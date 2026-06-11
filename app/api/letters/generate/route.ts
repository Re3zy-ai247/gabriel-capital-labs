import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { buildContext, renderTemplateLetter, buildSystemPrompt, buildUserPrompt } from "@/lib/letter";
import { applyCompliance } from "@/lib/compliance";
import type { Bureau } from "@prisma/client";

// Generates a dispute letter. Strategy: build a grounded deterministic draft,
// optionally refine it with an LLM, then ALWAYS run the compliance filter.
// Robust: if the LLM key is missing or the call fails, the grounded draft is used.
export async function POST(req: Request) {
  try {
    const user = await currentUserOrDemo();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tradelineId, strategyId, targetBureau } = await req.json();
    const tradeline = await prisma.tradeline.findFirst({ where: { id: tradelineId, userId: user.id } });
    if (!tradeline) return NextResponse.json({ error: "Tradeline not found" }, { status: 404 });

    const consumer = {
      fullName: user.fullName,
      addressLine1: user.addressLine1,
      city: user.city,
      state: user.state,
      zip: user.zip,
    };

    const ctx = buildContext(strategyId, tradeline as any, consumer, targetBureau as Bureau | undefined);
    let body = renderTemplateLetter(tradeline as any, ctx, consumer);

    // Optional LLM refinement
    const key = process.env.ANTHROPIC_API_KEY;
    if (key) {
      try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey: key });
        const msg = await client.messages.create({
          model: process.env.LLM_MODEL || "claude-sonnet-4-6",
          max_tokens: 2000,
          system: buildSystemPrompt(),
          messages: [{ role: "user", content: buildUserPrompt(tradeline as any, ctx, body) }],
        });
        const text = msg.content.find((c) => c.type === "text");
        if (text && "text" in text && text.text.trim().length > 100) body = text.text.trim();
      } catch (e) {
        console.error("LLM refinement failed, using grounded draft:", e);
      }
    }

    // Compliance pass ALWAYS runs on the final text.
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

    return NextResponse.json({
      ok: true,
      letter,
      consumerComplete: ctx.consumerComplete,
      warning: ctx.consumerComplete
        ? null
        : "Complete your Consumer Info (name + mailing address) before printing — this draft contains placeholders.",
    });
  } catch (e) {
    console.error("letter generation error", e);
    return NextResponse.json({ error: "Letter generation failed. Please try again." }, { status: 500 });
  }
}
