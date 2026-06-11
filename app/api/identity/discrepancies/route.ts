import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Compares the consumer's verified identity (from Settings) against the Personal
// Information section of their most recent credit report to surface inaccurate
// names, addresses, and employers they can dispute first. Grounded — never
// invents data. Available to all signed-in users (the correction LETTER is premium).
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reportedNames: { type: "array", items: { type: "string" } },
    reportedAddresses: { type: "array", items: { type: "string" } },
    reportedEmployers: { type: "array", items: { type: "string" } },
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
        },
        required: ["category", "reportValue", "yourValue", "severity", "explanation"],
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

  const system = [
    "You compare a consumer's VERIFIED identity against the Personal Information section of their credit report to surface inaccuracies they may dispute.",
    "RULES:",
    "1. Extract reported names/AKAs, addresses, and employers strictly from the report text. Never invent anything not present.",
    "2. Flag a discrepancy only when the report shows something that conflicts with or is absent from the verified identity: misspelled or variant names, addresses other than the verified current address, unknown/outdated employers.",
    "3. Severity: 'high' = clearly wrong/unrecognized (e.g., a misspelled name, an address the consumer never lived at); 'medium' = plausibly outdated (an old address/employer); 'low' = minor formatting.",
    "4. Be precise and conservative — do not invent discrepancies. An old address the consumer genuinely had is medium severity, not high.",
    "5. In each explanation, note the FCRA basis briefly (inaccurate personal information undermines maximum-possible-accuracy under §1681e(b) and is disputable under §611).",
  ].join("\n");

  const userPrompt = [
    "VERIFIED IDENTITY:",
    identity,
    "",
    "CREDIT REPORT TEXT (find the Personal Information / consumer identification section):",
    report.rawText.slice(0, 120_000),
  ].join("\n");

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: process.env.LLM_MODEL || "claude-opus-4-8",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    } as any);
    const textBlock = (msg.content as any[]).find((c) => c.type === "text");
    if (!textBlock || !("text" in textBlock)) {
      return NextResponse.json({ error: "Could not analyze. Try again." }, { status: 500 });
    }
    const parsed = JSON.parse(textBlock.text);
    return NextResponse.json({ ok: true, ...parsed });
  } catch (e) {
    console.error("discrepancy detection error", e);
    return NextResponse.json({ error: "Identity analysis failed. Please try again." }, { status: 500 });
  }
}
