// Agency roster ladder (Phase 1A, Agent B). Extracted verbatim from
// app/api/agency/clients/route.ts's GET handler so a second caller — Mission
// Control at agency-owner altitude — can reuse the EXACT same needs-attention-
// first computation and ordering, never a second, independently specified
// ladder (SIM-REVIEW.md finding 13's exact defect: "two rooms say 'do this
// first' from two independently specified ladders"). Zero AI, zero new schema,
// zero new query shape — the same Letter/Tradeline/User reads the route always
// ran, just relocated so both callers share one source of truth.
import { prisma } from "@/lib/prisma";

export interface AgencyRosterEntry {
  id: string;
  name: string;
  location: string;
  negativeItems: number;
  letters: number;
  lastRound: number | null;
  lastSentAt: string | null;
  daysSince: number | null;
  nextRoundDueAt: string | null;
  needsAttention: boolean;
}

const DAY = 86_400_000;

// The agency's client roster with light per-client stats, needs-attention-first.
// Each client's most recently MAILED letter drives the follow-up clock: the FCRA
// reinvestigation runs ~30 days from when the dispute was sent, so the agent
// should send the next round around day 30. We surface days-since-sent, the due
// date, and an attention flag when 30+ days have passed with no logged response
// — then sort so the work that needs attention rises to the top.
export async function getAgencyRoster(agencyId: string): Promise<AgencyRosterEntry[]> {
  const clients = await prisma.user.findMany({
    where: { managedByAgencyId: agencyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fullName: true, name: true, city: true, state: true, createdAt: true },
  });

  const ids = clients.map((c) => c.id);
  const [tl, lt] = await Promise.all([
    ids.length ? prisma.tradeline.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: true }) : [],
    ids.length ? prisma.letter.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: true }) : [],
  ]);
  const tlMap = new Map(tl.map((r) => [r.userId, r._count]));
  const ltMap = new Map(lt.map((r) => [r.userId, r._count]));

  const mailed = ids.length
    ? await prisma.letter.findMany({
        where: { userId: { in: ids }, mailedAt: { not: null } },
        select: { userId: true, round: true, mailedAt: true, responseAt: true },
        orderBy: { mailedAt: "desc" },
      })
    : [];
  const latest = new Map<string, { round: number; mailedAt: Date; responseAt: Date | null }>();
  for (const l of mailed) {
    if (!latest.has(l.userId) && l.mailedAt) {
      latest.set(l.userId, { round: l.round, mailedAt: l.mailedAt, responseAt: l.responseAt });
    }
  }

  const now = Date.now();
  const out: AgencyRosterEntry[] = clients.map((c) => {
    const last = latest.get(c.id);
    let lastRound: number | null = null;
    let lastSentAt: string | null = null;
    let daysSince: number | null = null;
    let nextRoundDueAt: string | null = null;
    let needsAttention = false;
    if (last) {
      lastRound = last.round;
      lastSentAt = last.mailedAt.toISOString();
      daysSince = Math.floor((now - last.mailedAt.getTime()) / DAY);
      nextRoundDueAt = new Date(last.mailedAt.getTime() + 30 * DAY).toISOString();
      needsAttention = daysSince >= 30 && !last.responseAt;
    }
    return {
      id: c.id,
      name: c.fullName || c.name || "Unnamed client",
      location: [c.city, c.state].filter(Boolean).join(", "),
      negativeItems: tlMap.get(c.id) ?? 0,
      letters: ltMap.get(c.id) ?? 0,
      lastRound,
      lastSentAt,
      daysSince,
      nextRoundDueAt,
      needsAttention,
    };
  });

  // Needs-attention first, then most-overdue (largest daysSince), then the rest —
  // the ONE ordering rule every caller shares (never re-sorted downstream).
  out.sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    return (b.daysSince ?? -1) - (a.daysSince ?? -1);
  });

  return out;
}
