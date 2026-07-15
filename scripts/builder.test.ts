// Guards for the Credit Builder OS (Sprint XVIII). Pure — no DB.
// Run: npx tsx scripts/builder.test.ts
import { buildBuilder, NOT_ENOUGH_INFO } from "../lib/builder";
import type { IntelSnapshot, CreditIntelligence, ReadinessResult, ReadinessLevel } from "../lib/intelligence";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

function snap(over: Partial<IntelSnapshot> = {}): IntelSnapshot {
  return {
    userId: "u1", hasReport: true, totalAccounts: 4, negatives: 2, resolved: 0,
    collections: 1, chargeOffs: 1, publicRecords: 0, inquiries: 1, revolving: 1, installment: 1, mortgage: 0, studentLoans: 0,
    positives: 0, disputable: 2, duplicateGroups: 0, avgAccountAgeYears: 4.2, oldestDerogatoryYears: 6, youngestDerogatoryYears: 2,
    openInvestigations: 1, completedInvestigations: 1, round2Ready: 0, obsoleteOpportunities: 0,
    ownTrack: { total: 0, byStrategy: {}, byRecipient: {} }, favorableRate: null, respondedCount: 0, ownHistoryLine: null,
    openWindows: [], overdueWindows: 0, scoreByBureau: [], addressComplete: true, recentEvents: [], utilizationTracked: false, ...over,
  };
}
const readi = (goal: string, level: ReadinessLevel): ReadinessResult => ({ goal, label: `${goal} readiness`, level, reasons: [{ text: level === "ready" ? "✓ clean" : "1 collection to resolve" }], nextActions: [], estimatedTimeline: "n/a", confidence: "high" });
const intel = (readiness: ReadinessResult[] = [readi("mortgage", "not_ready"), readi("credit_card", "not_ready"), readi("personal_loan", "not_ready"), readi("auto", "not_ready")]): CreditIntelligence =>
  ({ readiness } as unknown as CreditIntelligence);
const get = (b: ReturnType<typeof buildBuilder>, id: string) => b.recommendations.find((r) => r.id === id)!;

// ---- shape + honesty ----
{
  const b = buildBuilder(snap(), intel());
  ok("11 builder modules", b.recommendations.length === 11);
  ok("utilization is unavailable + says 'Not enough information'", get(b, "utilization").status === "unavailable" && get(b, "utilization").why === NOT_ENOUGH_INFO);
  ok("CLI opportunities unavailable (no limit data)", get(b, "cli").status === "unavailable");
  ok("every recommendation cites evidence", b.recommendations.every((r) => r.evidence.length > 0));
}

// ---- recommendations respond to real data ----
{
  const noInstall = buildBuilder(snap({ installment: 0 }), intel());
  ok("no installment → credit-builder loan recommended", get(noInstall, "builder_loan").status === "recommended");
  const hasInstall = buildBuilder(snap({ installment: 2 }), intel());
  ok("has installment → builder loan on_track", get(hasInstall, "builder_loan").status === "on_track");
  const noRevolving = buildBuilder(snap({ revolving: 0 }), intel());
  ok("no revolving → secured card recommended", get(noRevolving, "secured_card").status === "recommended");
}

// ---- age of accounts uses the real avg (and is unavailable when missing) ----
{
  ok("age on_track when avg >= 5", get(buildBuilder(snap({ avgAccountAgeYears: 8 }), intel()), "age").status === "on_track");
  ok("age cites the avg", /8/.test(get(buildBuilder(snap({ avgAccountAgeYears: 8 }), intel()), "age").observed));
  ok("age unavailable when no open dates", get(buildBuilder(snap({ avgAccountAgeYears: null }), intel()), "age").status === "unavailable");
}

// ---- payment history + business + readiness reuse ----
{
  const b = buildBuilder(snap(), intel());
  ok("derogatory present → payment history in_progress", get(b, "payment_history").status === "in_progress");
  ok("business credit is locked", get(b, "business").status === "locked");
  ok("mortgage prep = unavailable when readiness unknown", get(buildBuilder(snap(), intel([readi("mortgage", "unknown")])), "mortgage_prep").status === "unavailable");
  ok("mortgage prep = on_track when readiness ready", get(buildBuilder(snap(), intel([readi("mortgage", "ready")])), "mortgage_prep").status === "on_track");
  ok("funding prep on_track when a goal is ready", get(buildBuilder(snap(), intel([readi("credit_card", "ready"), readi("mortgage", "not_ready")])), "funding_prep").status === "on_track");
}

// ---- public records count toward payment history (no false "on track") ----
{
  const b = buildBuilder(snap({ collections: 0, chargeOffs: 0, publicRecords: 2 }), intel());
  ok("public-record-only file → payment history in_progress (not falsely on_track)", get(b, "payment_history").status === "in_progress");
  ok("payment history observed cites public records", /public record/i.test(get(b, "payment_history").observed));
}

// ---- funding prep is honest when readiness is unknown ----
{
  const b = buildBuilder(snap(), intel([readi("credit_card", "unknown"), readi("personal_loan", "unknown"), readi("auto", "unknown"), readi("mortgage", "unknown")]));
  ok("funding prep unavailable when all funding readiness is unknown", get(b, "funding_prep").status === "unavailable");
}

// ---- determinism ----
{
  const a = JSON.stringify(buildBuilder(snap(), intel()));
  const c = JSON.stringify(buildBuilder(snap(), intel()));
  ok("buildBuilder is deterministic", a === c);
}

// ---- CROA/FTC sweep: no promised score, no guaranteed approval ----
{
  const b = buildBuilder(snap({ scoreByBureau: [{ bureau: "EQUIFAX", latest: 640, delta: 10 }] }), intel([readi("mortgage", "ready"), readi("credit_card", "ready")]));
  const strings = b.recommendations.flatMap((r) => [r.label, r.why, r.currentProfile, r.observed, r.expectedImprovement, r.dependencies, r.estimatedTiming]).concat(b.summary, b.note);
  const FORBIDDEN = /guarantee|guaranteed|raise your score|will (increase|raise|approve)|your score will|points|approval odds|will be approved/i;
  const bad = strings.find((s) => FORBIDDEN.test(s));
  ok(`no promised-score/guaranteed-approval string${bad ? ` (offender: ${bad})` : ""}`, !bad);
  ok("funding/mortgage prep state 'not a lending decision'", get(b, "funding_prep").why.includes("not a lending decision") || get(b, "mortgage_prep").why.includes("not a lending decision"));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
