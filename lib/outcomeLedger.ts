// Verified Outcome Ledger (Sprint XIV, ADR-0014) — closes the compounding loop.
// Each logged bureau/furnisher response becomes ONE canonical verified-outcome
// row (keyed by letter), linking the dispute (strategy·recipient·bureau·round)
// AND the recommendation that produced it (decisionId, from the Decision
// Registry) to its outcome + latency. It is the durable, provenance-tagged source
// the moat learns from:
//   • OWN-data feedback is gate-free NOW (a user's own track record is their data —
//     no consent, no k-anonymity needed; framed as history, never a prediction).
//   • CROSS-user aggregation stays consent-gated + k-anon + CCO-gated (ADR-0010):
//     `ledgerCorpus` yields ONLY consenting users' rows, identifier-stripped.
// Deduplicated per letter (upsert) so an outcome is never double-counted; the
// append-only CHANGE history already lives in the KaiEvent stream + Letter.responseAt.
import { createHmac } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OutcomeRecord } from "./outcomeStats";
import { consentingUserIds } from "./outcomeConsent";

const DAY = 86_400_000;

// Outcome semantics — the SAME vocabulary Engine 1 (outcomeStats) uses, so
// "favorable"/"responded" mean one thing across the platform.
const FAVORABLE = new Set(["deleted", "updated"]);      // the item changed or was removed
const RESPONDED = new Set(["deleted", "updated", "verified", "no_response", "unknown"]);
const OWN_MIN_SAMPLE = 3; // a median/rate needs ≥3 of the user's OWN observations to read as earned (FTC substantiation; matches lib/forecast)

export interface LedgerRow {
  letterId: string;
  strategy: string;
  recipientType: string;
  bureau: string | null;
  round: number;
  accountType: string;
  isDebtBuyer: boolean;
  outcome: string | null;
  latencyDays: number | null;
}

// ---- pure: own-data track record (gate-free) ------------------------------
export interface TrackCell { sample: number; responded: number; favorable: number; favorableRate: number | null; medianLatencyDays: number | null }
export interface OwnTrack { total: number; byStrategy: Record<string, TrackCell>; byRecipient: Record<string, TrackCell> }

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
function trackCell(rows: LedgerRow[]): TrackCell {
  const responded = rows.filter((r) => r.outcome != null && RESPONDED.has(r.outcome)).length;
  const favorable = rows.filter((r) => r.outcome != null && FAVORABLE.has(r.outcome)).length;
  const latencies = rows.map((r) => r.latencyDays).filter((d): d is number => d != null);
  return {
    sample: rows.length, responded, favorable,
    favorableRate: responded > 0 ? Math.round((favorable / responded) * 100) / 100 : null,
    medianLatencyDays: latencies.length ? median(latencies) : null,
  };
}
function groupBy(rows: LedgerRow[], key: (r: LedgerRow) => string | null): Record<string, LedgerRow[]> {
  const out: Record<string, LedgerRow[]> = {};
  for (const r of rows) { const k = key(r); if (k == null) continue; (out[k] ??= []).push(r); }
  return out;
}

// Pure — deterministic own track record from the user's OWN verified outcomes.
export function computeOwnTrack(rows: LedgerRow[]): OwnTrack {
  const byStrategy: Record<string, TrackCell> = {};
  for (const [k, rs] of Object.entries(groupBy(rows, (r) => r.strategy))) byStrategy[k] = trackCell(rs);
  const byRecipient: Record<string, TrackCell> = {};
  for (const [k, rs] of Object.entries(groupBy(rows, (r) => r.recipientType))) byRecipient[k] = trackCell(rs);
  return { total: rows.length, byStrategy, byRecipient };
}

// One honest own-history line for a strategy, or null when the sample is too thin
// to read as earned. History, never a prediction (CROA).
export function ownTrackLine(track: OwnTrack, strategyId: string | null): string | null {
  const cell = strategyId ? track.byStrategy[strategyId] : undefined;
  if (!cell || cell.responded < OWN_MIN_SAMPLE || cell.favorableRate == null) return null;
  return `Your own history: of ${cell.responded} past dispute${cell.responded === 1 ? "" : "s"} using this approach that got a response, the item was changed or removed in ${Math.round(cell.favorableRate * 100)}% — your track record so far, not a prediction of this result.`;
}

// One aggregate own-history line across all of the user's verified outcomes —
// gate-free (their own data), history not prediction, null when too thin.
export function ownHistorySummary(track: OwnTrack): string | null {
  let responded = 0, favorable = 0;
  for (const c of Object.values(track.byStrategy)) { responded += c.responded; favorable += c.favorable; }
  if (responded < OWN_MIN_SAMPLE) return null;
  return `Across your ${responded} logged dispute response${responded === 1 ? "" : "s"} so far, the item was changed or removed ${favorable} time${favorable === 1 ? "" : "s"} — your own track record, not a prediction.`;
}

// ---- pure: ledger row → anonymized cross-user OutcomeRecord ----------------
function saltedUserKey(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "outcome-corpus-fallback-salt";
  return createHmac("sha256", secret).update(userId).digest("hex").slice(0, 16);
}
export function toOutcomeRecord(row: LedgerRow & { isDebtBuyer: boolean }, userKey: string): OutcomeRecord {
  return {
    strategy: row.strategy, bureau: row.bureau, round: row.round,
    accountType: row.accountType, isDebtBuyer: row.isDebtBuyer,
    outcome: row.outcome, latencyDays: row.latencyDays, userKey,
  };
}

// ---- persistence (self-heal, ADR-0001) ------------------------------------
let ready = false;
async function ensureLedger(): Promise<void> {
  if (ready) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "VerifiedOutcome" (
      "letterId" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tradelineId" TEXT,
      "decisionId" TEXT,
      "campaignId" TEXT,
      "strategy" TEXT NOT NULL,
      "recipientType" TEXT NOT NULL,
      "bureau" TEXT,
      "round" INTEGER NOT NULL DEFAULT 1,
      "accountType" TEXT NOT NULL DEFAULT 'OTHER',
      "isDebtBuyer" BOOLEAN NOT NULL DEFAULT false,
      "outcome" TEXT,
      "latencyDays" INTEGER,
      "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "source" TEXT NOT NULL DEFAULT 'response_log'
    )`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VerifiedOutcome_userId_idx" ON "VerifiedOutcome" ("userId")`);
  // One-time idempotent backfill from already-responded letters, so historical
  // outcomes appear in the ledger immediately (ON CONFLICT keeps it safe/rerunnable).
  await prisma.$executeRawUnsafe(
    `INSERT INTO "VerifiedOutcome" ("letterId","userId","tradelineId","strategy","recipientType","bureau","round","accountType","isDebtBuyer","outcome","latencyDays","verifiedAt","source")
     SELECT l."id", l."userId", l."tradelineId", l."strategy", l."recipientType", l."targetBureau"::text, l."round",
            COALESCE(t."accountType"::text,'OTHER'), COALESCE(t."isDebtBuyer",false),
            COALESCE(l."responseOutcome",'unknown'),
            CASE WHEN l."responseAt" IS NOT NULL AND l."mailedAt" IS NOT NULL AND l."responseAt" >= l."mailedAt"
                 THEN ROUND(EXTRACT(EPOCH FROM (l."responseAt" - l."mailedAt"))/86400)::int ELSE NULL END,
            COALESCE(l."responseAt", CURRENT_TIMESTAMP), 'backfill'
     FROM "Letter" l LEFT JOIN "Tradeline" t ON t."id" = l."tradelineId"
     WHERE l."responseAt" IS NOT NULL
     ON CONFLICT ("letterId") DO NOTHING`
  );
  ready = true;
}

export interface RecordOutcomeInput {
  userId: string; letterId: string; tradelineId: string | null;
  strategy: string; recipientType: string; bureau: string | null; round: number;
  outcome: string | null; mailedAt: Date | null; responseAt: Date | null;
  accountType?: string; isDebtBuyer?: boolean;
}

// Record (or update) the verified outcome for a letter, and CLOSE the loop by
// linking the recommendation that produced it. Fail-open — a ledger hiccup must
// never break the response the user just logged.
export async function recordVerifiedOutcome(input: RecordOutcomeInput): Promise<void> {
  try {
    await ensureLedger();
    const latency = input.mailedAt && input.responseAt && input.responseAt >= input.mailedAt
      ? Math.round((input.responseAt.getTime() - input.mailedAt.getTime()) / DAY) : null;

    let accountType = input.accountType ?? "OTHER";
    let isDebtBuyer = input.isDebtBuyer ?? false;
    if (input.accountType == null && input.tradelineId) {
      const t = await prisma.tradeline.findFirst({ where: { id: input.tradelineId, userId: input.userId }, select: { accountType: true, isDebtBuyer: true } }).catch(() => null);
      if (t) { accountType = t.accountType; isDebtBuyer = t.isDebtBuyer; }
    }

    // Close the loop: the latest recommendation on record for this item.
    let decisionId: string | null = null;
    if (input.tradelineId) {
      const dec = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "DecisionRegistry" WHERE "userId" = ${input.userId} AND "tradelineId" = ${input.tradelineId}
        ORDER BY "recordedAt" DESC LIMIT 1`.catch(() => []);
      decisionId = dec[0]?.id ?? null;
    }

    await prisma.$executeRaw`
      INSERT INTO "VerifiedOutcome" ("letterId","userId","tradelineId","decisionId","strategy","recipientType","bureau","round","accountType","isDebtBuyer","outcome","latencyDays","source")
      VALUES (${input.letterId}, ${input.userId}, ${input.tradelineId}, ${decisionId}, ${input.strategy}, ${input.recipientType}, ${input.bureau}, ${input.round}, ${accountType}, ${isDebtBuyer}, ${input.outcome}, ${latency}, 'response_log')
      ON CONFLICT ("letterId") DO UPDATE SET
        "outcome" = EXCLUDED."outcome", "latencyDays" = EXCLUDED."latencyDays",
        "decisionId" = COALESCE(EXCLUDED."decisionId", "VerifiedOutcome"."decisionId"),
        "verifiedAt" = CURRENT_TIMESTAMP, "source" = 'response_log'`;
  } catch (e) {
    console.error("outcomeLedger: record failed (fail-open):", e);
  }
}

// The requesting user's OWN verified outcomes → their track record. Gate-free.
export async function ownOutcomeTrack(userId: string): Promise<OwnTrack> {
  try {
    await ensureLedger();
    const rows = await prisma.$queryRaw<LedgerRow[]>`
      SELECT "letterId","strategy","recipientType","bureau","round","accountType","isDebtBuyer","outcome","latencyDays"
      FROM "VerifiedOutcome" WHERE "userId" = ${userId}`;
    return computeOwnTrack(rows);
  } catch (e) {
    console.error("outcomeLedger: ownOutcomeTrack failed (fail-open):", e);
    return { total: 0, byStrategy: {}, byRecipient: {} };
  }
}

// The canonical CROSS-user corpus for the moat — ONLY consenting users' rows,
// every identifier stripped (userId → salted contributor key used solely for
// k-anon counting downstream). This is the durable source outcomeStats aggregates.
export async function ledgerCorpus(client: PrismaClient = prisma): Promise<OutcomeRecord[]> {
  await ensureLedger();
  const ids = await consentingUserIds();
  if (!ids.length) return [];
  const rows = await client.$queryRaw<(LedgerRow & { userId: string })[]>(Prisma.sql`
    SELECT "userId","letterId","strategy","recipientType","bureau","round","accountType","isDebtBuyer","outcome","latencyDays"
    FROM "VerifiedOutcome" WHERE "userId" IN (${Prisma.join(ids)})`).catch(() => [] as (LedgerRow & { userId: string })[]);
  return rows.map((r) => toOutcomeRecord(r, saltedUserKey(r.userId)));
}
