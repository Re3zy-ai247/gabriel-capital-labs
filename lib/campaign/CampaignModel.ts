// Kai Campaign Intelligence — the campaign record and its state machine (Sprint
// XII, ADR-0012). A CAMPAIGN is a coherent set of dispute items selected for a
// documented reason — the unit of "what to send next, and why". Every mailed
// dispute belongs to a campaign; the composer proposes them, the user approves,
// and a version SNAPSHOT is frozen at approval so what was sent can never drift
// from what was reviewed.
//
// This file is pure (types + helpers + transitions), so it is unit-testable with
// no DB and no network — the same discipline as lib/mail/. Persistence lives in
// CampaignStore; composition in CampaignComposer.
import type { AccountType, Bureau, Probability } from "@prisma/client";
import type { RecipientType } from "@/lib/strategies";

// ---- status machine -------------------------------------------------------
// A campaign moves DRAFT/RECOMMENDED → (NEEDS_REVIEW) → APPROVED → ACTIVE →
// WAITING/RESPONSE_RECEIVED → COMPLETED. SUPERSEDED marks a campaign replaced by
// a re-composed one (e.g. after a new report). CANCELED is a user exit.
export type CampaignStatus =
  | "DRAFT"             // being assembled (custom selection in progress)
  | "RECOMMENDED"       // Kai's proposed campaign, awaiting the user
  | "NEEDS_REVIEW"      // an expanded/over-threshold selection needing a Strategy Review
  | "APPROVED"          // user approved; snapshot frozen; nothing mailed yet
  | "ACTIVE"            // at least one item queued/mailed
  | "WAITING"           // all items are out; awaiting responses
  | "RESPONSE_RECEIVED" // at least one response logged
  | "COMPLETED"         // every item resolved or closed
  | "CANCELED"          // user canceled before completion
  | "SUPERSEDED";       // replaced by a newer campaign

export const CAMPAIGN_TERMINAL: ReadonlySet<CampaignStatus> = new Set<CampaignStatus>([
  "COMPLETED", "CANCELED", "SUPERSEDED",
]);

// Legal forward transitions. NEEDS_REVIEW is reachable from a custom/expanded
// draft; RECOMMENDED is Kai's clean proposal. Both approve into APPROVED.
const FORWARD: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["RECOMMENDED", "NEEDS_REVIEW", "APPROVED", "CANCELED", "SUPERSEDED"],
  RECOMMENDED: ["APPROVED", "NEEDS_REVIEW", "CANCELED", "SUPERSEDED"],
  NEEDS_REVIEW: ["APPROVED", "CANCELED", "SUPERSEDED"],
  APPROVED: ["ACTIVE", "CANCELED", "SUPERSEDED"],
  ACTIVE: ["WAITING", "RESPONSE_RECEIVED", "COMPLETED", "CANCELED", "SUPERSEDED"],
  WAITING: ["RESPONSE_RECEIVED", "COMPLETED", "CANCELED", "SUPERSEDED"],
  RESPONSE_RECEIVED: ["ACTIVE", "WAITING", "COMPLETED", "CANCELED", "SUPERSEDED"],
  COMPLETED: [],
  CANCELED: [],
  SUPERSEDED: [],
};

export function canCampaignTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return FORWARD[from]?.includes(to) ?? false;
}
export function isCampaignTerminal(s: CampaignStatus): boolean {
  return CAMPAIGN_TERMINAL.has(s);
}

// ---- strategy family (coherence axis) -------------------------------------
// The pathway a campaign pursues. Grouping by family is one coherence signal:
// items in one family share a recipient AND a compatible legal procedure.
export type StrategyFamily =
  | "bureau_reinvestigation" // §611/§607b accuracy disputes to the CRAs
  | "obsolescence"           // §605 reporting-window removals (to the CRAs)
  | "furnisher_direct"       // §623 direct disputes / goodwill to the furnisher
  | "collector_validation"   // FDCPA §1692g validation / collector-facing
  | "mixed";                 // a custom set spanning more than one family

export const FAMILY_LABEL: Record<StrategyFamily, string> = {
  bureau_reinvestigation: "Bureau reinvestigation (§611)",
  obsolescence: "Obsolete-item removal (§605)",
  furnisher_direct: "Direct furnisher dispute (§623)",
  collector_validation: "Debt validation (FDCPA §1692g)",
  mixed: "Mixed pathways",
};

// Map a concrete strategy id → its family. Unknown/absent → bureau default.
export function strategyFamily(strategyId: string | null, recipient: RecipientType): StrategyFamily {
  if (strategyId === "fcra_605") return "obsolescence";
  if (recipient === "collector") return "collector_validation";
  if (recipient === "furnisher") return "furnisher_direct";
  return "bureau_reinvestigation";
}

// ---- items ----------------------------------------------------------------
export type ItemDecision = "included" | "deferred" | "excluded";

export interface CampaignItem {
  tradelineId: string;
  creditorName: string;
  recipientType: RecipientType;   // bureau | furnisher | collector
  bureaus: Bureau[];              // for bureau strategies: the CRAs this can go to (empty otherwise)
  strategyId: string | null;
  strategyLabel: string;
  decision: ItemDecision;
  reason: string;                 // why included / deferred / excluded — deterministic
  pages: number;                  // estimated page count for the package (per piece)
  letterId: string | null;        // linked once a letter is generated
  queued: boolean;                // true once the mail is queued
}

// ---- warnings (categorized — Phase 11) ------------------------------------
// Every warning states WHICH category it belongs to so the user can tell a legal
// requirement from CreditVector's operational policy from Kai's recommendation.
export type WarningCategory = "law" | "policy" | "recommendation";
export const WARNING_CATEGORY_LABEL: Record<WarningCategory, string> = {
  law: "The law",
  policy: "CreditVector policy",
  recommendation: "Kai's recommendation",
};
export interface CampaignWarning {
  category: WarningCategory;
  text: string;
}

// ---- audit + snapshot -----------------------------------------------------
export interface CampaignAudit {
  at: string;                     // ISO
  actor: "kai" | "user" | "system";
  event: string;                  // "composed" | "approved" | "customized" | …
  detail?: string;
}

// The frozen record of exactly what the user approved — items + policy version +
// time. Immutable once set; the mail gate matches queued letters against THIS.
export interface CampaignSnapshot {
  approvedAt: string;
  policyVersion: string;
  strategyFamily: StrategyFamily;
  includedItems: { tradelineId: string; recipientType: RecipientType; bureaus: Bureau[]; strategyId: string | null }[];
}

export interface Campaign {
  id: string;
  userId: string;
  sequence: number;               // per-user campaign number (Campaign 1, 2, …)
  status: CampaignStatus;
  strategyFamily: StrategyFamily;
  items: CampaignItem[];          // included + deferred + excluded, all here
  rationale: string;              // one honest sentence: why these belong together
  warnings: CampaignWarning[];
  nextUnlock: string[];           // what unlocks the next campaign
  userDecision: "recommended" | "customized" | "expanded" | null;
  createdAt: string;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  snapshot: CampaignSnapshot | null; // frozen at approval
  auditTrail: CampaignAudit[];
}

// ---- derived helpers ------------------------------------------------------
export function includedItems(c: Pick<Campaign, "items">): CampaignItem[] {
  return c.items.filter((i) => i.decision === "included");
}
export function deferredItems(c: Pick<Campaign, "items">): CampaignItem[] {
  return c.items.filter((i) => i.decision === "deferred");
}
export function excludedItems(c: Pick<Campaign, "items">): CampaignItem[] {
  return c.items.filter((i) => i.decision === "excluded");
}

// ---- planned-item exclusion (Phase 1A-R RB-6) -----------------------------
// Statuses where the user has actually committed to a plan for these items —
// APPROVED or further along. Deliberately EXCLUDES RECOMMENDED/NEEDS_REVIEW
// (pre-decision; a not-yet-approved proposal must stay fully candidate-
// eligible) and the terminal statuses (COMPLETED/CANCELED/SUPERSEDED release
// their items back to the pool).
export const CAMPAIGN_PLANNED_STATUSES: ReadonlySet<CampaignStatus> = new Set([
  "APPROVED", "ACTIVE", "WAITING", "RESPONSE_RECEIVED",
]);

// The set of "tradelineId:recipientType" keys already covered by a live,
// APPROVED-or-further campaign — items Kai already has a live plan for.
// lib/campaignInput.ts's buildComposerItems consults this to keep a
// freshly-approved item out of the VERY NEXT recommendation's candidate set
// (mirrors lib/kaiHome.ts's disputedIds idiom: one exclusion Set, computed
// once, consulted by every downstream decision — never a second ranking).
//
// Deliberately keyed on `decision === "included"`, not `queued` — `queued`
// only flips true once a letter actually reaches the mail gate
// (CampaignService.markQueued), which can be well after approval. Excluding
// only queued items left an approved-but-undrafted item with
// alreadyInFlight=false, so composeCampaign() re-offered it as the very next
// campaign the moment the page reloaded (Founder Experience Gate 1.0 RB-6:
// "Campaign 1 approved" instantly re-recommending the same items as
// "Campaign 2"). This is a strict superset of the old queued-only check:
// `queued` can only ever be true on an `included` item of an
// APPROVED-or-further campaign (see CampaignService.markQueued — it never
// sets queued on anything else), so nothing previously excluded becomes
// newly includable; this only catches MORE true in-flight items, never fewer.
export function plannedItemKeys(campaigns: Pick<Campaign, "status" | "items">[]): Set<string> {
  const keys = new Set<string>();
  for (const c of campaigns) {
    if (!CAMPAIGN_PLANNED_STATUSES.has(c.status)) continue;
    for (const it of includedItems(c)) keys.add(`${it.tradelineId}:${it.recipientType}`);
  }
  return keys;
}

// Total estimated document/page count for the INCLUDED package (Phase 4/5 —
// package burden is a real campaign-size input).
export function packagePages(c: Pick<Campaign, "items">): number {
  return includedItems(c).reduce((sum, i) => sum + Math.max(1, i.pages || 1), 0);
}

// Distinct recipients in the included set (bureau counted per-CRA), for the
// per-recipient policy check and the "how many recipients" honest UI line.
export function recipientKeys(c: Pick<Campaign, "items">): string[] {
  const keys = new Set<string>();
  for (const i of includedItems(c)) {
    if (i.recipientType === "bureau") {
      for (const b of i.bureaus.length ? i.bureaus : (["EQUIFAX"] as Bureau[])) keys.add(`bureau:${b}`);
    } else {
      keys.add(`${i.recipientType}:${i.creditorName}`);
    }
  }
  return [...keys];
}

// Expand the included items into the per-target snapshot entries the mail gate
// matches against — one entry per tradeline-recipient, carrying every CRA a
// bureau dispute may go to (so any per-bureau letter the user later mails is
// covered). Called once, at approval, to freeze the snapshot.
export function expandIncludedToSnapshot(items: CampaignItem[]): CampaignSnapshot["includedItems"] {
  return includedItems({ items }).map((i) => ({
    tradelineId: i.tradelineId,
    recipientType: i.recipientType,
    bureaus: i.recipientType === "bureau" ? i.bureaus : [],
    strategyId: i.strategyId,
  }));
}

// Does a frozen campaign cover this letter's target? The mail gate uses this to
// decide whether a queue belongs to the approved campaign. Matched on the stable
// identity a letter carries: tradeline + recipient type + (for bureaus) the CRA.
export function snapshotCovers(
  snap: CampaignSnapshot | null,
  target: { tradelineId: string | null; recipientType: RecipientType; bureau: Bureau | null },
): boolean {
  if (!snap || !target.tradelineId) return false;
  return snap.includedItems.some((i) =>
    i.tradelineId === target.tradelineId &&
    i.recipientType === target.recipientType &&
    // For a bureau dispute: match the specific CRA. When the snapshot couldn't
    // enumerate the CRAs (sparse bureauData → empty bureaus[]), the tradeline
    // identity is enough — cover any CRA letter for it rather than fail to match.
    (target.recipientType !== "bureau" || i.bureaus.length === 0 || i.bureaus.includes(target.bureau as Bureau)));
}

// Append an audit entry immutably (returns a new array).
export function appendCampaignAudit(trail: CampaignAudit[], entry: CampaignAudit): CampaignAudit[] {
  return [...trail, entry];
}
