// MailService — the single orchestration surface for CreditVector Mail. Business
// logic, routes, and Kai call ONLY this; never a provider directly. It enforces
// the two invariants that make mailing trustworthy:
//
//   1. Kai never sends mail. Kai recommends; a USER approves; only then can the
//      service execute. `dispatch` refuses to run unless the piece is PAID,
//      which is only reachable through a user APPROVED transition.
//   2. The manifest is immutable + the audit trail append-only. Every step is a
//      guarded state-machine transition that records who did what, when.
//
// Provider is resolved from config (one env var). Store/clock/event-sink are
// injectable so the whole service is unit-testable with no DB and no network.
import { getMailProvider } from "./providers";
import type { MailProvider, MailProviderId, MailAddress, MailPieceSpec, PdfSource } from "./MailProvider";
import { MailProviderError } from "./MailProvider";
import { PrismaMailStore, type MailStore } from "./MailStore";
import { createManifest, type MailManifest, type MailIdentity } from "./MailManifest";
import { applyTransition, type MailKaiEvent } from "./MailJob";
import { computePrice, type PlanTier, type Coupon, type PriceBreakdown, type PricingPolicy } from "./MailPricing";
import { normalizeTracking, type NormalizedTracking } from "./MailTracking";
import { buildReceipt, type MailReceipt } from "./MailReceipt";
import { pipelineIndex, canTransition, nextStatuses, type MailStatus } from "./MailStatus";
import { recordKaiEvent } from "@/lib/kaiEvents";

export type EventSink = (e: MailKaiEvent) => Promise<void>;

// Default sink → the existing fail-open KaiEvent stream (ADR-0007). A failed
// event write never blocks a mail transition.
const defaultSink: EventSink = async (e) => {
  await recordKaiEvent(e.userId, e.type, { refType: e.refType, refId: e.refId, payload: e.payload });
};

export interface MailServiceDeps {
  provider?: MailProvider;
  store?: MailStore;
  now?: () => string;        // ISO clock (injectable for deterministic tests)
  sink?: EventSink;
}

export interface EstimateInput {
  spec: MailPieceSpec;
  plan: PlanTier;
  isAgency: boolean;
  coupon?: Coupon;
  policy?: PricingPolicy;
}

export interface InitiateInput {
  mailId: string;
  letterId: string;
  userId: string;
  disputeId?: string | null;
  tradelineId?: string | null;
  recipient: MailAddress;
  spec: MailPieceSpec;
  cost: PriceBreakdown;      // the price the user is agreeing to (from estimate)
  contentHash?: string;      // SHA-256 of the exact letter approved — proof of intent
}

export class MailApprovalError extends Error {
  constructor(message: string) { super(message); this.name = "MailApprovalError"; }
}
export class MailTransitionError extends Error {
  constructor(message: string) { super(message); this.name = "MailTransitionError"; }
}

export class MailService {
  private readonly provider: MailProvider;
  private readonly store: MailStore;
  private readonly now: () => string;
  private readonly sink: EventSink;

  constructor(deps: MailServiceDeps = {}) {
    this.provider = deps.provider ?? getMailProvider();
    this.store = deps.store ?? new PrismaMailStore();
    this.now = deps.now ?? (() => new Date().toISOString());
    this.sink = deps.sink ?? defaultSink;
  }

  get providerId(): MailProviderId { return this.provider.id; }

  // ---- read-only helpers (safe for Kai to call while recommending) ----------
  async estimate(input: EstimateInput): Promise<{ providerCostCents: number; price: PriceBreakdown }> {
    const estimate = await this.provider.estimateCost(input.spec);
    // Certified/class/pages are already in the provider's cost; pricing only
    // layers platform fee, markup, discounts, coupon on top.
    const price = computePrice({
      estimate, plan: input.plan, isAgency: input.isAgency, coupon: input.coupon, policy: input.policy,
    });
    return { providerCostCents: estimate.providerCostCents, price };
  }

  validateAddress(a: MailAddress) { return this.provider.validateAddress(a); }
  healthCheck() { return this.provider.healthCheck(); }
  getManifest(mailId: string) { return this.store.get(mailId); }
  async getReceipt(mailId: string): Promise<MailReceipt | null> {
    const m = await this.store.get(mailId);
    return m ? buildReceipt(m) : null;
  }

  // ---- lifecycle (mutations) ------------------------------------------------
  // Create the record and present it for the user's review. Starts at GENERATED
  // then moves to IN_REVIEW — Kai has recommended; the ball is with the user.
  async initiate(input: InitiateInput): Promise<MailManifest> {
    const at = this.now();
    const identity: MailIdentity = {
      mailId: input.mailId, provider: this.provider.id, letterId: input.letterId,
      userId: input.userId, disputeId: input.disputeId ?? null, tradelineId: input.tradelineId ?? null,
      recipient: input.recipient,
      // Persist the exact spec the price was computed from — dispatch reuses it.
      mailClass: input.spec.mailClass, certified: input.spec.certified,
      pages: input.spec.pages, color: input.spec.color, doubleSided: input.spec.doubleSided,
      cost: input.cost, createdAt: at,
    };
    const manifest = createManifest(identity, "GENERATED", at);
    await this.store.create(manifest);
    return this.transition(manifest, {
      to: "IN_REVIEW", actor: "kai", event: "kai.recommended",
      detail: input.contentHash
        ? `Kai recommends mailing; awaiting the user's approval. Letter content hash: ${input.contentHash}`
        : "Kai recommends mailing; awaiting the user's approval.",
    });
  }

  // The ONLY approval path. A user — never Kai, never the system — approves.
  async approve(mailId: string, opts: { detail?: string } = {}): Promise<MailManifest> {
    const m = await this.require(mailId);
    return this.transition(m, {
      to: "APPROVED", actor: "user", event: "user.approved",
      detail: opts.detail ?? "User approved mailing.",
    });
  }

  async markPaid(mailId: string, paymentRef: string): Promise<MailManifest> {
    const m = await this.require(mailId);
    if (m.status !== "APPROVED") throw new MailApprovalError(`cannot take payment before approval (status ${m.status})`);
    return this.transition(m, { to: "PAID", actor: "system", event: "payment.captured", detail: paymentRef });
  }

  // Queue the paid piece for the provider — the LAST step before live dispatch.
  // Reaches QUEUED and STOPS. No provider is contacted and no provider state is
  // ever fabricated here: everything past QUEUED (PDF_GENERATED, PROVIDER_ACCEPTED,
  // …) waits for live integration (dispatch(), gated by MAIL_LIVE). This is how a
  // customer completes the workflow today without a single real letter moving.
  async queueForProvider(mailId: string): Promise<MailManifest> {
    const m = await this.require(mailId);
    if (m.status !== "PAID") throw new MailApprovalError(`cannot queue before payment (status ${m.status})`);
    return this.transition(m, {
      to: "QUEUED", actor: "system", event: "queued",
      detail: "Queued for the mail provider — awaiting live mail integration.",
    });
  }

  // Execute: dispatch the paid piece to the provider. HARD GATE — refuses unless
  // the piece is PAID (which requires a prior user approval). This is where "only
  // after approval can MailService execute" is enforced.
  async dispatch(mailId: string, pdf: PdfSource, from: MailAddress): Promise<MailManifest> {
    let m = await this.require(mailId);
    if (m.status !== "PAID") {
      throw new MailApprovalError(`refusing to send: piece is ${m.status}, not PAID (approval + payment required first)`);
    }
    m = await this.transition(m, { to: "QUEUED", actor: "system", event: "queued" });
    m = await this.transition(m, { to: "PDF_GENERATED", actor: "system", event: "pdf.generated" });

    // Dispatch the piece EXACTLY as priced and paid — the spec is read from the
    // immutable manifest, never fabricated. A provider failure fails the piece
    // closed (auditable FAILED) instead of stranding it at PDF_GENERATED.
    let result;
    try {
      result = await this.provider.createMailJob({
        mailId: m.mailId, pdf, to: m.recipient, from,
        spec: {
          pages: m.pages, color: m.color, doubleSided: m.doubleSided,
          mailClass: m.mailClass, certified: m.certified,
        },
      });
    } catch (e) {
      await this.transition(m, {
        to: "FAILED", actor: "system", event: "provider.error",
        detail: e instanceof Error ? e.message : "provider rejected the job",
      });
      throw e;
    }
    return this.transition(m, {
      to: "PROVIDER_ACCEPTED", actor: "provider", event: "provider.accepted",
      detail: `Accepted by ${this.provider.name}`,
      providerJobId: result.providerJobId, trackingNumber: result.trackingNumber,
    });
  }

  // Pull the provider's tracking, normalize, and advance the manifest to the
  // furthest new milestone. Only ever moves forward along the pipeline.
  async syncTracking(mailId: string): Promise<{ manifest: MailManifest; tracking: NormalizedTracking }> {
    let m = await this.require(mailId);
    if (!m.providerJobId) throw new MailTransitionError("no provider job to track yet");
    const info = await this.provider.retrieveTracking(m.providerJobId);
    const tracking = normalizeTracking(info);
    // Walk the state machine one legal step at a time up to the reported status —
    // the machine's guards (and the immutable audit) stay intact; we never jump.
    const target = tracking.currentStatus;
    if (target === "RETURNED" && canTransition(m.status, "RETURNED")) {
      m = await this.transition(m, {
        to: "RETURNED", actor: "provider", event: "tracking.update",
        detail: "Provider reports RETURNED", trackingNumber: tracking.trackingNumber ?? undefined,
      });
    } else {
      let guard = 0;
      while (pipelineIndex(m.status) < pipelineIndex(target) && guard++ < 20) {
        const step = nextStatuses(m.status)
          .filter((s) => pipelineIndex(s) > pipelineIndex(m.status) && pipelineIndex(s) <= pipelineIndex(target))
          .sort((a, b) => pipelineIndex(a) - pipelineIndex(b))[0];
        if (!step) break;
        m = await this.transition(m, {
          to: step, actor: "provider", event: "tracking.update",
          detail: `Provider reports ${target}`, trackingNumber: tracking.trackingNumber ?? undefined,
        });
      }
    }
    return { manifest: m, tracking };
  }

  async cancel(mailId: string, reason: string): Promise<MailManifest> {
    const m = await this.require(mailId);
    // Check cancelability BEFORE calling the provider — never ask a provider to
    // cancel a piece the state machine won't let us cancel (e.g. already printed).
    if (!canTransition(m.status, "CANCELED")) {
      throw new MailTransitionError(`cannot cancel a ${m.status} piece`);
    }
    if (m.providerJobId) {
      try { await this.provider.cancelMailJob(m.providerJobId); }
      catch (e) {
        if (e instanceof MailProviderError && e.code === "rejected") {
          throw new MailTransitionError("provider refused cancellation (already in the mail stream)");
        }
        throw e;
      }
    }
    return this.transition(m, { to: "CANCELED", actor: "user", event: "canceled", detail: reason });
  }

  async logResponse(mailId: string, detail: string): Promise<MailManifest> {
    const m = await this.require(mailId);
    return this.transition(m, { to: "RESPONSE_RECEIVED", actor: "user", event: "response.logged", detail });
  }

  async close(mailId: string): Promise<MailManifest> {
    const m = await this.require(mailId);
    return this.transition(m, { to: "CLOSED", actor: "system", event: "closed" });
  }

  // ---- internals ------------------------------------------------------------
  private async require(mailId: string): Promise<MailManifest> {
    const m = await this.store.get(mailId);
    if (!m) throw new MailTransitionError(`mail ${mailId} not found`);
    return m;
  }

  private async transition(
    m: MailManifest,
    t: { to: MailStatus; actor: "system" | "user" | "provider" | "kai"; event: string; detail?: string; providerJobId?: string; trackingNumber?: string },
  ): Promise<MailManifest> {
    const res = applyTransition(m, { ...t, at: this.now() });
    if (!res.ok) throw new MailTransitionError(res.error);
    await this.store.saveProgress(res.manifest);
    try { await this.sink(res.kaiEvent); } catch { /* event sink is fail-open */ }
    return res.manifest;
  }
}
