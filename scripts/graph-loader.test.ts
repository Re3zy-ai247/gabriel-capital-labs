// Run: npx tsx scripts/graph-loader.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// graphInputFromSnapshot loader — the fixture-backed proof. Exercises the PURE
// projector (lib/intelligence/graphProject.ts) end-to-end into a validated Kai
// evidence trace, with negative controls. No database: the projector is pure, so
// this runs anywhere. Determinism, partitioning, bureau provenance, statutory
// recipient context, honest omission of absent data, and fail-closed handling
// are all asserted here. The async DB wrapper (graphInputFromSnapshot) is a thin
// tenant-safe read over these same rows, covered by tsc + the admin trace route.
import { projectGraphInput, type CaseRows } from "../lib/intelligence/graphProject";
import { buildCreditGraph, nodeRef } from "../lib/intelligence/graph";
import { reason, validateReasoningTrace, scanForbiddenLanguage } from "../lib/intelligence/reasoning";

let pass = 0, fail = 0;
const violations: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else { fail++; violations.push(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`); }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const ASOF = new Date("2026-07-18T00:00:00.000Z");
const bd = (present: string[], absent: string[] = []) => ({
  ...Object.fromEntries(present.map((b) => [b, { presence: "PRESENT" }])),
  ...Object.fromEntries(absent.map((b) => [b, { presence: "ABSENT" }])),
});

// A representative real-shaped case: a debt-buyer collection, a charge-off, a
// NOT_RECOMMENDED GOVERNMENT line (non-disputable), an installment row with
// MALFORMED bureauData, one inquiry, one public record, and four letters
// (bureau-open, responded, collector-open, malformed-recipientType-open).
const ROWS: CaseRows = {
  userId: "u_fixture",
  tradelines: [
    { id: "t1", creditorName: "Synthetic Collections LLC", accountType: "COLLECTION", isDebtBuyer: true, balance: 120000, probability: "HIGH", bureauData: bd(["EQUIFAX", "EXPERIAN"], ["TRANSUNION"]), dateReported: null, dateOpened: null },
    { id: "t2", creditorName: "Synthetic Bank", accountType: "CHARGE_OFF", isDebtBuyer: false, balance: 80000, probability: "MEDIUM", bureauData: bd(["EQUIFAX", "EXPERIAN", "TRANSUNION"]), dateReported: null, dateOpened: null },
    { id: "t3", creditorName: "State Tax Board", accountType: "GOVERNMENT", isDebtBuyer: false, balance: 50000, probability: "NOT_RECOMMENDED", bureauData: bd(["EQUIFAX"]), dateReported: null, dateOpened: null },
    { id: "t4", creditorName: "Auto Finance Co", accountType: "INSTALLMENT", isDebtBuyer: false, balance: 0, probability: "LOW", bureauData: "not-an-object" as unknown, dateReported: null, dateOpened: null },
    { id: "q1", creditorName: "Hard Inquiry Lender", accountType: "INQUIRY", isDebtBuyer: false, balance: 0, probability: "NOT_RECOMMENDED", bureauData: {}, dateReported: new Date("2026-06-15T00:00:00.000Z"), dateOpened: null },
    { id: "p1", creditorName: "County Court Judgment", accountType: "PUBLIC_RECORD", isDebtBuyer: false, balance: 0, probability: "LOW", bureauData: {}, dateReported: null, dateOpened: null },
  ],
  letters: [
    { id: "l1", tradelineId: "t1", recipientName: "Equifax", recipientType: "bureau", targetBureau: "EQUIFAX", round: 1, status: "MAILED", mailedAt: new Date("2026-07-01T00:00:00.000Z"), responseAt: null, responseOutcome: null },
    { id: "l2", tradelineId: "t2", recipientName: "Experian", recipientType: "bureau", targetBureau: "EXPERIAN", round: 1, status: "MAILED", mailedAt: new Date("2026-06-01T00:00:00.000Z"), responseAt: new Date("2026-06-20T00:00:00.000Z"), responseOutcome: "verified" },
    { id: "l3", tradelineId: null, recipientName: "Midland Funding", recipientType: "collector", targetBureau: null, round: 1, status: "MAILED", mailedAt: new Date("2026-07-05T00:00:00.000Z"), responseAt: null, responseOutcome: null },
    { id: "l4", tradelineId: null, recipientName: "Unknown Recipient", recipientType: "GARBAGE", targetBureau: null, round: 1, status: "MAILED", mailedAt: new Date("2026-07-10T00:00:00.000Z"), responseAt: null, responseOutcome: null },
  ],
};

const gi = projectGraphInput(ROWS, ASOF);

// ── Partitioning ────────────────────────────────────────────────────────────
check("tradelines exclude inquiry + public record", gi.tradelines.length === 4, `got ${gi.tradelines.length}`);
check("no inquiry/public_record leaked into tradelines", gi.tradelines.every((t) => t.accountType !== "INQUIRY" && t.accountType !== "PUBLIC_RECORD"));
check("inquiry partitioned", eq(gi.inquiries, [{ id: "q1", name: "Hard Inquiry Lender", at: "2026-06-15T00:00:00.000Z" }]), JSON.stringify(gi.inquiries));
check("public record partitioned", eq(gi.publicRecords, [{ id: "p1", kind: "County Court Judgment" }]), JSON.stringify(gi.publicRecords));

// ── Bureau provenance (PRESENT only; teeth = ABSENT/malformed excluded) ───────
const t1 = gi.tradelines.find((t) => t.id === "t1")!;
const t4 = gi.tradelines.find((t) => t.id === "t4")!;
check("bureau provenance = PRESENT only (TRANSUNION ABSENT excluded)", eq(t1.bureaus, ["EQUIFAX", "EXPERIAN"]), JSON.stringify(t1.bureaus));
check("malformed bureauData → no fabricated provenance", eq(t4.bureaus, []), JSON.stringify(t4.bureaus));
check("isDebtBuyer preserved", t1.isDebtBuyer === true && gi.tradelines.find((t) => t.id === "t2")!.isDebtBuyer === false);
check("stored enum values passed through (accountType/probability)", t1.accountType === "COLLECTION" && t1.probability === "HIGH");

// ── Letters + statutory recipient context ─────────────────────────────────────
check("letters carry tradeline linkage + target bureau", (() => { const l1 = gi.letters.find((l) => l.id === "l1")!; return l1.tradelineId === "t1" && l1.bureau === "EQUIFAX"; })());
check("open windows = mailed-without-response only (responded letter excluded)", (gi.openWindows?.length ?? 0) === 3, `got ${gi.openWindows?.length}`);
check("open window day-count is deterministic vs asOf", (() => { const w = gi.openWindows?.find((w) => w.letterId === "l1"); return w?.daysElapsed === 17 && w?.daysLeft === 13; })());
check("recipientType preserved for statutory routing (collector kept)", gi.openWindows?.some((w) => w.letterId === "l3" && w.recipientType === "collector") === true);
check("malformed recipientType fails closed to bureau", gi.openWindows?.find((w) => w.letterId === "l4")?.recipientType === "bureau");

// ── Honesty: absent sources omitted, never invented ──────────────────────────
check("readinessGoals omitted (no persisted source)", gi.readinessGoals === undefined);
check("businessEntities omitted (no persisted source)", gi.businessEntities === undefined);
// Coverage: empty-object bureauData and a fully-undated inquiry stay honest.
check("empty-object bureauData → no fabricated bureaus", projectGraphInput({ userId: "u", tradelines: [{ id: "x1", creditorName: "Bank", accountType: "CHARGE_OFF", isDebtBuyer: false, balance: 0, probability: "LOW", bureauData: {}, dateReported: null, dateOpened: null }], letters: [] }, ASOF).tradelines[0].bureaus?.length === 0);
check("inquiry with no dates → at:null (honest omission)", projectGraphInput({ userId: "u", tradelines: [{ id: "x2", creditorName: "Lender", accountType: "INQUIRY", isDebtBuyer: false, balance: 0, probability: "NOT_RECOMMENDED", bureauData: {}, dateReported: null, dateOpened: null }], letters: [] }, ASOF).inquiries?.[0].at === null);

// ── Determinism: order-independent + reproducible ────────────────────────────
const shuffled: CaseRows = { userId: ROWS.userId, tradelines: [...ROWS.tradelines].reverse(), letters: [...ROWS.letters].reverse() };
check("projection is order-independent (rows sorted by id)", eq(projectGraphInput(shuffled, ASOF), gi));
check("projection is reproducible (same rows+asOf → deep-equal)", eq(projectGraphInput(ROWS, ASOF), gi));

// ── Evidence-trace proof: loader output → graph → reason → validate ───────────
const g = buildCreditGraph(gi);
const trace = reason(g);
const errors = validateReasoningTrace(trace, g);
check("reasoning trace over loader output is VALID (no-hallucination law)", errors.length === 0, errors.join(" | "));
check("every finding carries evidence (cited)", trace.findings.every((f) => f.evidence.length > 0));
check("per-item recommendations generated (t1,t2,t4 disputable)", trace.recommendations.length === 3, `got ${trace.recommendations.length}`);
check("NOT_RECOMMENDED item excluded from recommendations", !trace.recommendations.some((r) => r.evidence.includes(nodeRef("tradeline", "t3"))));
check("but NOT_RECOMMENDED item still appears as a fact", trace.findings.some((f) => f.stage === "facts" && f.evidence.includes(nodeRef("tradeline", "t3"))));
check("GOVERNMENT account kept as a tradeline node (not dropped), never recommended", gi.tradelines.some((t) => t.id === "t3" && t.accountType === "GOVERNMENT") && !trace.recommendations.some((r) => r.evidence.includes(nodeRef("tradeline", "t3"))));
check("§611 cited on bureau reinvestigation", trace.findings.some((f) => (f.lawRefs ?? []).includes("fcra_611")));
check("FDCPA §809 cited on collector window (recipientType routed the statute)", trace.findings.some((f) => f.stage === "law" && (f.lawRefs ?? []).includes("fdcpa_809") && f.evidence.includes(nodeRef("dispute_window", "l3"))));
check("debt-buyer conflict surfaced with evidence", trace.findings.some((f) => f.stage === "conflicts" && f.evidence.includes(nodeRef("collection", "t1"))));
check("no forbidden outcome language on any trace text", trace.findings.every((f) => !scanForbiddenLanguage(f.text)) && trace.recommendations.every((r) => !scanForbiddenLanguage(r.action) && !scanForbiddenLanguage(r.expectedOutcome)));

// ── Negative control: empty case reasons honestly, never fabricates ──────────
const giEmpty = projectGraphInput({ userId: "u_empty", tradelines: [], letters: [] }, ASOF);
check("empty case → no tradelines, no windows section", giEmpty.tradelines.length === 0 && giEmpty.openWindows === undefined && giEmpty.inquiries === undefined);
const gEmpty = buildCreditGraph(giEmpty);
const traceEmpty = reason(gEmpty);
check("empty case trace is valid + honest (no disputable items)", validateReasoningTrace(traceEmpty, gEmpty).length === 0 && traceEmpty.recommendations.length === 0 && traceEmpty.findings.some((f) => f.stage === "facts" && /no disputable items/i.test(f.text)));

if (violations.length) console.error(violations.join("\n"));
console.log(`\ngraph-loader.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
