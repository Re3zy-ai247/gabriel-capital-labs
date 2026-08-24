import type { Bureau } from "@prisma/client";
import type { BureauData, BureauFields } from "./bureauData";
import type { CreditorKind } from "./classify";
import type { FurnisherContact } from "./furnisher";

// Deterministic heuristic extractor — the fallback used when AI extraction is
// unavailable (no ANTHROPIC_API_KEY) or fails. Real credit-report PDFs flatten
// into messy text full of boilerplate (educational blurbs, ratio explanations,
// payment-history headers, bureau-name strings), so this parser is tuned for
// PRECISION over recall: it would rather emit fewer, clean tradelines than turn
// prose into fake accounts. For full-fidelity extraction of arbitrary reports,
// the AI parser (lib/aiParse.ts) is strongly preferred.

// RC1-S3 (Credit Truth Core): the key under which an account-level observation
// is stored when the SOURCE attests a value but does not attribute it to a
// specific bureau (a tri-merge account whose single status/balance was printed
// once, or a report that never said which bureau shows the account). It is
// deliberately NOT a `Bureau`, so every bureau-scoped reader ignores it by
// construction: presentBureaus()/hasCrossBureauKnowledge()/conflictFields()
// filter on presence PRESENT|ABSENT (this entry is UNKNOWN), and the per-bureau
// comparison table iterates the three real bureaus. Only whole-record readers
// that legitimately want "everything the report said about this account" —
// bureauTextBlob() for the §605 clock and the condition model in
// lib/intelligence/snapshot.ts — see it. Writing an unattributed value into a
// bureau's fields instead would assert that THAT bureau reports it, which the
// report never said.
export const UNATTRIBUTED = "UNATTRIBUTED";

export interface ExtractedTradeline {
  creditorName: string;
  originalCreditor?: string;
  accountNumberMask?: string;
  balanceCents: number;
  dofd?: string;
  dateReported?: string;
  typeHint?: string;
  kind?: CreditorKind; // AI's judgment of the entity (original creditor vs debt buyer, etc.)
  // Furnisher/collector mailing contact parsed from the account's Contact block,
  // used to pre-fill the dispute-letter recipient address. AI-only (the regex
  // fallback leaves it undefined).
  furnisherAddress?: FurnisherContact;
  // Per-bureau raw values, only for bureaus the source actually attributed.
  // An entry may legitimately be `{}`: the source attested that this bureau
  // reports the account but gave no bureau-scoped VALUES for it (presence is
  // attested, values are not).
  perBureau: Partial<Record<Bureau, Omit<BureauFields, "presence">>>;
  // Values the source attests for the ACCOUNT without saying which bureau they
  // belong to. Never copied into a bureau's fields — see UNATTRIBUTED above.
  unattributed?: Omit<BureauFields, "presence">;
}

// Hard cap so a pathological parse can never flood the account list.
const MAX_TRADELINES = 150;

// Phrases that mark a line as report boilerplate, NOT an account name.
const BOILERPLATE = [
  /payment history/i,
  /\bcomments?\b/i,
  /\bcontact\b/i,
  /debt[-\s]?to[-\s]?credit/i,
  /equifax\s*experian\s*trans\s*union/i,
  /personal information/i,
  /\binquir/i,
  /detailed information/i,
  /outstanding debt/i,
  /\bsold by\b/i,
  /\brepresents\b/i,
  /amount of credit/i,
  /show up to/i,
  /monthly payment/i,
  /account details/i,
  /credit score/i,
  /\bsummary\b/i,
  /\bremarks?\b/i,
  /this (table|account|section|report)/i,
  /view the/i,
  /\bdispute\b/i,
  /date of birth/i,
  /\bemployers?\b/i,
  /\baka\b|also known as/i,
  /years? of/i,
  /\btotal\b/i,
  /\boverview\b/i,
];

// Function words that, in quantity, mark a string as a sentence rather than a name.
const SENTENCE_WORDS =
  /\b(are|the|this|that|your|you're|have|has|been|with|which|when|from|about|includes?|will|can|may|should|these|those|their|its)\b/gi;

// Tokens that strongly indicate a real creditor/collector — lets us keep an
// account even when it lacks an explicit $ amount.
const CREDITOR_TOKENS = [
  "bank", "card", "capital one", "discover", "amex", "american express", "synchrony",
  "comenity", "fingerhut", "credit one", "chase", "citi", "wells fargo", "us bank",
  "onemain", "one main", "upgrade", "best egg", "lendingclub", "sofi", "marcus", "avant",
  "navient", "nelnet", "great lakes", "mohela", "sallie mae", "dept of ed", "aidvantage",
  "mortgage", "auto", "acceptance", "santander", "ally", "carmax", "credit acceptance",
  "lvnv", "portfolio recov", "midland", "jefferson capital", "cavalry", "resurgent",
  "encore", "convergent", "enhanced recovery", "iq data", "national credit", "receivables",
  "mdg", "1st crd", "first credit", "credit collection", "transworld", "i.c. system",
];

function stripIndex(s: string): string {
  // Remove leading outline numbers like "2.6 ", "4.10 ", "11. ".
  return s.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, "").trim();
}

function cleanName(s: string): string {
  // Drop trailing status parentheticals so they don't pollute the name.
  return stripIndex(s)
    .replace(/\s*\((?:closed|open|paid|transferred|current|derogatory)\)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Bare section headers that are not real account names.
const GENERIC_HEADERS = new Set([
  "collection", "collections", "account", "accounts", "public record", "public records",
  "real estate", "revolving accounts", "installment accounts", "open accounts",
  "closed accounts", "credit cards", "loans", "other accounts", "negative", "positive",
  "derogatory", "tradelines", "creditor", "balance", "status", "type",
]);

function looksLikeBoilerplate(name: string): boolean {
  if (!name) return true;
  if (GENERIC_HEADERS.has(name.toLowerCase())) return true;
  if (BOILERPLATE.some((p) => p.test(name))) return true;
  if (name.length > 48) return true; // creditor names are short
  if (/[.…]$/.test(name) || name.endsWith("...")) return true; // truncated prose
  const words = name.split(/\s+/);
  if (words.length >= 4) {
    const fnCount = (name.match(SENTENCE_WORDS) || []).length;
    if (fnCount >= 2) return true; // reads like a sentence
  }
  if (!/[a-z]/i.test(name)) return true; // no letters at all
  return false;
}

function toCents(s: string): number {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Balance ONLY from a labeled "Balance: $X" or an explicit $-amount. We never
// fall back to bare numbers (that's what turned outline indices into balances).
function extractBalanceCents(block: string): number {
  const labeled = block.match(/balance[:\s]*\$\s?([\d,]+(?:\.\d{2})?)/i);
  if (labeled) return toCents(labeled[1]);
  const dollarAmts = [...block.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)/g)].map((m) => toCents(m[1]));
  if (dollarAmts.length) return Math.max(...dollarAmts);
  return 0;
}

function hasAccountSignal(block: string, name: string): boolean {
  if (/\$\s?[\d,]/.test(block)) return true;
  if (
    /\b(balance|status|account\s*#|acct\s*#|date opened|date reported|past due|high credit|credit limit|charge[-\s]?off|collection|dofd|first delinquency|original creditor)\b/i.test(
      block
    )
  )
    return true;
  const lower = name.toLowerCase();
  return CREDITOR_TOKENS.some((t) => lower.includes(t));
}

export function extractRawTradelines(rawText: string, coveredBureaus: Bureau[]): ExtractedTradeline[] {
  const blocks = rawText
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: ExtractedTradeline[] = [];

  for (const block of blocks) {
    if (out.length >= MAX_TRADELINES) break;

    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const rawFirst = lines[0] || "";
    const creditorName = cleanName(rawFirst);

    // Reject empty, too-short, boilerplate, or sentence-like "names".
    if (!creditorName || creditorName.length < 2) continue;
    if (looksLikeBoilerplate(creditorName)) continue;
    // Require an actual account signal so prose blocks are dropped.
    if (!hasAccountSignal(block, creditorName)) continue;

    const balanceCents = extractBalanceCents(block);
    const dofdMatch = block.match(/(?:dofd|first delinquency)[:\s]*([0-9/\-]+)/i);
    const ocMatch = block.match(/original creditor[:\s]*(.+)/i);
    const typeMatch = block.match(/type[:\s]*(.+)/i);
    // MEDIUM-2 (S11 journey): this was the only matcher in this block without
    // /i, so a real report's "Account #: 517805XXXXXX1234" never matched and
    // every mask parsed as null. That cost the letter its account identification
    // (it degrades to a generic placeholder) AND cost tradelineKey() its only
    // disambiguator between two accounts at the same creditor, so a re-analysis
    // could mis-relink the consumer's existing dispute letters. Reports also
    // spell the label out ("Account Number:"), so that wording is accepted too.
    const acctMatch = block.match(/account\s*(?:number|no\.?|num)?[#:\s]*([xX\d\-\*]{4,})/i);
    const status = (block.match(/status[:\s]*(.+)/i)?.[1] || "").trim() || undefined;

    // This parser reads a FLAT account block: it has no way to tell which
    // bureau a value came from. Copying one status/balance/DOFD into every
    // covered bureau (what this did before) asserted that all three bureaus
    // report those exact values — a claim the report never made, and one that
    // also made crossBureauConflicts() compare identical copies and conclude
    // "no inconsistency". Attribution is only honest when the consumer told us
    // the report covers exactly ONE bureau; otherwise the values are recorded
    // as an account-level observation and every covered bureau stays UNKNOWN.
    const observed = { status, balanceCents, dofd: dofdMatch?.[1] };
    const perBureau: ExtractedTradeline["perBureau"] = {};
    if (coveredBureaus.length === 1) perBureau[coveredBureaus[0]] = observed;

    out.push({
      creditorName,
      originalCreditor: ocMatch?.[1] ? cleanName(ocMatch[1]) : undefined,
      accountNumberMask: acctMatch?.[1],
      balanceCents,
      dofd: dofdMatch?.[1],
      typeHint: typeMatch?.[1]?.trim(),
      perBureau,
      unattributed: coveredBureaus.length === 1 ? undefined : observed,
    });
  }
  return out;
}

// Convert extracted per-bureau values + the set of covered bureaus into the
// stored BureauData with honest presence flags.
//
// ABSENT is an AFFIRMATIVE claim — the UI renders it as "Not reporting this
// account" — so it may only be written when the extractor actually attributed
// this account to some bureau and left this one out. When the extractor
// attributed nothing (it could not tell, or the model returned no bureau
// list), every covered bureau is UNKNOWN: parser silence is unknown, never
// absence.
export function toBureauData(
  ex: ExtractedTradeline,
  coveredBureaus: Bureau[],
  allBureaus: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"]
): BureauData {
  const data: BureauData = {};
  const attributed = allBureaus.some((b) => ex.perBureau[b]);
  for (const b of allBureaus) {
    if (ex.perBureau[b]) {
      data[b] = { presence: "PRESENT", ...ex.perBureau[b] };
    } else if (coveredBureaus.includes(b) && attributed) {
      data[b] = { presence: "ABSENT" };
    } else {
      data[b] = { presence: "UNKNOWN" };
    }
  }
  if (ex.unattributed) {
    // Stored under a non-Bureau key with UNKNOWN presence: kept as evidence,
    // never presented as any bureau's report. See UNATTRIBUTED above.
    (data as Record<string, BureauFields>)[UNATTRIBUTED] = { presence: "UNKNOWN", ...ex.unattributed };
  }
  return data;
}
