import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { meteredMessage } from "@/lib/aiMeter";
import { recordKaiEvent } from "@/lib/kaiEvents";
import { track, PRODUCT_EVENTS } from "@/lib/events";
import { enforceRateLimit } from "@/lib/rateLimit";
import {
  assertionsForContext,
  buildContext,
  renderTemplateLetter,
  buildSystemPrompt,
  buildUserPrompt,
  planLetterRegeneration,
  type ConsumerAssertionInput,
} from "@/lib/letter";
import { applyCompliance } from "@/lib/compliance";
import { encryptText } from "@/lib/docCrypto";
import { getEntitlement } from "@/lib/entitlements";
import { presentBureaus, getBureauData } from "@/lib/bureauData";
import { getFurnisherContact, formatFurnisherAddress } from "@/lib/furnisher";
import { BUREAU_LABEL } from "@/lib/bureaus";
import type { Bureau } from "@prisma/client";

export const maxDuration = 60;

const VALID: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

// One stable key per target, including the bureau-less furnisher/collector
// target. Mirrors planLetterRegeneration's own "__none__" convention.
const targetKey = (b: Bureau | undefined) => b ?? "__none__";

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
  recipient: { name?: string | null; address?: string | null } | undefined,
  // RC1-S4: the consumer's OWN confirmed statements of fact about this item.
  // Every factual concern in the letter derives from these and nothing else;
  // buildContext narrows them again per target bureau.
  assertions: ConsumerAssertionInput[]
) {
  const consumer = {
    fullName: user.fullName,
    addressLine1: user.addressLine1,
    city: user.city,
    state: user.state,
    zip: user.zip,
  };
  const ctx = buildContext(strategyId, tradeline, consumer, targetBureau, 1, recipient, {
    assertions,
    // Round 1 never carries a regulatory-complaint intent, and nothing in this
    // route may set one: it is the consumer's declaration to make, on the
    // round-2 path, through an explicit opt-in (see lib/round2.ts).
    complaintIntent: false,
  });
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

  // The signed-letter bar — this body is printed, signed and mailed by the
  // consumer, so it answers to the letter rules, not only the base ones.
  const { text, flags } = applyCompliance(body, { bar: "signed-letter" });
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
  recipient: { name?: string | null; address?: string | null } | undefined,
  assertions: ConsumerAssertionInput[]
) {
  const { ctx, text, flags, aiRefined } = await composeLetter(user, tradeline, strategyId, targetBureau, useAI, apiKey, recipient, assertions);
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
// against `updated`, never `created`, so the append-only ledger is untouched —
// the row was already counted once, at its original creation.
async function updateOne(
  user: GenerateUser,
  tradeline: any,
  strategyId: string,
  targetBureau: Bureau | undefined,
  useAI: boolean,
  apiKey: string | undefined,
  recipient: { name?: string | null; address?: string | null } | undefined,
  existingId: string,
  assertions: ConsumerAssertionInput[]
) {
  const { ctx, text, flags, aiRefined } = await composeLetter(user, tradeline, strategyId, targetBureau, useAI, apiKey, recipient, assertions);
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
// strategies.
//
// RC1-S6a: there is NO letter quota and no paid tier. What actually bounds this
// route is capability-neutral and stays exactly as S4/S5 left it: the consumer
// must have confirmed a fact that applies to each target (no confirmed fact, no
// letter), and the S1 rate/spend limits cap volume for everyone equally.
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

    // ---- RC1-S4 (P0-3 / L-02): THE CONSUMER CONFIRMS FIRST -------------------
    // Before this gate, the only inputs to a letter were a tradeline id and a
    // strategy id. Everything the letter then said in the consumer's first
    // person — including "I am unable to reconcile the reported status with my
    // records" — was composed from parsed report data the consumer had never
    // been asked about, and (the letter body being read-only) could not amend
    // before signing and mailing it.
    //
    // Now: no confirmed fact, no letter. This runs BEFORE the entitlement gate,
    // the credit spend and any AI call, so a refusal costs the consumer nothing
    // — no quota, no credit, no charge, no row.
    const assertions = await prisma.consumerAssertion.findMany({
      where: { userId: user.id, tradelineId: tradeline.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { assertionType: true, consumerNote: true, bureauScope: true, status: true },
    });
    if (assertions.length === 0) {
      return NextResponse.json(
        {
          error:
            "Before we draft anything in your name, tell us which fact on this account is wrong. Open the account on your Tradelines page, choose \u201cReview the facts,\u201d and confirm what you know to be inaccurate \u2014 we only write what you confirm.",
          // Machine-readable so the letters page can link straight to the item
          // instead of leaving the consumer to find it (S5 wires the link).
          needsAssertion: true,
          tradelineId: tradeline.id,
        },
        { status: 400 }
      );
    }

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

    // ---- RC1-S4 REMEDIATION H-1: THE GATE AND THE COMPOSER MUST AGREE --------
    // The check above asks "has this consumer confirmed anything about this
    // ACCOUNT". `buildContext` then narrows per RECIPIENT (assertionsForContext,
    // lib/letter.ts): a bureau letter may only speak from assertions scoped to
    // NULL or to that same bureau, because telling Equifax about a fact the
    // consumer confirmed only about their Experian file is the cross-bureau
    // violation this product exists to avoid.
    //
    // Those two questions are not the same one. A consumer who confirms "the
    // balance is wrong — only my Experian file" and then generates for all three
    // bureaus used to get three letters: one real, and two that asserted
    // nothing, contradicted themselves ("each disputed item" with no items), and
    // were charged for. Mailing a dispute that identifies nothing is exactly the
    // §1681i(a)(3) frivolous-determination hazard this letter engine is built to
    // avoid.
    //
    // So the narrowing happens HERE, per target, BEFORE anything is created,
    // updated or spent. A target with no applicable confirmation is not written.
    const assertionsByTarget = new Map<string, typeof assertions>();
    const validTargets: (Bureau | undefined)[] = [];
    const skippedBureaus: Bureau[] = [];
    for (const b of targets) {
      const applicable = assertionsForContext(assertions, { strategy: ctxProbe.strategy, targetBureau: b });
      assertionsByTarget.set(targetKey(b), applicable as typeof assertions);
      if (applicable.length > 0) validTargets.push(b);
      else if (b) skippedBureaus.push(b);
    }

    // Every requested target is unsupported → refuse outright, before the
    // entitlement gate and before any spend, exactly like the no-assertion case.
    if (validTargets.length === 0) {
      const scopes = Array.from(
        new Set(assertions.map((a) => (a.bureauScope ? BUREAU_LABEL[a.bureauScope] : null)).filter(Boolean) as string[])
      );
      const askedFor = skippedBureaus.map((b) => BUREAU_LABEL[b]);
      return NextResponse.json(
        {
          error:
            askedFor.length && scopes.length
              ? `You told us what\u2019s wrong on your ${scopes.join(" and ")} ${
                  scopes.length > 1 ? "files" : "file"
                }, but this letter is addressed to ${askedFor.join(" and ")}. Confirm what\u2019s wrong on ${
                  askedFor.length > 1 ? "those files" : "that file"
                } \u2014 or re-confirm it for every bureau reporting this account \u2014 and we\u2019ll draft it. Nothing was used up.`
              : "We don\u2019t have a confirmed fact that applies to the bureau this letter is addressed to. Confirm what\u2019s wrong on that file before we draft it. Nothing was used up.",
          needsAssertion: true,
          tradelineId: tradeline.id,
          // Machine-readable: which targets had no applicable confirmation.
          skippedBureaus,
        },
        { status: 400 }
      );
    }
    targets = validTargets;

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

    // RC1-S6a (S-01 / D-3): THE LETTER QUOTA IS GONE.
    //
    // This is where the 402 lived — "You've used all 3 free dispute letters this
    // month. Upgrade to Professional…" — together with a silent partial-success
    // cap that generated some of the requested letters, dropped the rest, and
    // attached an upgrade nudge to a 200. Both are removed: every consumer gets
    // every target they confirmed a fact for. Nothing here reads plan,
    // subscription, credits or who is paying.
    //
    // The entitlement is still resolved, for two non-commercial reasons: the AI
    // refinement switch (off for everyone, D-2) and the read-only snapshot the
    // client renders.
    const entitlement = await getEntitlement(user);
    const newTargets = toCreate;

    const key = process.env.ANTHROPIC_API_KEY;
    const updated: any[] = [];
    const created: any[] = [];
    let anyAI = false;
    let consumerComplete = true;
    let recipientComplete = true;
    for (const { target: b, existingId } of toUpdate) {
      const r = await updateOne(user, tradeline as any, strategyId, b, entitlement.aiRefinement, key, recipient, existingId, assertionsByTarget.get(targetKey(b)) ?? []);
      updated.push(r.letter);
      anyAI = anyAI || r.aiRefined;
      consumerComplete = consumerComplete && r.consumerComplete;
      recipientComplete = recipientComplete && r.recipientComplete;
    }
    for (const b of newTargets) {
      const r = await generateOne(user, tradeline as any, strategyId, b, entitlement.aiRefinement, key, recipient, assertionsByTarget.get(targetKey(b)) ?? []);
      created.push(r.letter);
      anyAI = anyAI || r.aiRefined;
      consumerComplete = consumerComplete && r.consumerComplete;
      recipientComplete = recipientComplete && r.recipientComplete;
    }

    // RC1-S6a (D-3): NOTHING IS SPENT HERE. Purchased letter credits are a frozen
    // historical balance — the credit-decrement path is not called from this route
    // at all, and a generation cycle leaves that balance byte-unchanged. The append-only
    // ledger below is history, not accounting: it records that letters were
    // written, and nothing consumes it.
    //
    // The append-only ledger only grows for NEW
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
      entitlement: after,
      consumerComplete,
      recipientComplete,
      // REMEDIATION H-1: which requested bureaus were NOT written, and why.
      // Never silently dropped, and never charged for.
      skippedBureaus,
      skippedReason: skippedBureaus.length
        ? `No confirmed fact of yours applies to ${skippedBureaus
            .map((b) => BUREAU_LABEL[b])
            .join(" or ")}, so ${skippedBureaus.length > 1 ? "those letters were" : "that letter was"} not drafted and nothing was used up for ${
            skippedBureaus.length > 1 ? "them" : "it"
          }.`
        : null,
      warning: skippedBureaus.length
        ? `Drafted for ${all.length} of ${all.length + skippedBureaus.length} bureaus. No confirmed fact of yours applies to ${skippedBureaus
            .map((b) => BUREAU_LABEL[b])
            .join(" or ")} \u2014 confirm what\u2019s wrong on that file and we\u2019ll draft it. Nothing was used up for it.`
        : !consumerComplete
        ? "Complete your Consumer Info (name + mailing address) before printing — the draft contains placeholders."
        : !recipientComplete
        ? "Add the furnisher/collector mailing address before printing — the draft still shows a [Furnisher mailing address] placeholder."
        : null,
    });
  } catch (e) {
    console.error("letter generation error", e);
    await track(PRODUCT_EVENTS.failure, { meta: { surface: "letter_generate" } });
    return NextResponse.json({ error: "Letter generation failed. Please try again." }, { status: 500 });
  }
}
