// Campaign size & safety policy (Sprint XII, ADR-0012, Phase 4).
//
// IMPORTANT — this is CreditVector OPERATIONAL policy, NOT a legal rule. There is
// no universal number that makes a dispute "frivolous or irrelevant"; that is a
// CRA's case-by-case determination under FCRA §611(a)(3). So nothing here — and
// nothing that renders these values — may claim that a count above a threshold is
// frivolous, will be rejected, or is unsafe as a matter of law. These knobs exist
// to keep the mailing package reviewable and the reinvestigation focused, and to
// give the user an honest heads-up. They are configurable + versioned (the version
// is frozen into every campaign snapshot, which is the audit history).
export interface CampaignPolicy {
  version: string;       // stamped into each campaign snapshot = audit trail
  recommendedMax: number; // conservative default: Kai proposes at most this many per campaign
  warnThreshold: number;  // at/above this included count, show a policy heads-up
  hardCeiling: number;    // technical ceiling protecting package/mailing/review integrity
  perRecipientMax: number;// max included items to a single recipient in one campaign
  minItems: number;       // a campaign needs at least this many included items
  // Deferral tuning (Kai recommendation layer, not law):
  maxWeakPerCampaign: number; // beyond this many LOW-grounds items, defer the extras
}

// Conservative defaults. recommendedMax is deliberately small so Kai proposes a
// focused package; the hardCeiling is well above it so a determined user is never
// boxed in at the recommended number — only guardrailed at the integrity limit.
export const DEFAULT_CAMPAIGN_POLICY: CampaignPolicy = {
  version: "cvp-2026-07-14",
  recommendedMax: 5,
  warnThreshold: 6,
  hardCeiling: 12,
  perRecipientMax: 8,
  minItems: 1,
  maxWeakPerCampaign: 2,
};

// Resolve the active policy. Admin-configurable via a JSON env override
// (CAMPAIGN_POLICY) so values can change without a deploy; the version field MUST
// change with any value change so snapshots remain a truthful audit history.
// Invalid/partial config falls back to the default (fail-safe), never throws.
export function resolveCampaignPolicy(): CampaignPolicy {
  const raw = process.env.CAMPAIGN_POLICY;
  if (!raw) return DEFAULT_CAMPAIGN_POLICY;
  try {
    const p = JSON.parse(raw) as Partial<CampaignPolicy>;
    const merged: CampaignPolicy = { ...DEFAULT_CAMPAIGN_POLICY, ...p };
    // Guard the invariants so a bad override can't produce nonsense.
    if (
      !merged.version ||
      merged.minItems < 1 ||
      merged.recommendedMax < merged.minItems ||
      merged.warnThreshold < merged.recommendedMax ||
      merged.hardCeiling < merged.warnThreshold ||
      merged.perRecipientMax < 1
    ) return DEFAULT_CAMPAIGN_POLICY;
    return merged;
  } catch {
    return DEFAULT_CAMPAIGN_POLICY;
  }
}

export type SizeVerdict = "within" | "warn" | "over_ceiling";

export interface SizeAssessment {
  verdict: SizeVerdict;
  includedCount: number;
  overRecipient: { key: string; count: number }[]; // recipients past perRecipientMax
  // Human, category-tagged messages — LABELED as policy, never as law.
  messages: string[];
}

// Assess an included set against the policy. perRecipientCounts maps a recipient
// key → count of included items to that recipient.
export function assessCampaignSize(
  includedCount: number,
  perRecipientCounts: Record<string, number>,
  policy: CampaignPolicy = DEFAULT_CAMPAIGN_POLICY,
): SizeAssessment {
  const overRecipient = Object.entries(perRecipientCounts)
    .filter(([, n]) => n > policy.perRecipientMax)
    .map(([key, count]) => ({ key, count }));

  let verdict: SizeVerdict = "within";
  if (includedCount > policy.hardCeiling) verdict = "over_ceiling";
  else if (includedCount >= policy.warnThreshold || overRecipient.length > 0) verdict = "warn";

  const messages: string[] = [];
  if (verdict === "over_ceiling") {
    messages.push(
      `This selection has ${includedCount} items. CreditVector caps a single mailed campaign at ${policy.hardCeiling} to keep the package reviewable and each dispute clearly presented — this is an operational limit, not a statement that more than ${policy.hardCeiling} is legally improper. Split it into sequenced campaigns to send everything.`,
    );
  } else if (verdict === "warn") {
    if (includedCount >= policy.warnThreshold) {
      messages.push(
        `You've selected ${includedCount} items. A larger package is harder to review and can mix issues that need different procedures — sending fewer, tightly-related items per campaign is usually easier to follow. This is CreditVector's guidance, not a legal limit; the choice is yours.`,
      );
    }
    for (const r of overRecipient) {
      messages.push(
        `${r.count} items are aimed at one recipient. Concentrating many disputes on a single recipient at once can make each one harder to investigate on its merits — consider spacing them across campaigns.`,
      );
    }
  }
  return { verdict, includedCount, overRecipient, messages };
}
