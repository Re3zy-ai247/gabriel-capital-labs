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
import { isFactualNegative, factualCondition } from "@/lib/intelligence/snapshot";
import { letterAuthorization } from "@/lib/letter";
import {
  resolveCampaignPolicy, includedItems, deferredItems, FAMILY_LABEL,
  type Campaign, type CampaignItem, type CampaignPolicy, type ComposedCampaign,
} from "@/lib/campaign";

const DAY = 86_400_000;

export type Health = "green" | "amber" | "red";

// RC1 S7 (finding C-05). `Health` answers "how is the work going"; it has no
// vocabulary for "no work has started", so an account that had done nothing
// scored all-green on every signal and the room announced "ALL SYSTEMS GREEN"
// next to "Upload your credit report to get started". On a credit product that
// pill reads as a statement about the consumer's FILE, not about an empty
// internal queue. `Standing` is the missing state, kept as its OWN type rather
// than widened into `Health` so the existing tone maps (exhaustive
// Record<Health, ...> lookups in components/mission/CommandCenter.tsx) stay
// total and unchanged.
export type Standing = Health | "unstarted";

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
  /** C-05: caseHealth, except an account that has not started reads "unstarted", never green. */
  standing: Standing;
  /** A report row exists. THE shared fact - see the derivation note in assembleMission. */
  hasReport: boolean;
  /**
   * Anything at all is on file — a report, a letter or a campaign (S11 AD-4).
   * Deliberately broader than `hasReport`: letters survive a report delete, and
   * the mail/response/campaign health signals derive from them, so this is the
   * question "has this case begun" actually asks.
   */
  caseOnFile: boolean;
  /**
   * A report exists but analysis produced no tradelines (A1-04). Its own
   * state, because "nothing to do" and "we could not read your report" are
   * different sentences, and the consumer in the second one needs the most help.
   */
  reportWithoutTradelines: boolean;
  ownHistory: string | null; // gate-free own verified-outcome track record (Sprint XIV)
}

// Everything the pure assembler needs — already loaded, deterministic.
export interface MissionInputs {
  user: { fullName?: string | null; name?: string | null };
  kai: KaiHomeData;
  caseMemory: CaseMemory;
  campaigns: Campaign[];
  composed: ComposedCampaign;
  // accountType + dateOfFirstDelinquency + bureauData: RB-2's isFactualNegative
  // fact test, so the Deferred Queue below can tell a genuine negative from a
  // factually clean account (e.g. "pays as agreed, never late").
  //
  // RC1 S7 (S3 handoff): `bureauData` is load-bearing and used to be missing.
  // lib/intelligence/snapshot.ts's factualCondition() reads the report's OWN
  // per-bureau status text ("Charge-Off", "Collection", "120 days past due")
  // as evidence - but this projection carried only type + DOFD, and
  // ConditionInput makes bureauData optional so a narrowed caller still
  // compiles. The result was silent: a REVOLVING row whose report text says
  // "Charge-Off" is DEROGATORY to every S3 surface and NEEDS_REVIEW here, so
  // the Deferred Queue dropped an account the rest of the product counts.
  // Same rows, same fact test, same answer - pass the field.
  tradelines: { id: string; resolved: boolean; accountType: AccountType; dateOfFirstDelinquency: Date | null; bureauData?: unknown }[];
  /**
   * How many report rows exist for this user (A1-04 / C-04, the split-brain).
   * Mission Control derived `hasReport` from `tradelines.length > 0` while Kai
   * Home's own branch 4 keys on `reports.length === 0`. The two disagree in a
   * very reachable state - upload succeeded, extraction produced nothing - and
   * that disagreement rendered as one screen saying "Upload your credit report
   * to get started" and "Nothing needs your attention right now" at once. Both
   * engines now key on the same fact.
   */
  reportCount: number;
  /**
   * ACTIVE ConsumerAssertion counts by tradelineId (S11 NEW-3). Feeds
   * lib/letter.ts's letterAuthorization() — the SAME predicate the approve,
   * print and mail routes enforce — so this engine can never describe a letter
   * as ready when the server has already decided to refuse it with a 409.
   * Only unmailed letters are judged; a mailed letter is a record.
   */
  activeAssertionCounts: Record<string, number>;
  // `strategy` (S11 AD-R3-1 / B-R3-2) is NOT optional here even though
  // LetterAuthorizationInput still declares it optional. Optional-and-absent is
  // exactly how this engine got the identity letter wrong: the field failed
  // closed, so every Personal Information correction letter — which has no
  // tradelineId BY DESIGN, because it disputes the consumer's own name, address
  // and employers — read as an orphan whose account had been deleted. Requiring
  // it here means no caller can omit it, and S5 making it required upstream is
  // a no-op for this engine rather than a compile break.
  letters: Pick<Letter, "id" | "tradelineId" | "recipientName" | "parentLetterId" | "responseAt" | "responseOutcome" | "mailedAt" | "strategy">[];
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
  // THE shared fact (A1-04): "has this consumer given us a report" is a
  // question about REPORTS, and it is answered here exactly the way
  // lib/kaiHome.ts's pickRecommendation answers it. Extraction yield is a
  // separate, second question - never a proxy for the first.
  const hasReport = x.reportCount > 0;
  const hasTradelines = tradelines.length > 0;
  const reportWithoutTradelines = hasReport && !hasTradelines;
  // S11 AD-4. "Has a report" is NOT the same question as "has anything begun",
  // and conflating them put the opposite falsehood on the same band C-05 fixed.
  // `hasReport` counts REPORT rows, which the consumer can zero out at will —
  // /upload offers DELETE /api/reports/{id}, and letters deliberately survive
  // that delete (SetNull). Letters and campaigns are what the mail, response
  // and campaign health signals are derived from, and those are computed
  // without reference to hasReport at all. So a consumer who mailed two
  // disputes and then exercised the data-control the product advertises had a
  // live, overdue case with nothing on file called a report.
  const caseOnFile = hasReport || letters.length > 0 || campaigns.length > 0;
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
  // S11 NEW-3 — the drafts the server will refuse. Asked of lib/letter.ts's own
  // letterAuthorization(), never a second predicate of this engine's invention:
  // a letter is REVOKED when it is unmailed and either its tradeline is gone
  // (report deleted or replaced) or no ACTIVE confirmation stands behind it
  // (withdrawn, or drafted before confirmations existed). Those letters cannot
  // be approved, printed or mailed, so a room that called them ready — and then
  // summarised the account as needing no action — was describing a product that
  // had already decided otherwise.
  const blockedLetters = letters.filter(
    (l) =>
      letterAuthorization({
        mailedAt: l.mailedAt,
        tradelineId: l.tradelineId,
        activeAssertionCount: l.tradelineId ? x.activeAssertionCounts[l.tradelineId] ?? 0 : 0,
        // The discriminator. Without it a null tradelineId reads as a deleted
        // account; with it, a non-tradeline strategy reads as what it is.
        strategy: l.strategy,
      }) === "REVOKED"
  );
  // The two shapes have different remedies, and sending everyone to /tradelines
  // was the secondary defect: for a consumer whose report was deleted that page
  // is empty, so the offered action did not exist.
  // Every letter in `blockedLetters` has already been ruled REVOKED, so a null
  // tradelineId here can only be the re-analysis/deleted-report orphan — a
  // non-tradeline letter never reaches this line.
  const blockedOrphaned = blockedLetters.filter((l) => !l.tradelineId).length;
  const blockedConfirmable = blockedLetters.length - blockedOrphaned;

  const openLetters = letters.filter((l) => l.mailedAt && !l.responseAt);
  const openWindows = openLetters.length;
  const overdueCount = openLetters.filter((l) => (now - new Date(l.mailedAt as Date).getTime()) / DAY >= REINVESTIGATION_DAYS).length;
  // ONE follow-up index + escalatable set, reused by tasks, next action, and the
  // response-health signal so they can never disagree (a task without a matching
  // health flag was the bug the review caught).
  const followedUp = new Set(letters.map((l) => l.parentLetterId).filter(Boolean));
  // AD-4: gated on the case existing, not on a report row surviving. A logged
  // response IS a letter fact; requiring a report to notice it is how a
  // time-barred escalation went unmentioned. (With no letters the filter is
  // empty anyway, so this only ever ADDS the state the old gate suppressed.)
  const escalatable = caseOnFile
    ? letters.filter((l) => l.responseAt && l.responseOutcome && l.responseOutcome !== "deleted" && !followedUp.has(l.id))
    : [];
  const needsResponseAction = escalatable.length > 0;

  // ---- Today's Mission (the checklist) ----
  const tasks: MissionTask[] = [];
  // AD-4: the letter-derived work comes FIRST and is emitted whatever the
  // report state is. It used to sit inside the final `else`, so a consumer with
  // no report row on file was shown "Upload your credit report to get started"
  // as their entire mission while two of their disputes sat past the §611
  // window. Time-barred facts outrank onboarding prompts, always.
  for (const l of escalatable.slice(0, 2)) {
    tasks.push({ text: l.responseOutcome === "verified" ? `Open Round 2 for ${l.recipientName} — method-of-verification available` : `Review the ${l.recipientName} response and decide the next round`, href: "/letters", kind: "escalate" });
  }
  for (const d of overdue.slice(0, 2)) {
    tasks.push({ text: `Upload the ${d.recipient} response (its window has passed)`, href: "/letters", kind: "upload" });
  }
  // S11 NEW-3: the true next step for a blocked draft, split by what actually
  // blocks it. Letter-derived, so it is emitted whatever the report state is.
  if (blockedConfirmable > 0) {
    tasks.push({
      text: `Confirm the facts behind ${blockedConfirmable} dispute letter${blockedConfirmable === 1 ? "" : "s"} — ${blockedConfirmable === 1 ? "it can't" : "they can't"} be approved, printed or mailed until you do`,
      href: "/tradelines", kind: "review",
    });
  }
  if (blockedOrphaned > 0) {
    tasks.push({
      text: `${blockedOrphaned} dispute letter${blockedOrphaned === 1 ? " names an account that is" : "s name accounts that are"} no longer on your report — upload that report again to confirm the facts, or leave the draft as it is`,
      href: "/upload", kind: "upload",
    });
  }
  if (!hasReport) {
    tasks.push({ text: "Upload your credit report to get started", href: "/upload", kind: "upload" });
  } else if (reportWithoutTradelines) {
    // A1-04: the consumer who most needs help used to be told there was
    // nothing to do. State the fact and give them the one move that helps -
    // no promise about what a re-run will find.
    tasks.push({ text: "No accounts were read from your last report — open Upload to try that file again or add another report", href: "/upload", kind: "upload" });
  } else {
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
  // C-06 - every line here is a render-time derivation over rows the consumer
  // already gave us. There is no scheduler behind any of it: vercel.json
  // declares two crons and both belong to the news Brief, and no consumer
  // notification is wired to a §611 window. So the copy says what is true -
  // these are counted and shown when you open CreditVector - and never "we are
  // watching it for you", which would tell a consumer they can stop looking.
  if (deferredComposed.length > 0) automatic.push({ text: `${deferredComposed.length} account${deferredComposed.length === 1 ? " is" : "s are"} staged for a later campaign — they move into the next campaign as the current one progresses.` });
  if (kai.deadlines.length > 0) automatic.push({ text: `Every response window is counted against the ~${REINVESTIGATION_DAYS}-day §611 clock from the date you logged, and shown here each time you open CreditVector.` });
  if (composed.nextUnlock.length > 0 && tasks.some((t) => t.kind === "mail")) automatic.push({ text: "Your next campaign is staged and unlocks as the current one progresses." });

  // ---- Next action (single, deterministic) ----
  // An overdue window or a response that needs escalation is the RED state — it
  // outranks sending new mail. Kai Home ranks verified/lapsed first, so when the
  // case is urgent its recommendation IS that escalation; surface it before a
  // "mail the next campaign" step (the priority inversion the review caught).
  let nextAction: KaiRecommendation | null = null;
  const urgent = overdueCount > 0 || escalatable.length > 0;
  if (reportWithoutTradelines && kai.recommendation) {
    // A1-04: kaiHome's own branch for this exact state. Taking it verbatim is
    // what makes "Today's mission" and "Kai's next action" ONE answer rather
    // than two - there is nothing to escalate or mail on a file with no rows.
    nextAction = kai.recommendation;
  } else if (urgent && kai.recommendation) {
    nextAction = kai.recommendation;
  } else if (approvedUnmailed[0]) {
    const c = approvedUnmailed[0]; const n = unmailedCount(c);
    nextAction = { title: `Mail Campaign ${c.sequence}`, body: `${n} approved dispute${n === 1 ? " is" : "s are"} ready to send. Each item's response clock starts once its recipient receives it.`, cta: "Go to campaigns", href: "/campaigns", basis: `Rule: Campaign ${c.sequence} is approved with ${n} unmailed item${n === 1 ? "" : "s"}.` };
  } else if (kai.recommendation) {
    nextAction = kai.recommendation;
  } else if (pendingReview[0]) {
    const c = pendingReview[0]; const n = includedItems(c).length;
    nextAction = { title: `Approve Campaign ${c.sequence}`, body: `Kai has a focused campaign of ${n} item${n === 1 ? "" : "s"} ready for your review.`, cta: "Review the campaign", href: "/campaigns", basis: `Rule: Campaign ${c.sequence} is composed and awaiting your approval.` };
  } else if (composed.hasRecommendation) {
    nextAction = { title: `Review your next campaign`, body: composed.rationale, cta: "Open campaigns", href: "/campaigns", basis: "Rule: disputable items on file with no campaign in review." };
  } else if (waiting[0]) {
    const min = Math.min(...waiting.map((w) => w.daysLeft));
    nextAction = { title: `Wait ${min} day${min === 1 ? "" : "s"}`, body: `Your disputes are within their statutory windows — no action is needed right now. Each window's remaining time is shown here whenever you open CreditVector.`, cta: "See what's in flight", href: "/mail", basis: `Rule: ${waiting.length} open window${waiting.length === 1 ? "" : "s"}, none overdue.` };
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
  if (approvedUnmailed.length > 0) health.push({ key: "campaign", label: "Campaign health", status: "amber", message: "A campaign is approved but not yet mailed — send it; the clock starts once the recipient receives it." });
  else if (pendingReview.length > 0) health.push({ key: "campaign", label: "Campaign health", status: "amber", message: "A campaign is waiting for your review." });
  else health.push({ key: "campaign", label: "Campaign health", status: "green", message: liveCampaigns.length > 0 ? "Your campaigns are progressing." : "Nothing stalled." });

  if (overdueCount > 0) health.push({ key: "mail", label: "Mail health", status: "red", message: `${overdueCount} mailed dispute${overdueCount === 1 ? "" : "s"} past the response window.` });
  else if (closing.length > 0) health.push({ key: "mail", label: "Mail health", status: "amber", message: `${closing.length} window${closing.length === 1 ? "" : "s"} closing within 5 days.` });
  else health.push({ key: "mail", label: "Mail health", status: "green", message: kai.lettersMailed > 0 ? "Everything mailed is within its window." : "Nothing in the mail yet." });

  if (overdueCount > 0) health.push({ key: "response", label: "Response health", status: "red", message: "A response is overdue — log it or escalate." });
  else if (needsResponseAction) health.push({ key: "response", label: "Response health", status: "amber", message: "A logged response needs your next move." });
  else health.push({ key: "response", label: "Response health", status: "green", message: "No response action outstanding." });

  // ---- Report health: the CONSUMER'S FILE, not our workflow (S11 HIGH-1) ----
  // Every signal above measures workflow hygiene — is a campaign stalled, is
  // mail moving, is a response outstanding, has anything happened lately — and
  // every one of them has a green else-branch. So a consumer with four
  // unresolved derogatory accounts, six unmailed letters and three bureau
  // responses that ALL came back verified rolled up to "ALL SYSTEMS GREEN",
  // three inches from "Your favorable-change rate so far: 0%". On a credit
  // product that pill reads as a claim about the consumer's FILE, and nothing
  // in the roll-up was reading the file at all.
  //
  // Truth source is S3's condition model, the same one the Strategy Desk and
  // the Deferred Queue use — never the disputability band. Note the asymmetry
  // S3 established and this honours: DEROGATORY is a positive finding, while
  // "not derogatory" includes NEEDS_REVIEW ("we could not read it"), so the
  // green branch reports what was READ and never asserts the file is clean.
  const unresolvedDerogatory = tradelines.filter((t) => !t.resolved && factualCondition(t) === "DEROGATORY").length;
  const loggedResponses = letters.filter((l) => l.responseAt && l.responseOutcome);
  const favourableResponses = loggedResponses.filter((l) => l.responseOutcome === "deleted").length;
  const nothingChanged = loggedResponses.length > 0 && favourableResponses === 0;
  const verifiedNote = nothingChanged
    ? ` None of the ${loggedResponses.length} logged response${loggedResponses.length === 1 ? "" : "s"} changed one.`
    : "";
  if (unresolvedDerogatory > 0) {
    health.push({
      key: "file", label: "Report health", status: "amber",
      message: `${unresolvedDerogatory} account${unresolvedDerogatory === 1 ? "" : "s"} on your report still show${unresolvedDerogatory === 1 ? "s" : ""} a derogatory status.${verifiedNote}`,
    });
  } else if (nothingChanged) {
    health.push({
      key: "file", label: "Report health", status: "amber",
      message: `${loggedResponses.length} response${loggedResponses.length === 1 ? " has" : "s have"} been logged and none of them changed what's reported.`,
    });
  } else {
    health.push({
      key: "file", label: "Report health", status: "green",
      message: hasTradelines
        ? "No unresolved derogatory account was read from your report."
        : caseOnFile ? "No accounts have been read from your report yet." : "Nothing on file yet.",
    });
  }

  // ---- Draft health: what the SERVER will refuse (S11 NEW-3) ----
  // Same class as report health above: the roll-up must not summarise as
  // "no action needed" an account whose only pending work the product itself
  // has blocked.
  if (blockedLetters.length > 0) {
    const n = blockedLetters.length;
    health.push({
      key: "authorization", label: "Draft health", status: "amber",
      message: `${n} dispute letter${n === 1 ? " is" : "s are"} on hold — ${n === 1 ? "it states facts" : "they state facts"} in your name with no confirmation standing behind ${n === 1 ? "it" : "them"} right now.`,
    });
  } else {
    health.push({
      key: "authorization", label: "Draft health", status: "green",
      message: letters.some((l) => !l.mailedAt) ? "Every draft on file is confirmed and can move." : "No drafts waiting.",
    });
  }

  const lastEvent = kai.recentEvents[0]?.occurredAt;
  const stale = lastEvent ? (now - new Date(lastEvent).getTime()) / DAY > 30 : false;
  const openDisputes = letters.some((l) => l.mailedAt && !l.responseAt);
  if (stale && openDisputes) health.push({ key: "timeline", label: "Timeline health", status: "amber", message: "No activity in over 30 days while disputes are open — check your windows." });
  else if (reportWithoutTradelines) health.push({ key: "timeline", label: "Timeline health", status: "amber", message: "A report is on file but no accounts were read from it — try that file again or add another report." });
  // AD-4: "nothing has started" is a claim about the CASE, not about a report
  // row — a consumer with letters in flight and no report on file is moving.
  else health.push({ key: "timeline", label: "Timeline health", status: "green", message: caseOnFile ? "Your case is moving." : "Nothing has started yet." });

  const caseHealth: Health = health.some((h) => h.status === "red") ? "red" : health.some((h) => h.status === "amber") ? "amber" : "green";
  // C-05: zero rows is not health. An account with nothing on file has an
  // empty queue, which is not the same claim as a clean, monitored file - and
  // that was the claim the all-green roll-up was making.
  // AD-4 — two independent conditions, either of which alone would have
  // prevented the defect, because this band is the product's loudest single
  // claim and it has now been wrong in BOTH directions:
  //   1. "unstarted" requires that nothing is on file at all — not merely that
  //      a report row is missing.
  //   2. "unstarted" can never outrank a signal. If anything is amber or red
  //      the band reports THAT, so a state nobody anticipated can still only
  //      make the band louder, never quieter.
  // (W3-S7-review L-9 flagged the mirror image — green surviving on an empty
  // account. Condition 2 is what closes the class rather than one direction.)
  const nothingOnFile = !caseOnFile;
  const standing: Standing = nothingOnFile && caseHealth === "green" ? "unstarted" : caseHealth;
  health.push({
    key: "case",
    label: "Case health",
    status: caseHealth,
    message: standing === "unstarted"
      ? "Nothing has started yet — upload a report to begin."
      : caseHealth === "green" ? "Everything's green — no action needed."
        : caseHealth === "amber" ? "A couple of things want your attention."
          : "Something's overdue — see the flags above.",
  });

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
  return { firstName, caseMemory, overnight: kai.overnight, tasks, waiting, automatic, nextAction, nextUnlock, command, capacity, deferred, health, caseHealth, standing, hasReport, caseOnFile, reportWithoutTradelines, ownHistory };
}

// The loader — pulls the real rows and hands them to the pure assembler.
export async function getMissionControl(userId: string, user: { fullName?: string | null; name?: string | null }): Promise<MissionControlData> {
  const svc = campaignService();
  const [kai, caseMemory, campaigns, items, tradelines, letters, scoreEntries, ownTrack, nextSeq, reportCount] = await Promise.all([
    getKaiHomeData(userId),
    caseMemorySince(userId),
    svc.list(userId, 50),
    buildComposerItems(userId),
    prisma.tradeline.findMany({ where: { userId }, select: { id: true, resolved: true, accountType: true, dateOfFirstDelinquency: true, bureauData: true } }),
    prisma.letter.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true, tradelineId: true, recipientName: true, parentLetterId: true, responseAt: true, responseOutcome: true, mailedAt: true, strategy: true } }),
    prisma.scoreEntry.findMany({ where: { userId }, select: { bureau: true, score: true, recordedAt: true }, orderBy: { recordedAt: "asc" } }),
    ownOutcomeTrack(userId),
    svc.nextSequence(userId),
    // The same row set lib/kaiHome.ts counts, counted the same way - the whole
    // point of A1-04's unification is that neither engine gets its own idea of
    // whether a report exists.
    prisma.report.count({ where: { userId } }),
  ]);

  // S11 NEW-3 — one grouped count for the whole render, mirroring
  // app/api/letters/route.ts. Mailed letters are excluded: HISTORICAL is
  // terminal and a record is never re-judged.
  const unmailedTradelineIds = Array.from(
    new Set(letters.filter((l) => !l.mailedAt && l.tradelineId).map((l) => l.tradelineId as string))
  );
  const activeAssertionCounts: Record<string, number> = {};
  if (unmailedTradelineIds.length) {
    const grouped = await prisma.consumerAssertion.groupBy({
      by: ["tradelineId"],
      where: { userId, status: "ACTIVE", tradelineId: { in: unmailedTradelineIds } },
      _count: { _all: true },
    });
    for (const g of grouped) if (g.tradelineId) activeAssertionCounts[g.tradelineId] = g._count._all;
  }
  const composed = svc.compose(items, nextSeq);
  return assembleMission({
    user, kai, caseMemory, campaigns, composed, tradelines,
    letters, scoreEntries, ownTrack, nextSeq, reportCount, activeAssertionCounts, policy: resolveCampaignPolicy(),
  });
}
