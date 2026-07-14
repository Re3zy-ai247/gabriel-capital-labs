import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { MailService } from "@/lib/mail";
import { recordDecision } from "@/lib/decisionRegistry";

export const dynamic = "force-dynamic";

// Confirm payment and queue the piece. MAIL_LIVE is OFF, so NO card is charged
// and NO provider is contacted: this records the payment INTENT and reaches
// QUEUED, then stops. Everything past QUEUED waits for live mail integration.
// Kai's downstream surfaces (Timeline, Case Memory) update from the mail.status
// events MailService emits on each transition; the Decision Registry records here.
export async function POST(_req: Request, { params }: { params: { mailId: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = new MailService();
  const m = await svc.getManifest(params.mailId);
  if (!m || m.userId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (m.status === "QUEUED") return NextResponse.json({ manifest: m }); // idempotent

  // Resumable + atomic-safe: markPaid and queueForProvider are two writes; if the
  // second failed last time the piece is stranded at PAID. Accept APPROVED (do
  // both steps) OR PAID (payment intent already recorded — just finish queuing).
  if (m.status !== "APPROVED" && m.status !== "PAID") {
    return NextResponse.json({ error: "Approve the dispute before confirming." }, { status: 409 });
  }

  try {
    // No real charge while MAIL_LIVE is off — the ref documents that explicitly.
    if (m.status === "APPROVED") {
      await svc.markPaid(params.mailId, "authorized:no-charge (MAIL_LIVE=off — no card charged, no letter sent yet)");
    }
    const queued = await svc.queueForProvider(params.mailId);

    // Decision Registry — the recommendation the customer acted on.
    const letter = m.letterId
      ? await prisma.letter.findFirst({ where: { id: m.letterId, userId: user.id }, select: { strategy: true } })
      : null;
    await recordDecision({
      userId: user.id, tradelineId: m.tradelineId, strategyId: letter?.strategy ?? null,
      confidence: "acted", basis: ["Customer approved and queued this dispute for mailing via the Mail Center."],
    });

    return NextResponse.json({ manifest: queued });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not queue." }, { status: 409 });
  }
}
