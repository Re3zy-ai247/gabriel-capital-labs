// CreditVector Mail — public module surface. Business logic, routes, and Kai
// import from "@/lib/mail" and nothing deeper. Providers are never imported by
// callers; the registry (behind MailService) is the only thing that knows them.
//
// This is a permanent platform capability, built inside CreditVector and kept
// cleanly extractable under the Rule of Two (nothing is extracted to GIOS until
// a committed product #2 needs it — the seams here are the preparation only).
export { MailService, MailApprovalError, MailTransitionError } from "./MailService";
export type { MailServiceDeps, EstimateInput, InitiateInput, EventSink } from "./MailService";

export type {
  MailProvider, MailProviderId, MailClass, MailAddress, MailPieceSpec,
  CostEstimate, CreateJobInput, CreateJobResult, ProviderStatus, TrackingInfo,
  ProofArtifact, HealthStatus, AddressValidationResult, PdfSource,
} from "./MailProvider";
export { MailProviderError } from "./MailProvider";

export type { MailStatus } from "./MailStatus";
export {
  MAIL_PIPELINE, MAIL_STATUS_LABEL, canTransition, nextStatuses, isTerminal, pipelineIndex,
} from "./MailStatus";

export type { MailManifest, MailIdentity, MailProgress } from "./MailManifest";
export type { AuditEntry, AuditActor } from "./MailAudit";
export { summarizeAudit, validateAuditTrail } from "./MailAudit";

export type { PriceBreakdown, PriceInput, PricingPolicy, PlanTier, Coupon } from "./MailPricing";
export { computePrice, DEFAULT_PRICING_POLICY } from "./MailPricing";

export type { MailReceipt } from "./MailReceipt";
export { buildReceipt } from "./MailReceipt";

export type { NormalizedTracking, TrackingMilestone } from "./MailTracking";
export { normalizeTracking } from "./MailTracking";

export type { MailStore } from "./MailStore";
export { InMemoryMailStore, PrismaMailStore } from "./MailStore";

export { getMailProvider, listProviderIds, DEFAULT_PROVIDER, isProviderId } from "./providers";
