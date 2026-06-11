import { NextResponse } from "next/server";
import type { Bureau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { getEntitlement } from "@/lib/entitlements";
import { applyCompliance } from "@/lib/compliance";
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
}

// Premium: drafts a Personal Information correction letter to a bureau from the
// detected discrepancies, runs the compliance filter, and saves it like any letter.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const consumerComplete = Boolean(user.fullName && user.addressLine1 && user.city && user.state && user.zip);
  const addr = BUREAU_ADDRESS[bureau];

  const system = [
    "You draft a Personal Information correction letter to a credit reporting agency for a consumer disputing INACCURATE personal information (names, addresses, employers) on their file.",
    "RULES:",
    "1. Request correction or deletion ONLY of personal information that is inaccurate or cannot be verified. Never guarantee outcomes.",
    "2. Ground in the listed discrepancies; do not invent new ones. Cite FCRA §611 (15 U.S.C. §1681i) reinvestigation and §607(b) (15 U.S.C. §1681e(b)) maximum-possible-accuracy.",
    "3. Professional, firm, non-threatening. No all-caps, no threats.",
    "4. Output ONLY the finished letter (sender block, date, recipient block, RE line, body listing each item, signature). No commentary.",
  ].join("\n");

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const userPrompt = [
    `Consumer: ${user.fullName || "[YOUR FULL NAME]"}`,
    `Consumer address: ${user.addressLine1 || "[YOUR ADDRESS]"}, ${user.city || "[CITY]"}, ${user.state || "[ST]"} ${user.zip || "[ZIP]"}`,
    `Date: ${today}`,
    `Bureau: ${BUREAU_LABEL[bureau]} — ${addr.name}, ${addr.lines.join(", ")}`,
    "",
    "Inaccurate personal information to dispute (report value vs. correct value):",
    ...discrepancies.map((d, i) => `${i + 1}. [${d.category}] report shows "${d.reportValue}"; correct is "${d.yourValue}" — ${d.explanation}`),
    "",
    "Draft the personal-information correction letter.",
  ].join("\n");

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
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
        body: text,
        complianceFlags: flags,
      },
    });

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
