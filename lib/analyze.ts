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
  // Corroboration for the mask-free fallback below. Not part of any key — only
  // ever used to REFUSE a pairing the counting rule would otherwise force.
  accountType?: string | null;
  isDebtBuyer?: boolean | null;
  balance?: number | null;
  dateOfFirstDelinquency?: Date | string | null;
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

// Just the digits of a masked account number: "517805XXXXXX1234" -> "5178051234".
// Reports mask the middle, so two renderings of the SAME account agree on their
// trailing digits — but a tail is not an account number. Four digits collide
// once in ten thousand and masked reports routinely expose exactly four, so a
// tail can support identity, never establish it on its own.
const maskDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

// Below this, a shared tail says nothing at all: lib/parse.ts accepts a 4-char
// mask, so a 2-3 digit capture matches any account ending in those digits.
const MIN_MEANINGFUL_TAIL = 4;

// identical  — the same account number, digit for digit.
// weak       — one is a trailing view of the other, over a meaningful tail. Real
//              support, but consistent with a coincidence, so it needs a second
//              fact before it can pair two rows.
// conflicts  — both numbers parsed and they are not the same account.
// silent     — no usable evidence: one side parsed no digits, or the shared tail
//              is too short to identify anything. NOT agreement.
type MaskEvidence = "identical" | "weak" | "conflicts" | "silent";

function compareMasks(a: string | null | undefined, b: string | null | undefined): MaskEvidence {
  const da = maskDigits(a);
  const db = maskDigits(b);
  if (!da || !db) return "silent";
  if (Math.min(da.length, db.length) < MIN_MEANINGFUL_TAIL) return "silent";
  // Equality is only IDENTITY when the number is longer than the tail every
  // report prints. Two masks that both parsed down to the same four visible
  // digits are two accounts showing the same tail — the comment above says a
  // tail can never establish identity on its own, and this used to short-circuit
  // past that. `****3333` is an ordinary parse (lib/parse.ts accepts a 4-char
  // mask), not a contrived one, so equality there is support, not proof.
  if (da === db && da.length > MIN_MEANINGFUL_TAIL) return "identical";
  return da.endsWith(db) || db.endsWith(da) ? "weak" : "conflicts";
}

const asTime = (d: Date | string | null | undefined): number | null => {
  if (!d) return null;
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
};

// A fact that picks THIS account out from its neighbours at the same creditor,
// as opposed to describing the category it belongs to. Account type and
// debt-buyer status are derived from the creditor name, and the fallback only
// ever fires inside one creditor identity, so those two are equal by
// construction and individuate nothing.
//
// A balance individuates only when it is a real figure: extractRawTradelines
// returns 0 for a block with no dollar amount and safeCents(NaN) is 0, so two
// zero balances are the parser saying "I read nothing", not the report saying
// "these match". A first-delinquency date on both sides is the other real one.
function individuatingAgreement(prior: RelinkRow, rebuilt: RelinkRow): boolean {
  const pb = prior.balance ?? 0;
  const rb = rebuilt.balance ?? 0;
  if (pb > 0 && pb === rb) return true;
  const pd = asTime(prior.dateOfFirstDelinquency);
  const rd = asTime(rebuilt.dateOfFirstDelinquency);
  return pd != null && pd === rd;
}

// Does the evidence actually say these two rows are the SAME account, or is the
// pairing merely the last one left over?
//
// "Forced" and "correct" are not the same thing. Two DIFFERENT accounts at one
// creditor — one closed and gone from the report, another newly appearing —
// leave exactly one prior unmatched and one rebuilt unclaimed, and counting
// alone would pair them. The consequence is not cosmetic: the consumer's mailed
// dispute is re-pointed at an account they never disputed, and closing that
// dispute out as "corrected or removed" then writes `resolved: true` onto the
// wrong row (app/api/letters/[id]/route.ts), dropping a live derogatory account
// out of every recommendation surface while the disputed one stays open.
//
// The rule, tightened in the safe direction — refuse rather than guess:
//   • account numbers that disagree, or first-delinquency dates that disagree,
//     refuse outright, whatever the counts say;
//   • the same account number, digit for digit, IS identity;
//   • anything less — a shared tail, or a mask that parsed on only one side —
//     is not identity by itself. It pairs only when the category agrees AND
//     some fact individuates the account: an equal REAL balance, or an equal
//     first-delinquency date. Absent both, we cannot tell two accounts apart
//     and we decline.
// Declining is safe by design: an unmatched letter orphans, and the
// authorization rule then asks the consumer to re-confirm.
// Two rows that both carry a first-delinquency date, and disagree about it, are
// not the same account — whatever their keys say. This is the module's stated
// rule ("first-delinquency dates that disagree refuse outright, whatever the
// counts say"), and it applies on EVERY matching path, including the exact-key
// one, where it previously never ran.
//
// It is deliberately the only attribute check that reaches the exact-key path.
// Two parses of the SAME account legitimately disagree on type and balance when
// extraction quality changes (AI reader vs regex fallback) — that is the common
// case the re-link exists to serve — so gating the exact key on those would
// trade a rare wrong link for frequent false orphans. A DOFD is different: it is
// a fact about the delinquency itself, not about how well we read the page, and
// when it is absent on either side this refuses nothing.
function delinquencyDatesDisagree(a: RelinkRow, b: RelinkRow): boolean {
  const at = asTime(a.dateOfFirstDelinquency);
  const bt = asTime(b.dateOfFirstDelinquency);
  return at != null && bt != null && at !== bt;
}

function corroboratesSameAccount(prior: RelinkRow, rebuilt: RelinkRow): boolean {
  const masks = compareMasks(prior.accountNumberMask, rebuilt.accountNumberMask);
  if (masks === "conflicts") return false;
  if (delinquencyDatesDisagree(prior, rebuilt)) return false;
  if (masks === "identical") return true;

  const sameCategory =
    (prior.accountType ?? null) === (rebuilt.accountType ?? null) &&
    Boolean(prior.isDebtBuyer) === Boolean(rebuilt.isDebtBuyer);
  return sameCategory && individuatingAgreement(prior, rebuilt);
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
// ignoring the mask — but only when the identity is unambiguous on both sides
// (exactly one unmatched prior row and one unclaimed rebuilt row) AND the
// evidence corroborates that the two rows are the same account
// (corroboratesSameAccount). Two accounts at the same creditor are never guessed
// between, and an account that genuinely left the report matches nothing and is
// still orphaned — including when a DIFFERENT account at that same creditor
// arrived in its place, which the counting rule alone could not tell apart.
export function matchRebuiltTradelines(prior: RelinkRow[], rebuilt: RelinkRow[]): Map<string, string> {
  const matches = new Map<string, string>();
  const claimed = new Set<string>();
  const rowById = new Map(rebuilt.map((r) => [r.id, r] as const));

  const priorByKey = groupBy(prior, tradelineKey);
  const rebuiltByKey = groupBy(rebuilt, tradelineKey);
  for (const p of prior) {
    const key = tradelineKey(p);
    const candidates = (rebuiltByKey.get(key) ?? []).filter((id) => !claimed.has(id));
    if (!candidates.length) continue;
    // An "exact" key that carries no account number is only creditor +
    // original creditor — the same information as the identity fallback. With
    // one row on each side that is still sound (it is the only account at that
    // creditor), but where either side holds several, pairing them by position
    // is a guess dressed as an exact match. Corroborate, or decline.
    const keyIdentifiesAnAccount = maskDigits(p.accountNumberMask).length > 0;
    const unique = (priorByKey.get(key) ?? []).length === 1 && (rebuiltByKey.get(key) ?? []).length === 1;
    // A matching key is not a licence to ignore a contradicted delinquency
    // date. Filtering rather than refusing outright also fixes the order
    // dependence: where two accounts at one creditor print the same visible
    // four digits, the extractor returning them in the opposite order used to
    // cross-link both letters; each prior row now takes the candidate whose
    // delinquency it does not contradict, in either order.
    const acceptable = candidates.filter((id) => {
      const row = rowById.get(id);
      return row ? !delinquencyDatesDisagree(p, row) : false;
    });
    const candidate = keyIdentifiesAnAccount || unique
      ? acceptable[0]
      : acceptable.find((id) => {
          const row = rowById.get(id);
          return row ? corroboratesSameAccount(p, row) : false;
        });
    if (!candidate) continue;
    matches.set(p.id, candidate);
    claimed.add(candidate);
  }

  const priorByIdentity = groupBy(prior, tradelineIdentity);
  const rebuiltByIdentity = groupBy(rebuilt, tradelineIdentity);
  for (const p of prior) {
    if (matches.has(p.id)) continue;
    const identity = tradelineIdentity(p);
    const stillUnmatched = (priorByIdentity.get(identity) ?? []).filter((id) => !matches.has(id));
    const available = (rebuiltByIdentity.get(identity) ?? []).filter((id) => !claimed.has(id));
    // One left on each side makes the assignment FORCED. It still has to be
    // CORROBORATED before it is made — see corroboratesSameAccount.
    if (stillUnmatched.length !== 1 || available.length !== 1) continue;
    const candidate = rowById.get(available[0]);
    if (!candidate || !corroboratesSameAccount(p, candidate)) continue;
    matches.set(p.id, candidate.id);
    claimed.add(candidate.id);
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
    // accountType/isDebtBuyer/balance are not part of any key — they are the
    // corroboration the mask-free re-link fallback needs to refuse a pairing
    // that counting alone would force onto two different accounts.
    select: {
      id: true,
      creditorName: true,
      originalCreditor: true,
      accountNumberMask: true,
      accountType: true,
      isDebtBuyer: true,
      balance: true,
      dateOfFirstDelinquency: true,
    },
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
