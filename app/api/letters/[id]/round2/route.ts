import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { meteredMessage } from "@/lib/aiMeter";
import { enforceRateLimit } from "@/lib/rateLimit";
import { buildContext, renderTemplateLetter, buildSystemPrompt } from "@/lib/letter";
import { buildRound2UserPrompt, type ResponseAnalysis } from "@/lib/round2";
import { applyCompliance } from "@/lib/compliance";
import { encryptText, decryptText } from "@/lib/docCrypto";
import { getEntitlement } from "@/lib/entitlements";
import { track, PRODUCT_EVENTS } from "@/lib/events";
import type { Bureau } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Generates a Round 2 escalation letter that follows up on a prior dispute whose
// response has been logged. Targets the inadequacy of the bureau's reinvestigation
// and demands the method of verification under FCRA §611(a)(7).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceRateLimit(`letters-round2:${user.id}`, 20, 3600); // paid Opus escalation letter — cost guard
  if (limited) return limited;

  // Optional JSON body — a caller that sends none (every caller before RC1-S5)
  // gets `{}` and therefore the conservative defaults.
  const payload = await req.json().catch(() => ({} as Record<string, unknown>));

  const { id } = await params;
  const parent = await prisma.letter.findFirst({
    where: { id, userId: user.id },
    include: { tradeline: true },
  });
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!parent.responseText) {
    return NextResponse.json(
      { error: "Log the bureau's response first, then generate Round 2." },
      { status: 400 }
    );
  }
  if (parent.responseOutcome === "deleted") {
    return NextResponse.json(
      { error: "This item was already reported deleted — no escalation needed." },
      { status: 400 }
    );
  }
  if (!parent.tradeline) {
    return NextResponse.json({ error: "The disputed account no longer exists." }, { status: 400 });
  }

  const consumer = {
    fullName: user.fullName,
    addressLine1: user.addressLine1,
    city: user.city,
    state: user.state,
    zip: user.zip,
  };

  // ---- RC1-S5 (S4 handoff): THE ROUND-2 GATE ------------------------------
  // Round 1 refuses to compose in the consumer's name from facts they never
  // confirmed (app/api/letters/generate/route.ts). Round 2 spends the SAME
  // allowance on a letter written in the same first person, so it answers to the
  // same rule — and until now a consumer with zero confirmations could spend an
  // allowance on a claim-free escalation.
  //
  // Same per-target semantics as round 1: `buildContext` narrows the ACTIVE
  // assertions through `assertionsForContext` for THIS recipient (a bureau
  // letter may only speak from assertions scoped to that bureau or to none), and
  // the gate reads the narrowed set — so the check and the composer can never
  // disagree. buildContext is pure, so running it here costs nothing.
  //
  // RC1-S4 (L-03): `complaintIntent` is the consumer's own opt-in, read with a
  // strict === true so no truthy value can assert it for them. Default false.
  const complaintIntent = payload?.complaintIntent === true;
  const assertions = await prisma.consumerAssertion.findMany({
    where: { userId: user.id, tradelineId: parent.tradelineId!, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { assertionType: true, consumerNote: true, bureauScope: true, status: true },
  });

  // Escalation strategy, aimed at the same bureau as the original. The round
  // increments from the parent so the tone ladder advances (R2 demands method of
  // verification; R4+ adopt the regulatory-review framing).
  const ctx = buildContext(
    "escalation",
    parent.tradeline as any,
    consumer,
    (parent.targetBureau as Bureau) ?? undefined,
    parent.round + 1,
    undefined,
    { assertions, complaintIntent }
  );

  // BEFORE the entitlement gate, the credit spend and any AI call, so a refusal
  // costs the consumer nothing — no quota, no credit, no charge, no row.
  if (ctx.assertions.length === 0) {
    return NextResponse.json(
      {
        error:
          "Before we draft anything in your name, tell us which fact on this account is wrong. Open the account on your Tradelines page, choose “Review the facts,” and confirm what you know to be inaccurate — we only write what you confirm.",
        needsAssertion: true,
        tradelineId: parent.tradelineId,
      },
      { status: 400 }
    );
  }

  // RC1-S6a (S-03 / D-3): THE ROUND-2 QUOTA IS GONE.
  //
  // This is where the payment-required refusal lived — the same "Upgrade to
  // Professional… or buy a letter pack" copy as round 1, plus an upgrade nudge. An
  // escalation is assistance, and assistance is free, so the only gate left is
  // the one above: the consumer must have confirmed a fact that applies to the
  // bureau this letter is addressed to.
  //
  // The entitlement is still read for the AI refinement switch (off for
  // everyone, D-2) and for the read-only snapshot returned to the client.
  const entitlement = await getEntitlement(user);

  let body = renderTemplateLetter(parent.tradeline as any, ctx, consumer);
  let aiRefined = false;

  const analysis: ResponseAnalysis | null = parent.responseAnalysis
    ? (() => {
        try {
          return JSON.parse(decryptText(parent.responseAnalysis));
        } catch {
          return null;
        }
      })()
    : null;

  const key = process.env.ANTHROPIC_API_KEY;
  if (entitlement.aiRefinement && key) {
    try {
      const msg = await meteredMessage("letter-round2", user.id, {
        model: process.env.LLM_MODEL || "claude-opus-4-8",
        max_tokens: 6000,
        thinking: { type: "adaptive" },
        system: buildSystemPrompt(ctx.round),
        messages: [
          {
            role: "user",
            content: buildRound2UserPrompt(parent.tradeline as any, ctx, body, decryptText(parent.responseText), analysis),
          },
        ],
      } as any);
      const text = msg.content.find((c: any) => c.type === "text");
      if (text && "text" in text && text.text.trim().length > 100) {
        const candidate = text.text.trim();
        // RC1-S5 REMEDIATION (review L-4): a REFUSE-severity rule is defined as
        // one no rewrite makes honest. Enforcing it only against what the
        // CONSUMER types, while silently rewriting and saving the same sentence
        // when the MODEL writes it, is the wrong way round. If the refinement
        // trips one, the refinement is discarded and the grounded template draft
        // is used instead — it asserts only what the consumer confirmed.
        if (applyCompliance(candidate, { bar: "signed-letter" }).refused.length > 0) {
          console.error("round 2 refinement tripped a REFUSE rule, using grounded draft");
        } else {
          body = candidate;
          aiRefined = true;
        }
      }
    } catch (e) {
      console.error("round 2 refinement failed, using grounded draft:", e);
    }
  }

  // The signed-letter bar — this body is printed, signed and mailed.
  const { text, flags } = applyCompliance(body, { bar: "signed-letter" });
  const letter = await prisma.letter.create({
    data: {
      userId: user.id,
      tradelineId: parent.tradelineId,
      strategy: "escalation",
      recipientType: ctx.strategy.recipient,
      recipientName: ctx.recipientName,
      targetBureau: ctx.targetBureau ?? null,
      round: parent.round + 1,
      parentLetterId: parent.id,
      body: encryptText(text),
      complianceFlags: flags,
    },
  });
  // Persist ciphertext, return plaintext for immediate render.
  letter.body = text;

  // RC1-S6a (D-3): nothing is spent. A Round 2 letter is recorded on the
  // append-only ledger on the same terms as /api/letters/generate — that is
  // history, so escalations stay visible — but no credit is consumed and
  // `letterCredits` is left byte-unchanged.
  await track(PRODUCT_EVENTS.disputeCreated, { userId: user.id, meta: { count: 1, aiRefined } });

  const after = await getEntitlement(user);
  return NextResponse.json({ ok: true, letter, aiRefined, entitlement: after });
}
