// The provider abstraction. EVERY mail provider (LetterStream, Lob, PostGrid,
// Click2Mail, PostalMethods, …) implements exactly this interface. Business
// logic, Kai, and the UI depend ONLY on these types — never on a provider's
// concrete package or status vocabulary. Switching providers is a single config
// value (see providers/index.ts); no caller changes.
import type { MailStatus } from "./MailStatus";

export type MailProviderId =
  | "letterstream" | "lob" | "postgrid" | "click2mail" | "postalmethods";

export type MailClass = "first_class" | "standard";

export interface MailAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string; // ISO-2, defaults US
}

export interface AddressValidationResult {
  valid: boolean;
  normalized?: MailAddress;     // provider's corrected/standardized form
  deliverable?: boolean;        // USPS-deliverable per the provider
  issues: string[];             // human-readable problems (never provider codes)
}

export interface MailPieceSpec {
  pages: number;
  color: boolean;
  doubleSided: boolean;
  mailClass: MailClass;
  certified: boolean;           // certified mail w/ return receipt
}

// Provider's raw cost for one piece, in USD cents. Platform fee / markup /
// discounts are applied later by MailPricing — providers only report THEIR cost.
export interface CostEstimate {
  providerCostCents: number;
  currency: "USD";
  breakdown: { label: string; cents: number }[];
}

export interface CreateJobInput {
  mailId: string;               // CreditVector's own id (idempotency key)
  pdf: PdfSource;               // print-ready document
  to: MailAddress;
  from: MailAddress;
  spec: MailPieceSpec;
  metadata?: Record<string, string>; // opaque provider metadata (ids for reconciliation)
}

// A PDF is passed as raw bytes or an already-hosted URL; providers decide which
// they accept. Bytes never leak to logs.
export type PdfSource =
  | { kind: "bytes"; bytes: Uint8Array }
  | { kind: "url"; url: string };

export interface CreateJobResult {
  providerJobId: string;
  status: ProviderStatus;
  trackingNumber?: string;
  expectedDeliveryDate?: string; // ISO date, if the provider estimates one
}

// A provider's status snapshot, already mapped to the canonical enum. The `raw`
// field preserves the provider's own string for the audit trail, but callers
// branch only on `status`.
export interface ProviderStatus {
  status: MailStatus;
  raw: string;
  detail?: string;
  at?: string; // ISO timestamp the provider reported
}

export interface TrackingInfo {
  trackingNumber?: string;
  carrier?: string;
  status: ProviderStatus;
  milestones: ProviderStatus[]; // ordered provider events, each canonicalized
}

// A retrievable artifact (return receipt, proof of mailing, scanned delivery
// image). URL is a provider-hosted, access-controlled link; never public.
export interface ProofArtifact {
  kind: "proof_of_mailing" | "return_receipt" | "delivery_scan" | "tracking_page";
  url?: string;
  retrievedAt: string;
}

export interface HealthStatus {
  healthy: boolean;
  detail?: string;
  checkedAt: string;
}

// The interface every provider implements. Methods that touch the network are
// async and may throw MailProviderError; MailService is the only caller and
// wraps them with audit + state-machine guards.
export interface MailProvider {
  readonly id: MailProviderId;
  readonly name: string;

  validateAddress(address: MailAddress): Promise<AddressValidationResult>;
  estimateCost(spec: MailPieceSpec): Promise<CostEstimate>;
  createMailJob(input: CreateJobInput): Promise<CreateJobResult>;
  cancelMailJob(providerJobId: string): Promise<{ canceled: boolean; detail?: string }>;
  retrieveStatus(providerJobId: string): Promise<ProviderStatus>;
  retrieveTracking(providerJobId: string): Promise<TrackingInfo>;
  retrieveProof(providerJobId: string): Promise<ProofArtifact[]>;
  healthCheck(): Promise<HealthStatus>;
}

// Errors providers throw. `code` is stable and provider-neutral so MailService
// can branch without knowing which provider raised it.
export type MailProviderErrorCode =
  | "not_implemented"   // stub provider
  | "not_wired"         // implemented but live integration deferred
  | "network"           // transport failure
  | "rejected"          // provider rejected the job/address
  | "not_found"         // unknown provider job id
  | "auth";             // credentials missing/invalid

export class MailProviderError extends Error {
  constructor(
    public readonly code: MailProviderErrorCode,
    public readonly providerId: MailProviderId,
    message: string,
  ) {
    super(message);
    this.name = "MailProviderError";
  }
}
