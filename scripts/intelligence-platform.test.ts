// Guards for the Credit Intelligence Platform (Sprint XV). Pure — no DB.
// Run: npx tsx scripts/intelligence-platform.test.ts
import { assembleIntelligence } from "../lib/intelligence/api";
import type { IntelSnapshot } from "../lib/intelligence/snapshot";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

function snap(over: Partial<IntelSnapshot> = {}): IntelSnapshot {
  return {
    userId: "u1", hasReport: true, totalAccounts: 6,
    negatives: 3, resolved: 1, collections: 1, chargeOffs: 1, publicRecords: 0, inquiries: 2,
    revolving: 2, installment: 1, mortgage: 0, studentLoans: 0, positives: 0, disputable: 3, duplicateGroups: 0,
    avgAccountAgeYears: 4.2, oldestDerogatoryYears: 6, youngestDerogatoryYears: 2,
    openInvestigations: 1, completedInvestigations: 2, round2Ready: 1, obsoleteOpportunities: 0,
    ownTrack: { total: 3, byStrategy: {}, byRecipient: {} }, favorableRate: 0.5, respondedCount: 2,
    ownHistoryLine: "Across your 2 logged dispute responses so far, the item was changed or removed 1 time — your own track record, not a prediction.",
    openWindows: [{ recipient: "Equifax", daysElapsed: 12, daysLeft: 18, letterId: "L1" }], overdueWindows: 0,
    scoreByBureau: [{ bureau: "EQUIFAX", latest: 640, delta: 20 }],
    addressComplete: true, recentEvents: [], utilizationTracked: false, ...over,
  };
}

// ---- shape + honesty ----
{
  const i = assembleIntelligence(snap());
  ok("all modules present", !!i.profile && !!i.health && !!i.risk && Array.isArray(i.opportunities) && Array.isArray(i.readiness) && !!i.builder && !!i.business && !!i.timeline);
  ok("profile discloses utilization as NOT tracked (no fabrication)", i.profile.metrics.some((m) => m.key === "utilization" && /not tracked/i.test(m.value)));
  ok("health discloses utilization as NOT tracked", i.health.metrics.some((m) => m.key === "utilization" && /not tracked/i.test(m.value)));
  ok("business readiness is honest-insufficient (no external data invented)", i.business.confidence === "insufficient");
  ok("readiness includes a business goal marked unknown", i.readiness.some((r) => r.goal === "business_funding" && r.level === "unknown"));
}

// ---- readiness responds to real signals ----
{
  const dirty = assembleIntelligence(snap({ collections: 2 }));
  ok("collections → mortgage NOT ready (hard prerequisite)", dirty.readiness.find((r) => r.goal === "mortgage")!.level === "not_ready");
  const clean = assembleIntelligence(snap({ collections: 0, chargeOffs: 0, publicRecords: 0, negatives: 0, openInvestigations: 0, totalAccounts: 5 }));
  ok("clean file → mortgage ready", clean.readiness.find((r) => r.goal === "mortgage")!.level === "ready");
  ok("credit-card readiness is the most lenient", clean.readiness.find((r) => r.goal === "credit_card")!.level === "ready");
}

// ---- opportunities + risk from real data ----
{
  const i = assembleIntelligence(snap());
  ok("round-2-ready surfaces an opportunity", i.opportunities.some((o) => o.key === "round2"));
  ok("collections surface a high risk", i.risk.reasons.some((r) => /collection/i.test(r.text)));
  const over = assembleIntelligence(snap({ overdueWindows: 2 }));
  ok("overdue window → high risk + opportunity", over.risk.reasons.some((r) => /overdue/i.test(r.text)) && over.opportunities.some((o) => o.key === "overdue"));
}

// ---- risk reasons are severity-sorted (high before medium) ----
{
  const i = assembleIntelligence(snap({ duplicateGroups: 1, collections: 1, chargeOffs: 0, totalAccounts: 6, overdueWindows: 0 }));
  ok("highest-severity risk is first (collections before duplicates)", /collection/i.test(i.risk.reasons[0].text) && i.risk.reasons.some((r) => /duplicate/i.test(r.text)));
}

// ---- no report → insufficient, no invented data ----
{
  const empty = assembleIntelligence(snap({ hasReport: false, totalAccounts: 0, negatives: 0, disputable: 0 }));
  ok("no report → profile confidence insufficient", empty.profile.confidence === "insufficient");
  ok("no report → readiness goals unknown", empty.readiness.every((r) => r.level === "unknown"));
}

// ---- determinism ----
{
  const a = JSON.stringify(assembleIntelligence(snap()));
  const b = JSON.stringify(assembleIntelligence(snap()));
  ok("assembleIntelligence is deterministic", a === b);
}

// ---- CROA / FTC sweep across every platform string ----
{
  const i = assembleIntelligence(snap({ collections: 1, chargeOffs: 1, overdueWindows: 1 }));
  const strings: string[] = [];
  const mod = (m: typeof i.profile) => { strings.push(m.summary, ...m.metrics.flatMap((x) => [x.value, x.note ?? ""]), ...m.reasons.flatMap((r) => [r.text, r.evidence ?? ""]), ...m.recommendedActions.map((a) => a.text), ...m.nextSteps, m.history ?? ""); };
  [i.profile, i.health, i.risk, i.builder, i.business].forEach(mod);
  i.readiness.forEach((r) => strings.push(r.label, r.estimatedTimeline, ...r.reasons.map((x) => x.text), ...r.nextActions.map((a) => a.text)));
  i.opportunities.forEach((o) => strings.push(o.title, o.detail));
  strings.push(...i.timeline.past, ...i.timeline.present, ...i.timeline.upcoming, i.generatedAtNote);
  const FORBIDDEN = /guarantee|guaranteed|will be (deleted|removed|approved)|approval odds|you will be approved|your score will|likely to be approved|is frivolous(?! or irrelevant)/i;
  const bad = strings.find((str) => FORBIDDEN.test(str));
  ok(`no outcome/approval promise in any platform string${bad ? ` (offender: ${bad})` : ""}`, !bad);
  ok("readiness explicitly says it is not a lending decision (via UI copy) — timelines carry no approval odds", i.readiness.every((r) => !/odds|approv/i.test(r.estimatedTimeline)));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
