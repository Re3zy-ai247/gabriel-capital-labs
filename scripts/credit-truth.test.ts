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
  eq("upload discloses a fallback-reader analysis", /!done\.usedAI\s*&&\s*<ExtractionFallbackNotice/.test(upload), true);
  eq("upload no longer promises what it cannot keep about bureau attribution", upload.includes("never assert what a bureau reports unless its report was actually uploaded"), false);
  eq("upload states the unknown-bureau rule instead", upload.includes("we mark that unknown instead of assuming"), true);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
