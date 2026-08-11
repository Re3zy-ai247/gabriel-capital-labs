import { createHash } from "node:crypto";
import type { Bureau } from "@prisma/client";
import { isStrictIsoInstant } from "./progressIntelligence";

/**
 * Value-free, repository-resolved source membership for one Round 0 baseline.
 * The seal is evidence identity, not a parser-success flag or consumer claim.
 */
export const ROUND0_SOURCE_SEAL_CONTRACT_VERSION =
  "p0-round0-source-seal-v1" as const;

export const ROUND0_SOURCE_IDENTITY_CATEGORY_KEYS = [
  "LEGAL_NAME",
  "ALIAS",
  "CURRENT_ADDRESS",
  "FORMER_ADDRESS",
  "SAFE_IDENTIFIER",
  "PHONE",
  "EMPLOYMENT",
  "MIXED_FILE_INDICATOR",
] as const;

export type Round0SourceIdentityCategory =
  (typeof ROUND0_SOURCE_IDENTITY_CATEGORY_KEYS)[number];

export type Round0SourceCompletenessCategory =
  | Round0SourceIdentityCategory
  | "UNRECOGNIZED_ACCOUNT";

export interface Round0OriginalSourceArtifactRef {
  readonly artifactId: string;
  readonly artifactVersion: number;
  readonly kind: "REPORT_SOURCE";
  readonly representation: "ORIGINAL_BYTES";
  readonly sha256: string;
}

export interface Round0ExtractionInputArtifactRef {
  readonly artifactId: string;
  readonly artifactVersion: number;
  readonly kind: "NORMALIZED_TEXT";
  readonly representation: "DERIVED_NORMALIZED_TEXT";
  readonly sha256: string;
}

export interface Round0BureauCoverageSourceRef {
  readonly bureauCoverageId: string;
  readonly bureau: Bureau;
  readonly coverageStatus: "COVERED" | "OUTSIDE_COVERAGE";
}

/** Value-free mirror of one durable Round0SourceCompletenessEvidence row. */
export interface Round0SourceCompletenessEvidenceRef {
  readonly id: string;
  readonly bureau: Bureau;
  readonly coverageStatus: "COVERED" | "OUTSIDE_COVERAGE";
  readonly bureauCoverageId: string;
  /** Exact immutable DRAFT baseline whose member set this row counts. */
  readonly identityBaselineId: string;
  readonly baselineInputSetSha256: string;
  readonly category: Round0SourceCompletenessCategory;
  readonly status:
    | "COMPLETE"
    | "PARTIAL"
    | "FAILED"
    | "NOT_PROVIDED"
    | "UNKNOWN";
  readonly sourceMemberCount: number;
  readonly sourceMembershipSha256: string;
  readonly sourceLocatorToken: string | null;
  readonly integritySha256: string;
  readonly ruleKey: string;
  readonly ruleVersion: string;
}

export interface Round0SourceListedAccountMember {
  readonly reportAccountId: string;
  readonly accountId: string;
  readonly sourceAccountOrdinal: number;
  readonly membershipOrigin: "SOURCE_LISTED";
  readonly authorityStatus: "SHADOW_V2";
  readonly bureau: Bureau;
  readonly bureauCoverageId: string;
  readonly coverageStatus: "COVERED";
  readonly accountPresenceId: string;
  readonly accountPresence: "PRESENT" | "UNKNOWN";
  readonly accountPresenceSeriesKey: string;
  readonly accountPresenceRevision: number;
  readonly accountPresenceIntegritySha256: string;
  readonly accountPresenceSourceLocatorToken: string | null;
  readonly accountIndexCompletenessId: string;
  readonly accountIndexStatus:
    | "COMPLETE"
    | "PARTIAL"
    | "FAILED"
    | "NOT_PROVIDED"
    | "UNKNOWN";
}

export interface Round0IdentityFactSourceMember {
  readonly identityFactId: string;
  readonly factSeriesKey: string;
  readonly factOrdinal: number;
  readonly categoryKey: Round0SourceIdentityCategory;
  readonly bureau: Bureau;
  readonly presence: "PRESENT" | "UNKNOWN";
  readonly sourceKind: "SOURCE_REPORTED" | "PARSER_UNCERTAINTY";
  readonly classification: "REVIEW_NEEDED";
  readonly integritySha256: string;
  readonly sourceLocatorToken: string;
}

export interface Round0SourceSnapshot {
  readonly contractVersion: typeof ROUND0_SOURCE_SEAL_CONTRACT_VERSION;
  readonly repositoryReadId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  /** Exact durable ingestion that owns the immutable source Artifact link. */
  readonly reportIngestionId: string;
  readonly reportVersionId: string;
  readonly reportSeriesKey: string;
  readonly reportVersion: number;
  readonly reportSourceSha256: string;
  readonly sourceArtifact: Round0OriginalSourceArtifactRef;
  readonly extractionRunId: string;
  readonly extractionStatus: "SUCCEEDED" | "PARTIAL";
  readonly inputArtifact: Round0ExtractionInputArtifactRef;
  readonly identityBaselineId: string;
  readonly baselineSeriesKey: string;
  readonly baselineVersion: number;
  readonly expectedCoverageCount: number;
  readonly coverage: readonly Round0BureauCoverageSourceRef[];
  readonly expectedCompletenessCount: number;
  readonly completenessMembers: readonly Round0SourceCompletenessEvidenceRef[];
  readonly expectedAccountMemberCount: number;
  readonly accountMembers: readonly Round0SourceListedAccountMember[];
  readonly expectedIdentityFactCount: number;
  readonly identityFacts: readonly Round0IdentityFactSourceMember[];
}

export interface Round0SourceSealVerifier {
  readonly verifierId: string;
  verifyExactRound0SourceSnapshot(input: {
    readonly snapshot: Round0SourceSnapshot;
    readonly sourceSetSha256: string;
  }): Promise<boolean>;
}

const VERIFIED_ROUND0_SOURCE_SEAL = Symbol("verified-round0-source-seal");
const verifiedSourceSealIdentities = new WeakSet<object>();
const verifiedSourceSealDigests = new WeakMap<object, string>();

export interface VerifiedRound0SourceSeal extends Round0SourceSnapshot {
  readonly sourceSetSha256: string;
  readonly verifierId: string;
  readonly [VERIFIED_ROUND0_SOURCE_SEAL]: true;
}

const SHA256 = /^[0-9a-f]{64}$/;
const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const MAX_COVERAGE = 3;
const COMPLETENESS_CATEGORIES = [
  ...ROUND0_SOURCE_IDENTITY_CATEGORY_KEYS,
  "UNRECOGNIZED_ACCOUNT",
] as const;
const EXPECTED_COMPLETENESS_COUNT = MAX_COVERAGE * COMPLETENESS_CATEGORIES.length;
const MAX_ACCOUNT_MEMBERS = 1_024;
const MAX_IDENTITY_FACTS = 1_024;

function nonEmptyStable(value: unknown): value is string {
  // These are authenticated repository IDs/tokens, often hexadecimal. Numeric
  // runs inside an opaque digest are not consumer values and cannot be screened
  // with a PII-looking regex without nondeterministically rejecting valid IDs.
  return typeof value === "string" && STABLE.test(value);
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

const ROUND0_SOURCE_SNAPSHOT_KEYS = [
  "contractVersion",
  "repositoryReadId",
  "tenantId",
  "consumerId",
  "reportIngestionId",
  "reportVersionId",
  "reportSeriesKey",
  "reportVersion",
  "reportSourceSha256",
  "sourceArtifact",
  "extractionRunId",
  "extractionStatus",
  "inputArtifact",
  "identityBaselineId",
  "baselineSeriesKey",
  "baselineVersion",
  "expectedCoverageCount",
  "coverage",
  "expectedCompletenessCount",
  "completenessMembers",
  "expectedAccountMemberCount",
  "accountMembers",
  "expectedIdentityFactCount",
  "identityFacts",
] as const;

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function validBureau(value: unknown): value is Bureau {
  return (
    value === "EQUIFAX" ||
    value === "EXPERIAN" ||
    value === "TRANSUNION"
  );
}

function canonical(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite source seal value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value !== "object") {
    throw new Error("non-JSON source seal value");
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function validInputArtifact(
  value: unknown,
): value is Round0ExtractionInputArtifactRef {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Round0ExtractionInputArtifactRef;
  return (
    Object.keys(artifact).length === 5 &&
    nonEmptyStable(artifact.artifactId) &&
    positiveInteger(artifact.artifactVersion) &&
    artifact.kind === "NORMALIZED_TEXT" &&
    artifact.representation === "DERIVED_NORMALIZED_TEXT" &&
    SHA256.test(artifact.sha256)
  );
}

function validSourceArtifact(
  value: unknown,
): value is Round0OriginalSourceArtifactRef {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Round0OriginalSourceArtifactRef;
  return (
    exactKeys(artifact, [
      "artifactId",
      "artifactVersion",
      "kind",
      "representation",
      "sha256",
    ]) &&
    nonEmptyStable(artifact.artifactId) &&
    positiveInteger(artifact.artifactVersion) &&
    artifact.kind === "REPORT_SOURCE" &&
    artifact.representation === "ORIGINAL_BYTES" &&
    SHA256.test(artifact.sha256)
  );
}

function validCoverage(
  value: unknown,
): value is Round0BureauCoverageSourceRef {
  if (!value || typeof value !== "object") return false;
  const coverage = value as Round0BureauCoverageSourceRef;
  return (
    Object.keys(coverage).length === 3 &&
    nonEmptyStable(coverage.bureauCoverageId) &&
    validBureau(coverage.bureau) &&
    (coverage.coverageStatus === "COVERED" ||
      coverage.coverageStatus === "OUTSIDE_COVERAGE")
  );
}

function validCompletenessMember(
  value: unknown,
): value is Round0SourceCompletenessEvidenceRef {
  if (!value || typeof value !== "object") return false;
  const member = value as Round0SourceCompletenessEvidenceRef;
  return (
    exactKeys(member, [
      "id",
      "bureau",
      "coverageStatus",
      "bureauCoverageId",
      "identityBaselineId",
      "baselineInputSetSha256",
      "category",
      "status",
      "sourceMemberCount",
      "sourceMembershipSha256",
      "sourceLocatorToken",
      "integritySha256",
      "ruleKey",
      "ruleVersion",
    ]) &&
    nonEmptyStable(member.id) &&
    validBureau(member.bureau) &&
    (member.coverageStatus === "COVERED" ||
      member.coverageStatus === "OUTSIDE_COVERAGE") &&
    nonEmptyStable(member.bureauCoverageId) &&
    nonEmptyStable(member.identityBaselineId) &&
    SHA256.test(member.baselineInputSetSha256) &&
    COMPLETENESS_CATEGORIES.includes(member.category) &&
    ["COMPLETE", "PARTIAL", "FAILED", "NOT_PROVIDED", "UNKNOWN"].includes(
      member.status,
    ) &&
    Number.isSafeInteger(member.sourceMemberCount) &&
    member.sourceMemberCount >= 0 &&
    SHA256.test(member.sourceMembershipSha256) &&
    (member.sourceLocatorToken === null ||
      nonEmptyStable(member.sourceLocatorToken)) &&
    SHA256.test(member.integritySha256) &&
    nonEmptyStable(member.ruleKey) &&
    nonEmptyStable(member.ruleVersion) &&
    (member.coverageStatus === "COVERED"
      ? ((member.status === "COMPLETE" || member.status === "PARTIAL")
          ? member.sourceLocatorToken !== null
          : true)
      : ((member.status === "NOT_PROVIDED" || member.status === "UNKNOWN") &&
        member.sourceMemberCount === 0 &&
        member.sourceLocatorToken === null))
  );
}

function validAccountMember(
  value: unknown,
): value is Round0SourceListedAccountMember {
  if (!value || typeof value !== "object") return false;
  const member = value as Round0SourceListedAccountMember;
  return (
    Object.keys(member).length === 16 &&
    nonEmptyStable(member.reportAccountId) &&
    nonEmptyStable(member.accountId) &&
    Number.isSafeInteger(member.sourceAccountOrdinal) &&
    member.sourceAccountOrdinal >= 0 &&
    member.membershipOrigin === "SOURCE_LISTED" &&
    member.authorityStatus === "SHADOW_V2" &&
    validBureau(member.bureau) &&
    nonEmptyStable(member.bureauCoverageId) &&
    member.coverageStatus === "COVERED" &&
    nonEmptyStable(member.accountPresenceId) &&
    (member.accountPresence === "PRESENT" ||
      member.accountPresence === "UNKNOWN") &&
    nonEmptyStable(member.accountPresenceSeriesKey) &&
    positiveInteger(member.accountPresenceRevision) &&
    SHA256.test(member.accountPresenceIntegritySha256) &&
    (member.accountPresenceSourceLocatorToken === null ||
      nonEmptyStable(member.accountPresenceSourceLocatorToken)) &&
    (member.accountPresence === "UNKNOWN" ||
      member.accountPresenceSourceLocatorToken !== null) &&
    nonEmptyStable(member.accountIndexCompletenessId) &&
    ["COMPLETE", "PARTIAL", "FAILED", "NOT_PROVIDED", "UNKNOWN"].includes(
      member.accountIndexStatus,
    )
  );
}

function validIdentityFact(
  value: unknown,
): value is Round0IdentityFactSourceMember {
  if (!value || typeof value !== "object") return false;
  const fact = value as Round0IdentityFactSourceMember;
  return (
    Object.keys(fact).length === 10 &&
    nonEmptyStable(fact.identityFactId) &&
    nonEmptyStable(fact.factSeriesKey) &&
    Number.isSafeInteger(fact.factOrdinal) &&
    fact.factOrdinal >= 0 &&
    ROUND0_SOURCE_IDENTITY_CATEGORY_KEYS.includes(fact.categoryKey) &&
    validBureau(fact.bureau) &&
    ((fact.presence === "PRESENT" &&
      fact.sourceKind === "SOURCE_REPORTED") ||
      (fact.presence === "UNKNOWN" &&
        fact.sourceKind === "PARSER_UNCERTAINTY")) &&
    fact.classification === "REVIEW_NEEDED" &&
    SHA256.test(fact.integritySha256) &&
    nonEmptyStable(fact.sourceLocatorToken)
  );
}

function compareStrings(
  left: readonly string[],
  right: readonly string[],
): number {
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? "";
    const rightValue = right[index] ?? "";
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return 0;
}

function canonicalCoverage(
  coverage: readonly Round0BureauCoverageSourceRef[],
): readonly Round0BureauCoverageSourceRef[] {
  return Object.freeze(
    coverage
      .map((item) => Object.freeze({ ...item }))
      .sort((left, right) =>
        compareStrings(
          [left.bureau, left.bureauCoverageId],
          [right.bureau, right.bureauCoverageId],
        ),
      ),
  );
}

function canonicalAccountMembers(
  members: readonly Round0SourceListedAccountMember[],
): readonly Round0SourceListedAccountMember[] {
  return Object.freeze(
    members
      .map((item) => Object.freeze({ ...item }))
      .sort(
        (left, right) =>
          left.sourceAccountOrdinal - right.sourceAccountOrdinal ||
          compareStrings(
            [left.bureau, left.reportAccountId, left.accountPresenceId],
            [right.bureau, right.reportAccountId, right.accountPresenceId],
          ),
      ),
  );
}

function canonicalIdentityFacts(
  facts: readonly Round0IdentityFactSourceMember[],
): readonly Round0IdentityFactSourceMember[] {
  return Object.freeze(
    facts
      .map((item) => Object.freeze({ ...item }))
      .sort(
        (left, right) =>
          left.factOrdinal - right.factOrdinal ||
          compareStrings(
            [left.bureau ?? "", left.identityFactId],
            [right.bureau ?? "", right.identityFactId],
          ),
      ),
  );
}

function canonicalCompletenessMembers(
  members: readonly Round0SourceCompletenessEvidenceRef[],
): readonly Round0SourceCompletenessEvidenceRef[] {
  return Object.freeze(
    members
      .map((item) => Object.freeze({ ...item }))
      .sort((left, right) =>
        compareStrings(
          [left.bureau, left.category, left.id],
          [right.bureau, right.category, right.id],
        ),
      ),
  );
}

/**
 * The baseline input-set digest is a derived self-pin: every durable
 * completeness row must equal the final source-set digest, so that one field
 * cannot also participate in the digest preimage. All primary membership,
 * including the exact identityBaselineId, remains in the preimage.
 */
function completenessSourceSealProjection(
  members: readonly Round0SourceCompletenessEvidenceRef[],
): readonly unknown[] {
  return canonicalCompletenessMembers(members).map((member) => ({
    id: member.id,
    bureau: member.bureau,
    coverageStatus: member.coverageStatus,
    bureauCoverageId: member.bureauCoverageId,
    identityBaselineId: member.identityBaselineId,
    category: member.category,
    status: member.status,
    sourceMemberCount: member.sourceMemberCount,
    sourceMembershipSha256: member.sourceMembershipSha256,
    sourceLocatorToken: member.sourceLocatorToken,
    integritySha256: member.integritySha256,
    ruleKey: member.ruleKey,
    ruleVersion: member.ruleVersion,
  }));
}

export function computeRound0CompletenessMembershipSha256(input: {
  readonly category: Round0SourceCompletenessCategory;
  readonly bureau: Bureau;
  readonly accountMembers: readonly Round0SourceListedAccountMember[];
  readonly identityFacts: readonly Round0IdentityFactSourceMember[];
}): string {
  const members =
    input.category === "UNRECOGNIZED_ACCOUNT"
      ? canonicalAccountMembers(
          input.accountMembers.filter((member) => member.bureau === input.bureau),
        )
      : canonicalIdentityFacts(
          input.identityFacts.filter(
            (fact) =>
              fact.bureau === input.bureau &&
              fact.categoryKey === input.category,
          ),
        );
  return sha256(members);
}

export function computeRound0CompletenessSetSha256(
  members: readonly Round0SourceCompletenessEvidenceRef[],
): string {
  if (
    !Array.isArray(members) ||
    members.length !== MAX_COVERAGE ||
    !members.every(validCompletenessMember) ||
    new Set(members.map((member) => member.bureau)).size !== MAX_COVERAGE ||
    new Set(members.map((member) => member.category)).size !== 1
  ) {
    throw new Error("invalid Round 0 completeness set");
  }
  return sha256(canonicalCompletenessMembers(members));
}

export function round0SourceCompletenessSet(
  seal: VerifiedRound0SourceSeal,
  category: Round0SourceCompletenessCategory,
): readonly Round0SourceCompletenessEvidenceRef[] | null {
  if (!isVerifiedRound0SourceSeal(seal)) return null;
  const members = seal.completenessMembers.filter(
    (member) => member.category === category,
  );
  if (members.length !== MAX_COVERAGE) return null;
  return canonicalCompletenessMembers(members);
}

export function round0SourceSealHasCompleteCategory(
  seal: VerifiedRound0SourceSeal,
  category: Round0SourceCompletenessCategory,
): boolean {
  const members = round0SourceCompletenessSet(seal, category);
  if (!members || seal.extractionStatus !== "SUCCEEDED") return false;
  const coverageByBureau = new Map(
    seal.coverage.map((coverage) => [coverage.bureau, coverage]),
  );
  return members.every((member) => {
    const coverage = coverageByBureau.get(member.bureau);
    return Boolean(
      coverage &&
        member.coverageStatus === coverage.coverageStatus &&
        member.bureauCoverageId === coverage.bureauCoverageId &&
        (coverage.coverageStatus === "OUTSIDE_COVERAGE" ||
          (member.status === "COMPLETE" &&
            member.sourceLocatorToken !== null)),
    );
  });
}

function validSourceSnapshot(value: unknown): value is Round0SourceSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Round0SourceSnapshot;
  const exactSnapshot = exactKeys(snapshot, ROUND0_SOURCE_SNAPSHOT_KEYS);
  const exactVerifiedSnapshot =
    verifiedSourceSealIdentities.has(snapshot) &&
    exactKeys(snapshot, [
      ...ROUND0_SOURCE_SNAPSHOT_KEYS,
      "sourceSetSha256",
      "verifierId",
    ]);
  if (
    (!exactSnapshot && !exactVerifiedSnapshot) ||
    snapshot.contractVersion !== ROUND0_SOURCE_SEAL_CONTRACT_VERSION ||
    !nonEmptyStable(snapshot.repositoryReadId) ||
    !nonEmptyStable(snapshot.tenantId) ||
    !nonEmptyStable(snapshot.consumerId) ||
    !nonEmptyStable(snapshot.reportIngestionId) ||
    !nonEmptyStable(snapshot.reportVersionId) ||
    !nonEmptyStable(snapshot.reportSeriesKey) ||
    !positiveInteger(snapshot.reportVersion) ||
    !SHA256.test(snapshot.reportSourceSha256) ||
    !validSourceArtifact(snapshot.sourceArtifact) ||
    snapshot.sourceArtifact.sha256 !== snapshot.reportSourceSha256 ||
    !nonEmptyStable(snapshot.extractionRunId) ||
    (snapshot.extractionStatus !== "SUCCEEDED" &&
      snapshot.extractionStatus !== "PARTIAL") ||
    !validInputArtifact(snapshot.inputArtifact) ||
    !nonEmptyStable(snapshot.identityBaselineId) ||
    !nonEmptyStable(snapshot.baselineSeriesKey) ||
    !positiveInteger(snapshot.baselineVersion) ||
    !Number.isSafeInteger(snapshot.expectedCoverageCount) ||
    snapshot.expectedCoverageCount !== MAX_COVERAGE ||
    !Array.isArray(snapshot.coverage) ||
    snapshot.coverage.length !== snapshot.expectedCoverageCount ||
    !snapshot.coverage.every(validCoverage) ||
    snapshot.expectedCompletenessCount !== EXPECTED_COMPLETENESS_COUNT ||
    !Array.isArray(snapshot.completenessMembers) ||
    snapshot.completenessMembers.length !==
      snapshot.expectedCompletenessCount ||
    !snapshot.completenessMembers.every(validCompletenessMember) ||
    !Number.isSafeInteger(snapshot.expectedAccountMemberCount) ||
    snapshot.expectedAccountMemberCount < 0 ||
    snapshot.expectedAccountMemberCount > MAX_ACCOUNT_MEMBERS ||
    !Array.isArray(snapshot.accountMembers) ||
    snapshot.accountMembers.length !== snapshot.expectedAccountMemberCount ||
    !snapshot.accountMembers.every(validAccountMember) ||
    !Number.isSafeInteger(snapshot.expectedIdentityFactCount) ||
    snapshot.expectedIdentityFactCount < 0 ||
    snapshot.expectedIdentityFactCount > MAX_IDENTITY_FACTS ||
    !Array.isArray(snapshot.identityFacts) ||
    snapshot.identityFacts.length !== snapshot.expectedIdentityFactCount ||
    !snapshot.identityFacts.every(validIdentityFact)
  ) {
    return false;
  }

  const coverageByBureau = new Map(
    snapshot.coverage.map((item) => [item.bureau, item]),
  );
  if (
    coverageByBureau.size !== snapshot.coverage.length ||
    new Set(snapshot.coverage.map((item) => item.bureauCoverageId)).size !==
      snapshot.coverage.length ||
    !(["EQUIFAX", "EXPERIAN", "TRANSUNION"] as const).every((bureau) =>
      coverageByBureau.has(bureau),
    ) ||
    !snapshot.coverage.some((item) => item.coverageStatus === "COVERED")
  ) {
    return false;
  }

  const completenessIdentities = snapshot.completenessMembers.map(
    (member) => `${member.bureau}:${member.category}`,
  );
  if (
    new Set(completenessIdentities).size !== completenessIdentities.length ||
    new Set(
      snapshot.completenessMembers.map((member) => member.id),
    ).size !== snapshot.completenessMembers.length ||
    !(["EQUIFAX", "EXPERIAN", "TRANSUNION"] as const).every((bureau) =>
      COMPLETENESS_CATEGORIES.every((category) =>
        snapshot.completenessMembers.some(
          (member) => member.bureau === bureau && member.category === category,
        ),
      ),
    ) ||
    snapshot.completenessMembers.some((member) => {
      const coverage = coverageByBureau.get(member.bureau);
      const expectedMembershipSha256 =
        computeRound0CompletenessMembershipSha256({
          category: member.category,
          bureau: member.bureau,
          accountMembers: snapshot.accountMembers,
          identityFacts: snapshot.identityFacts,
        });
      const expectedMemberCount =
        member.category === "UNRECOGNIZED_ACCOUNT"
          ? snapshot.accountMembers.filter(
              (account) => account.bureau === member.bureau,
            ).length
          : snapshot.identityFacts.filter(
              (fact) =>
                fact.bureau === member.bureau &&
                fact.categoryKey === member.category,
            ).length;
      return (
        !coverage ||
        member.coverageStatus !== coverage.coverageStatus ||
        member.bureauCoverageId !== coverage.bureauCoverageId ||
        member.identityBaselineId !== snapshot.identityBaselineId ||
        member.sourceMemberCount !== expectedMemberCount ||
        member.sourceMembershipSha256 !== expectedMembershipSha256
      );
    })
  ) {
    return false;
  }

  if (
    new Set(snapshot.accountMembers.map((member) => member.reportAccountId))
      .size !== snapshot.accountMembers.length ||
    new Set(snapshot.accountMembers.map((member) => member.accountId)).size !==
      snapshot.accountMembers.length ||
    new Set(
      snapshot.accountMembers.map((member) => member.sourceAccountOrdinal),
    ).size !== snapshot.accountMembers.length ||
    new Set(snapshot.accountMembers.map((member) => member.accountPresenceId))
      .size !== snapshot.accountMembers.length ||
    new Set(
      snapshot.accountMembers.map(
        (member) => member.accountPresenceSeriesKey,
      ),
    ).size !== snapshot.accountMembers.length ||
    snapshot.accountMembers.some((member) => {
      const coverage = coverageByBureau.get(member.bureau);
      return (
        !coverage ||
        coverage.coverageStatus !== "COVERED" ||
        coverage.bureauCoverageId !== member.bureauCoverageId
      );
    })
  ) {
    return false;
  }

  return (
    new Set(snapshot.identityFacts.map((fact) => fact.identityFactId)).size ===
      snapshot.identityFacts.length &&
    new Set(snapshot.identityFacts.map((fact) => fact.factSeriesKey)).size ===
      snapshot.identityFacts.length &&
    new Set(snapshot.identityFacts.map((fact) => fact.factOrdinal)).size ===
      snapshot.identityFacts.length &&
    snapshot.identityFacts.every((fact) => {
      const coverage = coverageByBureau.get(fact.bureau);
      return Boolean(coverage && coverage.coverageStatus === "COVERED");
    })
  );
}

function freezeSourceSnapshot(
  snapshot: Round0SourceSnapshot,
): Round0SourceSnapshot {
  return Object.freeze({
    ...snapshot,
    inputArtifact: Object.freeze({ ...snapshot.inputArtifact }),
    sourceArtifact: Object.freeze({ ...snapshot.sourceArtifact }),
    coverage: canonicalCoverage(snapshot.coverage),
    completenessMembers: canonicalCompletenessMembers(
      snapshot.completenessMembers,
    ),
    accountMembers: canonicalAccountMembers(snapshot.accountMembers),
    identityFacts: canonicalIdentityFacts(snapshot.identityFacts),
  });
}

function sourceSealProjection(snapshot: Round0SourceSnapshot): unknown {
  return {
    contractVersion: snapshot.contractVersion,
    tenantId: snapshot.tenantId,
    consumerId: snapshot.consumerId,
    reportIngestionId: snapshot.reportIngestionId,
    reportVersionId: snapshot.reportVersionId,
    reportSeriesKey: snapshot.reportSeriesKey,
    reportVersion: snapshot.reportVersion,
    reportSourceSha256: snapshot.reportSourceSha256,
    sourceArtifact: snapshot.sourceArtifact,
    extractionRunId: snapshot.extractionRunId,
    extractionStatus: snapshot.extractionStatus,
    inputArtifact: snapshot.inputArtifact,
    identityBaselineId: snapshot.identityBaselineId,
    baselineSeriesKey: snapshot.baselineSeriesKey,
    baselineVersion: snapshot.baselineVersion,
    expectedCoverageCount: snapshot.expectedCoverageCount,
    coverage: canonicalCoverage(snapshot.coverage),
    expectedCompletenessCount: snapshot.expectedCompletenessCount,
    completenessMembers: completenessSourceSealProjection(
      snapshot.completenessMembers,
    ),
    expectedAccountMemberCount: snapshot.expectedAccountMemberCount,
    accountMembers: canonicalAccountMembers(snapshot.accountMembers),
    expectedIdentityFactCount: snapshot.expectedIdentityFactCount,
    identityFacts: canonicalIdentityFacts(snapshot.identityFacts),
  };
}

export function computeRound0SourceSetSha256(
  snapshot: Round0SourceSnapshot,
): string {
  if (!validSourceSnapshot(snapshot)) {
    throw new Error("invalid Round 0 source snapshot");
  }
  const sourceSetSha256 = sha256(sourceSealProjection(snapshot));
  if (
    snapshot.completenessMembers.some(
      (member) => member.baselineInputSetSha256 !== sourceSetSha256,
    )
  ) {
    throw new Error("Round 0 completeness self-pin mismatch");
  }
  return sourceSetSha256;
}

/** Two-pass builder for the exact derived completeness self-pin. */
export function bindRound0SourceSnapshotInputSetSha256(
  snapshot: Round0SourceSnapshot,
): Round0SourceSnapshot {
  if (!validSourceSnapshot(snapshot)) {
    throw new Error("invalid unbound Round 0 source snapshot");
  }
  const sourceSetSha256 = sha256(sourceSealProjection(snapshot));
  const bound: Round0SourceSnapshot = {
    ...snapshot,
    completenessMembers: snapshot.completenessMembers.map((member) => ({
      ...member,
      baselineInputSetSha256: sourceSetSha256,
    })),
  };
  if (!validSourceSnapshot(bound)) {
    throw new Error("invalid bound Round 0 source snapshot");
  }
  return freezeSourceSnapshot(bound);
}

export async function verifyRound0SourceSnapshot(
  snapshot: Round0SourceSnapshot,
  verifier: Round0SourceSealVerifier,
): Promise<VerifiedRound0SourceSeal | null> {
  if (!validSourceSnapshot(snapshot) || !nonEmptyStable(verifier?.verifierId)) {
    return null;
  }
  const frozen = freezeSourceSnapshot(snapshot);
  const sourceSetSha256 = computeRound0SourceSetSha256(frozen);
  let approved = false;
  try {
    approved = await verifier.verifyExactRound0SourceSnapshot({
      snapshot: frozen,
      sourceSetSha256,
    });
  } catch {
    return null;
  }
  if (!approved) return null;
  const verified = {
    ...frozen,
    sourceSetSha256,
    verifierId: verifier.verifierId,
  } as VerifiedRound0SourceSeal;
  Object.defineProperty(verified, VERIFIED_ROUND0_SOURCE_SEAL, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedSourceSealIdentities.add(verified);
  verifiedSourceSealDigests.set(verified, sourceSetSha256);
  return Object.freeze(verified);
}

export function isVerifiedRound0SourceSeal(
  value: unknown,
): value is VerifiedRound0SourceSeal {
  if (!value || typeof value !== "object") return false;
  const seal = value as VerifiedRound0SourceSeal;
  try {
    return (
      seal[VERIFIED_ROUND0_SOURCE_SEAL] === true &&
      verifiedSourceSealIdentities.has(seal) &&
      verifiedSourceSealDigests.get(seal) === seal.sourceSetSha256 &&
      nonEmptyStable(seal.verifierId) &&
      SHA256.test(seal.sourceSetSha256) &&
      validSourceSnapshot(seal) &&
      computeRound0SourceSetSha256(seal) === seal.sourceSetSha256
    );
  } catch {
    return false;
  }
}

export function findRound0AccountMember(
  seal: VerifiedRound0SourceSeal,
  reportAccountId: string,
  bureau: Bureau,
): Round0SourceListedAccountMember | null {
  if (!isVerifiedRound0SourceSeal(seal)) return null;
  return (
    seal.accountMembers.find(
      (member) =>
        member.reportAccountId === reportAccountId && member.bureau === bureau,
    ) ?? null
  );
}

export const ROUND0_ACCOUNT_SET_ABSENCE_CONTRACT_VERSION =
  "p0-round0-account-set-absence-v1" as const;

export interface Round0AccountSetAbsenceCandidate {
  readonly contractVersion: typeof ROUND0_ACCOUNT_SET_ABSENCE_CONTRACT_VERSION;
  readonly attestationId: string;
  readonly repositoryReadId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly baselineSeriesKey: string;
  readonly baselineVersion: number;
  readonly sourceSetSha256: string;
  readonly expectedCompletenessEvidenceCount: 3;
  readonly completenessEvidence: readonly Round0SourceCompletenessEvidenceRef[];
  readonly sourceCompletenessSha256: string;
  readonly extractionStatus: "SUCCEEDED";
  readonly expectedAccountMemberCount: 0;
  readonly accountMemberIds: readonly [];
  readonly observedAt: string;
}

export interface Round0AccountSetAbsenceEvidence
  extends Round0AccountSetAbsenceCandidate {
  readonly semanticSha256: string;
}

export interface Round0AccountSetAbsenceVerifier {
  readonly verifierId: string;
  verifyExactEmptyRound0AccountSet(input: {
    readonly candidate: Round0AccountSetAbsenceCandidate;
    readonly semanticSha256: string;
    readonly sourceSealSha256: string;
  }): Promise<boolean>;
}

const VERIFIED_EMPTY_ACCOUNT_SET = Symbol("verified-empty-round0-account-set");
const verifiedEmptyAccountSets = new WeakSet<object>();
const verifiedEmptyAccountSetDigests = new WeakMap<object, string>();

export interface VerifiedRound0AccountSetAbsence
  extends Round0AccountSetAbsenceEvidence {
  readonly verifierId: string;
  readonly [VERIFIED_EMPTY_ACCOUNT_SET]: true;
}

const ROUND0_ACCOUNT_SET_ABSENCE_KEYS = [
  "contractVersion",
  "attestationId",
  "repositoryReadId",
  "tenantId",
  "consumerId",
  "reportVersionId",
  "extractionRunId",
  "identityBaselineId",
  "baselineSeriesKey",
  "baselineVersion",
  "sourceSetSha256",
  "expectedCompletenessEvidenceCount",
  "completenessEvidence",
  "sourceCompletenessSha256",
  "extractionStatus",
  "expectedAccountMemberCount",
  "accountMemberIds",
  "observedAt",
] as const;

function validAccountSetAbsenceCandidate(
  value: unknown,
  shape: "CANDIDATE" | "EVIDENCE" | "VERIFIED" = "CANDIDATE",
): value is Round0AccountSetAbsenceCandidate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Round0AccountSetAbsenceCandidate;
  const expectedKeys =
    shape === "CANDIDATE"
      ? ROUND0_ACCOUNT_SET_ABSENCE_KEYS
      : shape === "EVIDENCE"
        ? [...ROUND0_ACCOUNT_SET_ABSENCE_KEYS, "semanticSha256"]
        : [
            ...ROUND0_ACCOUNT_SET_ABSENCE_KEYS,
            "semanticSha256",
            "verifierId",
          ];
  return (
    exactKeys(candidate, expectedKeys) &&
    candidate.contractVersion ===
      ROUND0_ACCOUNT_SET_ABSENCE_CONTRACT_VERSION &&
    nonEmptyStable(candidate.attestationId) &&
    nonEmptyStable(candidate.repositoryReadId) &&
    nonEmptyStable(candidate.tenantId) &&
    nonEmptyStable(candidate.consumerId) &&
    nonEmptyStable(candidate.reportVersionId) &&
    nonEmptyStable(candidate.extractionRunId) &&
    nonEmptyStable(candidate.identityBaselineId) &&
    nonEmptyStable(candidate.baselineSeriesKey) &&
    positiveInteger(candidate.baselineVersion) &&
    SHA256.test(candidate.sourceSetSha256) &&
    candidate.expectedCompletenessEvidenceCount === MAX_COVERAGE &&
    Array.isArray(candidate.completenessEvidence) &&
    candidate.completenessEvidence.length === MAX_COVERAGE &&
    candidate.completenessEvidence.every(validCompletenessMember) &&
    candidate.completenessEvidence.every(
      (member) => member.category === "UNRECOGNIZED_ACCOUNT",
    ) &&
    SHA256.test(candidate.sourceCompletenessSha256) &&
    computeRound0CompletenessSetSha256(candidate.completenessEvidence) ===
      candidate.sourceCompletenessSha256 &&
    candidate.extractionStatus === "SUCCEEDED" &&
    candidate.expectedAccountMemberCount === 0 &&
    Array.isArray(candidate.accountMemberIds) &&
    candidate.accountMemberIds.length === 0 &&
    isStrictIsoInstant(candidate.observedAt)
  );
}

function accountSetAbsenceProjection(
  candidate: Round0AccountSetAbsenceCandidate,
): unknown {
  return {
    contractVersion: candidate.contractVersion,
    attestationId: candidate.attestationId,
    repositoryReadId: candidate.repositoryReadId,
    tenantId: candidate.tenantId,
    consumerId: candidate.consumerId,
    reportVersionId: candidate.reportVersionId,
    extractionRunId: candidate.extractionRunId,
    identityBaselineId: candidate.identityBaselineId,
    baselineSeriesKey: candidate.baselineSeriesKey,
    baselineVersion: candidate.baselineVersion,
    sourceSetSha256: candidate.sourceSetSha256,
    expectedCompletenessEvidenceCount:
      candidate.expectedCompletenessEvidenceCount,
    completenessEvidence: canonicalCompletenessMembers(
      candidate.completenessEvidence,
    ),
    sourceCompletenessSha256: candidate.sourceCompletenessSha256,
    extractionStatus: candidate.extractionStatus,
    expectedAccountMemberCount: candidate.expectedAccountMemberCount,
    accountMemberIds: [],
    observedAt: candidate.observedAt,
  };
}

function absenceMatchesSeal(
  candidate: Round0AccountSetAbsenceCandidate,
  seal: VerifiedRound0SourceSeal,
): boolean {
  return (
    isVerifiedRound0SourceSeal(seal) &&
    round0SourceSealHasCompleteCategory(seal, "UNRECOGNIZED_ACCOUNT") &&
    seal.expectedAccountMemberCount === 0 &&
    seal.accountMembers.length === 0 &&
    candidate.tenantId === seal.tenantId &&
    candidate.consumerId === seal.consumerId &&
    candidate.reportVersionId === seal.reportVersionId &&
    candidate.extractionRunId === seal.extractionRunId &&
    candidate.identityBaselineId === seal.identityBaselineId &&
    candidate.baselineSeriesKey === seal.baselineSeriesKey &&
    candidate.baselineVersion === seal.baselineVersion &&
    candidate.sourceSetSha256 === seal.sourceSetSha256 &&
    candidate.sourceCompletenessSha256 ===
      computeRound0CompletenessSetSha256(
        round0SourceCompletenessSet(seal, "UNRECOGNIZED_ACCOUNT")!,
      ) &&
    sha256(canonicalCompletenessMembers(candidate.completenessEvidence)) ===
      sha256(
        canonicalCompletenessMembers(
          round0SourceCompletenessSet(seal, "UNRECOGNIZED_ACCOUNT")!,
        ),
      )
  );
}

export async function verifyRound0AccountSetAbsence(
  candidate: Round0AccountSetAbsenceCandidate,
  seal: VerifiedRound0SourceSeal,
  verifier: Round0AccountSetAbsenceVerifier,
): Promise<VerifiedRound0AccountSetAbsence | null> {
  if (
    !validAccountSetAbsenceCandidate(candidate) ||
    !absenceMatchesSeal(candidate, seal) ||
    !nonEmptyStable(verifier?.verifierId)
  ) {
    return null;
  }
  const snapshot = Object.freeze({
    ...candidate,
    completenessEvidence: canonicalCompletenessMembers(
      candidate.completenessEvidence,
    ),
    accountMemberIds: Object.freeze([]) as readonly [],
  });
  const semanticSha256 = sha256(accountSetAbsenceProjection(snapshot));
  let approved = false;
  try {
    approved = await verifier.verifyExactEmptyRound0AccountSet({
      candidate: snapshot,
      semanticSha256,
      sourceSealSha256: seal.sourceSetSha256,
    });
  } catch {
    return null;
  }
  if (!approved) return null;
  const verified = {
    ...snapshot,
    semanticSha256,
    verifierId: verifier.verifierId,
  } as VerifiedRound0AccountSetAbsence;
  Object.defineProperty(verified, VERIFIED_EMPTY_ACCOUNT_SET, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedEmptyAccountSets.add(verified);
  verifiedEmptyAccountSetDigests.set(verified, semanticSha256);
  return Object.freeze(verified);
}

export function isVerifiedRound0AccountSetAbsence(
  value: unknown,
  seal?: VerifiedRound0SourceSeal,
): value is VerifiedRound0AccountSetAbsence {
  if (!value || typeof value !== "object") return false;
  const verified = value as VerifiedRound0AccountSetAbsence;
  try {
    return (
      verified[VERIFIED_EMPTY_ACCOUNT_SET] === true &&
      verifiedEmptyAccountSets.has(verified) &&
      verifiedEmptyAccountSetDigests.get(verified) === verified.semanticSha256 &&
      nonEmptyStable(verified.verifierId) &&
      validAccountSetAbsenceCandidate(verified, "VERIFIED") &&
      SHA256.test(verified.semanticSha256) &&
      sha256(accountSetAbsenceProjection(verified)) === verified.semanticSha256 &&
      (seal === undefined || absenceMatchesSeal(verified, seal))
    );
  } catch {
    return false;
  }
}

export function round0AccountSetAbsenceEvidence(
  verified: VerifiedRound0AccountSetAbsence,
): Round0AccountSetAbsenceEvidence {
  if (!isVerifiedRound0AccountSetAbsence(verified)) {
    throw new Error("unverified Round 0 account-set absence");
  }
  return Object.freeze({
    contractVersion: verified.contractVersion,
    attestationId: verified.attestationId,
    repositoryReadId: verified.repositoryReadId,
    tenantId: verified.tenantId,
    consumerId: verified.consumerId,
    reportVersionId: verified.reportVersionId,
    extractionRunId: verified.extractionRunId,
    identityBaselineId: verified.identityBaselineId,
    baselineSeriesKey: verified.baselineSeriesKey,
    baselineVersion: verified.baselineVersion,
    sourceSetSha256: verified.sourceSetSha256,
    expectedCompletenessEvidenceCount: 3,
    completenessEvidence: canonicalCompletenessMembers(
      verified.completenessEvidence,
    ),
    sourceCompletenessSha256: verified.sourceCompletenessSha256,
    extractionStatus: verified.extractionStatus,
    expectedAccountMemberCount: 0,
    accountMemberIds: Object.freeze([]) as readonly [],
    observedAt: verified.observedAt,
    semanticSha256: verified.semanticSha256,
  });
}

export function isValidRound0AccountSetAbsenceEvidence(
  value: unknown,
): value is Round0AccountSetAbsenceEvidence {
  if (!value || typeof value !== "object") return false;
  const evidence = value as Round0AccountSetAbsenceEvidence;
  return (
    validAccountSetAbsenceCandidate(evidence, "EVIDENCE") &&
    SHA256.test(evidence.semanticSha256) &&
    sha256(accountSetAbsenceProjection(evidence)) === evidence.semanticSha256
  );
}
