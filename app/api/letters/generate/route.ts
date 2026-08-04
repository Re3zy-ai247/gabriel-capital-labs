import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { meteredMessage } from "@/lib/aiMeter";
import { recordKaiEvent } from "@/lib/kaiEvents";
import { track, PRODUCT_EVENTS } from "@/lib/events";
import { enforceRateLimit } from "@/lib/rateLimit";
import { buildContext, renderTemplateLetter, buildSystemPrompt, buildUserPrompt, planLetterRegeneration } from "@/lib/letter";
import { applyCompliance } from "@/lib/compliance";
import { encryptText } from "@/lib/docCrypto";
import { getEntitlement, spendLetterCredits } from "@/lib/entitlements";
import { presentBureaus, getBureauData } from "@/lib/bureauData";
import { getFurnisherContact, formatFurnisherAddress } from "@/lib/furnisher";
import type { Bureau } from "@prisma/client";

export const maxDuration = 60;

const VALID: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

type GenerateUser = {
  id: string;
  fullName: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

// Shared compose step (grounded draft + optional AI refinement + compliance
// pass) for BOTH a brand-new letter and an RB-6 in-place regenerate — the only
// difference between the two callers is whether they create or update the
// Letter row afterward.
async function composeLetter(
  user: GenerateUser,
  tradeline: any,
  strategyId: string,
  targetBureau: Bureau | undefined,
  useAI: boolean,
  apiKey: string | undefined,
  recipient?: { name?: string | null; address?: string | null }
) {
  const consumer = {
    fullName: user.fullName,
    addressLine1: user.addressLine1,
    city: user.city,
    state: user.state,
    zip: user.zip,
  };
  const ctx = buildContext(strategyId, tradeline, consumer, targetBureau, 1, recipient);
  let body = renderTemplateLetter(tradeline, ctx, consumer);
  let aiRefined = false;

  if (useAI && apiKey) {
    try {
      const msg = await meteredMessage("letter-generate", user.id, {
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
  return { ctx, text, flags, aiRefined };
}

// Build + AI-refine + compliance-check + persist a NEW letter for one bureau.
async function generateOne(
  user: GenerateUser,
  tradeline: any,
  strategyId: string,
  targetBureau: Bureau | undefined,
  useAI: boolean,
  apiKey: string | undefined,
  recipient?: { name?: string | null; address?: string | null }
) {
  const { ctx, text, flags, aiRefined } = await composeLetter(user, tradeline, strategyId, targetBureau, useAI, apiKey, recipient);
  const letter = await prisma.letter.create({
    data: {
      userId: user.id,
      tradelineId: tradeline.id,
      strategy: ctx.strategy.id,
      recipientType: ctx.strategy.recipient,
      recipientName: ctx.recipientName,
      targetBureau: ctx.targetBureau ?? null,
      body: encryptText(text),
      complianceFlags: flags,
    },
  });
  await recordKaiEvent(user.id, "letter.generated", {
    refType: "letter",
    refId: letter.id,
    payload: { strategy: ctx.strategy.id, recipient: ctx.recipientName, aiRefined },
  });
  // Persist ciphertext, but hand the caller/client the plaintext body it needs to render.
  letter.body = text;
  return { letter, aiRefined, consumerComplete: ctx.consumerComplete, recipientComplete: ctx.recipientComplete };
}

// RB-6 idempotent regenerate: UPDATE an existing UNMAILED letter in place —
// fresh body composed from CURRENT inputs, same row id, createdAt untouched
// (Letter has no updatedAt field to set either — see prisma/schema.prisma).
// Only ever called for a target planLetterRegeneration matched to an unmailed
// row (never a mailed one — see lib/letter.ts). No credit spend, no
// dispute_created event here: the caller (POST below) only counts this
// against `updated`, never `created`, so the monthly ledger and purchased
// credits are untouched — the row was already counted once, at its original
// creation.
async function updateOne(
  user: GenerateUser,
  tradeline: any,
  strategyId: string,
  targetBureau: Bureau | undefined,
  useAI: boolean,
  apiKey: string | undefined,
  recipient: { name?: string | null; address?: string | null } | undefined,
  existingId: string
) {
  const { ctx, text, flags, aiRefined } = await composeLetter(user, tradeline, strategyId, targetBureau, useAI, apiKey, recipient);
  const letter = await prisma.letter.update({
    where: { id: existingId },
    data: {
      recipientType: ctx.strategy.recipient,
      recipientName: ctx.recipientName,
      targetBureau: ctx.targetBureau ?? null,
      body: encryptText(text),
      complianceFlags: flags,
      // A stale PRINTED status would otherwise imply the printed page still
      // matches this content; GENERATED is honest for a freshly-recomposed body.
      status: "GENERATED",
    },
  });
  await recordKaiEvent(user.id, "letter.generated", {
    refType: "letter",
    refId: letter.id,
    payload: { strategy: ctx.strategy.id, recipient: ctx.recipientName, aiRefined, regenerated: true },
  });
  letter.body = text;
  return { letter, aiRefined, consumerComplete: ctx.consumerComplete, recipientComplete: ctx.recipientComplete };
}

// Generates one or more dispute letters — one per selected bureau for bureau-type
// strategies. Free tier is capped at 3 letters/month; AI refinement is premium-only.
export async function POST(req: Request) {
  try {
    const user = await currentUserOrDemo();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Per-user cap before any AI refinement / letter generation work.
    const limited = await enforceRateLimit(`letters:${user.id}`, 40, 3600);
    if (limited) return limited;

    const body = await req.json();
    const { tradelineId, strategyId } = body;
    const tradeline = await prisma.tradeline.findFirst({ where: { id: tradelineId, userId: user.id } });
    if (!tradeline) return NextResponse.json({ error: "Tradeline not found" }, { status: 404 });

    // Resolve the strategy's recipient to decide whether bureau targeting applies.
    const ctxProbe = buildContext(strategyId, tradeline as any, {}, undefined);
    const isBureau = ctxProbe.strategy.recipient === "bureau";

    // Furnisher/collector letters can carry a user-supplied recipient address so
    // the letter is mail-ready (bureau letters use the known bureau addresses).
    const recipient = isBureau
      ? undefined
      : {
          name: typeof body.recipientName === "string" ? body.recipientName : undefined,
          address: typeof body.recipientAddress === "string" ? body.recipientAddress : undefined,
        };

    // If the user left the address blank, fall back to the furnisher contact we
    // parsed from their report — so a mail-ready letter needs zero manual entry.
    if (recipient && !recipient.address?.trim()) {
      const contact = await getFurnisherContact(tradeline.id);
      const formatted = formatFurnisherAddress(contact);
      if (formatted) {
        recipient.address = formatted;
        if (!recipient.name?.trim() && contact?.name) recipient.name = contact.name;
      }
    }

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

    // Phase 1A-R RB-6: idempotent regenerate. Match each requested target
    // against any UNMAILED letter already on file for this exact tradeline +
    // strategy + round (round is always 1 here — round 2+ is the dedicated
    // /api/letters/[id]/round2 endpoint, untouched). A match means "the
    // operator is correcting a draft" — update it in place, never insert a
    // duplicate. planLetterRegeneration (lib/letter.ts, guard-tested) owns
    // the matching rule, including why a MAILED letter is never matched.
    const strategyKey = ctxProbe.strategy.id;
    const existingRoundOne = await prisma.letter.findMany({
      where: { userId: user.id, tradelineId: tradeline.id, strategy: strategyKey, round: 1 },
      select: { id: true, targetBureau: true, mailedAt: true },
    });
    const { toUpdate, toCreate } = planLetterRegeneration(targets, existingRoundOne);

    // Entitlement gate. Free tier: cap to the remaining monthly allowance —
    // but ONLY against toCreate (net-new rows). An update never consumes
    // quota (RB-6: fixing a letter must not cost a letter), so it is never
    // blocked by the quota gate either — a pure correction goes through even
    // at 0 remaining, as long as there's nothing NEW it also needs to create.
    // The common case (nothing on file yet) is byte-identical to the prior
    // gate: toCreate === targets and toUpdate is empty, so `!hasQuota` alone
    // decides, exactly as the old unconditional check did.
    const entitlement = await getEntitlement(user);
    const hasQuota = entitlement.lettersRemaining === null || entitlement.lettersRemaining > 0;
    if (toUpdate.length === 0 && toCreate.length > 0 && !hasQuota) {
      return NextResponse.json(
        {
          error: "You've used all 3 free dispute letters this month. Upgrade to Professional for unlimited letters and AI refinement.",
          upgrade: true,
          entitlement,
        },
        { status: 402 }
      );
    }
    let allowedNew = toCreate.length;
    let capped = false;
    if (entitlement.lettersRemaining !== null && toCreate.length > entitlement.lettersRemaining) {
      allowedNew = Math.max(0, entitlement.lettersRemaining);
      capped = true;
    }
    const newTargets = toCreate.slice(0, allowedNew);

    const key = process.env.ANTHROPIC_API_KEY;
    const updated: any[] = [];
    const created: any[] = [];
    let anyAI = false;
    let consumerComplete = true;
    let recipientComplete = true;
    for (const { target: b, existingId } of toUpdate) {
      const r = await updateOne(user, tradeline as any, strategyId, b, entitlement.aiRefinement, key, recipient, existingId);
      updated.push(r.letter);
      anyAI = anyAI || r.aiRefined;
      consumerComplete = consumerComplete && r.consumerComplete;
      recipientComplete = recipientComplete && r.recipientComplete;
    }
    for (const b of newTargets) {
      const r = await generateOne(user, tradeline as any, strategyId, b, entitlement.aiRefinement, key, recipient);
      created.push(r.letter);
      anyAI = anyAI || r.aiRefined;
      consumerComplete = consumerComplete && r.consumerComplete;
      recipientComplete = recipientComplete && r.recipientComplete;
    }

    // Spend purchased letter credits for anything beyond the free monthly allowance.
    // Clamped + conditionally guarded in lib/entitlements so the balance can never go
    // negative (a negative balance silently eats the next letter-pack purchase).
    // Only NEW rows spend — an update is free (RB-6: the burn never happens; no
    // refund logic needed because nothing was ever charged for it).
    await spendLetterCredits(user.id, entitlement, created.length);

    // Same reasoning: the append-only monthly ledger only grows for NEW
    // letters. Skipped entirely (not tracked-then-refunded) when a request is
    // a pure regenerate — RB-6's "the burn never happens", not a credit-back.
    if (created.length > 0) {
      await track(PRODUCT_EVENTS.disputeCreated, { userId: user.id, meta: { count: created.length, aiRefined: anyAI } });
    }

    const after = await getEntitlement(user);
    const all = [...updated, ...created];
    return NextResponse.json({
      ok: true,
      letters: all,
      letter: all[0], // convenience for single-letter callers
      count: all.length,
      updatedCount: updated.length, // additive — how many were regenerated in place
      createdCount: created.length, // additive — how many were brand-new rows
      aiRefined: anyAI,
      capped,
      upgrade: capped,
      entitlement: after,
      consumerComplete,
      recipientComplete,
      warning: !consumerComplete
        ? "Complete your Consumer Info (name + mailing address) before printing — the draft contains placeholders."
        : !recipientComplete
        ? "Add the furnisher/collector mailing address before printing — the draft still shows a [Furnisher mailing address] placeholder."
        : capped
        ? `Generated ${created.length} letter(s). You hit your free monthly limit — upgrade for unlimited letters.`
        : null,
    });
  } catch (e) {
    console.error("letter generation error", e);
    await track(PRODUCT_EVENTS.failure, { meta: { surface: "letter_generate" } });
    return NextResponse.json({ error: "Letter generation failed. Please try again." }, { status: 500 });
  }
}
