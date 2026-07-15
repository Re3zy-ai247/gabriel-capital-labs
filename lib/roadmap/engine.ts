// The Roadmap Engine — PURE over CVI + the Mission Engine + Mission Control. It
// sequences existing evidence into a journey; it calculates no new intelligence
// and invents no dates.
import type { CreditIntelligence, ReadinessResult } from "@/lib/intelligence";
import type { FinancialMission } from "@/lib/missionEngine";
import type { MissionControlData } from "@/lib/missionControl";
import type { FinancialRoadmap, RoadmapStage, StageStatus, RoadmapMilestone } from "./types";

const st = (id: string, label: string, status: StageStatus, summary: string, milestones: RoadmapMilestone[], evidence: string, href: string): RoadmapStage =>
  ({ id, label, status, summary, milestones, evidence, href });

export function buildRoadmap(intel: CreditIntelligence, mission: FinancialMission, mc: MissionControlData): FinancialRoadmap {
  const metric = (k: string) => intel.profile.metrics.find((m) => m.key === k)?.value ?? "—";
  const num = (k: string) => { const v = parseInt(metric(k), 10); return Number.isFinite(v) ? v : 0; };
  const rd = (goal: string): ReadinessResult | undefined => intel.readiness.find((r) => r.goal === goal);
  const readinessStatus = (goal: string): StageStatus => {
    const r = rd(goal);
    if (!r || r.level === "unknown") return "unavailable";
    return r.level === "ready" ? "active" : "upcoming";
  };
  const has = (key: string) => intel.opportunities.some((o) => o.key === key);

  const negatives = num("negatives");
  const doneInv = num("done_inv");
  const openInv = num("open_inv");
  const favRate = metric("fav_rate"); // "—" until a response is logged
  const waiting = mc.waiting.length;
  const scoreTile = mc.command.find((c) => c.key === "scores");
  // Structural signal (the delta is formatted "+N pts"/"-N pts") — not a match on
  // Mission Control's "Log scores" CTA copy, which could be reworded.
  const scoresLogged = !!scoreTile && /pts/.test(scoreTile.stat);
  const hasMailMission = mission.queue.some((m) => m.type === "approve_campaign" || m.type === "monitor_deadline");
  const campaignActive = mission.queue.some((m) => m.type === "approve_campaign") || waiting > 0;

  if (!intel.hasReport) {
    const stages = [st("current_state", "Current state", "current", "Upload your report to map your journey.", [{ text: "Report uploaded", done: false }], "No report on file.", "/upload")];
    return { stages, progressPct: 0, currentStageId: "current_state", nextStageId: null, note: "Your roadmap builds itself from your file — deterministically, no predictions." };
  }

  const stages: RoadmapStage[] = [
    st("current_state", "Current state", "current",
      intel.profile.summary,
      [{ text: "Report analyzed", done: true }, { text: `${negatives} active negative${negatives === 1 ? "" : "s"} identified`, done: true }],
      intel.profile.summary, "/tradelines"),

    st("current_campaign", "Current campaign", campaignActive ? "active" : has("campaign") ? "upcoming" : negatives === 0 ? "completed" : "upcoming",
      campaignActive ? "A focused campaign is underway." : has("campaign") ? "Disputable items are ready to sequence into a campaign." : "No campaign needed right now.",
      [{ text: "Campaign planned", done: campaignActive || doneInv > 0 || negatives === 0 }, { text: "Disputes approved", done: waiting > 0 || doneInv > 0 }],
      has("campaign") ? "Disputable items on file." : "No open disputable items.", "/campaigns"),

    st("mail_queue", "Mail queue", hasMailMission || waiting > 0 ? "active" : "upcoming",
      waiting > 0 ? "Disputes are in the mail stream." : "Approved disputes queue here to mail.",
      [{ text: "Dispute mailed", done: waiting > 0 || doneInv > 0 || has("overdue") }],
      "Mailing runs through CreditVector Mail (MAIL_LIVE off).", "/mail"),

    st("waiting", "Waiting", waiting > 0 ? "waiting" : doneInv > 0 ? "completed" : "upcoming",
      waiting > 0 ? `${waiting} response window${waiting === 1 ? "" : "s"} running (§611).` : "No windows currently open.",
      mc.waiting.slice(0, 3).map((w) => ({ text: `${w.recipient} — ${w.daysLeft}d left`, done: false })),
      "FCRA §611 reinvestigation windows.", "/mail"),

    st("responses", "Responses", doneInv > 0 ? "active" : openInv > 0 ? "waiting" : "upcoming",
      doneInv > 0 ? `${doneInv} response${doneInv === 1 ? "" : "s"} logged.` : "Bureau responses appear here once logged.",
      [{ text: "Response logged", done: doneInv > 0 }],
      `${doneInv} completed investigation(s).`, "/letters"),

    st("verified_outcomes", "Verified outcomes", favRate !== "—" ? "active" : "upcoming",
      favRate !== "—" ? `Your favorable-change rate so far: ${favRate}.` : "Verified outcomes accumulate as you log responses.",
      [{ text: "First verified outcome", done: favRate !== "—" }],
      favRate !== "—" ? "From your own logged outcomes (history, not a prediction)." : "No verified outcomes yet.", "/journey"),

    st("utilization", "Utilization", "unavailable",
      "Not tracked — credit-limit data isn't in the parsed report.",
      [{ text: "Utilization data", done: false }],
      "Requires credit limits CreditVector doesn't receive.", "/dashboard"),

    st("credit_builder", "Credit builder", "upcoming",
      has("builder") ? "Your file is thin — adding on-time positive history strengthens it over time." : "Adding on-time positive history strengthens your profile over time.",
      // Positive tradelines aren't imported, so we never mark this done from our data.
      [{ text: "On-time positive history added", done: false }],
      "Builder gaps from the CVI builder module (positive tradelines aren't imported).", "/dashboard"),

    st("funding_readiness", "Funding readiness", ["personal_loan", "auto", "credit_card"].some((g) => rd(g)?.level === "ready") ? "active" : "upcoming",
      "Whether your file is in shape for personal / auto / card funding — not a lending decision.",
      ["credit_card", "personal_loan", "auto"].map((g) => ({ text: rd(g)?.label ?? g, done: rd(g)?.level === "ready" })),
      "From the CVI readiness engine.", "/dashboard"),

    st("business_credit", "Business credit", "locked",
      "A future module — nothing to connect externally yet.",
      [{ text: "Business profile", done: false }],
      "Business-credit data not collected.", "/dashboard"),

    st("mortgage_readiness", "Mortgage readiness", readinessStatus("mortgage"),
      rd("mortgage")?.level === "ready" ? "Your file is in shape for a mortgage application — not a lending decision." : "Mortgage readiness improves as you clear derogatory items — this is not a lending decision.",
      (rd("mortgage")?.reasons ?? []).slice(0, 3).map((r) => ({ text: r.text.replace(/^✓ /, ""), done: r.text.startsWith("✓") })),
      "From the CVI readiness engine (strictest prerequisites).", "/dashboard"),

    st("long_term_monitoring", "Long-term monitoring", scoresLogged ? "active" : "upcoming",
      scoresLogged ? "You're tracking your scores over time." : "Log scores over time to watch the trend.",
      [{ text: "Score tracking started", done: scoresLogged }],
      scoresLogged ? `Score progress: ${scoreTile!.stat}.` : "No scores logged yet.", "/scores"),
  ];

  // Journey progress: share of the ASSESSABLE stages (excluding locked/unavailable)
  // that are done or in motion. Deterministic; not a credit score.
  const assessable = stages.filter((s) => s.status !== "locked" && s.status !== "unavailable");
  const advanced = assessable.filter((s) => ["completed", "current", "active", "waiting"].includes(s.status)).length;
  const progressPct = assessable.length ? Math.round((advanced / assessable.length) * 100) : null;

  const currentStageId = stages.find((s) => s.status === "current")?.id
    ?? stages.find((s) => ["active", "waiting"].includes(s.status))?.id ?? null;
  const nextStageId = stages.find((s) => s.status === "upcoming")?.id ?? null;

  return { stages, progressPct, currentStageId, nextStageId, note: "Every stage is derived from your file — no invented dates, no promised outcomes." };
}
