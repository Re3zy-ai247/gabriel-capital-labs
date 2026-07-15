// The Mission Engine — PURE over what CVI + Mission Control already computed. It
// ranks, states, sequences, and rewards; it calculates no new intelligence.
import type { CreditIntelligence, Opportunity } from "@/lib/intelligence";
import type { MissionControlData } from "@/lib/missionControl";
import { REINVESTIGATION_DAYS } from "@/lib/forecast";
import type {
  FinancialMission, Mission, MissionState, PriorityBand, Level, MissionTimelineEntry, MissionReward,
} from "./types";

// Per-opportunity mission config — priority, state, effort, impact, unlock. The
// opportunity KEYS come from CVI (lib/intelligence/modules.ts opportunities()).
interface Cfg { type: string; priority: number; state: MissionState; effort: Level; impact: Level; unlocks: string | null }
const CFG: Record<string, Cfg> = {
  overdue:    { type: "monitor_deadline", priority: 96, state: "available", effort: "low", impact: "high", unlocks: "escalation paths (method-of-verification / CFPB)" },
  round2:     { type: "round_2", priority: 90, state: "needs_review", effort: "low", impact: "high", unlocks: "a stronger follow-up round" },
  obsolete:   { type: "dispute", priority: 82, state: "available", effort: "low", impact: "high", unlocks: "a clean §605 obsolescence ground" },
  validation: { type: "dispute", priority: 76, state: "available", effort: "medium", impact: "high", unlocks: null },
  campaign:   { type: "approve_campaign", priority: 70, state: "available", effort: "medium", impact: "high", unlocks: "mailing your disputes" },
  address:    { type: "address_consistency", priority: 62, state: "available", effort: "low", impact: "medium", unlocks: "mailing disputes for you" },
  builder:    { type: "builder", priority: 22, state: "deferred", effort: "medium", impact: "medium", unlocks: null },
};

function band(p: number): PriorityBand { return p >= 90 ? "critical" : p >= 70 ? "high" : p >= 40 ? "medium" : "low"; }
const ACTIONABLE: ReadonlySet<MissionState> = new Set<MissionState>(["available", "needs_review", "in_progress", "blocked"]);

function fromOpportunity(o: Opportunity, intel: CreditIntelligence): Mission {
  const c = CFG[o.key] ?? { type: o.kind, priority: 40, state: "available" as MissionState, effort: "medium" as Level, impact: "medium" as Level, unlocks: null };
  return {
    id: `m_${o.key}`, type: c.type, title: o.title, reason: o.detail, state: c.state, priority: c.priority,
    band: band(c.priority), href: o.href, deadline: null, dependency: null, effort: c.effort, impact: c.impact,
    unlocks: c.unlocks, evidence: o.detail, confidence: intel.profile.confidence, progress: null,
  };
}

export function assembleMissions(intel: CreditIntelligence, mc: MissionControlData): FinancialMission {
  // No report → the one and only mission.
  if (!intel.hasReport) {
    const upload: Mission = {
      id: "m_upload", type: "upload_reports", title: "Upload your credit reports", reason: "Everything starts from your report — Kai reads it and lines up your options.",
      state: "available", priority: 100, band: "critical", href: "/upload", deadline: null, dependency: null,
      effort: "low", impact: "high", unlocks: "your whole mission queue", evidence: "No report on file.", confidence: "insufficient", progress: null,
    };
    return { today: upload, queue: [upload], waiting: [], automatic: [], timeline: [{ when: "Today", title: upload.title, state: "available" }], completed: [], rewards: [], progress: { completedCount: 0, openCount: 1, overallPct: 0, caseHealthNote: "Not started", estimatedCompletion: "Upload a report to begin" } };
  }

  // Action + opportunity missions (the "deadline" opportunity is represented as a
  // waiting mission below, from the structured Mission Control windows).
  const missions: Mission[] = intel.opportunities.filter((o) => o.key !== "deadline").map((o) => fromOpportunity(o, intel));

  // Escalation is its own mission when a window is already overdue.
  if (intel.opportunities.some((o) => o.key === "overdue")) {
    missions.push({ id: "m_cfpb", type: "escalate_cfpb", title: "Escalation available (CFPB / state AG)", reason: "A non-answer past the §611 window is grounds to escalate.", state: "available", priority: 88, band: "high", href: "/letters", deadline: null, dependency: "an overdue reinvestigation", effort: "medium", impact: "high", unlocks: null, evidence: "One or more response windows have passed.", confidence: intel.profile.confidence, progress: null });
  }

  // Business Credit is a future module — a real but LOCKED mission (honest).
  missions.push({ id: "m_business", type: "business_credit_setup", title: "Business credit setup", reason: "A future module — nothing to connect externally yet.", state: "locked", priority: 8, band: "low", href: "/dashboard", deadline: null, dependency: "the Business Credit module", effort: "medium", impact: "medium", unlocks: "business-funding readiness", evidence: "Business profile not collected.", confidence: "insufficient", progress: null });

  // Waiting missions — from Mission Control's structured §611 windows (reused).
  const waiting: Mission[] = mc.waiting.map((w, i) => ({
    id: `m_wait_${i}_${w.recipient.replace(/\s+/g, "_")}`, type: "wait_response", title: `Waiting on ${w.recipient}`, reason: w.text, state: "waiting" as MissionState,
    priority: 30, band: band(30), href: w.href, deadline: `${w.daysLeft} day${w.daysLeft === 1 ? "" : "s"} left`, dependency: null,
    effort: "low", impact: "medium", unlocks: null, evidence: "Mailed dispute in its reinvestigation window.", confidence: intel.profile.confidence,
    progress: Math.max(0, Math.min(100, Math.round(((REINVESTIGATION_DAYS - w.daysLeft) / REINVESTIGATION_DAYS) * 100))),
  }));

  // The full queue: actionable missions ranked, deterministic tiebreak by id.
  const queue = [...missions, ...waiting].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const today = queue.find((m) => ACTIONABLE.has(m.state)) ?? null;

  // Timeline — derived only from existing windows, no invented dates.
  const timeline: MissionTimelineEntry[] = [];
  if (today) timeline.push({ when: "Today", title: today.title, state: today.state });
  for (const w of mc.waiting) timeline.push({ when: w.daysLeft <= 1 ? "Tomorrow" : `${w.daysLeft} days`, title: `Waiting on ${w.recipient}`, state: "waiting" });
  if (intel.opportunities.some((o) => o.key === "overdue")) timeline.push({ when: "Now", title: "Method of verification / CFPB escalation", state: "available" });
  else if (mc.waiting.length) timeline.push({ when: `~${Math.max(...mc.waiting.map((w) => w.daysLeft)) + 15} days`, title: "Method of verification, if unresolved", state: "locked" });

  // Rewards — factual progress only, no points/gamification.
  const metric = (key: string) => intel.profile.metrics.find((m) => m.key === key)?.value;
  const rewards: MissionReward[] = [];
  const doneInv = metric("done_inv");
  if (doneInv && doneInv !== "0") rewards.push({ label: "Investigations completed", value: doneInv });
  const fav = metric("fav_rate");
  if (fav && fav !== "—") rewards.push({ label: "Favorable-change rate (your history)", value: fav });
  const scoreTile = mc.command.find((c) => c.key === "scores");
  // Only a POSITIVE net delta is "progress won" — a regression ("-5 pts") is never a reward.
  if (scoreTile && scoreTile.stat.startsWith("+") && !scoreTile.stat.startsWith("+0")) rewards.push({ label: "Score progress", value: scoreTile.stat });

  // Completed = the append-only projection over the real event history (CVI).
  const completed = intel.timeline.past;

  // Locked missions (e.g. the future Business Credit module) are not completable,
  // so they don't count toward "open" — otherwise completion could never reach 100%.
  const openCount = queue.filter((m) => m.state !== "locked").length;
  const completedCount = completed.length;
  const total = openCount + completedCount;
  const maxWait = mc.waiting.length ? Math.max(...mc.waiting.map((w) => w.daysLeft)) : null;
  const progress = {
    completedCount, openCount,
    overallPct: total > 0 ? Math.round((completedCount / total) * 100) : null,
    caseHealthNote: mc.caseHealth === "green" ? "Healthy" : mc.caseHealth === "amber" ? "Needs attention" : "Action overdue",
    estimatedCompletion: maxWait != null ? `≈${maxWait} days until your current windows close` : today ? "Depends on your next actions" : "No blocking items",
  };

  return { today, queue, waiting, automatic: mc.automatic.map((a) => a.text), timeline, completed, rewards, progress };
}
