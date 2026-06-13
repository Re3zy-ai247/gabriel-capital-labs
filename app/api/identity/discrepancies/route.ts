import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { decryptDocument, docCryptoReady } from "@/lib/docCrypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Compares the consumer's verified identity (from Settings) against the Personal
// Information section of their most recent credit report to surface inaccurate
// names, addresses, and employers they can dispute first. Grounded — never
// invents data. Available to all signed-in users (the correction LETTER is premium).
// Each reported item / discrepancy carries the bureau(s) actually reporting it,
// so the UI can show attribution and a correction letter can target one bureau.
const BUREAUS = { type: "array", items: { type: "string", enum: ["EQUIFAX", "EXPERIAN", "TRANSUNION"] } } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reportedNames: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { value: { type: "string" }, bureaus: BUREAUS },
        required: ["value", "bureaus"],
      },
    },
    reportedAddresses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          value: { type: "string" },
          bureaus: BUREAUS,
          status: { type: "string", description: "Current, Former, or empty string if not shown" },
        },
        required: ["value", "bureaus", "status"],
      },
    },
    reportedEmployers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { value: { type: "string" }, bureaus: BUREAUS },
        required: ["value", "bureaus"],
      },
    },
    discrepancies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: ["name", "address", "employer", "dob", "other"] },
          reportValue: { type: "string" },
          yourValue: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          explanation: { type: "string" },
          bureaus: BUREAUS,
        },
        required: ["category", "reportValue", "yourValue", "severity", "explanation", "bureaus"],
      },
    },
  },
  required: ["reportedNames", "reportedAddresses", "reportedEmployers", "discrepancies"],
} as const;

export async function POST() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identityComplete = Boolean(user.fullName && user.addressLine1 && user.city && user.state && user.zip);
  if (!identityComplete) {
    return NextResponse.json({ needsIdentity: true });
  }

  const report = await prisma.report.findFirst({
    where: { userId: user.id, rawText: { not: null } },
    orderBy: { uploadedAt: "desc" },
  });
  if (!report?.rawText) {
    return NextResponse.json({ needsReport: true });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ needsAI: true });

  const identity = [
    `Name: ${user.fullName}`,
    `Address: ${user.addressLine1}${user.addressLine2 ? ", " + user.addressLine2 : ""}, ${user.city}, ${user.state} ${user.zip}`,
  ].join("\n");

  // Pull in the consumer's uploaded government ID (front/back images) so the AI
  // can read the ID directly and compare it against the report — not just the
  // typed Settings identity. Images are decrypted in-memory and never persisted.
  const idImages: { media_type: string; data: string }[] = [];
  if (docCryptoReady()) {
    const idDocs = await prisma.document.findMany({
      where: { userId: user.id, type: { in: ["GOV_ID_FRONT", "GOV_ID_BACK"] } },
    });
    for (const d of idDocs) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(d.mimeType)) continue;
      try {
        const buf = decryptDocument({
          ciphertext: Buffer.from(d.ciphertext),
          iv: Buffer.from(d.iv),
          authTag: Buffer.from(d.authTag),
        });
        idImages.push({ media_type: d.mimeType, data: buf.toString("base64") });
      } catch {
        /* skip an unreadable image */
      }
    }
  }
  const usedId = idImages.length > 0;

  const system = [
    "You compare a consumer's VERIFIED identity against the Personal Information section of their credit report to surface inaccuracies they may dispute.",
    usedId
      ? "You are given one or more GOVERNMENT ID images. Read the legal name, address, and date of birth printed on the ID and treat the ID as the most authoritative source of the consumer's verified identity (corroborated by the typed identity below)."
      : "",
    "RULES:",
    "1. Extract reported names/AKAs, addresses, and employers strictly from the report text. Never invent anything not present.",
    "2. Flag a discrepancy only when the report shows something that conflicts with or is absent from the verified identity: misspelled or variant names, addresses other than the verified current address, unknown/outdated employers.",
    usedId
      ? "2a. When the report's name or address conflicts with what is printed on the government ID, treat it as HIGH severity and note in the explanation that it differs from the consumer's government-issued identification."
      : "",
    "3. Severity: 'high' = clearly wrong/unrecognized (e.g., a misspelled name, an address the consumer never lived at); 'medium' = plausibly outdated (an old address/employer); 'low' = minor formatting.",
    "4. Be precise and conservative — do not invent discrepancies. An old address the consumer genuinely had is medium severity, not high.",
    "5. In each explanation, note the FCRA basis briefly (inaccurate personal information undermines maximum-possible-accuracy under §1681e(b) and is disputable under §611).",
    "6. BUREAU ATTRIBUTION IS CRITICAL. This is a THREE-BUREAU report with separate columns/sections for Equifax, Experian, and TransUnion. For every reported name, address, and employer, populate its `bureaus` array with ONLY the bureau column(s) that actually show that value. Never attribute a value to a bureau whose cell shows 'N/A', 'No', or is blank.",
    "7. For each discrepancy, set `bureaus` to the bureau(s) reporting that INACCURATE value — this decides which bureau the dispute goes to. If two bureaus report the same wrong value, list both. If different bureaus report different wrong values, emit SEPARATE discrepancies so each is tied to the bureau actually reporting it. Do NOT lump another bureau's data under a bureau that does not report it.",
    "8. For addresses, set `status` to 'Current' or 'Former' exactly as that bureau's Status row shows (empty string if not shown). An address marked 'Current' by one bureau but conflicting with the verified ID is high severity for THAT bureau only.",
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    "VERIFIED IDENTITY (typed by the consumer):",
    identity,
    "",
    "CREDIT REPORT TEXT (find the Personal Information / consumer identification section):",
    report.rawText.slice(0, 120_000),
  ].join("\n");

  // Multimodal content: ID image(s) first (when present), then the text prompt.
  const content: any[] = [];
  if (usedId) {
    content.push({
      type: "text",
      text: "GOVERNMENT ID IMAGE(S) — read the name, address, and date of birth shown and use them as the authoritative verified identity:",
    });
    for (const img of idImages) {
      content.push({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } });
    }
  }
  content.push({ type: "text", text: userPrompt });

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: process.env.LLM_MODEL || "claude-opus-4-8",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    } as any);
    const textBlock = (msg.content as any[]).find((c) => c.type === "text");
    if (!textBlock || !("text" in textBlock)) {
      return NextResponse.json({ error: "Could not analyze. Try again." }, { status: 500 });
    }
    const parsed = JSON.parse(textBlock.text);
    return NextResponse.json({ ok: true, usedId, ...parsed });
  } catch (e) {
    console.error("discrepancy detection error", e);
    return NextResponse.json({ error: "Identity analysis failed. Please try again." }, { status: 500 });
  }
}
