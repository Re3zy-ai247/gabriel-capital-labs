import type { Bureau, PrismaClient } from "@prisma/client";
import { extractRawTradelines, toBureauData, type ExtractedTradeline } from "./parse";
import { aiExtractTradelines } from "./aiParse";
import { classifyCreditor } from "./classify";
import { scoreTradeline } from "./scoring";
import { computeDuplicateGroups } from "./dedupe";
import { saveFurnisherContact, getFurnisherContacts, type FurnisherContact } from "./furnisher";

export interface AnalyzeResult {
  tradelines: number;
  usedAI: boolean;
}

// `balance` is a 32-bit Int column (max 2,147,483,647 cents). Real-report text
// can mis-parse into a value that overflows it (or NaN), which would throw a DB
// error mid-analysis. Clamp to a safe, sane range so a single bad number never
// fails the whole upload.
const MAX_CENTS = 2_000_000_000; // $20,000,000
function safeCents(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(Math.max(0, Math.round(v)), MAX_CENTS);
}

// Parse a possibly-garbage date string; return null if it isn't a valid date so
// Prisma never receives an Invalid Date.
function safeDate(v: string | undefined | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  // Guard against absurd years from mis-parsed text.
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 2100) return null;
  return d;
}

// A re-analysis deletes a report's tradelines and recreates them with NEW cuids,
// so an id can never carry anything across runs. This natural key — creditor +
// original creditor + masked account number — is how a human says "same
// account", and it is what re-links a consumer's existing dispute letters (and
// their furnisher mailing address) to the rebuilt rows. Balance is deliberately
// excluded: it legitimately changes between pulls.
function tradelineKey(t: {
  creditorName: string;
  originalCreditor?: string | null;
  accountNumberMask?: string | null;
}): string {
  return [t.creditorName, t.originalCreditor ?? "", t.accountNumberMask ?? ""]
    .map((s) => s.trim().toUpperCase())
    .join("|");
}

// The single source of truth for turning a report's raw text into scored,
// classified, deduped tradelines. Used by upload, re-analyze, and the seed so
// they can never drift apart. Prefers AI extraction (robust across formats),
// falls back to the deterministic regex parser.
export async function analyzeReportText(
  prisma: PrismaClient,
  opts: { userId: string; reportId: string; rawText: string; coveredBureaus: Bureau[] },
  // Optional narration hook: fired when a REAL pipeline stage begins, so the
  // upload UI can narrate honestly. Stages: "reading" (account extraction) and
  // "scoring" (classification + cross-bureau scoring + persistence). Never call
  // this for work that isn't happening.
  onStage?: (stage: "reading" | "scoring") => void
): Promise<AnalyzeResult> {
  const { userId, reportId, rawText, coveredBureaus } = opts;

  let extracted: ExtractedTradeline[] = [];
  let usedAI = false;
  onStage?.("reading");
  try {
    const ai = await aiExtractTradelines(rawText, coveredBureaus);
    if (ai && ai.length) {
      extracted = ai;
      usedAI = true;
    }
  } catch (e) {
    console.error("AI extraction failed, falling back to regex parser:", e);
  }
  if (!extracted.length) {
    extracted = extractRawTradelines(rawText, coveredBureaus);
  }

  onStage?.("scoring");

  const records = extracted.map((ex) => {
    const balanceCents = safeCents(ex.balanceCents);
    const cls = classifyCreditor(ex.creditorName, ex.typeHint, ex.kind);
    const bureauData = toBureauData(ex, coveredBureaus);
    const score = scoreTradeline({
      accountType: cls.accountType,
      isDebtBuyer: cls.isDebtBuyer,
      balanceCents,
      dateOfFirstDelinquency: ex.dofd ? new Date(ex.dofd) : null,
      bureauData,
      nonStrategic: cls.nonStrategic,
      creditorName: ex.creditorName,
    });
    return { ex, cls, bureauData, score, balanceCents };
  });

  const groups = computeDuplicateGroups(
    records.map((r, i) => ({
      id: String(i),
      creditorName: r.ex.creditorName,
      originalCreditor: r.ex.originalCreditor,
      balanceCents: r.balanceCents,
    }))
  );

  // Snapshot what currently exists BEFORE the rebuild. Letter.tradelineId is
  // ON DELETE SET NULL and TradelineContact cascades, so once the delete runs
  // both links are gone and unrecoverable — the mapping has to be captured here.
  const prior = await prisma.tradeline.findMany({
    where: { reportId },
    select: { id: true, creditorName: true, originalCreditor: true, accountNumberMask: true },
  });
  const priorIds = prior.map((p) => p.id);
  const keyByPriorId = new Map(prior.map((p) => [p.id, tradelineKey(p)] as const));
  const priorContactByKey = new Map<string, FurnisherContact>();
  if (priorIds.length) {
    try {
      for (const [id, contact] of Object.entries(await getFurnisherContacts(priorIds))) {
        const key = keyByPriorId.get(id);
        if (key && !priorContactByKey.has(key)) priorContactByKey.set(key, contact);
      }
    } catch (e) {
      console.error("furnisher contact snapshot failed", e);
    }
  }

  // Delete + recreate + re-link in ONE transaction: a partial failure must never
  // leave the consumer's letters pointing at nothing. The timeout is raised from
  // the 5s default because a large report writes up to the parser's cap of 150
  // rows inside this boundary.
  const createdIds: string[] = [];
  await prisma.$transaction(
    async (tx) => {
      createdIds.length = 0;

      // Read the letter→tradeline mapping INSIDE the transaction, immediately
      // before the delete that destroys it. Reading it outside left a window in
      // which a letter created after the snapshot but before the delete was
      // absent from the mapping and still got SET NULL — the exact orphaning
      // this re-link exists to prevent.
      const priorLetters = priorIds.length
        ? await tx.letter.findMany({
            where: { tradelineId: { in: priorIds } },
            select: { id: true, tradelineId: true },
          })
        : [];

      await tx.tradeline.deleteMany({ where: { reportId } });

      const newIdByKey = new Map<string, string>();
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const created = await tx.tradeline.create({
          data: {
            userId,
            reportId,
            creditorName: r.ex.creditorName,
            originalCreditor: r.ex.originalCreditor,
            accountNumberMask: r.ex.accountNumberMask,
            accountType: r.cls.accountType,
            isDebtBuyer: r.cls.isDebtBuyer,
            balance: r.balanceCents,
            dateOfFirstDelinquency: safeDate(r.ex.dofd),
            bureauData: r.bureauData as object,
            score: r.score.score,
            probability: r.score.probability,
            reasons: r.score.reasons,
            disputeAngles: r.score.disputeAngles,
            duplicateGroup: groups[String(i)] ?? null,
          },
        });
        createdIds[i] = created.id;
        const key = tradelineKey(created);
        if (!newIdByKey.has(key)) newIdByKey.set(key, created.id);
      }

      // Re-link every letter whose account came back in this parse. Without this
      // a re-analysis permanently orphans the consumer's dispute history:
      // "mark resolved" silently no-ops, the furnisher mailing address is lost,
      // and Round 2 escalations propagate a null. A letter whose account is no
      // longer in the report keeps a null tradeline (honest — the item is gone)
      // and is never deleted.
      const relink = new Map<string, string[]>();
      for (const letter of priorLetters) {
        const key = letter.tradelineId ? keyByPriorId.get(letter.tradelineId) : undefined;
        const newId = key ? newIdByKey.get(key) : undefined;
        if (!newId) continue;
        const ids = relink.get(newId);
        if (ids) ids.push(letter.id);
        else relink.set(newId, [letter.id]);
      }
      for (const [newId, letterIds] of relink) {
        await tx.letter.updateMany({ where: { id: { in: letterIds } }, data: { tradelineId: newId } });
      }

      await tx.report.update({ where: { id: reportId }, data: { analyzedAt: new Date() } });
    },
    { maxWait: 10_000, timeout: 15_000 }
  );

  // Furnisher mailing contacts, AFTER the commit: they live in a separate
  // raw-SQL table written through the base client, whose foreign key can only
  // see tradelines the transaction has already committed. A contact parsed from
  // THIS report wins; otherwise the one we already held for the same account is
  // carried forward, because the delete above cascaded it away. Best-effort —
  // never fail an analysis over it.
  for (let i = 0; i < records.length; i++) {
    const id = createdIds[i];
    if (!id) continue;
    const contact = records[i].ex.furnisherAddress ?? priorContactByKey.get(tradelineKey(records[i].ex));
    if (!contact) continue;
    try {
      await saveFurnisherContact(id, contact);
    } catch (e) {
      console.error("furnisher contact save failed", e);
    }
  }

  return { tradelines: records.length, usedAI };
}
