import type { Bureau } from "@prisma/client";
import type { CreditTruthFieldName } from "./types";

export const CONSUMER_ASSERTION_BINDING_VERSION = "consumer-assertion-binding-v1" as const;

export const CONSUMER_ASSERTION_DISPOSITIONS = [
  "CONFIRMED_ACCURATE",
  "CONFIRMED_INACCURATE",
  "NOT_MINE",
  "OUTDATED_UPDATE_REQUESTED",
  "REVIEW_NEEDED",
  "REVOKED",
] as const;

export type ConsumerAssertionDisposition = (typeof CONSUMER_ASSERTION_DISPOSITIONS)[number];

/**
 * A value-free identity snapshot for one persisted observation.
 *
 * Every member is supplied by the authorized persistence boundary. This module
 * deliberately does not derive ids, revisions, or digests from a consumer value,
 * low-entropy PII, or source text. The observationDigest is integrity metadata,
 * not a searchable fingerprint of the observed value.
 */
export interface ObservationBinding {
  tenantId: string;
  consumerId: string;
  observationId: string;
  reportVersionId: string;
  extractionRunId: string;
  accountId: string;
  bureau: Bureau;
  field: CreditTruthFieldName;
  observationSeriesKey: string;
  observationRevision: number;
  observationDigest: string;
}

export interface BoundConsumerAssertion {
  bindingVersion: typeof CONSUMER_ASSERTION_BINDING_VERSION;
  assertionId: string;
  disposition: ConsumerAssertionDisposition;
  binding: ObservationBinding;
}

export const ASSERTION_BINDING_COMPONENTS = [
  "tenantId",
  "consumerId",
  "observationId",
  "reportVersionId",
  "extractionRunId",
  "accountId",
  "bureau",
  "field",
  "observationSeriesKey",
  "observationRevision",
  "observationDigest",
] as const satisfies readonly (keyof ObservationBinding)[];

export type AssertionBindingComponent = (typeof ASSERTION_BINDING_COMPONENTS)[number];

export type ConsumerAssertionBindingStatus =
  | "CURRENT"
  | "RECONFIRMATION_REQUIRED"
  | "INVALID_BINDING";

export type ConsumerAssertionBindingReason =
  | "EXACT_BINDING_MATCH"
  | "ASSERTION_METADATA_INVALID"
  | "ASSERTION_BINDING_INVALID"
  | "CURRENT_OBSERVATION_BINDING_INVALID"
  | "TENANT_CHANGED"
  | "CONSUMER_CHANGED"
  | "OBSERVATION_ID_CHANGED"
  | "REPORT_VERSION_CHANGED"
  | "EXTRACTION_RUN_CHANGED"
  | "ACCOUNT_CHANGED"
  | "BUREAU_CHANGED"
  | "FIELD_CHANGED"
  | "OBSERVATION_SERIES_CHANGED"
  | "OBSERVATION_REVISION_CHANGED"
  | "OBSERVATION_DIGEST_CHANGED";

export interface ConsumerAssertionBindingValidation {
  status: ConsumerAssertionBindingStatus;
  valid: boolean;
  requiresReconfirmation: boolean;
  supportsDisputeGround: boolean;
  changedComponents: AssertionBindingComponent[];
  reasons: ConsumerAssertionBindingReason[];
}

const CHANGE_REASON_BY_COMPONENT: Record<AssertionBindingComponent, ConsumerAssertionBindingReason> = {
  tenantId: "TENANT_CHANGED",
  consumerId: "CONSUMER_CHANGED",
  observationId: "OBSERVATION_ID_CHANGED",
  reportVersionId: "REPORT_VERSION_CHANGED",
  extractionRunId: "EXTRACTION_RUN_CHANGED",
  accountId: "ACCOUNT_CHANGED",
  bureau: "BUREAU_CHANGED",
  field: "FIELD_CHANGED",
  observationSeriesKey: "OBSERVATION_SERIES_CHANGED",
  observationRevision: "OBSERVATION_REVISION_CHANGED",
  observationDigest: "OBSERVATION_DIGEST_CHANGED",
};

function isNonEmptyOpaqueToken(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isLowercaseSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function invalidBindingComponents(binding: ObservationBinding): AssertionBindingComponent[] {
  return ASSERTION_BINDING_COMPONENTS.filter((component) => {
    if (component === "observationRevision") {
      return !Number.isSafeInteger(binding.observationRevision) || binding.observationRevision < 1;
    }
    if (component === "observationDigest") return !isLowercaseSha256(binding.observationDigest);
    return !isNonEmptyOpaqueToken(binding[component]);
  });
}

/**
 * Validates whether a prior consumer assertion still targets the exact current
 * observation identity. Any version, scope, revision, or integrity-token change
 * requires a new explicit confirmation; this function never carries an assertion
 * forward implicitly.
 */
export function validateConsumerAssertionBinding(
  assertion: BoundConsumerAssertion,
  currentObservation: ObservationBinding
): ConsumerAssertionBindingValidation {
  if (
    assertion.bindingVersion !== CONSUMER_ASSERTION_BINDING_VERSION ||
    !isNonEmptyOpaqueToken(assertion.assertionId)
  ) {
    return {
      status: "INVALID_BINDING",
      valid: false,
      requiresReconfirmation: true,
      supportsDisputeGround: false,
      changedComponents: [],
      reasons: ["ASSERTION_METADATA_INVALID"],
    };
  }

  const invalidAssertionComponents = invalidBindingComponents(assertion.binding);
  if (invalidAssertionComponents.length > 0) {
    return {
      status: "INVALID_BINDING",
      valid: false,
      requiresReconfirmation: true,
      supportsDisputeGround: false,
      changedComponents: invalidAssertionComponents,
      reasons: ["ASSERTION_BINDING_INVALID"],
    };
  }

  const invalidCurrentComponents = invalidBindingComponents(currentObservation);
  if (invalidCurrentComponents.length > 0) {
    return {
      status: "INVALID_BINDING",
      valid: false,
      requiresReconfirmation: true,
      supportsDisputeGround: false,
      changedComponents: invalidCurrentComponents,
      reasons: ["CURRENT_OBSERVATION_BINDING_INVALID"],
    };
  }

  const changedComponents = ASSERTION_BINDING_COMPONENTS.filter(
    (component) => assertion.binding[component] !== currentObservation[component]
  );

  if (changedComponents.length > 0) {
    return {
      status: "RECONFIRMATION_REQUIRED",
      valid: false,
      requiresReconfirmation: true,
      supportsDisputeGround: false,
      changedComponents,
      reasons: changedComponents.map((component) => CHANGE_REASON_BY_COMPONENT[component]),
    };
  }

  return {
    status: "CURRENT",
    valid: true,
    requiresReconfirmation: false,
    supportsDisputeGround: ["CONFIRMED_INACCURATE", "NOT_MINE", "OUTDATED_UPDATE_REQUESTED"].includes(
      assertion.disposition
    ),
    changedComponents: [],
    reasons: ["EXACT_BINDING_MATCH"],
  };
}

export function isCurrentConsumerAssertion(
  validation: ConsumerAssertionBindingValidation
): validation is ConsumerAssertionBindingValidation & {
  status: "CURRENT";
  valid: true;
  requiresReconfirmation: false;
} {
  return validation.status === "CURRENT" && validation.valid && !validation.requiresReconfirmation;
}
