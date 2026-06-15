import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { buildContext, renderTemplateLetter, buildSystemPrompt, buildUserPrompt } from "@/lib/letter";
import { applyCompliance } from "@/lib/compliance";
import { getEntitlement } from "@/lib/entitlements";
import { presentBureaus, getBureauData } from "@/lib/bureauData";
import type { Bureau } from "@prisma/client";

export const maxDuration = 60;

const VALID: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

// Build + AI-refine + compliance-check + persist a single letter for one bureau.
async function generateOne(
  user: { id: string; fullName: string | null; addressLine1: string | null; city: string | null; state: string | null; zip: string | null },
  tradeline: any,
  strategyId: string,
  targetBureau: Bureau | undefined,
  useAI: boolean,
  apiKey: string | undefined
) {
  const consumer = {
    fullName: user.fullName,
    addressLine1: user.addressLine1,
    city: user.city,
    state: user.state,
    zip: user.zip,
  };
  const ctx = buildContext(strategyId, tradeline, consumer, targetBureau);
  let body = renderTemplateLetter(tradeline, ctx, consumer);
  let aiRefined = false;

  if (useAI && apiKey) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: process.env.LLM_MODEL || "claude-opus-4-8",
        max_tokens: 6000,
        thinking: { type: "adaptive" },
        system: buildSystemPrompt(ctx.round),
        messages: [{ role: "user", content: buildUserPrompt(tradeline, ctx, body) }],
      } as any);
      const text = msg.content.find((c: any) => c.type === "text");
      if (text && "text" in text && text.text.trim().length > 100) {
        body = text.text.trim();
        aiRefined = true;
      }
    } catch (e) {
      console.error("LLM refinement failed, using grounded draft:", e);
    }
  }

  const { text, flags } = applyCompliance(body);
  const letter = await prisma.letter.create({
    data: {
      userId: user.id,
      tradelineId: tradeline.id,
      strategy: ctx.strategy.id,
      recipientType: ctx.strategy.recipient,
      recipientName: ctx.recipientName,
      targetBureau: ctx.targetBureau ?? null,
      body: text,
      complianceFlags: flags,
    },
  });
  return { letter, aiRefined, consumerComplete: ctx.consumerComplete };
}

// Generates one or more dispute letters — one per selected bureau for bureau-type
// strategies. Free tier is capped at 3 letters/month; AI refinement is premium-only.
export async function POST(req: Request) {
  try {
    const user = await currentUserOrDemo();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { tradelineId, strategyId } = body;
    const tradeline = await prisma.tradeline.findFirst({ where: { id: tradelineId, userId: user.id } });
    if (!tradeline) return NextResponse.json({ error: "Tradeline not found" }, { status: 404 });

    // Resolve the strategy's recipient to decide whether bureau targeting applies.
    const ctxProbe = buildContext(strategyId, tradeline as any, {}, undefined);
    const isBureau = ctxProbe.strategy.recipient === "bureau";

    // Determine the target bureau list.
    let targets: (Bureau | undefined)[] = [undefined];
    if (isBureau) {
      const requested: Bureau[] = Array.isArray(body.targetBureaus)
        ? body.targetBureaus.filter((b: string): b is Bureau => VALID.includes(b as Bureau))
        : body.targetBureau && VALID.includes(body.targetBureau)
        ? [body.targetBureau]
        : [];
      const present = presentBureaus(getBureauData(tradeline.bureauData));
      const list = requested.length ? requested : present.length ? present : ["EQUIFAX" as Bureau];
      targets = list;
    }

    // Entitlement gate. Free tier: cap to the remaining monthly allowance.
    const entitlement = await getEntitlement(user);
    if (entitlement.lettersRemaining !== null && entitlement.lettersRemaining <= 0) {
      return NextResponse.json(
        {
          error: "You've used all 3 free dispute letters this month. Upgrade to Premium for unlimited letters and AI refinement.",
          upgrade: true,
          entitlement,
        },
        { status: 402 }
      );
    }
    let allowed = targets.length;
    let capped = false;
    if (entitlement.lettersRemaining !== null && targets.length > entitlement.lettersRemaining) {
      allowed = entitlement.lettersRemaining;
      capped = true;
    }
    const toGenerate = targets.slice(0, allowed);

    const key = process.env.ANTHROPIC_API_KEY;
    const created = [];
    let anyAI = false;
    let consumerComplete = true;
    for (const b of toGenerate) {
      const r = await generateOne(user, tradeline as any, strategyId, b, entitlement.aiRefinement, key);
      created.push(r.letter);
      anyAI = anyAI || r.aiRefined;
      consumerComplete = consumerComplete && r.consumerComplete;
    }

    // Spend purchased letter credits for anything beyond the free monthly allowance.
    if (!entitlement.premium && created.length > 0) {
      const fromCredits = Math.max(0, created.length - entitlement.freeMonthlyRemaining);
      if (fromCredits > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: { letterCredits: { decrement: fromCredits } },
        });
      }
    }

    const after = await getEntitlement(user);
    return NextResponse.json({
      ok: true,
      letters: created,
      letter: created[0], // convenience for single-letter callers
      count: created.length,
      aiRefined: anyAI,
      capped,
      upgrade: capped,
      entitlement: after,
      consumerComplete,
      warning: consumerComplete
        ? capped
          ? `Generated ${created.length} letter(s). You hit your free monthly limit — upgrade for unlimited letters.`
          : null
        : "Complete your Consumer Info (name + mailing address) before printing — the draft contains placeholders.",
    });
  } catch (e) {
    console.error("letter generation error", e);
    return NextResponse.json({ error: "Letter generation failed. Please try again." }, { status: 500 });
  }
}
