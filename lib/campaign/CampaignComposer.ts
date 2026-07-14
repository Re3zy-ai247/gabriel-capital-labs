// Kai Campaign Intelligence — the deterministic composer (Sprint XII, ADR-0012,
// Phase 3). Given the disputable items in a case (each already scored + mapped to
// a recommended strategy by the EXISTING engines) plus the prior-dispute history,
// it organizes them into a focused, evidence-supported campaign and explains every
// include / defer / exclude decision. It also reviews an arbitrary user selection
// (Phase 6). NO AI, NO hidden reasoning — only structured, inspectable rules over
// real data. It decides sequencing, never outcomes.
import type { AccountType, Bureau, Probability } from "@prisma/client";
import type { RecipientType } from "@/lib/strategies";
import {
  strategyFamily, FAMILY_LABEL, type StrategyFamily,
  type CampaignItem, type CampaignWarning,
} from "./CampaignModel";
import {
  assessCampaignSize, type CampaignPolicy, type SizeAssessment, DEFAULT_CAMPAIGN_POLICY,
} from "./CampaignPolicy";

// The normalized planning unit — one disputable tradeline with everything the
// composer needs, all derived upstream from the real engines (recommend/scoring/
// obsolescence/bureauData) + the user's own letter/mail history. Pure input.
export interface ComposerItem {
  tradelineId: string;
  creditorName: string;
  accountType: AccountType;
  isDebtBuyer: boolean;
  probability: Probability;
  score: number;                 // Tradeline.score 0-100 (deterministic tiebreak)
  recipientType: RecipientType;
  strategyId: string | null;     // null = not recommended for dispute
  strategyLabel: string;
  strategyReason: string;        // recommendStrategy's own reason (reused verbatim)
  bureaus: Bureau[];             // CRAs that report it (for bureau strategies)
  pastWindow: boolean;           // §605 window has passed
  monthsToFallOff: number | null;
  hasConflicts: boolean;         // genuine cross-bureau inconsistency
  duplicateGroup: string | null;
  estimatedPages: number;        // per-piece page estimate
  // Prior-dispute history (from the user's own letters/mail):
  activeInvestigation: boolean;  // a mailed, unanswered dispute for this item is open
  priorRounds: number;           // letters already sent for this item
  lastOutcome: string | null;    // last logged response outcome
  alreadyInFlight: boolean;      // already queued/mailed (don't re-send)
}

const PROB_SCORE: Record<Probability, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, NOT_RECOMMENDED: 0 };

// Evidence strength for SEQUENCING (grounds, never outcome). Higher = stronger
// documented basis, so it leads. Deterministic; no clocks, no randomness.
function evidenceScore(i: ComposerItem): number {
  let s = PROB_SCORE[i.probability] * 10;
  if (i.pastWindow) s += 6;         // obsolescence is a clean, factual ground
  if (i.hasConflicts) s += 5;       // cross-bureau inconsistency is a strong lever
  s += Math.max(0, Math.min(100, i.score)) / 100; // fine tiebreak by scoring
  return s;
}

// Environment-portable string order — code points, not the host locale, so the
// same input always yields the same order regardless of where it runs.
function cmpStr(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function byName(a: ComposerItem, b: ComposerItem): number {
  return cmpStr(a.creditorName, b.creditorName) || cmpStr(a.tradelineId, b.tradelineId);
}

// Stable deterministic sort: strongest evidence first, then score, then name.
function rankByEvidence(items: ComposerItem[]): ComposerItem[] {
  return [...items].sort((a, b) =>
    evidenceScore(b) - evidenceScore(a) ||
    b.score - a.score ||
    byName(a, b));
}

function familyOf(i: ComposerItem): StrategyFamily {
  return strategyFamily(i.strategyId, i.recipientType);
}

function toItem(i: ComposerItem, decision: CampaignItem["decision"], reason: string): CampaignItem {
  return {
    tradelineId: i.tradelineId,
    creditorName: i.creditorName,
    recipientType: i.recipientType,
    bureaus: i.recipientType === "bureau" ? i.bureaus : [],
    strategyId: i.strategyId,
    strategyLabel: i.strategyLabel,
    decision,
    reason,
    pages: Math.max(1, i.estimatedPages || 1),
    letterId: null,
    queued: false,
  };
}

// Per-recipient counts for the size policy. Bureau items count once per CRA they
// reach; furnisher/collector items key by recipient name (a proxy for identity).
export function perRecipientCounts(items: ComposerItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const i of items) {
    if (i.recipientType === "bureau") {
      for (const b of i.bureaus.length ? i.bureaus : (["EQUIFAX"] as Bureau[])) {
        counts[`bureau:${b}`] = (counts[`bureau:${b}`] ?? 0) + 1;
      }
    } else {
      counts[`${i.recipientType}:${i.creditorName}`] = (counts[`${i.recipientType}:${i.creditorName}`] ?? 0) + 1;
    }
  }
  return counts;
}

export interface ComposedCampaign {
  strategyFamily: StrategyFamily;
  items: CampaignItem[];         // included + deferred + excluded
  rationale: string;
  warnings: CampaignWarning[];
  nextUnlock: string[];
  hasRecommendation: boolean;    // false when there's nothing new to send now
}

export interface ComposeOptions {
  policy?: CampaignPolicy;
  nextSequence?: number;         // the campaign number this would be (for copy)
  expanded?: boolean;            // user override: include everything selected up to the ceiling
}

// ---- the recommended campaign ---------------------------------------------
export function composeCampaign(all: ComposerItem[], opts: ComposeOptions = {}): ComposedCampaign {
  const policy = opts.policy ?? DEFAULT_CAMPAIGN_POLICY;
  const seq = opts.nextSequence ?? 1;
  const out: CampaignItem[] = [];

  // 1. EXCLUDE — items the engines advise against disputing (set aside honestly).
  //    Sorted deterministically so the rendered order never depends on input order.
  const excluded = all.filter((i) => i.strategyId === null || i.probability === "NOT_RECOMMENDED").sort(byName);
  for (const i of excluded) {
    out.push(toItem(i, "excluded", i.strategyReason || "Set aside — a dispute here is unlikely to help and can cost credibility."));
  }

  // 2. From the disputable rest, DEFER items that shouldn't go out right now
  //    (collected, then pushed in a deterministic order).
  const disputable = all.filter((i) => i.strategyId !== null && i.probability !== "NOT_RECOMMENDED");
  const fresh: ComposerItem[] = [];
  const deferredNow: { item: ComposerItem; reason: string }[] = [];
  for (const i of disputable) {
    if (i.alreadyInFlight) {
      deferredNow.push({ item: i, reason: "Already in a current campaign or mailed — no need to send it again." });
    } else if (i.activeInvestigation) {
      deferredNow.push({ item: i, reason: `A dispute for this item is already open with the ${i.recipientType}. Sending another now can muddy that reinvestigation — it reopens once that round resolves or its window passes.` });
    } else {
      fresh.push(i);
    }
  }
  for (const d of deferredNow.sort((a, b) => byName(a.item, b.item))) {
    out.push(toItem(d.item, "deferred", d.reason));
  }

  // 3. Nothing new to send → an honest empty recommendation (still shows why).
  const ranked = rankByEvidence(fresh);
  if (ranked.length === 0) {
    return {
      strategyFamily: "mixed",
      items: out,
      rationale: "Nothing new to send right now. Here's what's set aside and what's already in motion — the moment an open dispute resolves, the next campaign unlocks.",
      warnings: [],
      nextUnlock: out.some((i) => i.decision === "deferred")
        ? ["Log the responses to your open disputes (or let their windows pass), and Kai will compose the next campaign."]
        : [],
      hasRecommendation: false,
    };
  }

  // 4b. EXPANDED OVERRIDE — the user explicitly chose to send everything they
  //     selected as one campaign (Phase 6 "Continue with expanded campaign"). We
  //     honor it up to the hard technical ceiling (package/review integrity), keep
  //     each decision explained, and never silently drop an item — anything past
  //     the ceiling is deferred with the reason, not lost.
  if (opts.expanded) {
    const included = ranked.slice(0, policy.hardCeiling);
    const overflow = ranked.slice(policy.hardCeiling);
    for (const i of included) out.push(toItem(i, "included", includeReason(i)));
    for (const i of overflow) out.push(toItem(i, "deferred", `Beyond CreditVector's ${policy.hardCeiling}-item campaign ceiling (an operational limit that keeps the package reviewable) — send it in the next campaign.`));
    const fams = new Set(included.map(familyOf));
    const family: StrategyFamily = fams.size === 1 ? [...fams][0] : "mixed";
    const size = assessCampaignSize(included.length, perRecipientCounts(included), policy);
    const warnings: CampaignWarning[] = size.messages.map((text) => ({ category: "policy" as const, text }));
    warnings.push({
      category: "law",
      text: "A consumer reporting agency may decline to investigate a dispute it reasonably determines is frivolous or irrelevant (FCRA §611(a)(3)) — a case-by-case determination about a specific dispute, not a headcount. This is your choice to make; Kai's role is to make sure each item you send has a documented basis.",
    });
    return {
      strategyFamily: family, items: out,
      rationale: `You chose to send these ${included.length} item${included.length === 1 ? "" : "s"} together as one campaign. Each one is listed with its documented basis so you can see exactly what's going out.`,
      warnings,
      nextUnlock: overflow.length ? [`${overflow.length} item(s) are held for the next campaign — the ceiling keeps this package reviewable.`] : [],
      hasRecommendation: included.length > 0,
    };
  }

  // 4. LEAD FAMILY — lead with the pathway of your single strongest item, then
  //    include compatible (same-family) items in evidence order. This keeps the
  //    campaign coherent: one recipient class, one compatible legal procedure.
  const leadFamily = familyOf(ranked[0]);
  const sameFamily = ranked.filter((i) => familyOf(i) === leadFamily);
  const otherFamily = ranked.filter((i) => familyOf(i) !== leadFamily);

  // 5. Fill the campaign from the lead family, respecting the conservative
  //    recommended max, the weak-item cap, and the per-recipient guard.
  const included: ComposerItem[] = [];
  const heldSameFamily: ComposerItem[] = [];
  let weakCount = 0;
  for (const i of sameFamily) {
    const isWeak = i.probability === "LOW";
    const wouldExceedRec = included.length >= policy.recommendedMax;
    const wouldExceedWeak = isWeak && weakCount >= policy.maxWeakPerCampaign;
    if (wouldExceedRec || wouldExceedWeak) { heldSameFamily.push(i); continue; }
    included.push(i);
    if (isWeak) weakCount++;
  }

  for (const i of included) {
    out.push(toItem(i, "included", includeReason(i)));
  }
  for (const i of heldSameFamily) {
    const reason = i.probability === "LOW"
      ? "Thin grounds on their own — worth strengthening with documentation before spending a round. Held for a later campaign."
      : `Strong item, but held for the next campaign so this one stays focused and reviewable.`;
    out.push(toItem(i, "deferred", reason));
  }
  for (const i of otherFamily) {
    out.push(toItem(i, "deferred", `Different pathway — ${FAMILY_LABEL[familyOf(i)]}. Sequenced after the current campaign so each pathway gets a clean, well-supported package.`));
  }

  // 6. Warnings — sizing (policy) only; a clean Kai proposal rarely trips these.
  const size = assessCampaignSize(included.length, perRecipientCounts(included), policy);
  const warnings: CampaignWarning[] = size.messages.map((text) => ({ category: "policy", text }));
  // If the case as a whole is large, explain the sequencing choice (policy, not law).
  const totalDisputable = disputable.length;
  if (totalDisputable > policy.recommendedMax) {
    warnings.unshift({
      category: "policy",
      text: `You have ${totalDisputable} disputable items. Rather than mail them all at once, Kai groups them into focused campaigns — sequenced so each reinvestigation stays clean and reviewable. Your plan permits more; this is about giving each dispute its best footing.`,
    });
  }

  // 7. Next unlock + rationale.
  const deferredFresh = heldSameFamily.length + otherFamily.length;
  const nextUnlock: string[] = [];
  if (deferredFresh > 0) {
    nextUnlock.push(`Mail this campaign, then log the responses (or let the response window pass).`);
    const nextFam = otherFamily.length ? familyOf(otherFamily[0]) : leadFamily;
    nextUnlock.push(`Campaign ${seq + 1} — ${FAMILY_LABEL[nextFam]} — unlocks once Campaign ${seq} is underway and its earliest window resolves.`);
  }

  const recipientNote = leadFamily === "bureau_reinvestigation" || leadFamily === "obsolescence"
    ? "the bureaus that report them"
    : leadFamily === "collector_validation" ? "the collector" : "the furnisher";
  const rationale = `These ${included.length} item${included.length === 1 ? "" : "s"} all pursue ${FAMILY_LABEL[leadFamily]} to ${recipientNote}, and carry the strongest documented grounds in your file right now — a focused, evidence-supported package.`;

  return { strategyFamily: leadFamily, items: out, rationale, warnings, nextUnlock, hasRecommendation: included.length > 0 };
}

function includeReason(i: ComposerItem): string {
  const bits: string[] = [];
  if (i.pastWindow) bits.push("past its §605 reporting window (obsolescence is a clean ground)");
  else if (i.monthsToFallOff != null && i.monthsToFallOff <= 24) bits.push("its §605 window is closing, so accuracy is best challenged now");
  if (i.hasConflicts) bits.push("the bureaus report it inconsistently (a strong lever)");
  if (i.probability === "HIGH") bits.push("multiple deterministic signals line up");
  const why = bits.length ? bits.join("; ") : (i.strategyReason || "a documented basis under the recommended strategy");
  return `Included — ${why}.`;
}

// ---- Strategy Review for a custom / expanded selection (Phase 6) ----------
export interface StrategyReview {
  size: SizeAssessment;
  families: { family: StrategyFamily; label: string; count: number }[];
  recipientCount: number;
  conflicts: string[];               // active investigations / duplicate strategy among the selection
  weakItems: { tradelineId: string; creditorName: string; reason: string }[];
  recommendedSplit: { includeNow: string[]; defer: string[] }; // tradelineIds
  projectedSequence: { family: StrategyFamily; label: string; count: number }[];
  warnings: CampaignWarning[];
  expandedAllowed: true;             // an expanded campaign is ALWAYS available (no silent block)
}

export function reviewSelection(selected: ComposerItem[], opts: ComposeOptions = {}): StrategyReview {
  const policy = opts.policy ?? DEFAULT_CAMPAIGN_POLICY;
  const disputable = selected.filter((i) => i.strategyId !== null && i.probability !== "NOT_RECOMMENDED");

  // Families present in the selection.
  const famMap = new Map<StrategyFamily, number>();
  for (const i of disputable) famMap.set(familyOf(i), (famMap.get(familyOf(i)) ?? 0) + 1);
  const families = [...famMap.entries()].map(([family, count]) => ({ family, label: FAMILY_LABEL[family], count }));

  const recipientCount = Object.keys(perRecipientCounts(disputable)).length;

  // Conflicts: active investigations + repeated (duplicate-group) strategies in one send.
  const conflicts: string[] = [];
  for (const i of disputable) {
    if (i.activeInvestigation) conflicts.push(`${i.creditorName}: a dispute is already open with the ${i.recipientType} — a second one now can muddy that reinvestigation.`);
  }
  const dupGroups = new Map<string, string[]>();
  for (const i of disputable) if (i.duplicateGroup) {
    const arr = dupGroups.get(i.duplicateGroup) ?? [];
    arr.push(i.creditorName); dupGroups.set(i.duplicateGroup, arr);
  }
  for (const [, names] of dupGroups) {
    if (names.length > 1) conflicts.push(`${names.join(" & ")} look like the same debt reported more than once — disputing them together as one story is stronger than as separate, possibly conflicting, letters.`);
  }

  // Weak-evidence items.
  const weakItems = disputable
    .filter((i) => i.probability === "LOW")
    .map((i) => ({ tradelineId: i.tradelineId, creditorName: i.creditorName, reason: "Thin grounds on their own — a targeted document or a stronger angle would help before mailing." }));

  // Recommended split: run the composer on the selection; included = send now.
  const composed = composeCampaign(disputable, { policy, nextSequence: opts.nextSequence });
  const includeNow = composed.items.filter((i) => i.decision === "included").map((i) => i.tradelineId);
  const defer = composed.items.filter((i) => i.decision === "deferred").map((i) => i.tradelineId);

  // Projected sequence: the non-lead families become future campaigns.
  const projectedSequence = families.filter((f) => f.family !== composed.strategyFamily);

  // Warnings: size (policy) + the categorized frivolous-risk CONTEXT (law), stated
  // factually — NOT as a claim that this selection is frivolous.
  const size = assessCampaignSize(disputable.length, perRecipientCounts(disputable), policy);
  const warnings: CampaignWarning[] = size.messages.map((text) => ({ category: "policy" as const, text }));
  if (size.verdict !== "within") {
    warnings.push({
      category: "law",
      text: "A consumer reporting agency may decline to investigate a dispute it reasonably determines is frivolous or irrelevant (FCRA §611(a)(3)) — that's a case-by-case call about a specific dispute, not a headcount. Nothing here treats a larger selection as frivolous by default; a focused, well-documented package is simply easier for everyone to investigate on the merits.",
    });
  }

  return { size, families, recipientCount, conflicts, weakItems, recommendedSplit: { includeNow, defer }, projectedSequence, warnings, expandedAllowed: true };
}
