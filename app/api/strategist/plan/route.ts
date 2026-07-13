import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { meteredMessage } from "@/lib/aiMeter";
import { enforceRateLimit } from "@/lib/rateLimit";
import { getEntitlement } from "@/lib/entitlements";
import { STRATEGIES } from "@/lib/strategies";
import { formatCents } from "@/lib/utils";

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
      { error: "The AI action plan is a Premium feature.", upgrade: true },
      { status: 402 }
    );
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "AI is not configured. Add ANTHROPIC_API_KEY to enable the action plan." },
      { status: 503 }
    );
  }

  const tradelines = await prisma.tradeline.findMany({
    where: { userId: user.id },
    orderBy: { score: "desc" },
  });
  const queue = tradelines.filter((t) => t.probability !== "NOT_RECOMMENDED");
  if (!queue.length) {
    return NextResponse.json({ error: "No disputable items yet. Upload a report first." }, { status: 400 });
  }

  const itemLines = queue
    .map(
      (t, i) =>
        `${i + 1}. ${t.creditorName} — ${t.accountType}${t.isDebtBuyer ? " (debt buyer)" : ""}, ` +
        `${formatCents(t.balance)}, priority ${t.probability}, score ${t.score}. ` +
        `Key reason: ${t.reasons[0] || "—"}. Angle: ${t.disputeAngles[0] || "standard reinvestigation"}.`
    )
    .join("\n");

  const strategyCatalog = STRATEGIES.map((s) => `- ${s.id}: ${s.label} (${s.recipient}) — ${s.blurb}`).join("\n");

  const system = [
    "You are an expert consumer-credit dispute strategist. You produce a prioritized, plain-English 90-day action plan for a consumer disputing their OWN credit report.",
    "RULES:",
    "1. Ground every recommendation in the provided scored items. Never invent accounts, balances, or facts.",
    "2. Recommend a specific strategy (by name) from the catalog for each item, and explain in one line WHY it fits (account type, debt-buyer status, age).",
    "3. Sequence the work across Month 1 (highest-impact disputes), Month 2 (responses & escalations), Month 3 (resolution / CFPB). Advise certified mail and keeping copies.",
    "4. NEVER guarantee deletions, score increases, or outcomes. This is educational, not legal advice.",
    "5. Be concise and skimmable — short sections and bullet points. No preamble.",
  ].join("\n");

  const userPrompt = [
    "Here are my scored, disputable items (highest priority first):",
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
    return NextResponse.json({ ok: true, plan, items: queue.length });
  } catch (e) {
    console.error("strategist plan error", e);
    return NextResponse.json({ error: "Plan generation failed. Please try again." }, { status: 500 });
  }
}
