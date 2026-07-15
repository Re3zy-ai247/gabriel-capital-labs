// Guards for CreditVector Academy (Sprint XXI, Phase 3). Pure — no DB, no AI.
// Verifies the 8-level progression, file-connection honesty (no fabricated data), the
// deterministic next-lesson pick, and CROA-safe educational framing.
// Run: npx tsx scripts/academy.test.ts
import { assembleIntelligence } from "../lib/intelligence/api";
import type { IntelSnapshot } from "../lib/intelligence/snapshot";
import { buildAcademy } from "../lib/academy";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

function snap(over: Partial<IntelSnapshot> = {}): IntelSnapshot {
  return {
    userId: "u1", hasReport: true, totalAccounts: 6,
    negatives: 3, resolved: 1, collections: 2, chargeOffs: 1, publicRecords: 0, inquiries: 4,
    revolving: 2, installment: 0, mortgage: 0, studentLoans: 0, positives: 0, disputable: 3, duplicateGroups: 0,
    avgAccountAgeYears: 4.2, oldestDerogatoryYears: 6, youngestDerogatoryYears: 2,
    openInvestigations: 0, completedInvestigations: 0, round2Ready: 0, obsoleteOpportunities: 0,
    ownTrack: { total: 0, byStrategy: {}, byRecipient: {} }, favorableRate: null, respondedCount: 0,
    ownHistoryLine: null, openWindows: [], overdueWindows: 0,
    scoreByBureau: [], addressComplete: true, recentEvents: [], utilizationTracked: false, ...over,
  };
}

// ---- structure ----
{
  const a = buildAcademy(snap());
  ok("eight levels, ordered 1..8", a.lessons.length === 8 && a.lessons.every((l, i) => l.level === i + 1));
  ok("every lesson teaches (>=2 key points)", a.lessons.every((l) => l.keyPoints.length >= 2));
  ok("educational note disclaims guarantees", /does not.*guarantee|not.*legal advice/i.test(a.note));
  // Flag only AFFIRMATIVE promises — disclaimers ("never guarantees", "not a
  // guaranteed outcome") are the CROA-safe framing we WANT and must not trip this.
  const PROMISSORY = /\bwe guarantee\b|\bguaranteed (deletion|removal|results?|score)\b|\bwill be (deleted|removed)\b|\bwill (raise|boost|increase) your score\b|\b100% (removal|deletion)\b/i;
  ok("no affirmative promissory language in any lesson", !a.lessons.some((l) => PROMISSORY.test([l.summary, ...l.keyPoints].join(" "))));
}
// Positive check: the CROA-safe DISCLAIMERS are actually present in the curriculum.
{
  const a = buildAcademy(snap());
  const corpus = a.lessons.flatMap((l) => [l.summary, ...l.keyPoints]).join(" ");
  ok("curriculum explicitly disclaims guarantees (process, not outcome)", /never guarantees|not a guaranteed outcome|is never guaranteed|not a lending decision|process (right|lever)/i.test(corpus));
}

// ---- file connection is honest: relevant flags track the real file ----
{
  const withColl = buildAcademy(snap({ collections: 2, chargeOffs: 1 }));
  ok("collections lesson relevant + cites the real count", withColl.lessons.find((l) => l.id === "collections")!.relevant && /2 collections/.test(withColl.lessons.find((l) => l.id === "collections")!.connection ?? ""));
  const noColl = buildAcademy(snap({ collections: 0, chargeOffs: 0, disputable: 0, negatives: 0 }));
  ok("collections lesson NOT relevant when file has none", !noColl.lessons.find((l) => l.id === "collections")!.relevant);
  ok("business lesson never claims data (future module)", !buildAcademy(snap()).lessons.find((l) => l.id === "business")!.relevant);
}

// ---- deterministic next-lesson pick meets the user where they are ----
{
  ok("no report → start at Level 1 (report)", buildAcademy(snap({ hasReport: false, totalAccounts: 0, negatives: 0, collections: 0, chargeOffs: 0, disputable: 0 })).nextLesson?.id === "report");
  ok("overdue window → escalation/CFPB lesson", buildAcademy(snap({ overdueWindows: 1, openWindows: [{ recipient: "Equifax", daysElapsed: 40, daysLeft: -5, letterId: "L1" }] })).nextLesson?.id === "cfpb");
  ok("response ready → method-of-verification lesson", buildAcademy(snap({ round2Ready: 1 })).nextLesson?.id === "mov");
  ok("disputable, nothing mailed → dispute-strategy lesson", buildAcademy(snap({ disputable: 3, openInvestigations: 0, overdueWindows: 0, round2Ready: 0 })).nextLesson?.id === "dispute_strategy");
  // determinism
  ok("deterministic: same snapshot → same academy", JSON.stringify(buildAcademy(snap())) === JSON.stringify(buildAcademy(snap())));
}

// ---- sanity: intelligence still assembles (shared fixture) ----
{
  const i = assembleIntelligence(snap());
  ok("intelligence readiness present (feeds Academy relevance + Phase 4)", Array.isArray(i.readiness));
}

console.log(failures === 0 ? "\nAll academy guards passed." : `\n${failures} guard(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
