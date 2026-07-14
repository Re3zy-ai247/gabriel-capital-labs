// Kai Case Memory (Sprint VII). Kai remembers the CASE, not the conversation:
// the case already lives in the DB (reports, letters, responses, KaiEvents). The
// only missing piece is a per-user "last seen" marker so a returning user can be
// greeted with "While you were away…" from REAL events since their last visit.
// Structured memory only (a timestamp + the existing event stream) — no freeform
// AI memory (Memory Orchestration law). Self-heal table (ADR-0001). Fail-open:
// a memory hiccup never breaks Kai Home.
import { prisma } from "@/lib/prisma";
import { listKaiEvents } from "@/lib/kaiEvents";

const HOUR = 3_600_000;
// Only greet as "returning" after a real gap — never on a refresh or same-session
// reload. Below this, the normal Kai Home framing carries.
const AWAY_THRESHOLD_MS = 12 * HOUR;

let tableReady = false;
async function ensureKaiSeenTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "KaiSeen" (
       "userId" TEXT NOT NULL PRIMARY KEY,
       "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );
  tableReady = true;
}

export type CaseMemory = { since: Date; items: { text: string; href: string }[] } | null;

const LABEL: Record<string, (p: Record<string, unknown>) => { text: string; href: string }> = {
  "report.uploaded": () => ({ text: "you uploaded a credit report", href: "/tradelines" }),
  "report.analyzed": (p) => ({ text: `I analyzed it — ${String(p.tradelines ?? "the")} accounts reviewed`, href: "/tradelines" }),
  "letter.generated": () => ({ text: "you generated a dispute letter", href: "/letters" }),
  "letter.mailed": (p) => ({ text: `Round ${String(p.round ?? "")} went out to ${String(p.recipient ?? "the bureau")} — the §611 clock started`, href: "/letters" }),
  "response.received": (p) => ({ text: `a bureau response came back (${String(p.outcome ?? "logged")})`, href: "/letters" }),
  "dispute.resolved": () => ({ text: "an item was marked resolved", href: "/journey" }),
  "mail.status": (p) => String(p.status) === "QUEUED"
    ? { text: "you queued a dispute for CreditVector to mail", href: "/mail" }
    : { text: "", href: "/mail" }, // only surface the queued milestone in case memory
  "campaign.approved": (p) => ({ text: `you approved Campaign ${String(p.sequence ?? "")} — a focused set of disputes`, href: "/campaigns" }),
  "campaign.active": (p) => ({ text: `Campaign ${String(p.sequence ?? "")} got underway`, href: "/campaigns" }),
};

// Returns the "while you were away" summary (events since the PREVIOUS visit),
// then stamps this visit. Null when there's no prior visit, the gap is short, or
// nothing happened in between. Reads only this user's own rows.
export async function caseMemorySince(userId: string): Promise<CaseMemory> {
  try {
    await ensureKaiSeenTable();
    const prior = await prisma.$queryRaw<{ seenAt: Date }[]>`
      SELECT "seenAt" FROM "KaiSeen" WHERE "userId" = ${userId} LIMIT 1`;
    const previous = prior[0]?.seenAt ? new Date(prior[0].seenAt) : null;

    // Advance the marker at most hourly (the DO UPDATE only fires when the row is
    // ≥1h stale) — this kills the per-refresh billable write on a force-dynamic
    // page while staying far finer than the 12h away-window. A rare same-instant
    // double-load may show the catch-up in one of two open tabs; benign.
    if (!previous || Date.now() - previous.getTime() >= HOUR) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "KaiSeen" ("userId", "seenAt") VALUES ($1, CURRENT_TIMESTAMP)
         ON CONFLICT ("userId") DO UPDATE SET "seenAt" = CURRENT_TIMESTAMP
         WHERE "KaiSeen"."seenAt" < CURRENT_TIMESTAMP - interval '1 hour'`,
        userId
      );
    }

    if (!previous || Date.now() - previous.getTime() < AWAY_THRESHOLD_MS) return null;

    const events = await listKaiEvents(userId, 50);
    const items = events
      .filter((e) => new Date(e.occurredAt) > previous && LABEL[e.type])
      .map((e) => LABEL[e.type]((e.payload ?? {}) as Record<string, unknown>))
      .filter((it) => it.text); // some events (e.g. non-queued mail steps) render nothing
    if (!items.length) return null;
    return { since: previous, items: items.slice(0, 5) };
  } catch (e) {
    console.error("caseMemorySince failed (non-fatal)", e);
    return null;
  }
}
