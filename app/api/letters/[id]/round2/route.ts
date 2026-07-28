import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { meteredMessage } from "@/lib/aiMeter";
import { enforceRateLimit } from "@/lib/rateLimit";
import { buildContext, renderTemplateLetter, buildSystemPrompt } from "@/lib/letter";
import { buildRound2UserPrompt, type ResponseAnalysis } from "@/lib/round2";
import { applyCompliance } from "@/lib/compliance";
import { encryptText, decryptText } from "@/lib/docCrypto";
import { getEntitlement, canGenerateLetter, spendLetterCredits } from "@/lib/entitlements";
import { track, PRODUCT_EVENTS } from "@/lib/events";
import type { Bureau } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Generates a Round 2 escalation letter that follows up on a prior dispute whose
// response has been logged. Targets the inadequacy of the bureau's reinvestigation
// and demands the method of verification under FCRA §611(a)(7).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceRateLimit(`letters-round2:${user.id}`, 20, 3600); // paid Opus escalation letter — cost guard
  if (limited) return limited;

  const parent = await prisma.letter.findFirst({
    where: { id: params.id, userId: user.id },
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
      { error: "This item was reported deleted — no escalation needed. 🎉" },
      { status: 400 }
    );
  }
  if (!parent.tradeline) {
    return NextResponse.json({ error: "The disputed account no longer exists." }, { status: 400 });
  }

  // Entitlement: a Round 2 letter counts against the monthly allowance.
  const entitlement = await getEntitlement(user);
  const gate = canGenerateLetter(entitlement);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, upgrade: true, entitlement }, { status: 402 });
  }

  const consumer = {
    fullName: user.fullName,
    addressLine1: user.addressLine1,
    city: user.city,
    state: user.state,
    zip: user.zip,
  };

  // Escalation strategy, aimed at the same bureau as the original. The round
  // increments from the parent so the tone ladder advances (R2 demands method of
  // verification; R4+ adopt the regulatory-review framing).
  const ctx = buildContext(
    "escalation",
    parent.tradeline as any,
    consumer,
    (parent.targetBureau as Bureau) ?? undefined,
    parent.round + 1
  );
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
        body = text.text.trim();
        aiRefined = true;
      }
    } catch (e) {
      console.error("round 2 refinement failed, using grounded draft:", e);
    }
  }

  const { text, flags } = applyCompliance(body);
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

  // A Round 2 letter consumes entitlement on the SAME terms as /api/letters/generate:
  // it spends a purchased credit past the free allowance, and it is metered on the
  // append-only ledger that lib/entitlements reads back as monthly usage. Without both,
  // every escalation letter was free and invisible to the meter.
  await spendLetterCredits(user.id, entitlement, 1);
  await track(PRODUCT_EVENTS.disputeCreated, { userId: user.id, meta: { count: 1, aiRefined } });

  const after = await getEntitlement(user);
  return NextResponse.json({ ok: true, letter, aiRefined, entitlement: after });
}
