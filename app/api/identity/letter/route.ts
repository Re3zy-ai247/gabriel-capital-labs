import { NextResponse } from "next/server";
import type { Bureau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { meteredMessage } from "@/lib/aiMeter";
import { enforceRateLimit } from "@/lib/rateLimit";
import { getEntitlement } from "@/lib/entitlements";
import { applyCompliance } from "@/lib/compliance";
import { encryptText } from "@/lib/docCrypto";
import { BUREAU_ADDRESS, BUREAU_LABEL } from "@/lib/bureaus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

interface Discrepancy {
  category: string;
  reportValue: string;
  yourValue: string;
  severity: string;
  explanation: string;
  bureaus?: string[];
}

// Premium: drafts a Personal Information correction letter to a bureau from the
// detected discrepancies, runs the compliance filter, and saves it like any letter.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceRateLimit(`identity-letter:${user.id}`, 20, 3600); // paid Opus letter — cost guard
  if (limited) return limited;

  const entitlement = await getEntitlement(user);
  if (!entitlement.premium) {
    return NextResponse.json(
      { error: "Generating correction letters is a Premium feature.", upgrade: true },
      { status: 402 }
    );
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "AI is not configured." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const discrepancies: Discrepancy[] = Array.isArray(body?.discrepancies) ? body.discrepancies : [];
  const bureau: Bureau = (["EQUIFAX", "EXPERIAN", "TRANSUNION"] as Bureau[]).includes(body?.bureau)
    ? body.bureau
    : "EQUIFAX";
  if (!discrepancies.length) {
    return NextResponse.json({ error: "No discrepancies to dispute." }, { status: 400 });
  }

  // Only dispute items the TARGET bureau actually reports — a letter to Equifax
  // must never contain Experian's or TransUnion's data. Items without bureau
  // attribution (legacy/unknown) are kept so nothing is silently dropped.
  const relevant = discrepancies.filter(
    (d) => !Array.isArray(d.bureaus) || d.bureaus.length === 0 || d.bureaus.includes(bureau)
  );
  if (!relevant.length) {
    return NextResponse.json(
      {
        error: `None of the detected items are reported by ${BUREAU_LABEL[bureau]}. Select the bureau that is actually reporting the inaccurate information.`,
      },
      { status: 400 }
    );
  }

  const consumerComplete = Boolean(user.fullName && user.addressLine1 && user.city && user.state && user.zip);
  const addr = BUREAU_ADDRESS[bureau];

  const system = [
    "You draft a Personal Information correction letter to a credit reporting agency for a consumer disputing INACCURATE personal information (names, addresses, employers) on their file.",
    "RULES:",
    "1. Request correction or deletion ONLY of personal information that is inaccurate or cannot be verified. Never guarantee outcomes.",
    "2. Ground in the listed discrepancies; do not invent new ones. Cite FCRA §611 (15 U.S.C. §1681i) reinvestigation and §607(b) (15 U.S.C. §1681e(b)) maximum-possible-accuracy.",
    "3. Professional, firm, non-threatening. No all-caps, no threats.",
    "4. Output ONLY the finished letter (sender block, date, recipient block, RE line, body listing each item, signature). No commentary.",
    "5. EVERY item listed below is reported by the SINGLE target bureau named in the prompt. Dispute only these items, address only that bureau, and do NOT mention, compare to, or include any other credit bureau or another bureau's data anywhere in the letter.",
  ].join("\n");

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const userPrompt = [
    `Consumer: ${user.fullName || "[YOUR FULL NAME]"}`,
    `Consumer address: ${user.addressLine1 || "[YOUR ADDRESS]"}, ${user.city || "[CITY]"}, ${user.state || "[ST]"} ${user.zip || "[ZIP]"}`,
    `Date: ${today}`,
    `Bureau (the ONLY bureau this letter addresses): ${BUREAU_LABEL[bureau]} — ${addr.name}, ${addr.lines.join(", ")}`,
    "",
    `Inaccurate personal information reported by ${BUREAU_LABEL[bureau]} to dispute (report value vs. correct value):`,
    ...relevant.map((d, i) => `${i + 1}. [${d.category}] report shows "${d.reportValue}"; correct is "${d.yourValue}" — ${d.explanation}`),
    "",
    "Draft the personal-information correction letter.",
  ].join("\n");

  try {
    const msg = await meteredMessage("identity-letter", user.id, {
      model: process.env.LLM_MODEL || "claude-opus-4-8",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: userPrompt }],
    } as any);
    const textBlock = (msg.content as any[]).find((c) => c.type === "text");
    const draft = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    if (!draft) return NextResponse.json({ error: "Could not draft the letter." }, { status: 500 });

    const { text, flags } = applyCompliance(draft);
    const letter = await prisma.letter.create({
      data: {
        userId: user.id,
        strategy: "personal_info",
        recipientType: "bureau",
        recipientName: addr.name,
        targetBureau: bureau,
        body: encryptText(text),
        complianceFlags: flags,
      },
    });
    // Persist ciphertext, return plaintext for immediate render.
    letter.body = text;

    return NextResponse.json({
      ok: true,
      letter,
      warning: consumerComplete ? null : "Complete your name and address in Settings before printing.",
    });
  } catch (e) {
    console.error("identity letter error", e);
    return NextResponse.json({ error: "Letter generation failed. Please try again." }, { status: 500 });
  }
}
