import type { Bureau, PrismaClient } from "@prisma/client";
import { extractRawTradelines, toBureauData, type ExtractedTradeline } from "./parse";
import { parseReportDate } from "./tradelineInsights";
import { aiExtractTradelines } from "./aiParse";
import { classifyCreditor } from "./classify";
import { scoreTradeline } from "./scoring";
import { computeDuplicateGroups } from "./dedupe";
import { saveFurnisherContact, getFurnisherContacts, type FurnisherContact } from "./furnisher";

export interface AnalyzeResult {
  tradelines: number;
  // FALSE means the precision-tuned regex fallback produced these rows, not the
  // AI extractor — a materially weaker read of the report (lib/parse.ts header).
  // This is a consumer-visible fact, not telemetry: every surface that reports
  // the result of an analysis must disclose it (app/upload/page.tsx does). It is
  // false whenever ANTHROPIC_API_KEY is absent, the AI call throws, or the model
  // returns no accounts — all three mean the same thing to the consumer.
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
//
// RC1-S3: a null here is the absence of a PARSED DATE, nothing more. Most
// consumer reports never print a date of first delinquency, so this returns
// null constantly — which is why "no DOFD" must never be read as "no derogatory
// history". The condition model (lib/intelligence/snapshot.ts factualCondition)
// reads the report's status text as well, so an unparseable or absent DOFD can
// no longer launder a charged-off account into "Clean".
// S11: it now parses the formats reports actually print (MM/YYYY, MM-YYYY,
// MM/DD/YYYY, MM-DD-YYYY, YYYY-MM, YYYY-MM-DD, "August 15, 2021"), but it
// persists a value ONLY when the report named a specific DAY. A month-precision
// DOFD stays out of this column on purpose: lib/letter.ts prints the column
// inside a mailed dispute letter as "The date of first delinquency is reported
// as <full date>", so widening "08/2021" into "August 1, 2021" would put a day
// the report never stated into a legal document the consumer signs.
//
// Nothing is lost by that: the reported value stays in `bureauData`, and
// reportedDofd() (lib/tradelineInsights.ts) is the single derivation the §605
// clock, the scoring engine and the condition model all read — so a month-only
// DOFD still runs the obsolescence clock and still marks the account
// derogatory. Precision is carried, never invented and never discarded.
function safeDate(v: string | undefined | null): Date | null {
  const parsed = parseReportDate(v ?? null);
  return parsed && parsed.precision === "day" ? parsed.date : null;
}

// A re-analysis deletes a report's tradelines and recreates them with NEW cuids,
// so an id can never carry anything across runs. This natural key — creditor +
// original creditor + masked account number — is how a human says "same
// account", and it is what re-links a consumer's existing dispute letters (and
// their furnisher mailing address) to the rebuilt rows. Balance is deliberately
// excluded: it legitimately changes between pulls.
export interface RelinkRow {
  id: string;
  creditorName: string;
  originalCreditor?: string | null;
  accountNumberMask?: string | null;
}

const normalizePart = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

function tradelineKey(t: Omit<RelinkRow, "id">): string {
  return [t.creditorName, t.originalCreditor ?? "", t.accountNumberMask ?? ""].map(normalizePart).join("|");
}

// The same account WITHOUT its masked number. The mask is the strongest
// disambiguator we have, but it is also the part most likely to change when the
// PARSER changes rather than the report — so it cannot be the thing that decides
// whether a consumer's existing letters survive.
function tradelineIdentity(t: Omit<RelinkRow, "id">): string {
  return [t.creditorName, t.originalCreditor ?? ""].map(normalizePart).join("|");
}

function groupBy(rows: RelinkRow[], keyOf: (r: RelinkRow) => string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const ids = out.get(k);
    if (ids) ids.push(r.id);
    else out.set(k, [r.id]);
  }
  return out;
}

// Match the rows that existed BEFORE a rebuild to the rows that exist after it,
// returning priorId -> newId. This is what carries a consumer's dispute letters
// and furnisher addresses across a re-analysis.
//
// Why it is not just an exact-key lookup: the key is computed by OUR parser, so
// a parser IMPROVEMENT changes its shape for rows that already exist in the
// database. The case-insensitive account-mask fix is exactly that — a row stored
// before it carries `accountNumberMask = null` (a capitalised "Account #:" never
// matched), and the same account re-parsed after it carries "…1234". Exact-only
// matching would miss, `Letter.tradelineId` would go NULL, and the authorization
// gate treats an orphaned letter as revoked: a real, previously-valid letter
// becomes un-approvable and un-printable, and the consumer is told the account is
// no longer on their report when in truth only our parser changed. That failure
// is invisible on a fresh database and lands only on existing users, at upgrade.
//
// So: exact key first; then, for anything still unmatched, the same account
// ignoring the mask — but ONLY when that identity is unambiguous on both sides
// (exactly one unmatched prior row and exactly one unclaimed rebuilt row). Two
// accounts at the same creditor never get guessed between, and an account that
// genuinely left the report still matches nothing and is still orphaned, which
// is the honest outcome the re-link must keep.
export function matchRebuiltTradelines(prior: RelinkRow[], rebuilt: RelinkRow[]): Map<string, string> {
  const matches = new Map<string, string>();
  const claimed = new Set<string>();

  const rebuiltByKey = groupBy(rebuilt, tradelineKey);
  for (const p of prior) {
    const candidate = (rebuiltByKey.get(tradelineKey(p)) ?? []).find((id) => !claimed.has(id));
    if (candidate) {
      matches.set(p.id, candidate);
      claimed.add(candidate);
    }
  }

  const priorByIdentity = groupBy(prior, tradelineIdentity);
  const rebuiltByIdentity = groupBy(rebuilt, tradelineIdentity);
  for (const p of prior) {
    if (matches.has(p.id)) continue;
    const identity = tradelineIdentity(p);
    const stillUnmatched = (priorByIdentity.get(identity) ?? []).filter((id) => !matches.has(id));
    const available = (rebuiltByIdentity.get(identity) ?? []).filter((id) => !claimed.has(id));
    // One left on each side => the assignment is forced, not guessed.
    if (stillUnmatched.length === 1 && available.length === 1) {
      matches.set(p.id, available[0]);
      claimed.add(available[0]);
    }
  }

  return matches;
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
      // Same guard the persisted column gets below: an unparseable date string
      // must not reach scoring as an Invalid Date while the row stores null —
      // scoring and the stored fact have to agree about whether a DOFD exists.
      dateOfFirstDelinquency: safeDate(ex.dofd),
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
  // Keyed by the prior ROW, not by its parser-derived key: the same rebuild
  // matcher then carries the contact forward, so a mask that changed shape can
  // no longer silently drop the furnisher's mailing address either.
  const priorContactById = new Map<string, FurnisherContact>();
  if (priorIds.length) {
    try {
      for (const [id, contact] of Object.entries(await getFurnisherContacts(priorIds))) {
        if (!priorContactById.has(id)) priorContactById.set(id, contact);
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
  // priorId -> newId, from the shared matcher below; also used after the commit
  // to carry each account's furnisher contact onto its rebuilt row.
  let matchedByPriorId = new Map<string, string>();
  await prisma.$transaction(
    async (tx) => {
      createdIds.length = 0;
      matchedByPriorId = new Map();

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

      const rebuilt: RelinkRow[] = [];
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
        rebuilt.push(created);
      }

      // Old rows -> new rows. Exact natural key first, then the same account
      // ignoring a mask whose shape our own parser changed — see
      // matchRebuiltTradelines. An account that genuinely left the report still
      // matches nothing.
      matchedByPriorId = matchRebuiltTradelines(prior, rebuilt);

      // Re-link every letter whose account came back in this parse. Without this
      // a re-analysis permanently orphans the consumer's dispute history:
      // "mark resolved" silently no-ops, the furnisher mailing address is lost,
      // and Round 2 escalations propagate a null. A letter whose account is no
      // longer in the report keeps a null tradeline (honest — the item is gone)
      // and is never deleted.
      const relink = new Map<string, string[]>();
      for (const letter of priorLetters) {
        const newId = letter.tradelineId ? matchedByPriorId.get(letter.tradelineId) : undefined;
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
  const carriedContactByNewId = new Map<string, FurnisherContact>();
  for (const [priorId, newId] of matchedByPriorId) {
    const contact = priorContactById.get(priorId);
    if (contact && !carriedContactByNewId.has(newId)) carriedContactByNewId.set(newId, contact);
  }
  for (let i = 0; i < records.length; i++) {
    const id = createdIds[i];
    if (!id) continue;
    const contact = records[i].ex.furnisherAddress ?? carriedContactByNewId.get(id);
    if (!contact) continue;
    try {
      await saveFurnisherContact(id, contact);
    } catch (e) {
      console.error("furnisher contact save failed", e);
    }
  }

  return { tradelines: records.length, usedAI };
}
