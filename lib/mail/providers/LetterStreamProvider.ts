// LetterStream — CreditVector Mail Provider #1.
//
// The ABSTRACTION is complete; live API integration is intentionally deferred
// (founder directive: "Do NOT begin live API integration until the abstraction
// is complete"). This provider therefore runs in one of two modes:
//   • dry-run (default, MAIL_LIVE!=="true"): pure, deterministic results — real
//     address checks, real cost math from LetterStream's rate card, real status
//     mapping — and NO network I/O. This lets the whole pipeline be exercised.
//   • live (MAIL_LIVE==="true"): the network calls are not wired yet, so they
//     throw MailProviderError("not_wired") rather than silently doing nothing.
//
// All LetterStream-specific vocabulary (status strings, rate card) is contained
// HERE — nothing provider-specific escapes this file.
import {
  MailProviderError,
  type MailProvider, type MailAddress, type AddressValidationResult,
  type MailPieceSpec, type CostEstimate, type CreateJobInput, type CreateJobResult,
  type ProviderStatus, type TrackingInfo, type ProofArtifact, type HealthStatus,
} from "../MailProvider";
import type { MailStatus } from "../MailStatus";

// Read per-call (not a module constant) so the live gate reflects the current
// environment — and stays honest under tests that toggle it.
function isLive(): boolean {
  return process.env.MAIL_LIVE === "true";
}

// LetterStream's status vocabulary → canonical MailStatus. This map is the ONLY
// place LetterStream strings are interpreted.
const LS_STATUS: Record<string, MailStatus> = {
  received: "PROVIDER_ACCEPTED",
  queued: "PROVIDER_ACCEPTED",
  printed: "PRINTED",
  mailed: "CARRIER_ACCEPTED",
  "in-transit": "IN_TRANSIT",
  in_transit: "IN_TRANSIT",
  delivered: "DELIVERED",
  returned: "RETURNED",
  canceled: "CANCELED",
  cancelled: "CANCELED",
  error: "FAILED",
};

export function mapLetterStreamStatus(raw: string): MailStatus {
  return LS_STATUS[raw.trim().toLowerCase()] ?? "PROVIDER_ACCEPTED";
}

// LetterStream rate card (USD cents). Kept here as provider data; the platform's
// fee/markup/discounts live in MailPricing, never here.
const RATE = {
  base: 92,            // 1 page, B/W, first-class
  perExtraPage: 12,
  colorPerPage: 15,
  doubleSidedDiscountPerSheet: 4,
  certified: 495,      // certified w/ return receipt surcharge
  standardClassDelta: -20,
};

export class LetterStreamProvider implements MailProvider {
  readonly id = "letterstream" as const;
  readonly name = "LetterStream";

  async validateAddress(address: MailAddress): Promise<AddressValidationResult> {
    // Structural validation runs in every mode (no network needed). Live mode
    // would additionally hit LetterStream's CASS endpoint — deferred.
    const issues: string[] = [];
    if (!address.line1?.trim()) issues.push("Street address is required.");
    if (!address.city?.trim()) issues.push("City is required.");
    if (!/^[A-Za-z]{2}$/.test(address.state ?? "")) issues.push("State must be a 2-letter code.");
    if (!/^\d{5}(-\d{4})?$/.test(address.zip ?? "")) issues.push("ZIP must be 5 or 9 digits.");
    if (isLive() && issues.length === 0) {
      throw new MailProviderError("not_wired", this.id, "LetterStream CASS validation not yet wired.");
    }
    return {
      valid: issues.length === 0,
      deliverable: issues.length === 0 ? true : undefined,
      normalized: issues.length === 0 ? { ...address, country: address.country ?? "US" } : undefined,
      issues,
    };
  }

  async estimateCost(spec: MailPieceSpec): Promise<CostEstimate> {
    const breakdown: { label: string; cents: number }[] = [];
    let cents = RATE.base;
    breakdown.push({ label: "Base (1 page, first-class)", cents: RATE.base });
    const extraPages = Math.max(0, spec.pages - 1);
    if (extraPages) {
      const c = extraPages * RATE.perExtraPage;
      cents += c; breakdown.push({ label: `${extraPages} extra page(s)`, cents: c });
    }
    if (spec.color) {
      const c = spec.pages * RATE.colorPerPage;
      cents += c; breakdown.push({ label: "Color", cents: c });
    }
    if (spec.doubleSided) {
      const sheets = Math.ceil(spec.pages / 2);
      const c = -sheets * RATE.doubleSidedDiscountPerSheet;
      cents += c; breakdown.push({ label: "Double-sided", cents: c });
    }
    if (spec.mailClass === "standard") {
      cents += RATE.standardClassDelta;
      breakdown.push({ label: "Standard class", cents: RATE.standardClassDelta });
    }
    if (spec.certified) {
      cents += RATE.certified; breakdown.push({ label: "Certified + return receipt", cents: RATE.certified });
    }
    return { providerCostCents: Math.max(0, cents), currency: "USD", breakdown };
  }

  async createMailJob(input: CreateJobInput): Promise<CreateJobResult> {
    if (isLive()) throw new MailProviderError("not_wired", this.id, "LetterStream job creation not yet wired.");
    // Dry-run: deterministic provider job id derived from our idempotency key, so
    // the pipeline + manifest + audit can be exercised end-to-end without I/O.
    return {
      providerJobId: `ls_dry_${input.mailId}`,
      status: { status: "PROVIDER_ACCEPTED", raw: "received", at: undefined },
      trackingNumber: input.spec.certified ? `9407${input.mailId.replace(/\D/g, "").slice(0, 18)}` : undefined,
    };
  }

  async cancelMailJob(providerJobId: string): Promise<{ canceled: boolean; detail?: string }> {
    if (isLive()) throw new MailProviderError("not_wired", this.id, "LetterStream cancel not yet wired.");
    return { canceled: true, detail: `dry-run cancel ${providerJobId}` };
  }

  async retrieveStatus(providerJobId: string): Promise<ProviderStatus> {
    if (isLive()) throw new MailProviderError("not_wired", this.id, "LetterStream status not yet wired.");
    return { status: "PROVIDER_ACCEPTED", raw: "received", detail: `dry-run ${providerJobId}` };
  }

  async retrieveTracking(providerJobId: string): Promise<TrackingInfo> {
    if (isLive()) throw new MailProviderError("not_wired", this.id, "LetterStream tracking not yet wired.");
    return {
      status: { status: "PROVIDER_ACCEPTED", raw: "received" },
      milestones: [{ status: "PROVIDER_ACCEPTED", raw: "received", detail: `dry-run ${providerJobId}` }],
    };
  }

  async retrieveProof(providerJobId: string): Promise<ProofArtifact[]> {
    if (isLive()) throw new MailProviderError("not_wired", this.id, "LetterStream proof not yet wired.");
    return [{ kind: "tracking_page", retrievedAt: "", url: undefined }];
  }

  async healthCheck(): Promise<HealthStatus> {
    // Dry-run reports healthy-but-not-live so ops can see the provider is loaded
    // and the integration is pending, without a false "connected" signal.
    return { healthy: !isLive(), detail: isLive() ? "live integration not wired" : "dry-run mode", checkedAt: "" };
  }
}
