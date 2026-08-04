// Kai Campaign Intelligence — public module surface (Sprint XII, ADR-0012).
// Routes, the mail gate, and UI import from "@/lib/campaign" and nothing deeper.
// Deterministic + provider-free; built inside CreditVector, kept cleanly
// extractable under the Rule of Two (seams only — nothing extracted yet).
export {
  type Campaign, type CampaignStatus, type CampaignItem, type CampaignWarning,
  type WarningCategory, type CampaignSnapshot, type CampaignAudit, type StrategyFamily,
  type ItemDecision,
  FAMILY_LABEL, WARNING_CATEGORY_LABEL,
  canCampaignTransition, isCampaignTerminal, strategyFamily,
  includedItems, deferredItems, excludedItems, packagePages, recipientKeys,
  expandIncludedToSnapshot, snapshotCovers,
  CAMPAIGN_PLANNED_STATUSES, plannedItemKeys,
} from "./CampaignModel";

export {
  type CampaignPolicy, type SizeVerdict, type SizeAssessment,
  DEFAULT_CAMPAIGN_POLICY, resolveCampaignPolicy, assessCampaignSize,
} from "./CampaignPolicy";

export {
  type ComposerItem, type ComposedCampaign, type StrategyReview,
  composeCampaign, reviewSelection, perRecipientCounts,
} from "./CampaignComposer";

export {
  type CampaignStore, InMemoryCampaignStore, PrismaCampaignStore, CampaignStoreError,
} from "./CampaignStore";

export {
  CampaignService, CampaignError,
  type CampaignServiceDeps, type CampaignEventSink, type LetterTarget,
} from "./CampaignService";
