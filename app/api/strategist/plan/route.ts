import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { meteredMessage } from "@/lib/aiMeter";
import { enforceRateLimit } from "@/lib/rateLimit";
import { getEntitlement } from "@/lib/entitlements";
import { STRATEGIES } from "@/lib/strategies";
import { formatCents } from "@/lib/utils";
import { track, PRODUCT_EVENTS } from "@/lib/events";
// The SAME fact test the Tradelines page and Strategy Desk use for "is this an
// actual negative" — imported, never re-implemented, so the plan can never
// disagree with the screen the consumer just read.
import { isFactualNegative } from "@/lib/intelligence/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Premium: an AI-generated, personalized dispute action plan grounded strictly
// in the user's own scored tradelines. Educational, no guarantees.
export async function POST() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Per-user cap before the (expensive) Opus call.
  const limited = await enforceRateLimit(`strategist:${user.id}`, 10, 3600);
  if (limited) return limited;

  const entitlement = await getEntitlement(user);
  if (!entitlement.premium) {
    return NextResponse.json(
      { error: "The Action Plan is a Professional feature.", upgrade: true },
      { status: 402 }
    );
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "KAI isn't configured for this deployment yet, so the action plan can't be generated." },
      { status: 503 }
    );
  }

  const tradelines = await prisma.tradeline.findMany({
    where: { userId: user.id },
    orderBy: { score: "desc" },
  });
  // The plan queue is built from the SAME fact test the UI applies, not from
  // the `probability` band. The band gives every non-government account a
  // nonzero "worth a look" score regardless of payment history, so filtering on
  // it alone handed the model clean, never-late accounts labelled "my scored,
  // disputable items" — a plan telling the consumer to open a reinvestigation
  // against an account this same product shows as being in good standing.
  const queue = tradelines.filter((t) => t.probability !== "NOT_RECOMMENDED" && isFactualNegative(t));
  if (!queue.length) {
    return NextResponse.json(
      {
        error: tradelines.length
          ? "I don't have an item on your file I can honestly build a dispute plan around yet — nothing on it shows a derogatory status I can point to. If you know something on your report is wrong, start from that account's row."
          : "No analyzed accounts yet. Upload a report first.",
      },
      { status: 400 }
    );
  }

  const itemLines = queue
    .map((t, i) => {
      // No invented angle. The engine produced one or it did not. The generic
      // placeholder this used to substitute told the model there were grounds
      // we never found, and it wrote the plan as if there were.
      const angle = t.disputeAngles[0];
      return (
        `${i + 1}. ${t.creditorName} — ${t.accountType}${t.isDebtBuyer ? " (debt buyer)" : ""}, ` +
        `${formatCents(t.balance)}, priority ${t.probability}, score ${t.score}. ` +
        `Key reason: ${t.reasons[0] || "none recorded"}. ` +
        (angle ? `Angle: ${angle}.` : "Angle: none identified by the analysis.")
      );
    })
    .join("\n");

  const strategyCatalog = STRATEGIES.map((s) => `- ${s.id}: ${s.label} (${s.recipient}) — ${s.blurb}`).join("\n");

  const system = [
    "You are Kai, the Credit Intelligence Officer for CreditVector — a calm, evidence-driven credit analyst, not a chatbot. You produce a prioritized, plain-English 90-day action plan for a consumer disputing their OWN credit report. Brief the user like an analyst: direct, specific, and educational; never hype, upsell, or imply a guaranteed outcome. If you refer to yourself at all, it is only as Kai — never name an underlying AI model, provider, or vendor.",
    "RULES:",
    "1. Ground every recommendation in the provided scored items. Never invent accounts, balances, or facts.",
    "2. Recommend a specific strategy (by name) from the catalog for each item, and explain in one line WHY it fits (account type, debt-buyer status, age).",
    "3. Sequence the work across Month 1 (highest-impact disputes), Month 2 (responses & escalations), Month 3 (resolution / CFPB). Advise certified mail and keeping copies.",
    "4. NEVER guarantee deletions, score increases, or outcomes. This is educational, not legal advice.",
    "5. Be concise and skimmable — short sections and bullet points. No preamble.",
    "6. An item listed with 'Angle: none identified by the analysis.' has no dispute angle the engine could find. Do NOT invent one. Say plainly that nothing in the extracted data supports a specific challenge yet, and that the next step is for the consumer to check that item against their own records — they are the authority on what is accurate.",
    "7. Never state or imply that an item is inaccurate. The consumer decides what is inaccurate; you explain what the report shows and what the process is.",
  ].join("\n");

  const userPrompt = [
    "Here are the items from my report that show a derogatory status (highest priority first):",
    itemLines,
    "",
    "Available strategies:",
    strategyCatalog,
    "",
    "Write my prioritized 90-day dispute action plan.",
  ].join("\n");

  try {
    const msg = await meteredMessage("strategist", user.id, {
      model: process.env.LLM_MODEL || "claude-opus-4-8",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: userPrompt }],
    } as any);
    const textBlock = (msg.content as any[]).find((c) => c.type === "text");
    const plan = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    if (!plan) return NextResponse.json({ error: "Could not generate a plan. Try again." }, { status: 500 });
    await track(PRODUCT_EVENTS.strategyGenerated, { userId: user.id, meta: { items: queue.length } });
    return NextResponse.json({ ok: true, plan, items: queue.length });
  } catch (e) {
    console.error("strategist plan error", e);
    await track(PRODUCT_EVENTS.failure, { userId: user.id, meta: { surface: "strategist_plan" } });
    return NextResponse.json({ error: "Plan generation failed. Please try again." }, { status: 500 });
  }
}
