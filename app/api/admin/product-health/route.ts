import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Product-health aggregates for the admin Product dashboard. Every number is a
// real DB count — nothing is estimated. Counts on self-heal tables (support,
// community reports, brief comments) are guarded with .catch(()=>0) so a
// not-yet-created table returns 0 rather than 500-ing the whole board.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const c = <T>(p: Promise<T>) => (p as Promise<number>).catch(() => 0);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [
    // support queue
    ticketsOpen, ticketsResponded, ticketsClosed,
    // moderation
    communityReportsOpen, flaggedComments, removedComments,
    // report processing
    reportsTotal, reportsAnalyzed, reportsStalePending,
    // letter funnel + outcomes
    lettersTotal, lettersMailed, lettersResponded, lettersResolved,
    outcomeDeleted, outcomeUpdated, outcomeVerified,
  ] = await Promise.all([
    c(prisma.supportTicket.count({ where: { status: "open" } })),
    c(prisma.supportTicket.count({ where: { status: "responded" } })),
    c(prisma.supportTicket.count({ where: { status: "closed" } })),
    c(prisma.communityReport.count({ where: { status: "open" } })),
    c(prisma.briefComment.count({ where: { flagged: true, status: "visible" } })),
    c(prisma.briefComment.count({ where: { status: "removed" } })),
    c(prisma.report.count()),
    c(prisma.report.count({ where: { analyzedAt: { not: null } } })),
    // uploaded > 1h ago but never analyzed → likely a parse/upload failure
    c(prisma.report.count({ where: { analyzedAt: null, uploadedAt: { lt: oneHourAgo } } })),
    c(prisma.letter.count()),
    c(prisma.letter.count({ where: { status: "MAILED" } })),
    c(prisma.letter.count({ where: { status: "RESPONSE_RECEIVED" } })),
    c(prisma.letter.count({ where: { status: "RESOLVED" } })),
    c(prisma.letter.count({ where: { responseOutcome: "deleted" } })),
    c(prisma.letter.count({ where: { responseOutcome: "updated" } })),
    c(prisma.letter.count({ where: { responseOutcome: "verified" } })),
  ]);

  const analyzeRate = reportsTotal ? Math.round((reportsAnalyzed / reportsTotal) * 1000) / 10 : 0;
  const resolvedRate = lettersResponded + lettersResolved > 0
    ? Math.round((outcomeDeleted + outcomeUpdated) / (lettersResponded + lettersResolved) * 1000) / 10
    : 0;

  return NextResponse.json({
    support: { open: ticketsOpen, responded: ticketsResponded, closed: ticketsClosed },
    moderation: { communityReportsOpen, flaggedComments, removedComments },
    reports: { total: reportsTotal, analyzed: reportsAnalyzed, stalePending: reportsStalePending, analyzeRate },
    letters: {
      total: lettersTotal, mailed: lettersMailed, responded: lettersResponded, resolved: lettersResolved,
      outcomeDeleted, outcomeUpdated, outcomeVerified, favorableRate: resolvedRate,
    },
  });
}
