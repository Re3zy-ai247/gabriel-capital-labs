// Mission Control (Sprint XIII) — the operating system that tells the customer
// what to do today. It ORCHESTRATES the existing engines and invents nothing: no
// AI, no fabricated timelines, no estimated deletions, no fake probabilities. It
// answers four questions — what should I do today, what am I waiting on, what's
// happening automatically, what happens next — entirely from deterministic data.
//
// Reuses (never re-implements): Kai Home (getKaiHomeData), Case Memory
// (caseMemorySince), the Campaign engine (compose + campaign records + policy),
// the §611 clock (REINVESTIGATION_DAYS), and the user's own rows.
//
// `assembleMission` is PURE (no DB) so the whole composition is unit-testable;
// `getMissionControl` is the thin loader that feeds it real rows.
import { prisma } from "@/lib/prisma";
import type { AccountType, Letter } from "@prisma/client";
import { getKaiHomeData, REINVESTIGATION_DAYS, type KaiHomeData, type KaiRecommendation, type OvernightItem } from "@/lib/kaiHome";
import { caseMemorySince, type CaseMemory } from "@/lib/kaiSeen";
import { campaignService, buildComposerItems } from "@/lib/campaignInput";
import { ownOutcomeTrack, ownHistorySummary, type OwnTrack } from "@/lib/outcomeLedger";
// RB-2 (Founder Experience Gate): the same fact test lib/intelligence/snapshot.ts
// uses for the "active negatives" count — reused here so the Deferred Queue can
// never stage a factually clean account (never the disputability `probability`
// band the campaign composer ranks by).
import { isFactualNegative } from "@/lib/intelligence/snapshot";
import {
  resolveCampaignPolicy, includedItems, deferredItems, FAMILY_LABEL,
  type Campaign, type CampaignItem, type CampaignPolicy, type ComposedCampaign,
} from "@/lib/campaign";

const DAY = 86_400_000;

export type Health = "green" | "amber" | "red";

export interface MissionTask { text: string; href: string; kind: "review" | "mail" | "upload" | "escalate" | "start" }
export interface WaitItem { recipient: string; daysLeft: number; text: string; href: string }
export interface AutoItem { text: string }
export interface CommandSection { key: string; title: string; stat: string; sub: string; href: string; tone: Health | "neutral" }
export interface CapacityInfo { recommendedSize: number; policyMax: number; stagedCount: number; reasons: string[]; family: string | null }
export interface DeferredItem { creditorName: string; why: string; unlocks: string; estReviewDate: string | null; dependency: string | null }
export interface HealthSignal { key: string; label: string; status: Health; message: string }

export interface MissionControlData {
  firstName: string;
  caseMemory: CaseMemory;
  overnight: OvernightItem[];
  tasks: MissionTask[];
  waiting: WaitItem[];
  automatic: AutoItem[];
  nextAction: KaiRecommendation | null;
  nextUnlock: string | null;
  command: CommandSection[];
  capacity: CapacityInfo | null;
  deferred: DeferredItem[];
  health: HealthSignal[];
  caseHealth: Health;
  hasReport: boolean;
  ownHistory: string | null; // gate-free own verified-outcome track record (Sprint XIV)
}

// Everything the pure assembler needs — already loaded, deterministic.
export interface MissionInputs {
  user: { fullName?: string | null; name?: string | null };
  kai: KaiHomeData;
  caseMemory: CaseMemory;
  campaigns: Campaign[];
  composed: ComposedCampaign;
  // accountType + dateOfFirstDelinquency: RB-2's isFactualNegative fact test,
  // so the Deferred Queue below can tell a genuine negative from a factually
  // clean account (e.g. "pays as agreed, never late").
  tradelines: { id: string; resolved: boolean; accountType: AccountType; dateOfFirstDelinquency: Date | null }[];
  letters: Pick<Letter, "id" | "tradelineId" | "recipientName" | "parentLetterId" | "responseAt" | "responseOutcome" | "mailedAt">[];
  scoreEntries: { bureau: string; score: number; recordedAt: Date }[];
  nextSeq: number;
  policy: CampaignPolicy;
  ownTrack?: OwnTrack;
  now?: number;
}

const LIVE_CAMPAIGN = new Set(["APPROVED", "ACTIVE", "WAITING", "RESPONSE_RECEIVED"]);

function unmailedCount(c: Campaign): number {
  return includedItems(c).filter((i) => !i.queued).length;
}

function estDateFor(tradelineId: string, letters: MissionInputs["letters"], now: number): string | null {
  const open = letters.find((l) => l.tradelineId === tradelineId && l.mailedAt && !l.responseAt);
  if (!open?.mailedAt) return null;
  const end = new Date(new Date(open.mailedAt).getTime() + REINVESTIGATION_DAYS * DAY);
  // The window has already passed → don't show a date in the past; the "unlocks
  // when the window resolves or passes" copy already covers it.
  if (end.getTime() <= now) return null;
  return end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Score progress — net points across bureaus with ≥2 logged entries. Honest: no
// entries → an invitation to log, never a fabricated number.
function scoreProgress(entries: MissionInputs["scoreEntries"]): { stat: string; sub: string; tone: Health | "neutral" } {
  const byBureau = new Map<string, { score: number; recordedAt: Date }[]>();
  for (const e of entries) {
    const arr = byBureau.get(e.bureau) ?? [];
    arr.push({ score: e.score, recordedAt: e.recordedAt }); byBureau.set(e.bureau, arr);
  }
  let net = 0; let tracked = 0;
  for (const [, arr] of byBureau) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    net += sorted[sorted.length - 1].score - sorted[0].score; tracked++;
  }
  if (tracked === 0) return { stat: "Log scores", sub: "start tracking your progress", tone: "neutral" };
  return { stat: `${net >= 0 ? "+" : ""}${net} pts`, sub: "across bureaus since you started tracking", tone: net > 0 ? "green" : net < 0 ? "amber" : "neutral" };
}

// The pure composition — deterministic given its inputs.
export function assembleMission(x: MissionInputs): MissionControlData {
  const { user, kai, caseMemory, campaigns, composed, tradelines, letters, scoreEntries, nextSeq, policy } = x;
  const now = x.now ?? Date.now();

  const firstName = (user.fullName || user.name || "").trim().split(" ")[0] || "there";
  const hasReport = tradelines.length > 0;
  const resolved = tradelines.filter((t) => t.resolved).length;

  const liveCampaigns = campaigns.filter((c) => LIVE_CAMPAIGN.has(c.status));
  const pendingReview = campaigns.filter((c) => c.status === "RECOMMENDED" || c.status === "NEEDS_REVIEW");
  const approvedUnmailed = campaigns.filter((c) => (c.status === "APPROVED" || c.status === "ACTIVE") && unmailedCount(c) > 0);

  // ---- Waiting on (open §611 windows, still running) ----
  const waiting: WaitItem[] = kai.deadlines
    .filter((d) => d.daysLeft > 0)
    .slice(0, 4)
    .map((d) => ({ recipient: d.recipient, daysLeft: d.daysLeft, href: "/letters", text: `Waiting on ${d.recipient} — ${d.daysLeft} day${d.daysLeft === 1 ? "" : "s"} remaining in the statutory window.` }));
  const overdue = kai.deadlines.filter((d) => d.daysLeft <= 0);
  const closing = kai.deadlines.filter((d) => d.daysLeft > 0 && d.daysLeft <= 5);
  // Counts derived DIRECTLY from the letters, so they stay correct even when more
  // than Kai Home's 6-deadline display cap is open.
  const openLetters = letters.filter((l) => l.mailedAt && !l.responseAt);
  const openWindows = openLetters.length;
  const overdueCount = openLetters.filter((l) => (now - new Date(l.mailedAt as Date).getTime()) / DAY >= REINVESTIGATION_DAYS).length;
  // ONE follow-up index + escalatable set, reused by tasks, next action, and the
  // response-health signal so they can never disagree (a task without a matching
  // health flag was the bug the review caught).
  const followedUp = new Set(letters.map((l) => l.parentLetterId).filter(Boolean));
  const escalatable = hasReport
    ? letters.filter((l) => l.responseAt && l.responseOutcome && l.responseOutcome !== "deleted" && !followedUp.has(l.id))
    : [];
  const needsResponseAction = escalatable.length > 0;

  // ---- Today's Mission (the checklist) ----
  const tasks: MissionTask[] = [];
  if (!hasReport) {
    tasks.push({ text: "Upload your credit report to get started", href: "/upload", kind: "upload" });
  } else {
    for (const l of escalatable.slice(0, 2)) {
      tasks.push({ text: l.responseOutcome === "verified" ? `Open Round 2 for ${l.recipientName} — method-of-verification available` : `Review the ${l.recipientName} response and decide the next round`, href: "/letters", kind: "escalate" });
    }
    for (const d of overdue.slice(0, 2)) {
      tasks.push({ text: `Upload the ${d.recipient} response (its window has passed)`, href: "/letters", kind: "upload" });
    }
    for (const c of approvedUnmailed.slice(0, 2)) {
      const n = unmailedCount(c);
      tasks.push({ text: `Mail ${n} approved dispute${n === 1 ? "" : "s"} — Campaign ${c.sequence}`, href: "/campaigns", kind: "mail" });
    }
    for (const c of pendingReview.slice(0, 1)) {
      const n = includedItems(c).length;
      tasks.push({ text: `Review Campaign ${c.sequence} — ${n} item${n === 1 ? "" : "s"}`, href: "/campaigns", kind: "review" });
    }
    if (pendingReview.length === 0 && approvedUnmailed.length === 0 && composed.hasRecommendation) {
      const n = includedItems({ items: composed.items }).length;
      tasks.push({ text: `Review Kai's recommended campaign — ${n} item${n === 1 ? "" : "s"}`, href: "/campaigns", kind: "review" });
    }
  }

  // ---- What's happening automatically ----
  const automatic: AutoItem[] = [];
  // RB-2 (Founder Experience Gate): the Deferred Queue must never stage an
  // account with nothing to dispute (a "pays as agreed, never late" account
  // has no business being staged for "a later campaign"). Every tradelineId
  // in `composed.items` corresponds to an unresolved row in `tradelines`
  // (buildComposerItems already skips resolved tradelines before the
  // composer ever sees them), so the `?? true` fallback is defensive only —
  // it never silently hides a genuine negative behind a missing lookup.
  const negativeById = new Map(tradelines.map((t) => [t.id, isFactualNegative(t)]));
  const deferredComposed = deferredItems({ items: composed.items }).filter(
    (i) => negativeById.get(i.tradelineId) ?? true
  );
  if (deferredComposed.length > 0) automatic.push({ text: `${deferredComposed.length} account${deferredComposed.length === 1 ? " is" : "s are"} staged for a later campaign — Kai unlocks them automatically.` });
  if (kai.deadlines.length > 0) automatic.push({ text: `Your response windows are tracked automatically against the ~${REINVESTIGATION_DAYS}-day §611 clock.` });
  if (composed.nextUnlock.length > 0 && tasks.some((t) => t.kind === "mail")) automatic.push({ text: "Your next campaign is staged and unlocks as the current one progresses." });

  // ---- Next action (single, deterministic) ----
  // An overdue window or a response that needs escalation is the RED state — it
  // outranks sending new mail. Kai Home ranks verified/lapsed first, so when the
  // case is urgent its recommendation IS that escalation; surface it before a
  // "mail the next campaign" step (the priority inversion the review caught).
  let nextAction: KaiRecommendation | null = null;
  const urgent = overdueCount > 0 || escalatable.length > 0;
  if (urgent && kai.recommendation) {
    nextAction = kai.recommendation;
  } else if (approvedUnmailed[0]) {
    const c = approvedUnmailed[0]; const n = unmailedCount(c);
    nextAction = { title: `Mail Campaign ${c.sequence}`, body: `${n} approved dispute${n === 1 ? " is" : "s are"} ready to send. Mailing starts each item's response clock.`, cta: "Go to campaigns", href: "/campaigns", basis: `Rule: Campaign ${c.sequence} is approved with ${n} unmailed item${n === 1 ? "" : "s"}.` };
  } else if (kai.recommendation) {
    nextAction = kai.recommendation;
  } else if (pendingReview[0]) {
    const c = pendingReview[0]; const n = includedItems(c).length;
    nextAction = { title: `Approve Campaign ${c.sequence}`, body: `Kai has a focused campaign of ${n} item${n === 1 ? "" : "s"} ready for your review.`, cta: "Review the campaign", href: "/campaigns", basis: `Rule: Campaign ${c.sequence} is composed and awaiting your approval.` };
  } else if (composed.hasRecommendation) {
    nextAction = { title: `Review your next campaign`, body: composed.rationale, cta: "Open campaigns", href: "/campaigns", basis: "Rule: disputable items on file with no campaign in review." };
  } else if (waiting[0]) {
    const min = Math.min(...waiting.map((w) => w.daysLeft));
    nextAction = { title: `Wait ${min} day${min === 1 ? "" : "s"}`, body: `Your disputes are within their statutory windows — no action is needed right now. Kai is watching the clocks.`, cta: "See what's in flight", href: "/mail", basis: `Rule: ${waiting.length} open window${waiting.length === 1 ? "" : "s"}, none overdue.` };
  }

  // ---- Next unlock ----
  let nextUnlock: string | null = null;
  if (deferredComposed.length > 0) {
    if (waiting.length > 0) {
      const min = Math.min(...waiting.map((w) => w.daysLeft));
      nextUnlock = `Your next campaign unlocks in ~${min} day${min === 1 ? "" : "s"}, once the current response window resolves.`;
    } else if (tasks.some((t) => t.kind === "mail" || t.kind === "review")) {
      nextUnlock = "Your next campaign unlocks once the current one is mailed and its window opens.";
    }
  }

  // ---- Campaign Capacity ----
  let capacity: CapacityInfo | null = null;
  if (composed.hasRecommendation) {
    const staged = deferredComposed.length;
    const reasons = ["A focused package keeps each dispute clearly presented", "Each item is easier for you to document and track"];
    if (staged > 0) reasons.push(`Remaining ${staged} account${staged === 1 ? " is" : "s are"} automatically staged for the next campaign`);
    capacity = { recommendedSize: includedItems({ items: composed.items }).length, policyMax: policy.recommendedMax, stagedCount: staged, reasons, family: FAMILY_LABEL[composed.strategyFamily] };
  }

  // ---- Deferred Queue ----
  const deferred: DeferredItem[] = deferredComposed.slice(0, 8).map((i: CampaignItem) => {
    const active = /already open/i.test(i.reason);
    return {
      creditorName: i.creditorName, why: i.reason,
      unlocks: active ? "when the open dispute's window resolves or passes" : "after the current campaign is mailed and underway",
      estReviewDate: active ? estDateFor(i.tradelineId, letters, now) : null,
      dependency: active ? "An open §611 reinvestigation" : "The current campaign",
    };
  });

  // ---- Health Dashboard ----
  const health: HealthSignal[] = [];
  if (approvedUnmailed.length > 0) health.push({ key: "campaign", label: "Campaign health", status: "amber", message: "A campaign is approved but not yet mailed — send it to start the clock." });
  else if (pendingReview.length > 0) health.push({ key: "campaign", label: "Campaign health", status: "amber", message: "A campaign is waiting for your review." });
  else health.push({ key: "campaign", label: "Campaign health", status: "green", message: liveCampaigns.length > 0 ? "Your campaigns are progressing." : "Nothing stalled." });

  if (overdueCount > 0) health.push({ key: "mail", label: "Mail health", status: "red", message: `${overdueCount} mailed dispute${overdueCount === 1 ? "" : "s"} past the response window.` });
  else if (closing.length > 0) health.push({ key: "mail", label: "Mail health", status: "amber", message: `${closing.length} window${closing.length === 1 ? "" : "s"} closing within 5 days.` });
  else health.push({ key: "mail", label: "Mail health", status: "green", message: kai.lettersMailed > 0 ? "Everything mailed is within its window." : "Nothing in the mail yet." });

  if (overdueCount > 0) health.push({ key: "response", label: "Response health", status: "red", message: "A response is overdue — log it or escalate." });
  else if (needsResponseAction) health.push({ key: "response", label: "Response health", status: "amber", message: "A logged response needs your next move." });
  else health.push({ key: "response", label: "Response health", status: "green", message: "No response action outstanding." });

  const lastEvent = kai.recentEvents[0]?.occurredAt;
  const stale = lastEvent ? (now - new Date(lastEvent).getTime()) / DAY > 30 : false;
  const openDisputes = letters.some((l) => l.mailedAt && !l.responseAt);
  if (stale && openDisputes) health.push({ key: "timeline", label: "Timeline health", status: "amber", message: "No activity in over 30 days while disputes are open — check your windows." });
  else health.push({ key: "timeline", label: "Timeline health", status: "green", message: hasReport ? "Your case is moving." : "Upload a report to begin." });

  const caseHealth: Health = health.some((h) => h.status === "red") ? "red" : health.some((h) => h.status === "amber") ? "amber" : "green";
  health.push({ key: "case", label: "Case health", status: caseHealth, message: caseHealth === "green" ? "Everything's green — no action needed." : caseHealth === "amber" ? "A couple of things want your attention." : "Something's overdue — see the flags above." });

  // ---- Command Center (deep-linked sections) ----
  const nearest = kai.deadlines.filter((d) => d.daysLeft > 0).sort((a, b) => a.daysLeft - b.daysLeft)[0];
  const sp = scoreProgress(scoreEntries);
  const lastEventDate = lastEvent ? new Date(lastEvent).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
  const command: CommandSection[] = [
    { key: "campaigns", title: "Campaigns", stat: `${liveCampaigns.length} active`, sub: `${campaigns.length} total`, href: "/campaigns", tone: pendingReview.length || approvedUnmailed.length ? "amber" : "neutral" },
    { key: "mail", title: "Mail", stat: `${kai.lettersMailed} mailed`, sub: `${openWindows} awaiting response`, href: "/mail", tone: overdueCount ? "red" : "neutral" },
    { key: "responses", title: "Responses", stat: `${kai.responsesReceived} / ${kai.lettersMailed}`, sub: "responses logged", href: "/letters", tone: needsResponseAction ? "amber" : "neutral" },
    { key: "timeline", title: "Timeline", stat: `Last: ${lastEventDate}`, sub: `${resolved} item${resolved === 1 ? "" : "s"} resolved`, href: "/journey", tone: "neutral" },
    { key: "scores", title: "Score progress", stat: sp.stat, sub: sp.sub, href: "/scores", tone: sp.tone },
    { key: "deadlines", title: "Upcoming deadlines", stat: nearest ? `${nearest.daysLeft}d` : "None", sub: nearest ? `${nearest.recipient} · §611` : "no open windows", href: "/letters", tone: overdueCount ? "red" : closing.length ? "amber" : "neutral" },
    { key: "deferred", title: "Deferred accounts", stat: `${deferredComposed.length}`, sub: "staged for later", href: "/campaigns", tone: "neutral" },
    { key: "next", title: "Recommended next action", stat: nextAction ? nextAction.cta : "On track", sub: nextAction ? "one step at a time" : "no action needed", href: nextAction?.href ?? "/journey", tone: nextAction ? "amber" : "green" },
  ];

  const ownHistory = x.ownTrack ? ownHistorySummary(x.ownTrack) : null;
  return { firstName, caseMemory, overnight: kai.overnight, tasks, waiting, automatic, nextAction, nextUnlock, command, capacity, deferred, health, caseHealth, hasReport, ownHistory };
}

// The loader — pulls the real rows and hands them to the pure assembler.
export async function getMissionControl(userId: string, user: { fullName?: string | null; name?: string | null }): Promise<MissionControlData> {
  const svc = campaignService();
  const [kai, caseMemory, campaigns, items, tradelines, letters, scoreEntries, ownTrack, nextSeq] = await Promise.all([
    getKaiHomeData(userId),
    caseMemorySince(userId),
    svc.list(userId, 50),
    buildComposerItems(userId),
    prisma.tradeline.findMany({ where: { userId }, select: { id: true, resolved: true, accountType: true, dateOfFirstDelinquency: true } }),
    prisma.letter.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true, tradelineId: true, recipientName: true, parentLetterId: true, responseAt: true, responseOutcome: true, mailedAt: true } }),
    prisma.scoreEntry.findMany({ where: { userId }, select: { bureau: true, score: true, recordedAt: true }, orderBy: { recordedAt: "asc" } }),
    ownOutcomeTrack(userId),
    svc.nextSequence(userId),
  ]);
  const composed = svc.compose(items, nextSeq);
  return assembleMission({
    user, kai, caseMemory, campaigns, composed, tradelines,
    letters, scoreEntries, ownTrack, nextSeq, policy: resolveCampaignPolicy(),
  });
}
