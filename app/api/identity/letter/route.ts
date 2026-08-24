import { NextResponse } from "next/server";
import type { Bureau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { meteredMessage } from "@/lib/aiMeter";
import { enforceRateLimit } from "@/lib/rateLimit";
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
  // RC1-S4 (L-09): the consumer's own per-item confirmation. Strictly `true` —
  // never truthy-coerced — and set only by the consumer ticking that one item.
  confirmed?: unknown;
}

// RC1-S4 (L-09) — PER-ITEM CONSUMER CONFIRMATION.
//
// THE DEFECT. `app/identity/page.tsx` posts the entire AI-produced
// `discrepancies` array, and the prompt below then tells the model, for each
// item, `report shows "X"; correct is "Y"`. "Correct is Y" is a factual
// assertion about the consumer's own legal name, addresses and employers,
// produced by DIFFING the report against a profile — the consumer never
// affirmed any of it item by item, yet they sign and mail the result.
//
// THE RULE NOW. An item is disputed only if the consumer confirmed THAT item.
// Unconfirmed items are dropped, not asserted; if nothing is confirmed the route
// refuses and says so plainly. No AI call is made in the refusal path.
//
// HANDOFF (precise — `app/identity/page.tsx` is NOT owned by this slice, so the
// checkbox does not exist yet and this route therefore refuses every current
// request from that page):
//   1. Each detected discrepancy renders an UNCHECKED checkbox worded as the
//      consumer's own statement, e.g. "I confirm my correct {category} is
//      \"{yourValue}\" and that the report is wrong."
//   2. The POST body sends `confirmed: true` on exactly the ticked items (the
//      whole array may still be sent; unticked items are simply dropped here).
//   3. The submit button stays disabled while nothing is ticked, so the 400
//      below is a backstop rather than the normal path.
// Until step 1 ships, the correction letter cannot be generated. That is the
// deliberate fail-closed direction: refusing to draft is recoverable, mailing an
// unaffirmed statement of fact about the consumer's identity is not.
function isConfirmed(d: Discrepancy): boolean {
  return d.confirmed === true;
}

// S11 B-6 bounds. 50 items is far past any real personal-information section
// (names, addresses and employers on one file), and 500 chars matches the
// consumer-note cap this product already uses for free text destined for a
// signed letter.
const DISCREPANCY_MAX = 50;
const DISCREPANCY_FIELD_MAX = 500;
const DISCREPANCY_TEXT_FIELDS = ["category", "reportValue", "yourValue", "severity", "explanation"] as const;

// Drafts a Personal Information correction letter to a bureau from the items the
// consumer confirmed, runs the compliance filter, and saves it like any letter.
//
// RC1-S6a (S-05 / P0-6): this route used to open with
// `if (!entitlement.premium) → 402 "Generating correction letters is a
// Professional feature."` — the analysis was free but the finished letter was
// sold. It is not sold any more, and no entitlement is read here at all. The
// gate that remains is S4's, and it is about truth rather than money: an item is
// disputed only if the consumer confirmed THAT item.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceRateLimit(`identity-letter:${user.id}`, 20, 3600); // Opus letter — cost guard, same for everyone
  if (limited) return limited;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "AI is not configured." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const rawDiscrepancies: Discrepancy[] = Array.isArray(body?.discrepancies) ? body.discrepancies : [];
  // ── S11 B-6 · BOUND THE CLIENT-SUPPLIED PROMPT ────────────────────────────
  // Every confirmed item below becomes a line of an Opus prompt, and the array
  // arrived straight from the request body with no element count and no
  // per-field length. `reserveDailyBudget` admits an account's FIRST call of the
  // day whatever the estimate (lib/aiMeter.ts), so one body-limit-sized array
  // could exceed the whole daily ceiling in a single request.
  //
  // Refused, not silently trimmed: an over-long personal-information value is a
  // statement about the consumer's own identity, and quietly cutting it in half
  // would change what they are about to sign — the same rule the consumer note
  // follows in app/api/tradelines/[id]/assertion/route.ts.
  if (rawDiscrepancies.length > DISCREPANCY_MAX) {
    return NextResponse.json(
      { error: `Dispute up to ${DISCREPANCY_MAX} personal-information items in one letter, then generate another for the rest.` },
      { status: 400 }
    );
  }
  const overLong = rawDiscrepancies.find((d) =>
    DISCREPANCY_TEXT_FIELDS.some((f) => typeof d?.[f] === "string" && (d[f] as string).length > DISCREPANCY_FIELD_MAX)
  );
  if (overLong) {
    return NextResponse.json(
      { error: `Each entry needs to be ${DISCREPANCY_FIELD_MAX} characters or fewer \u2014 the letter quotes them exactly as written.` },
      { status: 400 }
    );
  }
  const discrepancies: Discrepancy[] = rawDiscrepancies;
  const bureau: Bureau = (["EQUIFAX", "EXPERIAN", "TRANSUNION"] as Bureau[]).includes(body?.bureau)
    ? body.bureau
    : "EQUIFAX";
  if (!discrepancies.length) {
    return NextResponse.json({ error: "No discrepancies to dispute." }, { status: 400 });
  }

  // Only dispute items the TARGET bureau actually reports — a letter to Equifax
  // must never contain Experian's or TransUnion's data. Items without bureau
  // attribution (legacy/unknown) are kept so nothing is silently dropped.
  const reportedByTarget = discrepancies.filter(
    (d) => !Array.isArray(d.bureaus) || d.bureaus.length === 0 || d.bureaus.includes(bureau)
  );
  // RC1-S4 (L-09): and of those, ONLY the ones the consumer confirmed item by
  // item. Checked before the AI call, so a refusal costs nothing.
  const relevant = reportedByTarget.filter(isConfirmed);
  if (reportedByTarget.length && !relevant.length) {
    return NextResponse.json(
      {
        error:
          "Confirm each correction before we draft it. This letter states, in your name, what your correct personal information is \u2014 so you tell us which items are wrong and what the right value is; we never assert that for you.",
        needsConfirmation: true,
        // REMEDIATION M-5: an actionable, TRUTHFUL next step. The per-item
        // confirmation control does not exist on app/identity/page.tsx yet (that
        // file is outside this slice's ownership), so this says exactly that
        // rather than pointing at a control the consumer cannot find. It links
        // nowhere, because there is nowhere honest to link yet.
        nextStep:
          "Tick each correction you want disputed, then generate the letter. If you don\u2019t see a confirmation control beside each item yet, this letter can\u2019t be drafted \u2014 nothing has been charged, nothing about your report has changed, and your dispute letters for accounts are unaffected.",
        // Which items are still awaiting the consumer's confirmation, by their
        // index in the submitted array, so the UI can point at them exactly.
        unconfirmed: discrepancies
          .map((d, i) => (reportedByTarget.includes(d) && !isConfirmed(d) ? i : -1))
          .filter((i) => i >= 0),
      },
      { status: 400 }
    );
  }
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
    "6. EVERY item listed below was confirmed by the consumer personally, item by item. State ONLY those items. Do not add an item, do not generalize one into a broader claim about the consumer's identity or history, and do not introduce any first-person statement the list does not support.",
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

    // The signed-letter bar — this body is printed, signed and mailed.
    const { text, flags } = applyCompliance(draft, { bar: "signed-letter" });
    const letter = await prisma.letter.create({
      data: {
        userId: user.id,
        // RC1-S4 (L-09): was "personal_info", which is NOT a member of
        // STRATEGIES (lib/strategies.ts). Harmless while this route bypasses
        // buildContext, but any future path through buildContext would silently
        // fall back to fcra_611 anyway — and every reader that looks the id up
        // (the letters list, outcome tracking) gets an unknown key today. This
        // letter IS a §611 reinvestigation request addressed to a bureau, which
        // is exactly what fcra_611 denotes, so it records that.
        // A dedicated "personal_info" strategy entry would be more precise; it
        // belongs in lib/strategies.ts, which this slice does not own.
        strategy: "fcra_611",
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
