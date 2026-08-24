// RC1-S3 — CREDIT TRUTH CORE. Guards the three claims the product makes about
// a consumer's own credit file, using the real-world matrix from the readiness
// assessment (a Founder-supplied report):
//
//   1. CONDITION — "is this account derogatory?" must be answered from the
//      report's own status text, not from account TYPE plus a
//      date-of-first-delinquency that most reports never print. A charged-off
//      Capital One card is not "Account in good standing".
//   2. ATTRIBUTION — "which bureau reports this?" must never be invented. An
//      unknown bureau list is UNKNOWN, never "present at every bureau you
//      selected", and one bureau's values are never copied into another's.
//   3. UNKNOWN — absence of evidence is neither clean nor derogatory. It is
//      NEEDS_REVIEW, and it stays that way.
//
// No DB, no network, no key. Run: npx tsx scripts/credit-truth.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Bureau } from "@prisma/client";
import {
  factualCondition,
  isFactualNegative,
  disputeQueue,
  hasAdverseStatusEvidence,
  hasAffirmativeStandingEvidence,
} from "../lib/intelligence/snapshot";
import { classifyCreditor } from "../lib/classify";
import { toExtractedTradelines, type AIAccount } from "../lib/aiParse";
import { extractRawTradelines, toBureauData, UNATTRIBUTED } from "../lib/parse";
import { presentBureaus, crossBureauConflicts, getBureauData, type BureauData } from "../lib/bureauData";
import { knownBureauCount, parseReportDate, reportedDofd, fallOffInsight } from "../lib/tradelineInsights";
import { scoreTradeline } from "../lib/scoring";
import { matchRebuiltTradelines, type RelinkRow } from "../lib/analyze";
import { explainTradeline } from "../lib/explain";

let failures = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failures++; console.error(`✗ ${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`); }
  else console.log(`✓ ${label}`);
}

const ALL: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];
const ROOT = join(__dirname, "..");

// One bureau reporting `status`, which is how a single-bureau report lands.
const reporting = (status: string, bureau: Bureau = "EQUIFAX"): BureauData => ({
  [bureau]: { presence: "PRESENT", status },
});

// ===========================================================================
// 1. CONDITION — the real-world matrix.
//
// Every row below is an account the product classified as "Clean — Account in
// good standing — no derogatory history on file", removed from the dispute
// queue, and hid Kai's explanation for, because its account TYPE came from the
// curated creditor-name list and its report never printed a DOFD.
// ===========================================================================
{
  const matrix: { creditor: string; hint: string; status: string; wantType: string }[] = [
    { creditor: "CAPITAL ONE", hint: "revolving", status: "Charge-Off", wantType: "REVOLVING" },
    { creditor: "DISCOVER BANK", hint: "revolving", status: "Collection", wantType: "REVOLVING" },
    { creditor: "SYNCHRONY BANK", hint: "revolving", status: "Charged off as bad debt", wantType: "REVOLVING" },
    { creditor: "ONEMAIN FINANCIAL", hint: "installment", status: "120 days past due", wantType: "INSTALLMENT" },
    { creditor: "UPGRADE INC", hint: "installment", status: "Collection Account", wantType: "INSTALLMENT" },
    { creditor: "EXTRA CREDIT", hint: "revolving", status: "Paid, was 120 days late", wantType: "REVOLVING" },
  ];
  for (const m of matrix) {
    const cls = classifyCreditor(m.creditor, m.hint);
    // The product type is unchanged — this is deliberately NOT fixed by
    // retyping the account as a COLLECTION/CHARGE_OFF (type is not condition).
    eq(`${m.creditor}: product type stays ${m.wantType}`, cls.accountType, m.wantType);
    const t = {
      accountType: cls.accountType,
      dateOfFirstDelinquency: null, // the report printed no DOFD — the normal case
      bureauData: reporting(m.status),
    };
    eq(`${m.creditor} "${m.status}" (no DOFD) → DEROGATORY`, factualCondition(t), "DEROGATORY");
    eq(`${m.creditor} "${m.status}" (no DOFD) → isFactualNegative`, isFactualNegative(t), true);
  }
}

// A genuine debt buyer is still typed and flagged as before (no regression).
{
  const lvnv = classifyCreditor("LVNV FUNDING LLC", "collection");
  eq("LVNV stays COLLECTION / debt buyer", [lvnv.accountType, lvnv.isDebtBuyer], ["COLLECTION", true]);
  eq("LVNV is a negative with no status text at all", isFactualNegative({ accountType: lvnv.accountType, dateOfFirstDelinquency: null }), true);
}

// A2-08 — a hardcoded creditor name must not override the report's own product
// type. MDG is consumer financing (so: never a debt buyer — that part of the
// curated list is right), but when the report explicitly prints "Revolving",
// the report wins.
{
  const printedRevolving = classifyCreditor("Mdg Us Inc", "Revolving");
  eq("MDG + report says Revolving → REVOLVING", printedRevolving.accountType, "REVOLVING");
  eq("MDG is never a debt buyer", printedRevolving.isDebtBuyer, false);
  const noProductType = classifyCreditor("Mdg Us Inc", "collection");
  eq("MDG with no product type printed → curated INSTALLMENT still applies", noProductType.accountType, "INSTALLMENT");
  eq("MDG under a Collections heading is still not a debt buyer", noProductType.isDebtBuyer, false);
  const discoverInstallment = classifyCreditor("Discover Personal Loans", "installment");
  eq("Discover + report says installment → INSTALLMENT, not the list's REVOLVING", discoverInstallment.accountType, "INSTALLMENT");
}

// ===========================================================================
// 2. NEGATION — a statement that the adverse event did NOT happen must never
//    be read as the event. Over-flagging a clean account is the same class of
//    false statement as under-flagging a derogatory one.
// ===========================================================================
{
  const clean = [
    "Pays as agreed",
    "Current; never late",
    "Open / Current, no late payments",
    "Paid in full",
    "Current, account in good standing",
    "Exceptional payment history, 0 times 30 days late",
  ];
  for (const status of clean) {
    const t = { accountType: "INSTALLMENT" as const, dateOfFirstDelinquency: null, bureauData: reporting(status) };
    eq(`"${status}" → CLEAN`, factualCondition(t), "CLEAN");
    eq(`"${status}" → not a negative`, isFactualNegative(t), false);
  }
  eq('"no derogatory history" is not derogatory', hasAdverseStatusEvidence("no derogatory history"), false);
  eq('"never late" is not derogatory', hasAdverseStatusEvidence("never late"), false);
  eq('a blank "Date of first delinquency:" LABEL is not a delinquency', hasAdverseStatusEvidence("Date of first delinquency:"), false);
  eq('"Current balance $500" is not a statement of standing', hasAffirmativeStandingEvidence("Current balance $500"), false);
  eq('"was 120 days late" IS adverse', hasAdverseStatusEvidence("Paid, was 120 days late"), true);
  eq('"Settled for less than the full balance" IS adverse', hasAdverseStatusEvidence("Settled for less than the full balance"), true);
  eq('"Repossession" IS adverse', hasAdverseStatusEvidence("Voluntary repossession"), true);
}

// ===========================================================================
// 2b. ZERO/NONE-VALUED FIELD LABELS (review M-1).
//
// A flattened PDF column routinely lands "Past Due: $0" on the same line as
// "Status: Current", and the fallback parser takes the rest of the line
// (lib/parse.ts). The label names the adverse event; the VALUE says it did not
// happen. Reading the label as the event flags a never-late account as
// derogatory — the A2-01 harm inverted, and worse than base, which called
// these accounts clean correctly.
// ===========================================================================
{
  const zeroValued = [
    "Current | Past due: $0",
    "Current, amount past due $0",
    "Open/Current. Past Due Amount: 0",
    "Charge-off amount: $0",
    "Pays as agreed. Charge-off: none",
    "Loss mitigation / foreclosure prevention plan",
    // Mine, same class:
    "Current. Charge off amount $0.00",
    "Pays as agreed; past due amount: none",
    "Current — collection amount 0",
    "Never late. Amount past due: N/A",
  ];
  for (const status of zeroValued) {
    eq(`"${status}" is not adverse evidence`, hasAdverseStatusEvidence(status), false);
    eq(`"${status}" → not a negative`, isFactualNegative({ accountType: "REVOLVING", dateOfFirstDelinquency: null, bureauData: reporting(status) }), false);
  }
  // …and the same labels with a REAL value must still flag. The zero-value
  // strip must not become a way to hide a genuine charge-off.
  const realValued: [string, boolean][] = [
    ["Charge-off amount: $1,477", true],
    ["Past due: $340", true],
    ["Past Due Amount: 210.00", true],
    ["120 days past due", true],
    ["Past due", true],           // bare label, no value: still adverse
    ["Charge-Off", true],
    ["Foreclosure", true],        // the event itself, not the prevention program
    ["Late 30 x2, 60 x1", true],  // L-1: rating-code wording
    ["Account transferred to recovery", true], // L-1
    // Review R2 controls: a real amount can never satisfy the zero value.
    ["Charge-off amount: $1,243", true],
    ["Charge-off amount: $10,000", true],
    ["Past due: $1,243", true],
    ["Amount past due $450.00", true],
    ["Charge off; past due $0; balance $1,243", true],
  ];
  for (const [status, want] of realValued) {
    eq(`"${status}" → adverse=${want}`, hasAdverseStatusEvidence(status), want);
  }
}

// ===========================================================================
// 2c. A ZERO BALANCE IS NOT A CLEAN CONDITION (review H-2).
//
// A paid charge-off and a paid collection carry "Balance: $0" BY DEFINITION,
// and both stay on the report for seven years from DOFD — they are among the
// most common derogatory items a consumer comes here to work on. Letting a
// zero balance cancel the status printed "Account in good standing — no
// derogatory history on file." over exactly those rows: A2-01 verbatim.
//
// The rule these pin: a value cancels only the label it belongs to. "Past due"
// and "late payments" ARE amounts, so a bare zero cancels them. "Charge-off",
// "collection" and "delinquent" name an EVENT, so only an explicit
// amount/amt qualifier — or a word that denies the event outright ("none") —
// can cancel those. `balance` qualifies nothing.
// ===========================================================================
{
  const zeroBalance = [
    "Collection, balance $0",
    "Charge-off, balance $0",
    "Paid collection $0",
    "Status: Charge-off  Balance: $0",
    // Mine, same class:
    "Charge-off. Balance: $0.00. Paid in full",
    "Collection — balance 0, settled",
    "Paid charge-off, current balance $0",
    "Delinquent; balance $0",
  ];
  for (const status of zeroBalance) {
    eq(`"${status}" IS adverse evidence`, hasAdverseStatusEvidence(status), true);
    eq(`"${status}" → DEROGATORY, never "good standing"`, factualCondition({ accountType: "REVOLVING", dateOfFirstDelinquency: null, bureauData: reporting(status) }), "DEROGATORY");
  }
  // The other direction stays fixed: an explicit zero AMOUNT still cancels,
  // and so does a word value that denies the event.
  eq('"Charge-off amount: $0" stays non-adverse', hasAdverseStatusEvidence("Charge-off amount: $0"), false);
  eq('"Collection amount: $0" stays non-adverse', hasAdverseStatusEvidence("Current. Collection amount: $0"), false);
  eq('"Charge-off: none" stays non-adverse', hasAdverseStatusEvidence("Pays as agreed. Charge-off: none"), false);
}

// ===========================================================================
// 3. UNKNOWN — parser silence is neither clean nor derogatory.
// ===========================================================================
{
  const silent = { accountType: "REVOLVING" as const, dateOfFirstDelinquency: null, bureauData: {} };
  eq("no status text, no DOFD → NEEDS_REVIEW (never CLEAN)", factualCondition(silent), "NEEDS_REVIEW");
  eq("NEEDS_REVIEW is not asserted as a negative either", isFactualNegative(silent), false);
  const noBureauDataAtAll = { accountType: "STUDENT_LOAN" as const, dateOfFirstDelinquency: null };
  eq("a caller with no bureauData at all still gets NEEDS_REVIEW, not CLEAN", factualCondition(noBureauDataAtAll), "NEEDS_REVIEW");

  // Existing, deliberate exclusions keep their own verdict — they are outside
  // the condition model, not "in good standing".
  eq("inquiry is NOT_APPLICABLE, even with a DOFD", factualCondition({ accountType: "INQUIRY", dateOfFirstDelinquency: new Date() }), "NOT_APPLICABLE");
  eq("government is NOT_APPLICABLE, even with a DOFD", factualCondition({ accountType: "GOVERNMENT", dateOfFirstDelinquency: new Date() }), "NOT_APPLICABLE");

  // A DOFD on file still stands on its own (pre-existing rule, unchanged).
  eq("revolving WITH a DOFD on file is DEROGATORY", factualCondition({ accountType: "REVOLVING", dateOfFirstDelinquency: new Date(), bureauData: {} }), "DEROGATORY");
}

// ===========================================================================
// 4. ATTRIBUTION — the AI extractor's bureau mapping.
// ===========================================================================
const aiAccount = (over: Partial<AIAccount> = {}): AIAccount => ({
  creditorName: "CAPITAL ONE", originalCreditor: "", accountNumberMask: "XXXX1477",
  accountTypeHint: "revolving", creditorKind: "original_creditor", balanceCents: 147700,
  status: "Charge-Off", dofd: "", dateReported: "2026-06-01", reportedByBureaus: [],
  furnisherName: "", furnisherAddressLine1: "", furnisherAddressLine2: "",
  furnisherCity: "", furnisherState: "", furnisherZip: "", furnisherPhone: "", ...over,
});

{
  // THE FABRICATION: the model returned no bureau list for a tri-bureau upload.
  const [ex] = toExtractedTradelines([aiAccount({ reportedByBureaus: [] })], ALL);
  eq("empty bureau list → no bureau is claimed to report the account", Object.keys(ex.perBureau), []);
  const data = toBureauData(ex, ALL);
  eq("empty bureau list → every covered bureau is UNKNOWN, never PRESENT", ALL.map((b) => data[b]?.presence), ["UNKNOWN", "UNKNOWN", "UNKNOWN"]);
  eq("empty bureau list → nothing renders as 'Not reporting this account' (no ABSENT)", ALL.filter((b) => data[b]?.presence === "ABSENT"), []);
  eq("empty bureau list → presentBureaus is empty", presentBureaus(data), []);
  eq("empty bureau list → no cross-bureau conflict claims", crossBureauConflicts(data), []);
  // The observation itself is not discarded — it is recorded unattributed, so
  // the condition model can still read the report's own words.
  eq("the observed status survives, unattributed", (data as Record<string, { status?: string }>)[UNATTRIBUTED]?.status, "Charge-Off");
  eq("unattributed evidence still yields DEROGATORY", factualCondition({ accountType: "REVOLVING", dateOfFirstDelinquency: null, bureauData: data }), "DEROGATORY");
}

{
  // Single-bureau report: the one value set unambiguously belongs to that bureau.
  const [ex] = toExtractedTradelines([aiAccount({ reportedByBureaus: ["EQUIFAX"] })], ["EQUIFAX"]);
  const data = toBureauData(ex, ["EQUIFAX"]);
  eq("single-bureau → attributed to that bureau", [data.EQUIFAX?.presence, data.EQUIFAX?.status, data.EQUIFAX?.balanceCents], ["PRESENT", "Charge-Off", 147700]);
  eq("single-bureau → the other two are UNKNOWN, not ABSENT", [data.EXPERIAN?.presence, data.TRANSUNION?.presence], ["UNKNOWN", "UNKNOWN"]);
  eq("single-bureau → no unattributed duplicate of the same values", (data as Record<string, unknown>)[UNATTRIBUTED], undefined);
  eq("single-bureau → condition still reads from the bureau's status", factualCondition({ accountType: "REVOLVING", dateOfFirstDelinquency: null, bureauData: data }), "DEROGATORY");
}

{
  // Two bureaus attested for a tri-bureau upload: presence is a real
  // attestation, the single value set is not attributable to either of them,
  // and the third bureau's absence IS attested.
  const [ex] = toExtractedTradelines([aiAccount({ reportedByBureaus: ["EQUIFAX", "EXPERIAN"] })], ALL);
  const data = toBureauData(ex, ALL);
  eq("multi-bureau → presence attested for the reported bureaus", [data.EQUIFAX?.presence, data.EXPERIAN?.presence], ["PRESENT", "PRESENT"]);
  eq("multi-bureau → the un-listed covered bureau is ABSENT (a real attestation)", data.TRANSUNION?.presence, "ABSENT");
  eq("multi-bureau → one bureau's values are NOT copied into each bureau", [data.EQUIFAX?.status, data.EXPERIAN?.status, data.EQUIFAX?.balanceCents], [undefined, undefined, undefined]);
  eq("multi-bureau → no conflict is manufactured from identical copies", crossBureauConflicts(data), []);
  eq("multi-bureau → the report's words are still on file, unattributed", (data as Record<string, { status?: string }>)[UNATTRIBUTED]?.status, "Charge-Off");
}

{
  // A bureau the consumer never uploaded can never be claimed, even if the
  // model names it.
  const [ex] = toExtractedTradelines([aiAccount({ reportedByBureaus: ["EQUIFAX", "TRANSUNION"] })], ["EQUIFAX"]);
  const data = toBureauData(ex, ["EQUIFAX"]);
  eq("a bureau outside the covered set is dropped, not reported", [data.EQUIFAX?.presence, data.TRANSUNION?.presence], ["PRESENT", "UNKNOWN"]);
}


// ===========================================================================
// 5. ATTRIBUTION — the deterministic fallback parser, which reads a FLAT block
//    and cannot attribute anything to a bureau.
// ===========================================================================
const BLOCK = [
  "Discover Card",
  "Type: Revolving",
  "Balance: $1,477.00",
  "Status: Charge-off",
  "Account#: XXXX1477",
].join("\n");

{
  const [ex] = extractRawTradelines(BLOCK, ["EQUIFAX"]);
  const data = toBureauData(ex, ["EQUIFAX"]);
  eq("regex, single-bureau → attributed to the one covered bureau", [data.EQUIFAX?.presence, data.EQUIFAX?.status], ["PRESENT", "Charge-off"]);
  eq("regex, single-bureau → charge-off status makes it a negative", isFactualNegative({ accountType: "REVOLVING", dateOfFirstDelinquency: null, bureauData: data }), true);
}

{
  const [ex] = extractRawTradelines(BLOCK, ALL);
  const data = toBureauData(ex, ALL);
  eq("regex, tri-merge → no bureau is claimed to report it", ALL.map((b) => data[b]?.presence), ["UNKNOWN", "UNKNOWN", "UNKNOWN"]);
  eq("regex, tri-merge → one status is not smeared across three bureaus", ALL.map((b) => (data[b] as { status?: string } | undefined)?.status), [undefined, undefined, undefined]);
  eq("regex, tri-merge → no conflict claims from copies", crossBureauConflicts(data), []);
  eq("regex, tri-merge → the status is still evidence, unattributed", isFactualNegative({ accountType: "REVOLVING", dateOfFirstDelinquency: null, bureauData: data }), true);
}

{
  // Review M-2 — attribution PARITY between the two parsers. A single-bureau
  // report where the model omits the bureau list must not lose its
  // attribution: every account in a one-bureau report is that bureau's, which
  // is what the system prompt itself tells the model. Losing it left
  // presentBureaus empty (the "—" bureau badge on the tradelines page) and let
  // the letter builder's API path fall through to a hardcoded EQUIFAX default —
  // a letter aimed at a bureau whose report was never uploaded.
  const [ex] = toExtractedTradelines([aiAccount({ reportedByBureaus: [] })], ["TRANSUNION"]);
  const data = toBureauData(ex, ["TRANSUNION"]);
  eq("AI path, single covered bureau + no model list → attributed anyway", [data.TRANSUNION?.presence, data.TRANSUNION?.status], ["PRESENT", "Charge-Off"]);
  eq("AI path, single covered bureau → presentBureaus is not empty", presentBureaus(data), ["TRANSUNION"]);
  eq("AI path, single covered bureau → nothing left unattributed", (data as Record<string, unknown>)[UNATTRIBUTED], undefined);
  const [rex] = extractRawTradelines(BLOCK, ["TRANSUNION"]);
  const rdata = toBureauData(rex, ["TRANSUNION"]);
  eq("both parsers answer the single-covered-bureau question identically", [presentBureaus(data), presentBureaus(rdata)], [["TRANSUNION"], ["TRANSUNION"]]);
  // The multi-bureau case is unchanged by the parity rule.
  const [multi] = toExtractedTradelines([aiAccount({ reportedByBureaus: [] })], ALL);
  eq("parity rule does not re-introduce fabrication on a tri-bureau upload", presentBureaus(toBureauData(multi, ALL)), []);
}

// Real per-bureau data (the demo/seed shape) must still produce real conflicts —
// the honesty fix must not blunt the product's actual cross-bureau finding.
{
  const real: BureauData = {
    EQUIFAX: { presence: "PRESENT", status: "Charge-off", balanceCents: 147700 },
    EXPERIAN: { presence: "PRESENT", status: "Collection", balanceCents: 152000 },
    TRANSUNION: { presence: "ABSENT" },
  };
  eq("genuinely differing per-bureau values still surface as conflicts", crossBureauConflicts(getBureauData(real)).length, 2);
}

// ===========================================================================
// 6. The AI Action Plan queue and the parse-mode disclosure — the two
//    consumer-facing surfaces this slice owns.
// ===========================================================================
// ---- The queue itself: derived ONCE, behaviorally ----
//
// app/strategist/AiPlan.tsx:106 decides a generated plan has gone stale by
// comparing the item count the ROUTE returned against the count the PAGE
// passes. When those two came from independently-written filters they drifted,
// and the drift rendered as "Your dispute queue has changed since this plan was
// written" on a case where nothing had changed. One derivation, both callers.
{
  const rows = [
    { id: "a", probability: "HIGH", accountType: "REVOLVING" as const, dateOfFirstDelinquency: null, bureauData: reporting("Charge-Off") },
    { id: "b", probability: "MEDIUM", accountType: "INSTALLMENT" as const, dateOfFirstDelinquency: null, bureauData: reporting("Pays as agreed") },
    { id: "c", probability: "LOW", accountType: "REVOLVING" as const, dateOfFirstDelinquency: null, bureauData: {} },
    { id: "d", probability: "NOT_RECOMMENDED", accountType: "GOVERNMENT" as const, dateOfFirstDelinquency: null, bureauData: reporting("Charge-Off") },
    { id: "e", probability: "LOW", accountType: "COLLECTION" as const, dateOfFirstDelinquency: null, bureauData: {} },
  ];
  eq("disputeQueue keeps only confirmed negatives that aren't statutory", disputeQueue(rows).map((r) => r.id), ["a", "e"]);
  eq("a CLEAN row is not queued", disputeQueue(rows).some((r) => r.id === "b"), false);
  eq("a NEEDS_REVIEW row is not queued", disputeQueue(rows).some((r) => r.id === "c"), false);
  eq("a government debt is not queued even when its status is adverse", disputeQueue(rows).some((r) => r.id === "d"), false);
}

{
  const route = readFileSync(join(ROOT, "app/api/strategist/plan/route.ts"), "utf8");
  const page = readFileSync(join(ROOT, "app/strategist/page.tsx"), "utf8");
  // Source-level, deliberately loose: these assert WHERE the queue comes from,
  // which no behavioral test of a Next route handler / server component can
  // reach offline. Kept resilient to reformatting.
  eq("plan route takes its queue from the shared derivation", /disputeQueue\(\s*tradelines\s*\)/.test(route), true);
  eq("plan route does not re-implement the filter", /tradelines\.filter\([^)]*probability/.test(route), false);
  eq("strategy desk takes its queue from the same derivation", /disputeQueue\(\s*tradelines\s*\)/.test(page), true);
  eq("strategy desk feeds that same queue to AiPlan's staleness check", /currentItemCount=\{queue\.length\}/.test(page), true);
  eq("strategy desk no longer prints a good-standing claim on a ranked row", page.includes("Account in good standing — no derogatory history on file."), false);
  eq("strategy desk names the unconfirmed state honestly", page.includes("couldn&apos;t confirm this account&apos;s standing") || page.includes("couldn't confirm this account's standing"), true);

  eq("no fabricated fallback angle is injected into the prompt", route.includes("standard reinvestigation"), false);
  eq("an item with no angle is described truthfully", route.includes("none identified by the analysis"), true);
  eq("the prompt forbids inventing an angle", /Do NOT invent one/.test(route), true);
  eq("the empty-plan message points at a path that exists (M-3)", route.includes("Letters page lets you start a dispute for any account"), true);
  eq("the empty-plan message no longer points at a row with no CTA", route.includes("start from that account's row"), false);

  const upload = readFileSync(join(ROOT, "app/upload/page.tsx"), "utf8");

  // The property: the extraction-quality disclosure must render on BOTH result
  // surfaces whenever the analysis did not use the AI reader OR was degraded.
  //
  // This used to be pinned as a literal source shape
  // (`!done.usedAI && <ExtractionFallbackNotice`). When S2 widened the
  // condition to `(!done.usedAI || done.degraded)` — the product doing MORE of
  // what the guard exists to require — the pin broke. A pin that matches
  // punctuation passes for the wrong reason and fails for the wrong reason, so
  // this one reads the enclosing JSX guard of every render site instead: it
  // survives a refactor of the same behaviour, and still fails if a site or
  // either operand is removed, or if the OR is narrowed to an AND.
  function enclosingJsxGuard(src: string, at: number): string {
    let depth = 0;
    for (let i = at - 1; i >= 0; i--) {
      const c = src[i];
      if (c === "}") depth++;
      else if (c === "{") {
        if (depth === 0) return src.slice(i + 1, at);
        depth--;
      }
    }
    return "";
  }
  const sites = [...upload.matchAll(/<ExtractionFallbackNotice\b/g)].map((m) => m.index ?? 0);
  const guards = sites.map((at) => enclosingJsxGuard(upload, at));
  const notAi = /!\s*[\w.]*\busedAI\b|\busedAI\s*===\s*false\b/;
  const degraded = /\bdegraded\b/;
  // Either operand order, so long as they are alternatives and not conjuncts.
  const asAlternatives =
    /(!\s*[\w.]*\busedAI\b[\s\S]{0,120}?\|\|[\s\S]{0,120}?\bdegraded\b)|(\bdegraded\b[\s\S]{0,120}?\|\|[\s\S]{0,120}?!\s*[\w.]*\busedAI\b)/;
  eq("the fallback notice renders on BOTH result surfaces (reveal and no-reveal)", sites.length >= 2, true);
  eq("every render site is gated on the run not having used the AI reader", guards.length > 0 && guards.every((g) => notAi.test(g)), true);
  eq("…and every one also discloses a degraded run", guards.length > 0 && guards.every((g) => degraded.test(g)), true);
  eq("…as alternatives, so either condition alone discloses", guards.length > 0 && guards.every((g) => asAlternatives.test(g)), true);
  eq("upload no longer promises what it cannot keep about bureau attribution", upload.includes("never assert what a bureau reports unless its report was actually uploaded"), false);
  eq("upload states the unknown-bureau rule instead", upload.includes("we mark that unknown instead of assuming"), true);
}


// ===========================================================================
// 7. ZERO BUREAUS IS NOT ONE BUREAU (S11 journey HIGH-2).
//
// `hasCrossBureauKnowledge` is "2 or more", so its negation covers BOTH "one
// bureau" and "no bureau at all". Two surfaces branched on that negation and
// then said "this bureau" / "Only one bureau's data is on file" for accounts
// where all three bureaus are UNKNOWN — naming a bureau the report never named.
// It fired on every account of every multi-bureau report read by the fallback
// extractor, which is the fail-closed default state of the build.
// ===========================================================================
{
  const noBureaus: BureauData = { EQUIFAX: { presence: "UNKNOWN" }, EXPERIAN: { presence: "UNKNOWN" }, TRANSUNION: { presence: "UNKNOWN" } };
  const oneBureau: BureauData = { EQUIFAX: { presence: "PRESENT", status: "Charge-Off", balanceCents: 147700 }, EXPERIAN: { presence: "UNKNOWN" }, TRANSUNION: { presence: "UNKNOWN" } };
  const twoBureaus: BureauData = { EQUIFAX: { presence: "PRESENT", status: "Charge-Off", balanceCents: 147700 }, EXPERIAN: { presence: "PRESENT", status: "Collection", balanceCents: 152000 }, TRANSUNION: { presence: "ABSENT" } };

  eq("knownBureauCount: all UNKNOWN → 0", knownBureauCount(noBureaus), 0);
  eq("knownBureauCount: one PRESENT → 1", knownBureauCount(oneBureau), 1);
  eq("knownBureauCount: PRESENT + PRESENT + ABSENT → 3", knownBureauCount(twoBureaus), 3);
  eq("knownBureauCount: the UNATTRIBUTED entry is not a bureau", knownBureauCount({ ...noBureaus, [UNATTRIBUTED]: { presence: "UNKNOWN", status: "Charge-Off" } }), 0);

  const score = (bureauData: BureauData) =>
    scoreTradeline({ accountType: "CHARGE_OFF", isDebtBuyer: false, balanceCents: 147700, dateOfFirstDelinquency: null, bureauData, nonStrategic: false, creditorName: "CAPITAL ONE" });

  const zeroReasons = score(noBureaus).reasons.join(" ");
  eq("scoring: zero bureaus never says \"this bureau\"", /this bureau/i.test(zeroReasons), false);
  eq("scoring: zero bureaus never claims single-bureau data", zeroReasons.includes("Single-bureau data"), false);
  eq("scoring: zero bureaus states the attribution as unknown", zeroReasons.includes("No bureau attribution on file"), true);
  eq("scoring: ONE bureau still gets the single-bureau read", score(oneBureau).reasons.join(" ").includes("Single-bureau data"), true);
  eq("scoring: two bureaus get neither unknown-attribution nor single-bureau copy", [
    score(twoBureaus).reasons.join(" ").includes("No bureau attribution on file"),
    score(twoBureaus).reasons.join(" ").includes("Single-bureau data"),
  ], [false, false]);

  const explain = (bureauData: BureauData) =>
    explainTradeline({ accountType: "CHARGE_OFF", isDebtBuyer: false, balance: 147700, probability: "HIGH", reasons: [], dateOfFirstDelinquency: null, bureauData, creditorName: "CAPITAL ONE", recommendedStrategy: "fcra_611" });

  const zeroUncertainty = explain(noBureaus).uncertainty.join(" ");
  eq("explain: zero bureaus never says \"Only one bureau\"", zeroUncertainty.includes("Only one bureau"), false);
  eq("explain: zero bureaus never says \"that bureau\"", /that bureau/i.test(zeroUncertainty), false);
  eq("explain: zero bureaus states the attribution as unknown", zeroUncertainty.includes("didn't say which bureau reports this account"), true);
  eq("explain: ONE bureau still gets the single-bureau caveat", explain(oneBureau).uncertainty.some((u) => u.includes("Only one bureau")), true);
  eq("explain: zero bureaus makes no contradiction claim", explain(noBureaus).contradictions, []);
  eq("explain: zero bureaus attributes nothing to a bureau", explain(noBureaus).bureauContributions, []);
}

// ===========================================================================
// 8. ACCOUNT-NUMBER MASKS (S11 journey MEDIUM-2).
//
// The mask matcher was the only one in its block without /i, so a real report's
// capitalized "Account #:" never matched and every mask parsed as null — which
// also strips tradelineKey() of its only disambiguator between two accounts at
// the same creditor, so a re-analysis can mis-relink the consumer's letters.
// ===========================================================================
{
  const realBlock = [
    "CAPITAL ONE",
    "Account #: 517805XXXXXX1234",
    "Type: Revolving",
    "Balance: $1,477.00",
    "Status: Charge-Off",
  ].join("\n");
  const [ex] = extractRawTradelines(realBlock, ["EQUIFAX"]);
  eq("capitalized \"Account #:\" is captured", ex?.accountNumberMask, "517805XXXXXX1234");

  const lower = extractRawTradelines(["DISCOVER BANK", "account#: XXXX1477", "Balance: $500.00"].join("\n"), ["EQUIFAX"]);
  eq("lowercase \"account#:\" still works", lower[0]?.accountNumberMask, "XXXX1477");
  const mixed = extractRawTradelines(["ONEMAIN FINANCIAL", "ACCOUNT NUMBER: 4521-XXXX-8890", "Balance: $9,000.00"].join("\n"), ["EQUIFAX"]);
  eq("upper-case \"ACCOUNT NUMBER:\" is captured", mixed[0]?.accountNumberMask, "4521-XXXX-8890");
}

// ===========================================================================
// 9. DATES AS REPORTS PRINT THEM (S11 journey MEDIUM-3).
//
// `new Date("08/2021")` is Invalid, so a month-only DOFD — one of the commonest
// formats on a consumer report — disabled the §605 clock entirely. It is now
// parsed, but a month is NEVER widened into a day: the persisted column is
// printed verbatim inside a mailed dispute letter, so a day we invented would
// become an assertion the consumer signs.
// ===========================================================================
{
  const p = (v: string | null | undefined) => {
    const r = parseReportDate(v ?? null);
    return r ? [r.date.toISOString().slice(0, 10), r.precision] : null;
  };
  eq('MM/YYYY parses at MONTH precision, anchored to month end', p("08/2021"), ["2021-08-31", "month"]);
  eq('MM-YYYY parses at MONTH precision', p("08-2021"), ["2021-08-31", "month"]);
  eq('YYYY-MM parses at MONTH precision (never silently day 1)', p("2021-08"), ["2021-08-31", "month"]);
  eq('MM/DD/YYYY parses at DAY precision', p("08/15/2021"), ["2021-08-15", "day"]);
  eq('YYYY-MM-DD parses at DAY precision', p("2021-08-15"), ["2021-08-15", "day"]);
  eq('MM-DD-YYYY parses at DAY precision', p("08-15-2021"), ["2021-08-15", "day"]);
  eq("absent DOFD stays null", [p(null), p(""), p(undefined)], [null, null, null]);
  eq("garbage stays null", [p("not-a-date"), p("13/2021"), p("0021-08")], [null, null, null]);
  eq("a bare year is refused — no honest month to anchor a §605 clock to", p("2021"), null);

  // The clock actually runs on a month-only DOFD.
  const monthOnly = { accountType: "CHARGE_OFF" as const, creditorName: "CAPITAL ONE", dateOfFirstDelinquency: null, bureauData: { EQUIFAX: { presence: "PRESENT", status: "Charge-Off", dofd: "08/2015" } } as BureauData };
  const fall = fallOffInsight(monthOnly);
  eq("§605 clock runs from a month-only DOFD", [fall?.windowYears, fall?.pastWindow, fall?.dofdPrecision], [7, true, "month"]);
  eq("scoring fires the §605 obsolescence angle on a month-only DOFD", scoreTradeline({ accountType: "CHARGE_OFF", isDebtBuyer: false, balanceCents: 0, dateOfFirstDelinquency: null, bureauData: monthOnly.bureauData, nonStrategic: false, creditorName: "CAPITAL ONE" }).reasons.some((r) => r.includes("§605")), true);
  eq("explain discloses that the DOFD is a month, not a day", explainTradeline({ accountType: "CHARGE_OFF", isDebtBuyer: false, balance: 0, probability: "HIGH", reasons: [], dateOfFirstDelinquency: null, bureauData: monthOnly.bureauData, creditorName: "CAPITAL ONE", recommendedStrategy: "fcra_611" }).uncertainty.some((u) => u.includes("reported as a month, not a specific day")), true);

  // …and it is still a derogatory EVENT, so the missing day cannot launder it.
  eq("a month-only reported DOFD alone makes the account DEROGATORY", factualCondition({ accountType: "REVOLVING", dateOfFirstDelinquency: null, bureauData: { EQUIFAX: { presence: "PRESENT", dofd: "08/2021" } } }), "DEROGATORY");
  eq("no DOFD anywhere is still NEEDS_REVIEW, never CLEAN", factualCondition({ accountType: "REVOLVING", dateOfFirstDelinquency: null, bureauData: { EQUIFAX: { presence: "PRESENT" } } }), "NEEDS_REVIEW");

  // Bureaus disagreeing on the DOFD: take the LATEST, so obsolescence is never
  // claimed before every reported date supports it.
  eq("conflicting reported DOFDs resolve to the latest", reportedDofd({ dateOfFirstDelinquency: null, bureauData: { EQUIFAX: { presence: "PRESENT", dofd: "01/2019" }, EXPERIAN: { presence: "PRESENT", dofd: "11/2020" } } })?.date.toISOString().slice(0, 10), "2020-11-30");
  eq("the persisted column wins over the report text when present", reportedDofd({ dateOfFirstDelinquency: new Date(Date.UTC(2022, 4, 9)), bureauData: { EQUIFAX: { presence: "PRESENT", dofd: "01/2019" } } })?.source, "column");
}


// ===========================================================================
// 10. TWO-DIGIT YEARS ARE YEARS, NOT DAYS (S11 AD review, AD-R2-2 note (b)).
//
// `parseReportDate("08/21")` used to fall through every explicit branch to
// `new Date(v + " UTC")`, where the "names a day" heuristic read the 21 as a
// day-of-month: 2001-08-21 at DAY precision. Two faults in one value — a
// fabricated exact day the report never gave, and an anchor twenty years early,
// which let the §605 clock call a 2021 delinquency obsolete. Since
// reportedDofd() is now the single authority the clock, the scoring engine and
// the condition model all read, one bad parse propagated to all three at once,
// and obsolescence claimed early is precisely the assertion a dispute letter
// must never carry.
//
// MM/YY is MONTH precision: a date of first delinquency without a year cannot
// anchor anything, so the second number is a year, and the month is all the
// report actually stated.
// ===========================================================================
{
  const p = (v: string | null | undefined) => {
    const r = parseReportDate(v ?? null);
    return r ? [r.date.toISOString().slice(0, 10), r.precision] : null;
  };
  // The five shapes the round asked to pin, each with its documented value.
  eq('"08/21" (MM/YY) → August 2021 at MONTH precision, never 2001 and never a day', p("08/21"), ["2021-08-31", "month"]);
  eq('"08/2021" → MONTH precision', p("08/2021"), ["2021-08-31", "month"]);
  eq('"2021-08" → MONTH precision', p("2021-08"), ["2021-08-31", "month"]);
  eq('"08/15/2021" → DAY precision', p("08/15/2021"), ["2021-08-15", "day"]);
  eq('garbage → null', p("not-a-date"), null);

  eq('"08-21" (MM-YY) is the same shape', p("08-21"), ["2021-08-31", "month"]);
  eq('"12/99" resolves to the past century, not 2099', p("12/99"), ["1999-12-31", "month"]);
  eq('"08/15/21" (MM/DD/YY) states a day, so DAY precision with the century inferred', p("08/15/21"), ["2021-08-15", "day"]);
  eq('"15/08/21" is refused — month 15 is not a month', p("15/08/21"), null);
  eq('"21/08" is refused — ambiguous, and 21 is not a month', p("21/08"), null);
  eq('"13/21" is refused', p("13/21"), null);
  // The same class, one layer out: a string with no four-digit year can no
  // longer reach `new Date`, which would have invented the current year.
  eq('"Aug 21" is refused rather than dated to the current year', p("Aug 21"), null);
  eq('"Aug 2021" still parses at MONTH precision', p("Aug 2021"), ["2021-08-31", "month"]);
  eq('"August 15, 2021" still parses at DAY precision', p("August 15, 2021"), ["2021-08-15", "day"]);
  eq('an 8-digit run with no separators is refused', p("08152021"), null);
  eq('a bare year is still refused', p("2021"), null);

  // The consequence that matters: a RECENT delinquency written MM/YY must not
  // be called obsolete. Built from the clock so the guard cannot rot.
  const now = new Date();
  const recent = new Date(Date.UTC(now.getUTCFullYear() - 3, now.getUTCMonth(), 1));
  const mmYY = `${String(recent.getUTCMonth() + 1).padStart(2, "0")}/${String(recent.getUTCFullYear() % 100).padStart(2, "0")}`;
  eq(`"${mmYY}" (3 years ago, MM/YY) resolves to the right year`, parseReportDate(mmYY)?.date.getUTCFullYear(), recent.getUTCFullYear());
  const recentData: BureauData = { EQUIFAX: { presence: "PRESENT", status: "Charge-Off", dofd: mmYY } };
  const recentFall = fallOffInsight({ accountType: "CHARGE_OFF", creditorName: "CAPITAL ONE", bureauData: recentData, dateOfFirstDelinquency: null });
  eq(`a ${mmYY} delinquency is NOT past the §605 window`, [recentFall?.pastWindow, recentFall?.dofdPrecision], [false, "month"]);
  eq("scoring raises no §605 obsolescence angle for it", scoreTradeline({ accountType: "CHARGE_OFF", isDebtBuyer: false, balanceCents: 50000, dateOfFirstDelinquency: null, bureauData: recentData, nonStrategic: false, creditorName: "CAPITAL ONE" }).disputeAngles.some((a) => a.includes("obsolete")), false);
  // …while still counting as the derogatory event it is.
  eq("and it is still DEROGATORY — a missing day launders nothing", factualCondition({ accountType: "REVOLVING", dateOfFirstDelinquency: null, bureauData: recentData }), "DEROGATORY");
  // An OLD MM/YY delinquency does still reach the window (the fix is not a mute).
  const oldData: BureauData = { EQUIFAX: { presence: "PRESENT", status: "Charge-Off", dofd: `08/${String((now.getUTCFullYear() - 12) % 100).padStart(2, "0")}` } };
  eq("a genuinely old MM/YY delinquency is still past the window", fallOffInsight({ accountType: "CHARGE_OFF", creditorName: "CAPITAL ONE", bureauData: oldData, dateOfFirstDelinquency: null })?.pastWindow, true);
  // Month precision is never persisted, so no invented day can reach a letter.
  eq("a MM/YY DOFD never becomes a day-precision column value", reportedDofd({ dateOfFirstDelinquency: null, bureauData: recentData })?.precision, "month");
}


// ===========================================================================
// 11. A PARSER IMPROVEMENT MUST NOT ORPHAN EXISTING LETTERS (S11 AD, NEW-4).
//
// The re-link that carries a consumer's dispute letters across a re-analysis
// matched on creditor|originalCreditor|accountNumberMask and gave up when the
// exact key missed. But that key is computed by OUR parser, so the
// case-insensitive account-mask fix changes its shape for rows ALREADY IN THE
// DATABASE: a row stored before the fix has accountNumberMask = null, the same
// account re-parsed after it has "…1234", the lookup misses, and
// Letter.tradelineId goes NULL. The authorization gate then treats the orphan as
// revoked — a real, previously-valid letter becomes un-approvable and
// un-printable, and the consumer is told the account is no longer on their
// report when only our parser changed.
//
// Invisible on a fresh database; lands only on existing users, at upgrade.
// ===========================================================================
{
  const row = (id: string, creditorName: string, accountNumberMask?: string | null, originalCreditor?: string | null): RelinkRow =>
    ({ id, creditorName, accountNumberMask: accountNumberMask ?? null, originalCreditor: originalCreditor ?? null });

  // THE migration case: stored with no mask (old regex never matched a
  // capitalised "Account #:"), re-parsed with one.
  const migrated = matchRebuiltTradelines([row("p1", "CAPITAL ONE", null)], [row("n1", "CAPITAL ONE", "517805XXXXXX1234")]);
  eq("a row parsed before the mask fix re-links after it", migrated.get("p1"), "n1");

  // …and the reverse shape (a mask that stops parsing) is the same hazard.
  eq("a row that loses its mask still re-links", matchRebuiltTradelines([row("p1", "CAPITAL ONE", "XXXX1234")], [row("n1", "CAPITAL ONE", null)]).get("p1"), "n1");
  eq("a mask that merely changes shape still re-links", matchRebuiltTradelines([row("p1", "CAPITAL ONE", "XXXX1234")], [row("n1", "CAPITAL ONE", "517805XXXXXX1234")]).get("p1"), "n1");

  // The guarantee that must NOT be weakened: an account that genuinely left the
  // report matches nothing and is still orphaned, honestly.
  const gone = matchRebuiltTradelines([row("p1", "LVNV FUNDING LLC", "XXXX9999")], [row("n1", "CAPITAL ONE", "517805XXXXXX1234")]);
  eq("an account that truly disappeared does NOT re-link", gone.get("p1"), undefined);
  eq("…and nothing else is linked in its place", gone.size, 0);
  eq("an empty rebuild orphans everything", matchRebuiltTradelines([row("p1", "CAPITAL ONE", null)], []).size, 0);

  // Exactness still wins where it can, and no rebuilt row is claimed twice.
  const twoExact = matchRebuiltTradelines(
    [row("p1", "CAPITAL ONE", "XXXX1111"), row("p2", "CAPITAL ONE", "XXXX2222")],
    [row("n2", "CAPITAL ONE", "XXXX2222"), row("n1", "CAPITAL ONE", "XXXX1111")]
  );
  eq("two accounts at one creditor keep their own identities", [twoExact.get("p1"), twoExact.get("p2")], ["n1", "n2"]);

  // Ambiguity is refused, never guessed: two same-creditor rows, one rebuilt.
  const ambiguous = matchRebuiltTradelines(
    [row("p1", "CAPITAL ONE", "XXXX1111"), row("p2", "CAPITAL ONE", "XXXX2222")],
    [row("n1", "CAPITAL ONE", "517805XXXXXX9999")]
  );
  eq("two candidates, one rebuilt row → no guess", ambiguous.size, 0);

  // …but once the ambiguity is resolved by an exact match, the leftover is forced.
  const forced = matchRebuiltTradelines(
    [row("p1", "CAPITAL ONE", "XXXX1111"), row("p2", "CAPITAL ONE", "XXXX2222")],
    [row("n2", "CAPITAL ONE", "XXXX2222"), row("n1", "CAPITAL ONE", "517805XXXXXX1111")]
  );
  eq("the exact match takes its row, and the only leftover pair is linked", [forced.get("p1"), forced.get("p2")], ["n1", "n2"]);

  // Original creditor still separates two collections at the same collector.
  const byOriginal = matchRebuiltTradelines(
    [row("p1", "LVNV FUNDING", null, "Credit One"), row("p2", "LVNV FUNDING", null, "Synchrony")],
    [row("n1", "LVNV FUNDING", "XXXX1", "Synchrony"), row("n2", "LVNV FUNDING", "XXXX2", "Credit One")]
  );
  eq("the original creditor still distinguishes two accounts at one collector", [byOriginal.get("p1"), byOriginal.get("p2")], ["n2", "n1"]);

  // Casing and whitespace are normalized on both sides (they always were for
  // case; whitespace is new) — this is an exact match, not the fallback.
  eq("casing and internal whitespace never break an exact match", matchRebuiltTradelines([row("p1", "capital  one", "xxxx1234")], [row("n1", "CAPITAL ONE", "XXXX1234")]).get("p1"), "n1");

  // ── B-R4-1 · FORCED IS NOT CORRECT ──────────────────────────────────────
  //
  // The count rule ("one prior left, one rebuilt left") pairs whatever remains.
  // When the two remaining rows are genuinely DIFFERENT accounts at one
  // creditor — one closed and gone, another newly appearing — it re-points the
  // consumer's mailed dispute at an account they never disputed, and closing
  // that dispute out as "corrected or removed" then writes resolved: true onto
  // the wrong row. The pairing must be corroborated, not merely forced.
  const acct = (
    id: string,
    creditorName: string,
    o: { mask?: string | null; type?: string; balance?: number; original?: string | null; debtBuyer?: boolean } = {}
  ): RelinkRow => ({
    id,
    creditorName,
    originalCreditor: o.original ?? null,
    accountNumberMask: o.mask ?? null,
    accountType: o.type ?? "REVOLVING",
    isDebtBuyer: o.debtBuyer ?? false,
    balance: o.balance ?? 147700,
  });

  // The reviewer's measured mis-links (r4 probe cases C, D, E).
  eq("C · 1234 left and a different 9999 arrived at one creditor → NO link",
    matchRebuiltTradelines([acct("old1234", "CAPITAL ONE", { mask: "****1234" })], [acct("new9999", "CAPITAL ONE", { mask: "****9999", balance: 30000 })]).size, 0);

  const caseD = matchRebuiltTradelines(
    [acct("oldA", "CAPITAL ONE", { mask: "****1234" }), acct("oldB", "CAPITAL ONE", { mask: "****5678", balance: 22000 })],
    [acct("newA", "CAPITAL ONE", { mask: "****1234" }), acct("newC", "CAPITAL ONE", { mask: "****9999", balance: 30000 })]
  );
  eq("D · the surviving account still links", caseD.get("oldA"), "newA");
  eq("D · the departed one does NOT inherit the newcomer", caseD.get("oldB"), undefined);
  eq("D · exactly one pairing is made", caseD.size, 1);

  eq("E · same collector and original creditor, different account numbers → NO link",
    matchRebuiltTradelines(
      [acct("oldDebt", "MIDLAND CREDIT", { mask: "****1111", original: "SYNCHRONY BANK", debtBuyer: true, type: "COLLECTION" })],
      [acct("newDebt", "MIDLAND CREDIT", { mask: "****2222", original: "SYNCHRONY BANK", debtBuyer: true, type: "COLLECTION", balance: 90000 })]
    ).size, 0);

  // The intended case must still work, with the corroborating fields present:
  // the SAME account, re-parsed, whose mask changed shape.
  eq("a true mask-shape change on the same account still links",
    matchRebuiltTradelines([acct("p1", "CAPITAL ONE", { mask: "XXXX1234" })], [acct("n1", "CAPITAL ONE", { mask: "517805XXXXXX1234" })]).get("p1"), "n1");
  eq("the mask fix's null → mask migration still links",
    matchRebuiltTradelines([acct("p1", "CAPITAL ONE", { mask: null })], [acct("n1", "CAPITAL ONE", { mask: "517805XXXXXX1234" })]).get("p1"), "n1");
  eq("…and the reverse, mask → null, still links",
    matchRebuiltTradelines([acct("p1", "CAPITAL ONE", { mask: "XXXX1234" })], [acct("n1", "CAPITAL ONE", { mask: null })]).get("p1"), "n1");

  // When the mask can say nothing (one side never parsed a number), something
  // else must corroborate — a different balance or type means a different
  // account, and it is refused.
  eq("mask silent + different balance → NO link",
    matchRebuiltTradelines([acct("p1", "CAPITAL ONE", { mask: "****1234", balance: 147700 })], [acct("n1", "CAPITAL ONE", { mask: null, balance: 30000 })]).size, 0);
  eq("mask silent + different account type → NO link",
    matchRebuiltTradelines([acct("p1", "CAPITAL ONE", { mask: null, type: "REVOLVING" })], [acct("n1", "CAPITAL ONE", { mask: "****9999", type: "COLLECTION" })]).size, 0);
  eq("mask silent + different debt-buyer status → NO link",
    matchRebuiltTradelines([acct("p1", "MIDLAND CREDIT", { mask: null, debtBuyer: false })], [acct("n1", "MIDLAND CREDIT", { mask: "****9999", debtBuyer: true })]).size, 0);

  // The plural-ambiguity guard still refuses, and an exact match is never
  // affected by corroboration (it is identity, not inference).
  eq("two unmatched priors and two unclaimed rebuilds still refuse",
    matchRebuiltTradelines(
      [acct("p1", "CAPITAL ONE", { mask: "****1111" }), acct("p2", "CAPITAL ONE", { mask: "****2222" })],
      [acct("n1", "CAPITAL ONE", { mask: "****8888" }), acct("n2", "CAPITAL ONE", { mask: "****9999" })]
    ).size, 0);
  eq("an exact-key match links even when the balance moved between pulls",
    matchRebuiltTradelines([acct("p1", "CAPITAL ONE", { mask: "****1234", balance: 147700 })], [acct("n1", "CAPITAL ONE", { mask: "****1234", balance: 90000 })]).get("p1"), "n1");

  const analyze = readFileSync(join(ROOT, "lib/analyze.ts"), "utf8");
  eq("the transaction re-links through the shared matcher", /matchedByPriorId = matchRebuiltTradelines\(prior, rebuilt\)/.test(analyze), true);
  eq("the fallback is corroborated, not merely forced", /corroboratesSameAccount\(p, candidate\)/.test(analyze), true);
  eq("a conflicting account number refuses the pairing outright", /if \(masks === "conflicts"\) return false;/.test(analyze), true);
  eq("the furnisher contact is carried by the same matcher, not by the parser key", /carriedContactByNewId/.test(analyze) && !/priorContactByKey/.test(analyze), true);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
