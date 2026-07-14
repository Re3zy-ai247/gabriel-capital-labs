// CampaignService — the single orchestration surface for Kai Campaign
// Intelligence (Sprint XII, ADR-0012). Business logic, routes, and the mail gate
// call ONLY this. It composes campaigns from the case, persists the user's
// decision, freezes an immutable snapshot at approval, and answers the one
// question the mail queue asks: "does this letter belong to an approved campaign?"
//
// Store / clock / event-sink are injectable so the whole thing is unit-testable
// with no DB and no network — the same discipline as MailService.
import type { Bureau } from "@prisma/client";
import type { RecipientType } from "@/lib/strategies";
import {
  type Campaign, type CampaignStatus, type CampaignAudit, type CampaignSnapshot,
  canCampaignTransition, appendCampaignAudit, includedItems, expandIncludedToSnapshot, snapshotCovers,
} from "./CampaignModel";
import {
  composeCampaign, reviewSelection, type ComposerItem, type ComposedCampaign, type StrategyReview,
} from "./CampaignComposer";
import { resolveCampaignPolicy, type CampaignPolicy } from "./CampaignPolicy";
import { PrismaCampaignStore, type CampaignStore } from "./CampaignStore";

export type CampaignEventSink = (e: {
  userId: string; type: string; campaignId: string; sequence: number; detail?: string;
}) => Promise<void>;

export interface CampaignServiceDeps {
  store?: CampaignStore;
  now?: () => string;
  sink?: CampaignEventSink;
  policy?: CampaignPolicy;
}

export class CampaignError extends Error {
  constructor(message: string) { super(message); this.name = "CampaignError"; }
}

// A letter's stable dispute target — what the gate matches against a snapshot.
export interface LetterTarget {
  tradelineId: string | null;
  recipientType: RecipientType;
  bureau: Bureau | null;
  creditorName: string;
  strategyId: string | null;
  strategyLabel: string;
  bureaus: Bureau[];      // all CRAs the item is on (for a single-item campaign snapshot)
  pages: number;
}

function id(): string {
  return "cmp_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export class CampaignService {
  private readonly store: CampaignStore;
  private readonly now: () => string;
  private readonly sink: CampaignEventSink;
  private readonly policy: CampaignPolicy;

  constructor(deps: CampaignServiceDeps = {}) {
    this.store = deps.store ?? new PrismaCampaignStore();
    this.now = deps.now ?? (() => new Date().toISOString());
    this.sink = deps.sink ?? (async () => {});
    this.policy = deps.policy ?? resolveCampaignPolicy();
  }

  // ---- read-only composition (safe to call while the user browses) ---------
  compose(items: ComposerItem[], nextSequence: number): ComposedCampaign {
    return composeCampaign(items, { policy: this.policy, nextSequence });
  }
  review(selected: ComposerItem[], nextSequence: number): StrategyReview {
    return reviewSelection(selected, { policy: this.policy, nextSequence });
  }
  get(campaignId: string, userId: string) { return this.owned(campaignId, userId); }
  list(userId: string, limit?: number) { return this.store.listByUser(userId, limit); }
  nextSequence(userId: string) { return this.store.nextSequence(userId); }

  // ---- persist a composed campaign as the user's working plan ---------------
  // status: RECOMMENDED for a clean Kai proposal; NEEDS_REVIEW when the user
  // expanded past the policy (a Strategy Review is required before approval).
  async createFromCompose(
    userId: string,
    composed: ComposedCampaign,
    userDecision: NonNullable<Campaign["userDecision"]>,
    status: Extract<CampaignStatus, "RECOMMENDED" | "NEEDS_REVIEW"> = "RECOMMENDED",
  ): Promise<Campaign> {
    const at = this.now();
    const sequence = await this.store.nextSequence(userId);
    const campaign: Campaign = {
      id: id(), userId, sequence, status,
      strategyFamily: composed.strategyFamily,
      items: composed.items,
      rationale: composed.rationale,
      warnings: composed.warnings,
      nextUnlock: composed.nextUnlock,
      userDecision,
      createdAt: at, approvedAt: null, startedAt: null, completedAt: null, canceledAt: null,
      snapshot: null,
      auditTrail: [{ at, actor: "kai", event: "composed", detail: `Campaign ${sequence} composed (${composed.strategyFamily}); ${includedItems({ items: composed.items }).length} item(s) recommended.` }],
    };
    await this.store.create(campaign);
    await this.emit(campaign, "campaign.recommended", campaign.rationale);
    return campaign;
  }

  // ---- approve → freeze the immutable snapshot ------------------------------
  async approve(campaignId: string, userId: string, opts: { expandedAck?: boolean; rationale?: string } = {}): Promise<Campaign> {
    const c = await this.owned(campaignId, userId);
    if (c.status === "APPROVED" || c.status === "ACTIVE") return c; // idempotent
    if (!canCampaignTransition(c.status, "APPROVED")) {
      throw new CampaignError(`cannot approve a ${c.status} campaign`);
    }
    const included = includedItems(c);
    if (included.length < this.policy.minItems) {
      throw new CampaignError("a campaign needs at least one included item to approve");
    }
    // An expanded campaign (came in as NEEDS_REVIEW) requires an explicit
    // acknowledgment recorded in the audit — never a silent approval.
    if (c.status === "NEEDS_REVIEW" && !opts.expandedAck) {
      throw new CampaignError("this expanded campaign needs an explicit acknowledgment before it can be approved");
    }
    const at = this.now();
    const snapshot: CampaignSnapshot = {
      approvedAt: at,
      policyVersion: this.policy.version,
      strategyFamily: c.strategyFamily,
      includedItems: expandIncludedToSnapshot(c.items),
    };
    const audit: CampaignAudit = {
      at, actor: "user",
      event: c.status === "NEEDS_REVIEW" ? "approved.expanded" : "approved",
      detail: c.status === "NEEDS_REVIEW"
        ? `User acknowledged the Strategy Review and approved an expanded campaign of ${included.length} items.${opts.rationale ? ` Rationale: ${opts.rationale}` : ""}`
        : `User approved the recommended campaign of ${included.length} items.`,
    };
    const next: Campaign = {
      ...c,
      status: "APPROVED",
      approvedAt: at,
      userDecision: c.status === "NEEDS_REVIEW" ? "expanded" : c.userDecision,
      snapshot,
      auditTrail: appendCampaignAudit(c.auditTrail, audit),
    };
    await this.store.save(next);
    await this.emit(next, "campaign.approved", audit.detail);
    return next;
  }

  async cancel(campaignId: string, userId: string, reason: string): Promise<Campaign> {
    const c = await this.owned(campaignId, userId);
    if (c.status === "CANCELED") return c;
    if (!canCampaignTransition(c.status, "CANCELED")) throw new CampaignError(`cannot cancel a ${c.status} campaign`);
    const at = this.now();
    const next: Campaign = {
      ...c, status: "CANCELED", canceledAt: at,
      auditTrail: appendCampaignAudit(c.auditTrail, { at, actor: "user", event: "canceled", detail: reason }),
    };
    await this.store.save(next);
    await this.emit(next, "campaign.canceled", reason);
    return next;
  }

  // ---- THE MAIL GATE --------------------------------------------------------
  // Answer for the queue step: return the approved campaign this letter belongs
  // to, associating the letter with its item and moving the campaign to ACTIVE.
  // If no approved campaign covers the target, lazily create + approve a
  // single-item campaign (coherent by definition) so a lone dispute is never
  // blocked while the invariant "every mailed dispute belongs to a campaign"
  // still holds. Returns which happened for honest UX/audit.
  async attachLetterForQueue(
    userId: string, letterId: string, target: LetterTarget,
  ): Promise<{ campaign: Campaign; created: boolean }> {
    // Normalize a stable dispute key so EVERY mailable letter is gated — including
    // letters with no tradeline (e.g. a personal-information bureau correction, or
    // a dispute whose tradeline row was later deleted via onDelete:SetNull). Those
    // key on `letter:<id>` so the invariant holds fail-closed rather than skipping.
    const nt: LetterTarget = { ...target, tradelineId: target.tradelineId || `letter:${letterId}` };
    const existing = await this.findCovering(userId, nt);
    if (existing) {
      const updated = await this.markQueued(existing, letterId, nt);
      return { campaign: updated, created: false };
    }
    // No campaign covers it → a single-item campaign for exactly this target.
    const composed = this.singleItemComposed(nt);
    let c = await this.createFromCompose(userId, composed, "recommended", "RECOMMENDED");
    c = await this.approve(c.id, userId);
    const updated = await this.markQueued(c, letterId, nt);
    return { campaign: updated, created: true };
  }

  // Find the user's APPROVED/ACTIVE/WAITING/RESPONSE_RECEIVED campaign whose
  // frozen snapshot covers this target. Scoped to the user only.
  async findCovering(userId: string, target: LetterTarget): Promise<Campaign | null> {
    const all = await this.store.listByUser(userId, 100);
    const live: CampaignStatus[] = ["APPROVED", "ACTIVE", "WAITING", "RESPONSE_RECEIVED"];
    return all.find((c) => live.includes(c.status) && snapshotCovers(c.snapshot, target)) ?? null;
  }

  // Is there an approved campaign covering this target? (read-only pre-check for
  // the UI, so it can route to the Campaign Review instead of the gate creating
  // an implicit single-item campaign when the user has a plan pending.)
  async coveredByApproved(userId: string, target: LetterTarget): Promise<Campaign | null> {
    return this.findCovering(userId, target);
  }

  // ---- internals ------------------------------------------------------------
  private singleItemComposed(t: LetterTarget): ComposedCampaign {
    const item: ComposerItem = {
      tradelineId: t.tradelineId ?? "", creditorName: t.creditorName,
      accountType: "OTHER" as ComposerItem["accountType"], isDebtBuyer: false,
      probability: "MEDIUM", score: 50,
      recipientType: t.recipientType, strategyId: t.strategyId, strategyLabel: t.strategyLabel,
      strategyReason: "You reviewed and approved this single dispute directly.",
      bureaus: t.bureaus, pastWindow: false, monthsToFallOff: null, hasConflicts: false,
      duplicateGroup: null, estimatedPages: t.pages,
      activeInvestigation: false, priorRounds: 0, lastOutcome: null, alreadyInFlight: false,
    };
    const composed = composeCampaign([item], { policy: this.policy });
    // A directly-mailed single item isn't a ranked "strongest grounds" selection —
    // don't inherit the multi-item comparative rationale (FTC substantiation).
    return {
      ...composed,
      rationale: "A single dispute you reviewed and approved directly, kept together as its own campaign for your records.",
      warnings: [],
      nextUnlock: [],
    };
  }

  private async markQueued(c: Campaign, letterId: string, target: LetterTarget): Promise<Campaign> {
    const at = this.now();
    let touched = false;
    const items = c.items.map((i) => {
      if (i.decision === "included" && i.tradelineId === target.tradelineId && i.recipientType === target.recipientType && !i.queued) {
        touched = true;
        return { ...i, letterId, queued: true };
      }
      return i;
    });
    const status: CampaignStatus = canCampaignTransition(c.status, "ACTIVE") ? "ACTIVE" : c.status;
    // Idempotent: if this letter was already queued here and the status doesn't
    // advance, don't append a redundant audit entry or re-write (retry-safe).
    if (!touched && status === c.status) return c;
    const audit: CampaignAudit = { at, actor: "system", event: "letter.queued", detail: `Letter ${letterId} queued under this campaign (${target.creditorName}).` };
    const next: Campaign = {
      ...c, items, status,
      startedAt: c.startedAt ?? at,
      auditTrail: appendCampaignAudit(c.auditTrail, audit),
    };
    await this.store.save(next);
    await this.emit(next, "campaign.active", audit.detail);
    return next;
  }

  private async owned(campaignId: string, userId: string): Promise<Campaign> {
    const c = await this.store.get(campaignId);
    if (!c || c.userId !== userId) throw new CampaignError("campaign not found");
    return c;
  }

  private async emit(c: Campaign, type: string, detail?: string): Promise<void> {
    try { await this.sink({ userId: c.userId, type, campaignId: c.id, sequence: c.sequence, detail }); }
    catch { /* event sink is fail-open — never blocks a campaign transition */ }
  }
}
