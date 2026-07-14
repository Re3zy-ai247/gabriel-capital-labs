// Guards for Mission Control's pure assembler (Sprint XIII). No DB, no network.
// Run: npx tsx scripts/missionControl.test.ts
import { assembleMission, type MissionInputs } from "../lib/missionControl";
import type { KaiHomeData } from "../lib/kaiHome";
import { composeCampaign, DEFAULT_CAMPAIGN_POLICY, type Campaign, type CampaignItem, type ComposedCampaign, type ComposerItem } from "../lib/campaign";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

const NOW = new Date("2026-07-14T00:00:00.000Z").getTime();
const emptyKai: KaiHomeData = { overnight: [], recommendation: null, deadlines: [], recentEvents: [], responsesReceived: 0, lettersMailed: 0 };
const emptyComposed: ComposedCampaign = { strategyFamily: "mixed", items: [], rationale: "", warnings: [], nextUnlock: [], hasRecommendation: false };

function inputs(over: Partial<MissionInputs> = {}): MissionInputs {
  return {
    user: { fullName: "Rey Gabriel" }, kai: emptyKai, caseMemory: null, campaigns: [],
    composed: emptyComposed, tradelines: [{ id: "t1", resolved: false }], letters: [],
    scoreEntries: [], nextSeq: 1, policy: DEFAULT_CAMPAIGN_POLICY, now: NOW, ...over,
  };
}
function item(over: Partial<ComposerItem> = {}): ComposerItem {
  return {
    tradelineId: "x" + Math.random().toString(36).slice(2, 7), creditorName: "Creditor",
    accountType: "CHARGE_OFF", isDebtBuyer: false, probability: "HIGH", score: 80, recipientType: "bureau",
    strategyId: "fcra_611", strategyLabel: "FCRA §611", strategyReason: "accuracy dispute",
    bureaus: ["EQUIFAX"], pastWindow: false, monthsToFallOff: null, hasConflicts: false, duplicateGroup: null,
    estimatedPages: 2, activeInvestigation: false, priorRounds: 0, lastOutcome: null, alreadyInFlight: false, ...over,
  };
}
function campaignItem(queued: boolean): CampaignItem {
  return { tradelineId: "t" + Math.random().toString(36).slice(2, 6), creditorName: "X", recipientType: "bureau", bureaus: ["EQUIFAX"], strategyId: "fcra_611", strategyLabel: "§611", decision: "included", reason: "", pages: 2, letterId: null, queued };
}
function campaign(status: Campaign["status"], sequence: number, items: CampaignItem[]): Campaign {
  return { id: "c" + sequence, userId: "u", sequence, status, strategyFamily: "bureau_reinvestigation", items, rationale: "", warnings: [], nextUnlock: [], userDecision: null, createdAt: "", approvedAt: null, startedAt: null, completedAt: null, canceledAt: null, snapshot: null, auditTrail: [] };
}
const lt = (over: Partial<MissionInputs["letters"][number]>): MissionInputs["letters"][number] =>
  ({ id: "L", tradelineId: "t1", recipientName: "Experian", parentLetterId: null, responseAt: null, responseOutcome: null, mailedAt: null, ...over });

// ---- on-track: report on file, nothing to do ----
{
  const m = assembleMission(inputs());
  ok("firstName parsed", m.firstName === "Rey");
  ok("on-track → no tasks", m.tasks.length === 0);
  ok("case health green when nothing outstanding", m.caseHealth === "green");
  ok("command center has 8 sections", m.command.length === 8);
  ok("5 health signals + case roll-up = 5", m.health.length === 5);
}

// ---- no report → upload task ----
{
  const m = assembleMission(inputs({ tradelines: [] }));
  ok("no report → upload task", m.tasks.some((t) => t.kind === "upload" && /upload your credit report/i.test(t.text)));
  ok("hasReport false", m.hasReport === false);
}

// ---- overdue window → red health + upload task ----
{
  const kai: KaiHomeData = { ...emptyKai, lettersMailed: 1, deadlines: [{ letterId: "L1", recipient: "Equifax", round: 1, daysElapsed: 35, daysLeft: -5 }] };
  const m = assembleMission(inputs({ kai, letters: [lt({ id: "L1", recipientName: "Equifax", mailedAt: new Date(NOW - 35 * 86400000) })] }));
  ok("overdue → upload-response task", m.tasks.some((t) => /window has passed/i.test(t.text)));
  ok("overdue → mail health red", m.health.find((h) => h.key === "mail")?.status === "red");
  ok("overdue → response health red", m.health.find((h) => h.key === "response")?.status === "red");
  ok("overdue → case health red", m.caseHealth === "red");
  ok("deadlines command tone red", m.command.find((c) => c.key === "deadlines")?.tone === "red");
}

// ---- waiting window (running) → waiting item, no task ----
{
  const kai: KaiHomeData = { ...emptyKai, lettersMailed: 1, deadlines: [{ letterId: "L1", recipient: "TransUnion", round: 1, daysElapsed: 12, daysLeft: 18 }] };
  const m = assembleMission(inputs({ kai }));
  ok("running window → a waiting item", m.waiting.length === 1 && m.waiting[0].daysLeft === 18);
  ok("running window → mail health green", m.health.find((h) => h.key === "mail")?.status === "green");
  ok("running window → nextAction = wait", Boolean(m.nextAction?.title.startsWith("Wait")));
}

// ---- approved campaign with unmailed items → mail task + nextAction ----
{
  const camps = [campaign("APPROVED", 2, [campaignItem(false), campaignItem(true)])];
  const m = assembleMission(inputs({ campaigns: camps }));
  ok("approved-unmailed → mail task", m.tasks.some((t) => t.kind === "mail" && /Campaign 2/.test(t.text)));
  ok("approved-unmailed → nextAction Mail Campaign 2", m.nextAction?.title === "Mail Campaign 2");
  ok("approved-unmailed → campaign health amber", m.health.find((h) => h.key === "campaign")?.status === "amber");
}

// ---- pending review campaign → review task + nextAction approve ----
{
  const camps = [campaign("RECOMMENDED", 1, [campaignItem(false), campaignItem(false)])];
  const m = assembleMission(inputs({ campaigns: camps }));
  ok("pending review → review task", m.tasks.some((t) => t.kind === "review" && /Review Campaign 1/.test(t.text)));
  ok("pending review → nextAction Approve Campaign 1", m.nextAction?.title === "Approve Campaign 1");
}

// ---- fresh composed recommendation (no persisted campaign) → capacity + deferred + review task ----
{
  const composed = composeCampaign(Array.from({ length: 8 }, (_, i) => item({ tradelineId: "b" + i, creditorName: "Cred " + i })), { nextSequence: 1 });
  const m = assembleMission(inputs({ composed }));
  ok("composed rec → review task", m.tasks.some((t) => t.kind === "review" && /recommended campaign/i.test(t.text)));
  ok("capacity recommendedSize = policy max (5)", m.capacity?.recommendedSize === DEFAULT_CAMPAIGN_POLICY.recommendedMax);
  ok("capacity stagedCount = deferred (3)", m.capacity?.stagedCount === 3);
  ok("deferred queue populated", m.deferred.length === 3);
  ok("automatic mentions staged accounts", m.automatic.some((a) => /staged for a later campaign/i.test(a.text)));
  ok("capacity copy is operational-not-legal", !m.capacity!.reasons.some((r) => /legal|guarantee|strongest legal/i.test(r)));
}

// ---- deferred item with an active investigation → est. review date + dependency ----
{
  const composed = composeCampaign([
    item({ tradelineId: "open1", creditorName: "OpenCo", activeInvestigation: true }),
    item({ tradelineId: "fresh1", creditorName: "FreshCo" }),
  ], { nextSequence: 1 });
  const letters = [lt({ id: "Lo", tradelineId: "open1", recipientName: "Equifax", mailedAt: new Date(NOW - 10 * 86400000) })];
  const m = assembleMission(inputs({ composed, letters }));
  const def = m.deferred.find((d) => d.creditorName === "OpenCo");
  ok("active-investigation deferral has an est. review date", !!def && def.estReviewDate !== null);
  ok("active-investigation deferral names its dependency", !!def && /§611 reinvestigation/i.test(def.dependency ?? ""));
}

// ---- score progress net delta ----
{
  const scoreEntries = [
    { bureau: "EQUIFAX", score: 600, recordedAt: new Date(NOW - 60 * 86400000) },
    { bureau: "EQUIFAX", score: 650, recordedAt: new Date(NOW - 1 * 86400000) },
  ];
  const m = assembleMission(inputs({ scoreEntries }));
  ok("score progress shows +50 pts", m.command.find((c) => c.key === "scores")?.stat === "+50 pts");
}
// no score entries → honest invitation, never a fabricated number
{
  const m = assembleMission(inputs());
  ok("no scores → 'Log scores' invitation", m.command.find((c) => c.key === "scores")?.stat === "Log scores");
}

// ---- M4: an 'updated'/'unknown' response drives BOTH a task and amber response health (no disagreement) ----
{
  const letters = [lt({ id: "Lu", recipientName: "Experian", responseAt: new Date(NOW - 2 * 86400000), responseOutcome: "updated", mailedAt: new Date(NOW - 40 * 86400000) })];
  const m = assembleMission(inputs({ letters }));
  const hasTask = m.tasks.some((t) => t.kind === "escalate");
  const respHealth = m.health.find((h) => h.key === "response")?.status;
  ok("updated response → escalate task exists", hasTask);
  ok("updated response → response health is NOT green while a task shows (M4)", respHealth !== "green");
  ok("task and response-health agree", hasTask === (respHealth === "amber"));
}

// ---- M5: an overdue window outranks 'mail an approved campaign' in nextAction ----
{
  const lapsedRec = { title: "The Equifax response window has passed.", body: "…", cta: "Log the response", href: "/letters", basis: "Rule: mailed 35 days ago with no response." };
  const kai: KaiHomeData = { ...emptyKai, lettersMailed: 1, recommendation: lapsedRec, deadlines: [{ letterId: "L1", recipient: "Equifax", round: 1, daysElapsed: 35, daysLeft: -5 }] };
  const camps = [campaign("APPROVED", 2, [campaignItem(false)])];
  const letters = [lt({ id: "L1", recipientName: "Equifax", mailedAt: new Date(NOW - 35 * 86400000) })];
  const m = assembleMission(inputs({ kai, campaigns: camps, letters }));
  ok("overdue window outranks mail-campaign in nextAction (M5)", Boolean(m.nextAction?.title.includes("window has passed")));
  ok("overdue → case health red even with an approved campaign", m.caseHealth === "red");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
