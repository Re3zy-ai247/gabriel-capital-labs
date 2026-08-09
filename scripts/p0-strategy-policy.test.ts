// Executable Phase 1 strategy-policy guard.
// Synthetic facts only; no consumer identity, report content, addresses, or account values.
// Run: npx --no-install tsx scripts/p0-strategy-policy.test.ts
import {
  CONSUMER_ASSERTION_BINDING_VERSION,
  PHASE_1_STRATEGY_POLICY_SET,
  PHASE_1_STRATEGY_POLICY_VERSION,
  STRATEGY_POLICY_SCHEMA_VERSION,
  evaluateStrategyPolicy,
  validateConsumerAssertionBinding,
  type ClaimType,
  type BoundConsumerAssertion,
  type ConsumerAssertionType,
  type ConsumerAssertionEvidence,
  type CurrentConsumerAssertionBinding,
  type ObservationBinding,
  type ObservationBoundConsumerAssertionType,
  type PolicyContextConsumerAssertionType,
  type ConsolidationItemMetadata,
  type StrategyPolicyDefinition,
  type StrategyPolicyDenialCode,
  type StrategyPolicyEvaluationRequest,
  type StrategyPolicyId,
  type StrategyPolicySet,
} from "../lib/creditTruth/strategyPolicy";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

function equal(label: string, actual: unknown, expected: unknown): void {
  const matches = JSON.stringify(actual) === JSON.stringify(expected);
  if (!matches) {
    console.error(`  actual: ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
  }
  check(label, matches);
}

function definitionFor(strategyId: StrategyPolicyId): StrategyPolicyDefinition {
  const definition = PHASE_1_STRATEGY_POLICY_SET.policies.find(
    (candidate) => candidate.strategyId === strategyId
  );
  if (!definition) throw new Error(`Missing synthetic policy definition: ${strategyId}`);
  return definition;
}

const observationBoundAssertionTypes = new Set<ConsumerAssertionType>([
  "EXACT_FIELD_DISPUTED",
  "EXACT_INCONSISTENCY_CONFIRMED",
  "OBSOLESCENCE_BASIS_CONFIRMED",
  "DIRECT_DISPUTE_BASIS_CONFIRMED",
  "ACCURACY_ACKNOWLEDGED",
]);

const SYNTHETIC_SCOPE = {
  tenantId: "synthetic-tenant",
  consumerId: "synthetic-consumer",
  caseId: "synthetic-case",
} as const;

function syntheticDigest(hexCharacter: string): string {
  return hexCharacter.repeat(64);
}

function consumerAssertionProof(
  definition: StrategyPolicyDefinition,
  type: ConsumerAssertionType,
  sequence: number
): {
  assertion: ConsumerAssertionEvidence;
  current: CurrentConsumerAssertionBinding;
} {
  const suffix = `${definition.strategyId}-${type}-${sequence}`;
  if (observationBoundAssertionTypes.has(type)) {
    const observationType = type as ObservationBoundConsumerAssertionType;
    const observationBinding: ObservationBinding = {
      tenantId: SYNTHETIC_SCOPE.tenantId,
      consumerId: SYNTHETIC_SCOPE.consumerId,
      observationId: `synthetic-observation-${suffix}`,
      reportVersionId: `synthetic-report-version-${definition.strategyId}`,
      extractionRunId: `synthetic-extraction-run-${definition.strategyId}`,
      accountId: `synthetic-account-${definition.strategyId}`,
      bureau: "EQUIFAX",
      field: "detailedStatus",
      observationSeriesKey: `synthetic-observation-series-${suffix}`,
      observationRevision: 1,
      observationDigest: syntheticDigest("b"),
    };
    const boundAssertion: BoundConsumerAssertion = {
      bindingVersion: CONSUMER_ASSERTION_BINDING_VERSION,
      assertionId: `synthetic-assertion-${suffix}`,
      disposition:
        observationType === "ACCURACY_ACKNOWLEDGED"
          ? "CONFIRMED_ACCURATE"
          : "CONFIRMED_INACCURATE",
      binding: { ...observationBinding },
    };
    return {
      assertion: {
        type: observationType,
        bindingKind: "OBSERVATION",
        assertion: boundAssertion,
      },
      current: {
        type: observationType,
        bindingKind: "OBSERVATION",
        observationBinding: { ...observationBinding },
      },
    };
  }

  const contextType = type as PolicyContextConsumerAssertionType;
  const policyContextBinding = {
    tenantId: SYNTHETIC_SCOPE.tenantId,
    consumerId: SYNTHETIC_SCOPE.consumerId,
    caseId: SYNTHETIC_SCOPE.caseId,
    contextId: `synthetic-policy-context-${suffix}`,
    contextVersion: "synthetic-context-version-1",
    contextDigest: syntheticDigest("c"),
    strategyId: definition.strategyId,
    policyVersion: definition.policyVersion,
  };
  return {
    assertion: {
      type: contextType,
      bindingKind: "POLICY_CONTEXT",
      assertionId: `synthetic-assertion-${suffix}`,
      assertionVersion: "synthetic-assertion-version-1",
      assertionDigest: syntheticDigest("a"),
      status: "CONFIRMED",
      policyContextBinding,
    },
    current: {
      type: contextType,
      bindingKind: "POLICY_CONTEXT",
      policyContextBinding: { ...policyContextBinding },
    },
  };
}

function completeRequest(
  definition: StrategyPolicyDefinition,
  overrides: Partial<StrategyPolicyEvaluationRequest> = {}
): StrategyPolicyEvaluationRequest {
  const claimType = definition.allowedClaimTypes[0];
  if (!claimType) throw new Error(`Policy has no allowed synthetic claim: ${definition.strategyId}`);
  const claimRequirement = definition.claimRequirements[claimType];
  const assertionTypes = [
    ...definition.requiredConsumerAssertions,
    ...(claimRequirement?.requiredConsumerAssertions ?? []),
  ].filter((type, index, all) => all.indexOf(type) === index);
  const assertionProofs = assertionTypes.map((type, index) =>
    consumerAssertionProof(definition, type, index)
  );
  return {
    scope: { ...SYNTHETIC_SCOPE },
    strategyId: definition.strategyId,
    policyVersion: definition.policyVersion,
    contextStatus: "COMPLETE",
    correspondenceItemId: `synthetic-item-${definition.strategyId}`,
    recipientId: `synthetic-recipient-${definition.strategyId}`,
    recipientAddressVersionId: `synthetic-address-version-${definition.strategyId}`,
    recipientType: definition.recipientTypes[0],
    addressStatus: "VERIFIED_VERSIONED",
    round: definition.roundPolicy.minimum,
    applicabilityFacts: [...definition.applicabilityPredicates],
    observationTypes: [
      ...definition.requiredObservationTypes,
      ...(claimRequirement?.requiredObservationTypes ?? []),
    ],
    consumerAssertions: assertionProofs.map((proof) => proof.assertion),
    currentAssertionBindings: assertionProofs.map((proof) => proof.current),
    timingFacts: [
      ...definition.requiredTimingFacts,
      ...(claimRequirement?.requiredTimingFacts ?? []),
    ],
    claimTypes: [claimType],
    statuteReferenceIds: [],
    enclosures: [...definition.enclosurePolicy.required],
    escalationFacts: [...definition.roundPolicy.prerequisites],
    ...overrides,
  };
}

function consolidationItem(
  definition: StrategyPolicyDefinition,
  request: StrategyPolicyEvaluationRequest,
  itemId: string,
  overrides: Partial<ConsolidationItemMetadata> = {}
): ConsolidationItemMetadata {
  return {
    tenantId: request.scope.tenantId,
    consumerId: request.scope.consumerId,
    caseId: request.scope.caseId,
    itemId,
    recipientId: request.recipientId,
    recipientAddressVersionId: request.recipientAddressVersionId,
    round: request.round,
    policyVersion: definition.policyVersion,
    recipientType: request.recipientType,
    strategyId: definition.strategyId,
    claimCompatibilityKey: definition.consolidationPolicy.claimCompatibilityKey,
    enclosureCompatibilityKey: definition.consolidationPolicy.enclosureCompatibilityKey,
    ...overrides,
  };
}

function activePolicySet(
  strategyId: StrategyPolicyId,
  approval: "APPROVED" | "AS_DEFINED" = "APPROVED"
): StrategyPolicySet {
  return {
    ...PHASE_1_STRATEGY_POLICY_SET,
    status: "ACTIVE",
    policySetVersion: "synthetic-active-policy-set-v1",
    policies: PHASE_1_STRATEGY_POLICY_SET.policies.map((definition) => {
      if (definition.strategyId !== strategyId || approval === "AS_DEFINED") return definition;
      return {
        ...definition,
        status: "APPROVED",
        counselApprovalStatus: definition.counselApprovalRequired ? "APPROVED" : "NOT_REQUIRED",
      };
    }),
  };
}

function hasReason(
  result: ReturnType<typeof evaluateStrategyPolicy>,
  code: StrategyPolicyDenialCode,
  requirement?: string
): boolean {
  return result.reasons.some(
    (reason) => reason.code === code && (requirement === undefined || reason.requirement === requirement)
  );
}

const expectedStrategies: StrategyPolicyId[] = [
  "fcra_611",
  "fcra_609",
  "validation",
  "metro2",
  "fcra_605",
  "fcra_623",
  "fdcpa",
  "escalation",
  "goodwill",
  "pay_delete",
  "cease_desist",
  "cfpb_threat",
];

equal(
  "all 12 checkpoint strategies are represented once",
  [...PHASE_1_STRATEGY_POLICY_SET.policies.map((policy) => policy.strategyId)].sort(),
  [...expectedStrategies].sort()
);
check(
  "every strategy uses the executable schema version",
  PHASE_1_STRATEGY_POLICY_SET.policies.every(
    (policy) => policy.schemaVersion === STRATEGY_POLICY_SCHEMA_VERSION
  )
);
check(
  "every strategy pins an exact policy version",
  PHASE_1_STRATEGY_POLICY_SET.policies.every(
    (policy) => policy.policyVersion === PHASE_1_STRATEGY_POLICY_VERSION
  )
);
check(
  "strategy id and version pairs are unique",
  new Set(
    PHASE_1_STRATEGY_POLICY_SET.policies.map(
      (policy) => `${policy.strategyId}:${policy.policyVersion}`
    )
  ).size === 12
);
check(
  "every definition carries recipient, predicates, claims, enclosures, consolidation, and round controls",
  PHASE_1_STRATEGY_POLICY_SET.policies.every(
    (policy) =>
      policy.recipientTypes.length > 0 &&
      policy.applicabilityPredicates.length > 0 &&
      policy.requiredObservationTypes.length > 0 &&
      policy.requiredConsumerAssertions.length > 0 &&
      policy.requiredAddressStatus === "VERIFIED_VERSIONED" &&
      policy.allowedClaimTypes.length > 0 &&
      policy.enclosurePolicy.recipientScopedManifestRequired === true &&
      policy.consolidationPolicy.requiresSameRecipient === true &&
      policy.consolidationPolicy.claimCompatibilityKey.length > 0 &&
      policy.consolidationPolicy.enclosureCompatibilityKey.length > 0 &&
      policy.roundPolicy.minimum >= 1
  )
);

const counselBlocked: StrategyPolicyId[] = [
  "validation",
  "fcra_623",
  "fdcpa",
  "goodwill",
  "pay_delete",
  "cease_desist",
  "cfpb_threat",
];
equal(
  "all seven counsel-dependent strategies remain PENDING_COUNSEL",
  PHASE_1_STRATEGY_POLICY_SET.policies
    .filter((policy) => policy.status === "PENDING_COUNSEL")
    .map((policy) => policy.strategyId)
    .sort(),
  [...counselBlocked].sort()
);
check(
  "every counsel-dependent strategy requires approval and records it as pending",
  counselBlocked.every((strategyId) => {
    const definition = definitionFor(strategyId);
    return (
      definition.counselApprovalRequired === true &&
      definition.counselApprovalStatus === "PENDING_COUNSEL"
    );
  })
);
check(
  "no Phase 1 strategy is marked approved",
  PHASE_1_STRATEGY_POLICY_SET.policies.every((policy) => policy.status !== "APPROVED")
);
equal("Phase 1 policy set is globally dormant", PHASE_1_STRATEGY_POLICY_SET.status, "DORMANT_PHASE_1");
check("Phase 1 policy set is runtime immutable", Object.isFrozen(PHASE_1_STRATEGY_POLICY_SET));
check(
  "Phase 1 policy definitions are runtime immutable",
  PHASE_1_STRATEGY_POLICY_SET.policies.every((policy) => Object.isFrozen(policy))
);

for (const strategyId of expectedStrategies) {
  const definition = definitionFor(strategyId);
  const result = evaluateStrategyPolicy(PHASE_1_STRATEGY_POLICY_SET, completeRequest(definition));
  check(`${strategyId} cannot activate from the dormant Phase 1 set`, result.decision === "DENY");
  check(`${strategyId} reports the dormant gate`, hasReason(result, "POLICY_SET_DORMANT"));
}

const fcra611 = definitionFor("fcra_611");
const activeFcra611 = activePolicySet("fcra_611");
const allowedFcra611 = evaluateStrategyPolicy(activeFcra611, completeRequest(fcra611));
equal("a complete synthetic context can pass an explicitly activated approved policy", allowedFcra611.decision, "ALLOW");
equal("an eligible result has no denial reasons", allowedFcra611.reasons, []);

const unknownStrategy = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  strategyId: "synthetic_unknown_strategy",
});
check("unknown strategy fails closed", unknownStrategy.decision === "DENY");
check("unknown strategy returns a precise reason", hasReason(unknownStrategy, "UNKNOWN_STRATEGY"));

const staleVersion = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  policyVersion: "synthetic-stale-version",
});
check("unknown policy version fails closed", staleVersion.decision === "DENY");
check("unknown policy version is distinguished from unknown strategy", hasReason(staleVersion, "POLICY_VERSION_NOT_FOUND"));

const incomplete = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  contextStatus: "INCOMPLETE",
});
check("incomplete context fails closed", hasReason(incomplete, "CONTEXT_INCOMPLETE"));

const noClaim = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  claimTypes: [],
});
check("missing claim selection fails closed", hasReason(noClaim, "CLAIM_SELECTION_MISSING"));

const missingPredicate = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  applicabilityFacts: [],
});
check("missing applicability predicate blocks eligibility", hasReason(missingPredicate, "APPLICABILITY_PREDICATE_MISSING", "EXACT_BUREAU_FIELD_OBSERVED"));

const wrongRecipient = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  recipientType: "FURNISHER",
});
check("recipient type mismatch blocks eligibility", hasReason(wrongRecipient, "RECIPIENT_TYPE_NOT_ALLOWED", "FURNISHER"));

const missingAddress = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  addressStatus: "MISSING",
});
check("missing recipient address version blocks eligibility", hasReason(missingAddress, "RECIPIENT_ADDRESS_NOT_VERIFIED_VERSIONED", "MISSING"));

const missingObservation = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  observationTypes: [],
});
check("missing exact observation blocks eligibility", hasReason(missingObservation, "REQUIRED_OBSERVATION_MISSING", "BUREAU_SCOPED_FIELD"));

const missingConfirmation = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  consumerAssertions: [],
});
check("missing consumer confirmation blocks eligibility", hasReason(missingConfirmation, "REQUIRED_CONSUMER_ASSERTION_MISSING", "EXACT_FIELD_DISPUTED"));

const exactFieldProof = consumerAssertionProof(fcra611, "EXACT_FIELD_DISPUTED", 0);
if (exactFieldProof.assertion.bindingKind !== "OBSERVATION") {
  throw new Error("Synthetic exact-field assertion must carry a bound observation assertion");
}
const revokedConfirmation = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  consumerAssertions: [
    {
      ...exactFieldProof.assertion,
      assertion: { ...exactFieldProof.assertion.assertion, disposition: "REVOKED" },
    },
  ],
  currentAssertionBindings: [exactFieldProof.current],
});
check("revoked consumer confirmation blocks eligibility", hasReason(revokedConfirmation, "CONSUMER_ASSERTION_NOT_CONFIRMED", "EXACT_FIELD_DISPUTED"));

if (exactFieldProof.current.bindingKind !== "OBSERVATION") {
  throw new Error("Synthetic exact-field assertion must be observation-bound");
}
const changedObservationBinding: CurrentConsumerAssertionBinding = {
  ...exactFieldProof.current,
  observationBinding: {
    ...exactFieldProof.current.observationBinding,
    observationRevision: 2,
    observationDigest: syntheticDigest("d"),
  },
};
const forgedCurrentLabel = {
  ...exactFieldProof.assertion,
  observationVersionBinding: "CURRENT",
} as unknown as ConsumerAssertionEvidence;
check(
  "forged CURRENT label cannot satisfy exact binding validation",
  forgedCurrentLabel.bindingKind === "OBSERVATION" &&
    changedObservationBinding.bindingKind === "OBSERVATION" &&
    !validateConsumerAssertionBinding(
      forgedCurrentLabel.assertion,
      changedObservationBinding.observationBinding
    ).valid
);
const staleConfirmation = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  consumerAssertions: [forgedCurrentLabel],
  currentAssertionBindings: [changedObservationBinding],
});
check("changed observation version requires reconfirmation despite forged label", hasReason(staleConfirmation, "CONSUMER_ASSERTION_NOT_BOUND_TO_CURRENT_OBSERVATION", "EXACT_FIELD_DISPUTED"));

const otherTenantObservation = {
  ...exactFieldProof.assertion.assertion.binding,
  tenantId: "synthetic-tenant-other",
};
const crossTenantAssertion: ConsumerAssertionEvidence = {
  ...exactFieldProof.assertion,
  assertion: {
    ...exactFieldProof.assertion.assertion,
    binding: otherTenantObservation,
  },
};
const crossTenantCurrent: CurrentConsumerAssertionBinding = {
  ...exactFieldProof.current,
  observationBinding: { ...otherTenantObservation },
};
check(
  "cross-tenant assertion/current pair is internally exact before scope enforcement",
  validateConsumerAssertionBinding(
    crossTenantAssertion.bindingKind === "OBSERVATION"
      ? crossTenantAssertion.assertion
      : exactFieldProof.assertion.assertion,
    crossTenantCurrent.bindingKind === "OBSERVATION"
      ? crossTenantCurrent.observationBinding
      : exactFieldProof.current.observationBinding
  ).status === "CURRENT"
);
const crossTenantAssertionResult = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  consumerAssertions: [crossTenantAssertion],
  currentAssertionBindings: [crossTenantCurrent],
});
check(
  "internally exact cross-tenant observation assertion is denied",
  hasReason(crossTenantAssertionResult, "OBSERVATION_ASSERTION_TENANT_SCOPE_MISMATCH")
);

const otherConsumerObservation = {
  ...exactFieldProof.assertion.assertion.binding,
  consumerId: "synthetic-consumer-other",
};
const crossConsumerAssertion: ConsumerAssertionEvidence = {
  ...exactFieldProof.assertion,
  assertion: {
    ...exactFieldProof.assertion.assertion,
    binding: otherConsumerObservation,
  },
};
const crossConsumerCurrent: CurrentConsumerAssertionBinding = {
  ...exactFieldProof.current,
  observationBinding: { ...otherConsumerObservation },
};
const crossConsumerAssertionResult = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  consumerAssertions: [crossConsumerAssertion],
  currentAssertionBindings: [crossConsumerCurrent],
});
check(
  "internally exact cross-consumer observation assertion is denied",
  hasReason(
    crossConsumerAssertionResult,
    "OBSERVATION_ASSERTION_CONSUMER_SCOPE_MISMATCH"
  )
);

const validation = definitionFor("validation");
const activePendingValidation = activePolicySet("validation", "AS_DEFINED");
const pendingCounsel = evaluateStrategyPolicy(activePendingValidation, completeRequest(validation));
check("active policy set cannot bypass pending counsel status", pendingCounsel.decision === "DENY");
check("pending counsel returns a precise denial reason", hasReason(pendingCounsel, "COUNSEL_APPROVAL_PENDING"));

const activeApprovedValidation = activePolicySet("validation");
const validationElectionProof = consumerAssertionProof(
  validation,
  "VALIDATION_REQUEST_ELECTED",
  0
);
if (validationElectionProof.current.bindingKind !== "POLICY_CONTEXT") {
  throw new Error("Synthetic validation election must be policy-context-bound");
}
const changedPolicyContextBinding: CurrentConsumerAssertionBinding = {
  ...validationElectionProof.current,
  policyContextBinding: {
    ...validationElectionProof.current.policyContextBinding,
    contextVersion: "synthetic-context-version-2",
    contextDigest: syntheticDigest("d"),
  },
};
const stalePolicyContext = evaluateStrategyPolicy(activeApprovedValidation, {
  ...completeRequest(validation),
  consumerAssertions: [validationElectionProof.assertion],
  currentAssertionBindings: [changedPolicyContextBinding],
});
check(
  "stale immutable policy/context version requires renewed election",
  hasReason(
    stalePolicyContext,
    "CONSUMER_ASSERTION_NOT_BOUND_TO_CURRENT_POLICY_CONTEXT",
    "VALIDATION_REQUEST_ELECTED"
  )
);

if (validationElectionProof.assertion.bindingKind !== "POLICY_CONTEXT") {
  throw new Error("Synthetic validation election must carry policy-context proof");
}
const otherScopePolicyContext = {
  ...validationElectionProof.assertion.policyContextBinding,
  tenantId: "synthetic-tenant-other",
  consumerId: "synthetic-consumer-other",
  caseId: "synthetic-case-other",
};
const crossScopePolicyContext = evaluateStrategyPolicy(activeApprovedValidation, {
  ...completeRequest(validation),
  consumerAssertions: [
    {
      ...validationElectionProof.assertion,
      policyContextBinding: otherScopePolicyContext,
    },
  ],
  currentAssertionBindings: [
    {
      ...validationElectionProof.current,
      policyContextBinding: { ...otherScopePolicyContext },
    },
  ],
});
check(
  "cross-tenant policy-context election is denied",
  hasReason(crossScopePolicyContext, "POLICY_CONTEXT_TENANT_SCOPE_MISMATCH")
);
check(
  "cross-consumer policy-context election is denied",
  hasReason(crossScopePolicyContext, "POLICY_CONTEXT_CONSUMER_SCOPE_MISMATCH")
);
check(
  "cross-case policy-context election is denied",
  hasReason(crossScopePolicyContext, "POLICY_CONTEXT_CASE_SCOPE_MISMATCH")
);

const validationWithCeaseClaim = completeRequest(validation, {
  claimTypes: ["ASSERT_CEASE_PENDING_VALIDATION"],
  timingFacts: [],
});
const missingValidationTiming = evaluateStrategyPolicy(
  activeApprovedValidation,
  validationWithCeaseClaim
);
for (const timingFact of [
  "COLLECTOR_INITIAL_NOTICE_DATE_RECORDED",
  "CONSUMER_WRITTEN_DISPUTE_DATE_RECORDED",
  "VALIDATION_PERIOD_ELIGIBILITY_DETERMINED",
] as const) {
  check(
    `cease claim requires timing fact ${timingFact}`,
    hasReason(missingValidationTiming, "REQUIRED_TIMING_FACT_MISSING", `ASSERT_CEASE_PENDING_VALIDATION:${timingFact}`)
  );
}
const completeValidationTiming = evaluateStrategyPolicy(activeApprovedValidation, {
  ...validationWithCeaseClaim,
  timingFacts: [
    "COLLECTOR_INITIAL_NOTICE_DATE_RECORDED",
    "CONSUMER_WRITTEN_DISPUTE_DATE_RECORDED",
    "VALIDATION_PERIOD_ELIGIBILITY_DETERMINED",
  ],
});
equal("complete synthetic timing facts satisfy the conditional cease-claim gate", completeValidationTiming.decision, "ALLOW");

const prohibitedClaim = evaluateStrategyPolicy(activePolicySet("fcra_609"), {
  ...completeRequest(definitionFor("fcra_609")),
  claimTypes: ["ASSERT_SECTION_609_AUTOMATIC_DELETION"],
});
check("prohibited claim is rejected", hasReason(prohibitedClaim, "PROHIBITED_CLAIM_TYPE", "ASSERT_SECTION_609_AUTOMATIC_DELETION"));

const unlistedClaim: ClaimType = "REQUEST_COURTESY_ADJUSTMENT";
const unlistedClaimResult = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  claimTypes: [unlistedClaim],
});
check("claim outside a strategy allowlist is rejected", hasReason(unlistedClaimResult, "CLAIM_TYPE_NOT_ALLOWED", unlistedClaim));

const statuteMismatch = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  statuteReferenceIds: ["FDCPA_809"],
});
check("unapproved statute reference is rejected", hasReason(statuteMismatch, "STATUTE_REFERENCE_NOT_ALLOWED", "FDCPA_809"));

const prohibitedEnclosure = evaluateStrategyPolicy(activeFcra611, {
  ...completeRequest(fcra611),
  enclosures: ["FULL_CREDIT_REPORT"],
});
check("full-report enclosure is rejected", hasReason(prohibitedEnclosure, "PROHIBITED_ENCLOSURE", "FULL_CREDIT_REPORT"));

const fcra605 = definitionFor("fcra_605");
const missingRequiredEnclosure = evaluateStrategyPolicy(activePolicySet("fcra_605"), {
  ...completeRequest(fcra605),
  enclosures: [],
});
check("strategy-required enclosure is enforced", hasReason(missingRequiredEnclosure, "REQUIRED_ENCLOSURE_MISSING", "REPORT_EXCERPT"));

const compatibleConsolidationRequest = completeRequest(fcra611);
const fcra609 = definitionFor("fcra_609");
const compatibleConsolidation = evaluateStrategyPolicy(activeFcra611, {
  ...compatibleConsolidationRequest,
  consolidation: {
    items: [
      consolidationItem(
        fcra611,
        compatibleConsolidationRequest,
        compatibleConsolidationRequest.correspondenceItemId
      ),
      consolidationItem(fcra609, compatibleConsolidationRequest, "synthetic-item-fcra-609"),
    ],
  },
});
equal("compatible same-recipient CRA consolidation passes policy", compatibleConsolidation.decision, "ALLOW");

const forgedCompatibilityKeys = evaluateStrategyPolicy(activeFcra611, {
  ...compatibleConsolidationRequest,
  consolidation: {
    items: [
      consolidationItem(
        fcra611,
        compatibleConsolidationRequest,
        compatibleConsolidationRequest.correspondenceItemId
      ),
      consolidationItem(fcra609, compatibleConsolidationRequest, "synthetic-item-forged", {
        claimCompatibilityKey: "synthetic-forged-claim-key",
        enclosureCompatibilityKey: "synthetic-forged-enclosure-key",
      }),
    ],
  },
});
check(
  "caller-forged claim compatibility key is rejected",
  hasReason(forgedCompatibilityKeys, "CONSOLIDATION_CLAIM_INCOMPATIBLE", "synthetic-item-forged")
);
check(
  "caller-forged enclosure compatibility key is rejected",
  hasReason(
    forgedCompatibilityKeys,
    "CONSOLIDATION_ENCLOSURE_INCOMPATIBLE",
    "synthetic-item-forged"
  )
);

const crossRecipientRequest = completeRequest(fcra611);
const crossRecipientConsolidation = evaluateStrategyPolicy(activeFcra611, {
  ...crossRecipientRequest,
  consolidation: {
    items: [
      consolidationItem(
        fcra611,
        crossRecipientRequest,
        crossRecipientRequest.correspondenceItemId
      ),
      consolidationItem(
        definitionFor("fcra_623"),
        crossRecipientRequest,
        "synthetic-item-fcra-623",
        {
          recipientId: "synthetic-recipient-other",
          recipientAddressVersionId: "synthetic-address-version-other",
          recipientType: "FURNISHER",
        }
      ),
    ],
  },
});
check("cross-recipient consolidation is rejected", hasReason(crossRecipientConsolidation, "CONSOLIDATION_RECIPIENT_MISMATCH"));
check("mixed recipient types remain separate", hasReason(crossRecipientConsolidation, "CONSOLIDATION_MIXED_RECIPIENT_TYPES"));
check("incompatible strategies remain separate", hasReason(crossRecipientConsolidation, "CONSOLIDATION_STRATEGY_INCOMPATIBLE", "fcra_623"));

const crossScopeConsolidation = evaluateStrategyPolicy(activeFcra611, {
  ...compatibleConsolidationRequest,
  consolidation: {
    items: [
      consolidationItem(
        fcra611,
        compatibleConsolidationRequest,
        compatibleConsolidationRequest.correspondenceItemId
      ),
      consolidationItem(
        fcra609,
        compatibleConsolidationRequest,
        "synthetic-item-cross-scope",
        {
          tenantId: "synthetic-tenant-other",
          consumerId: "synthetic-consumer-other",
          caseId: "synthetic-case-other",
        }
      ),
    ],
  },
});
check(
  "cross-tenant consolidation item is denied",
  hasReason(crossScopeConsolidation, "CONSOLIDATION_TENANT_SCOPE_MISMATCH")
);
check(
  "cross-consumer consolidation item is denied",
  hasReason(crossScopeConsolidation, "CONSOLIDATION_CONSUMER_SCOPE_MISMATCH")
);
check(
  "cross-case consolidation item is denied",
  hasReason(crossScopeConsolidation, "CONSOLIDATION_CASE_SCOPE_MISMATCH")
);

const standaloneGoodwill = definitionFor("goodwill");
const standaloneGoodwillRequest = completeRequest(standaloneGoodwill);
const bundledGoodwill = evaluateStrategyPolicy(activePolicySet("goodwill"), {
  ...standaloneGoodwillRequest,
  consolidation: {
    items: [
      consolidationItem(
        standaloneGoodwill,
        standaloneGoodwillRequest,
        standaloneGoodwillRequest.correspondenceItemId
      ),
      consolidationItem(
        standaloneGoodwill,
        standaloneGoodwillRequest,
        "synthetic-item-goodwill-second"
      ),
    ],
  },
});
check("standalone policy rejects bundling", hasReason(bundledGoodwill, "CONSOLIDATION_REQUIRES_STANDALONE"));

const escalation = definitionFor("escalation");
const activeEscalation = activePolicySet("escalation");
const wrongRound = evaluateStrategyPolicy(activeEscalation, {
  ...completeRequest(escalation),
  round: 1,
});
check("Round 2 policy rejects Round 1", hasReason(wrongRound, "ROUND_NOT_ALLOWED", "1"));

const missingEscalationFacts = evaluateStrategyPolicy(activeEscalation, {
  ...completeRequest(escalation),
  escalationFacts: [],
});
check("Round 2 requires immutable parent version", hasReason(missingEscalationFacts, "ESCALATION_PREREQUISITE_MISSING", "IMMUTABLE_PARENT_VERSION"));
check("Round 2 requires same recipient as parent", hasReason(missingEscalationFacts, "ESCALATION_PREREQUISITE_MISSING", "SAME_RECIPIENT_AS_PARENT"));
check("Round 2 requires explicit follow-up approval", hasReason(missingEscalationFacts, "ESCALATION_PREREQUISITE_MISSING", "EXPLICIT_FOLLOW_UP_APPROVAL"));
equal("complete synthetic Round 2 prerequisites pass activated policy", evaluateStrategyPolicy(activeEscalation, completeRequest(escalation)).decision, "ALLOW");

const dormantMutationGuard = JSON.stringify(PHASE_1_STRATEGY_POLICY_SET);
evaluateStrategyPolicy(PHASE_1_STRATEGY_POLICY_SET, completeRequest(fcra611));
equal("evaluator does not mutate the dormant policy set", JSON.stringify(PHASE_1_STRATEGY_POLICY_SET), dormantMutationGuard);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
