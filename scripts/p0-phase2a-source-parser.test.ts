import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyP0PrincipalCandidate, p0ScopeFromPrincipal, type P0Principal } from "../lib/creditTruth/principal";
import { attestLocalSyntheticP0Phase2AFlags, evaluateAndMintP0Phase2AGatePermit, verifyP0Phase2ACohortDecision, type P0Phase2AGatePermit } from "../lib/creditTruth/phase2Flags";
import { P0_PHASE2A_READINESS_CONTRACT_VERSION, P0_REPOSITORY_CAPABILITIES, verifyP0RepositoryReadinessReceipt } from "../lib/creditTruth/phase2Readiness";
import {
  P0_LOCAL_SOURCE_PROVIDER_KEY, P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
  computeP0SourceArtifactSha256, createLocalSyntheticP0SourceArtifactProvider,
  createLocalSyntheticP0SourceRetentionState, deriveP0SourceArtifactOperationIdentity,
  computeP0StoredSourceObjectBindingSha256, dispatchP0SourceArtifactRead,
  reconcileP0SourceArtifactUnknownWrite,
  createLocalSyntheticP0SourceErasureRepository, createP0SourceErasureCoordinator,
  dispatchP0SourceArtifactTombstone, dispatchP0SourceArtifactWrite,
  verifyP0SourceArtifactCapability, verifyP0SourceArtifactErasure,
  P0_SOURCE_ERASURE_COORDINATOR_VERSION,
  type P0SourceArtifactProvider, type VerifiedP0SourceArtifactCapability,
  type P0LocalSyntheticSourceRetentionState,
  type VerifiedP0SourceArtifactWriteReceipt,
} from "../lib/creditTruth/sourceArtifact";
import {
  authorizeAndAuditP0SensitiveAccess,
  verifyAndDeriveP0SensitiveAuditRefs,
  verifyP0SensitiveResourceRef,
  type P0SensitiveAccessEventDraft,
  type P0SensitiveAccessKind,
  type P0SensitiveAccessPurposeCode,
  type VerifiedP0SensitiveAccessGrant,
  type VerifiedP0SensitiveResourceRef,
} from "../lib/creditTruth/sensitiveAccessAudit";
import { LocalP0ResourceAdmissionController, P0_DEFAULT_REPORT_RESOURCE_LIMITS, inspectP0ReportSource, validateP0ReportResourceLimits, type P0ResourceLease } from "../lib/creditTruth/reportSourceSafety";
import { extractP0ReportSource, extractP0ReportSourceWithAdmission } from "../lib/creditTruth/reportSourceExtraction";
import {
  P0_PARSER_SHADOW_ENVELOPE_VERSION, P0_ROUND0_COMPLETENESS_CATEGORIES,
  validateP0ParserShadowEnvelope,
  verifyP0ParserShadowEnvelope, type P0ParserShadowEnvelopeCandidate,
  type P0Round0CompletenessEvidence,
} from "../lib/creditTruth/parserShadowEnvelope";
import { adaptP0ParserShadowEnvelope } from "../lib/creditTruth/parserShadowAdapter";
import {
  createLocalSyntheticP0ShadowTruthGraphRepository,
  createLocalSyntheticP0ShadowValueProtector,
  createP0ShadowExtractionService,
} from "../lib/creditTruth/shadowExtractionService";
import type {
  P0ReportIngestion,
  P0ReportVersionCommitReadback,
} from "../lib/creditTruth/reportIngestion";
import {
  P0_LOCAL_REPOSITORY_ID,
  P0_LOCAL_REPOSITORY_SEMANTICS_VERSION,
  verifyLocalP0RepositoryReadback,
  type VerifiedP0RepositoryAttestation,
} from "../lib/creditTruth/repositoryAttestation";

process.env.P0_PHASE2_ENABLED = "true";
process.env.P0_INGESTION_SHADOW_ENABLED = "true";
process.env.P0_PHASE2_KILL_SWITCH = "false";

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) { await run(); passed += 1; process.stdout.write(`ok ${passed} - ${name}\n`); }
async function principal(): Promise<P0Principal> { const value = await verifyP0PrincipalCandidate({ actorId: "parser-worker", tenantId: "consumer-parser", consumerId: "consumer-parser", authorizationKind: "SYSTEM_WORKER", authorizationVersion: "worker-v2" }, { verifyCandidate: async () => true }); assert(value); return value; }
async function gate(authenticated: P0Principal, operationId: string, now: Date): Promise<P0Phase2AGatePermit> {
  const scope = p0ScopeFromPrincipal(authenticated); const issuedAt = new Date(now.getTime() - 5_000).toISOString(); const expiresAt = new Date(now.getTime() + 120_000).toISOString(); const migrationSha256 = "d".repeat(64);
  const repositoryReceipt = await verifyP0RepositoryReadinessReceipt({ contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION, receiptId: `receipt-${operationId}`, receiptKind: "LOCAL_SYNTHETIC", repositoryAdapterId: "local", repositoryAdapterVersion: "v1", codeRevision: "local", migrationSha256, semanticsVersion: "v1", capabilities: P0_REPOSITORY_CAPABILITIES, issuedAt, expiresAt }, { verifierId: "local", verifyRepositoryReceipt: async () => true }); assert(repositoryReceipt);
  const cohortDecision = await verifyP0Phase2ACohortDecision({ contractVersion: "p0-phase2a-flags-v1", decisionId: `cohort-${operationId}`, stage: "INGESTION_SHADOW", actorId: authenticated.actorId, tenantId: scope.tenantId, consumerId: scope.consumerId, authorizationKind: authenticated.authorizationKind, authorizationVersion: authenticated.authorizationVersion, cohortVersion: "v1", included: true, decidedAt: issuedAt, expiresAt }, { resolverId: "local", verifyServerResolvedCohort: async () => true }); assert(cohortDecision);
  const flags = await attestLocalSyntheticP0Phase2AFlags({ phase2Enabled: true, killSwitchEngaged: false, ingestionShadowEnabled: true, round0ReviewEnabled: false, assertionRuntimeEnabled: false }, { attestorId: "local-test-flags", verifyLocalSyntheticFlags: async () => true }); assert(flags);
  const permit = evaluateAndMintP0Phase2AGatePermit({ stage: "INGESTION_SHADOW", mode: "LOCAL_BUILD", operationId, flags, principal: authenticated, scope, cohortDecision, readinessEvidence: { migrationVerified: true, migrationSha256, principalBoundaryVerified: true, repositoryBoundaryVerified: true, sourceArtifactBoundaryVerified: true, ingestionBoundaryVerified: true, round0BoundaryVerified: false, assertionBoundaryVerified: false, repositoryReceipt } }); assert(permit); return permit;
}

async function accessGrant(authenticated: P0Principal, input: { artifactId: string; artifactVersion?: number; resourceType?: "REPORT_INGESTION" | "REPORT_SOURCE" | "NORMALIZED_REPORT_TEXT"; accessKind?: P0SensitiveAccessKind; purposeCode?: P0SensitiveAccessPurposeCode; eventKey: string; allow?: boolean; failRepository?: boolean; ttlSeconds?: number }): Promise<{ grant: VerifiedP0SensitiveAccessGrant; resource: VerifiedP0SensitiveResourceRef } | null> {
  const scope = p0ScopeFromPrincipal(authenticated); const accessKind = input.accessKind ?? "WORKER"; const purposeCode = input.purposeCode ?? "INTEGRITY_VERIFICATION"; let audited: P0SensitiveAccessEventDraft | null = null;
  const resource = await verifyP0SensitiveResourceRef({ principal: authenticated, scope, candidate: { resourceType: input.resourceType ?? "NORMALIZED_REPORT_TEXT", resourceId: input.artifactId, resourceVersion: input.artifactVersion ?? 1 }, verifier: { verifierId: "local-resource", verifyResourceRef: async () => true } }); assert(resource);
  const auditRefs = await verifyAndDeriveP0SensitiveAuditRefs({ principal: authenticated, scope, candidate: { operationRef: input.eventKey, eventRef: input.eventKey }, resource, accessKind, purposeCode, verifier: { verifierId: "local-audit-refs", verifyAuditRefs: async () => true } }); assert(auditRefs);
  const result = await authorizeAndAuditP0SensitiveAccess({ principal: authenticated, scope, accessKind, purposeCode, resource, auditRefs, grantTtlSeconds: input.ttlSeconds, authorizer: { authorizeSensitiveAccess: async () => input.allow === false ? ({ allowed: false, reasonCode: "GATE_DISABLED" }) : ({ allowed: true, reasonCode: "AUTHORIZED" }) }, repository: { appendSensitiveAccessEvent: async ({ event }) => { if (input.failRepository) throw new Error("audit unavailable"); audited = event; return { disposition: "CREATED" }; }, readSensitiveAccessEvent: async () => input.failRepository ? null : audited } });
  return result.allowed ? { grant: result.grant, resource } : null;
}

async function storeNormalized(authenticated: P0Principal, ingestionId: string, artifactId: string, operationId: string, content: Uint8Array, provider = createLocalSyntheticP0SourceArtifactProvider(), kind: "NORMALIZED_TEXT" | "ORIGINAL_TEXT" = "NORMALIZED_TEXT", sharedRetention?: P0LocalSyntheticSourceRetentionState): Promise<{ receipt: VerifiedP0SourceArtifactWriteReceipt; provider: P0SourceArtifactProvider; capability: VerifiedP0SourceArtifactCapability; permit: P0Phase2AGatePermit; grant: VerifiedP0SensitiveAccessGrant; resource: VerifiedP0SensitiveResourceRef; retentionState: P0LocalSyntheticSourceRetentionState; sourceOperationId: string }> {
  void artifactId; const now = new Date(); const permit = await gate(authenticated, operationId, now); const principalScope = p0ScopeFromPrincipal(authenticated); const sourceOperationId = `source-${ingestionId}`; const identity = deriveP0SourceArtifactOperationIdentity({ ...principalScope, ingestionId, operationId: sourceOperationId, kind }); const scope = { ...principalScope, ingestionId, artifactId: identity.artifactId, artifactVersion: 1 }; const retentionState = sharedRetention ?? createLocalSyntheticP0SourceRetentionState({ ...principalScope, ingestionId, sourceOperationId, revision: 1, state: "RECEIVED", sourceDisposition: "RETAINED" });
  const access = await accessGrant(authenticated, { artifactId: ingestionId, eventKey: `audit-${operationId}`, resourceType: "REPORT_INGESTION", purposeCode: "REPORT_INGESTION" }); assert(access);
  const capability = await verifyP0SourceArtifactCapability({ scope, purpose: "STORE_SOURCE", actorId: authenticated.actorId, authorizationDecisionId: operationId, authorizationVersion: authenticated.authorizationVersion, issuedAt: new Date(now.getTime() - 1_000).toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString() }, { verifyDecision: async () => true }, { principal: authenticated, permit, operationId }); assert(capability);
  const result = await dispatchP0SourceArtifactWrite(provider, { contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, selectedProviderKey: P0_LOCAL_SOURCE_PROVIDER_KEY, capability: capability as typeof capability & { purpose: "STORE_SOURCE" }, principal: authenticated, gatePermit: permit, operationId, sourceOperationId, writeFence: retentionState.writeFence, ingestionRevision: 1, sensitiveAccessGrant: access.grant, sensitiveResource: access.resource, sensitiveAccessKind: "WORKER", sensitiveAccessPurposeCode: "REPORT_INGESTION", scope, kind, mimeType: "text/plain", content, sha256: computeP0SourceArtifactSha256(content), byteLength: content.byteLength, idempotencyKey: identity.providerOperationId }); assert(result.ok);
  return { receipt: result.value, provider, capability, permit, grant: access.grant, resource: access.resource, retentionState, sourceOperationId };
}

async function erasureAuthority(authenticated: P0Principal, stored: Awaited<ReturnType<typeof storeNormalized>>, key: string) {
  const now = new Date(); const object = stored.receipt.object; const objectBindingSha256 = computeP0StoredSourceObjectBindingSha256(object);
  const capability = await verifyP0SourceArtifactCapability({ scope: object.scope, purpose: "ERASE_SOURCE", actorId: authenticated.actorId, authorizationDecisionId: key, authorizationVersion: authenticated.authorizationVersion, issuedAt: new Date(now.getTime() - 1_000).toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString() }, { verifyDecision: async () => true }); assert(capability);
  const eligibility = await verifyP0SourceArtifactErasure({ decisionId: key, decisionVersion: "v1", disposition: "DELETE_OR_CRYPTO_SHRED", scope: object.scope, objectBindingSha256, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30_000).toISOString() }, object, { verifyDecision: async () => true }); assert(eligibility);
  return { objectBindingSha256, provider: stored.provider, capability: capability as typeof capability & { purpose: "ERASE_SOURCE" }, eligibility, tombstoneEventKey: key };
}

function envelope(receipt: VerifiedP0SourceArtifactWriteReceipt): P0ParserShadowEnvelopeCandidate {
  const locator = { section: "ACCOUNT_DETAIL" as const, page: 1, lineStart: 2, lineEnd: 3, charStart: 0, charEnd: 18 };
  return {
    contractVersion: P0_PARSER_SHADOW_ENVELOPE_VERSION, parser: "REGEX_V2", parserVersion: "regex-v2.1",
    source: { ingestionId: receipt.object.scope.ingestionId, artifactId: receipt.object.scope.artifactId, artifactVersion: receipt.object.scope.artifactVersion, artifactKind: "NORMALIZED_TEXT", mimeType: "text/plain", sha256: receipt.object.sha256, byteLength: receipt.object.byteLength, normalizationVersion: "newline-preserving-v1" },
    coveredBureaus: ["EQUIFAX"],
    accounts: [{ bureau: "EQUIFAX", account: {
      sourceAccountKey: "source-account-1", creditorName: { presence: "PRESENT", value: "Example Bank", locator },
      bureaus: { EQUIFAX: {
        accountPresence: { presence: "PRESENT", value: true, locator: { ...locator, section: "ACCOUNT_INDEX" } },
        sectionCompleteness: {
          ACCOUNT_INDEX: { state: "COMPLETE", locator: { ...locator, section: "ACCOUNT_INDEX" } }, ACCOUNT_SUMMARY: { state: "COMPLETE", locator: { ...locator, section: "ACCOUNT_SUMMARY" } }, ACCOUNT_DETAIL: { state: "COMPLETE", locator }, PAYMENT_HISTORY: { state: "COMPLETE", locator: { ...locator, section: "PAYMENT_HISTORY" } }, COLLECTIONS: { state: "COMPLETE", locator: { ...locator, section: "COLLECTIONS" } }, REMARKS: { state: "COMPLETE", locator: { ...locator, section: "REMARKS" } },
        },
        fields: {
          summaryStatus: { presence: "PRESENT", value: "Paid as agreed", locator: { ...locator, section: "ACCOUNT_SUMMARY" } },
          balanceCents: { presence: "PRESENT", value: 0, locator: { ...locator, section: "ACCOUNT_SUMMARY" } },
          paymentHistory: { presence: "PRESENT", value: [{ period: "2025-01", rating: "90", daysLate: 90 }], locator: { ...locator, section: "PAYMENT_HISTORY" } },
          chargeOffMarker: { presence: "PRESENT", value: true, locator },
        },
        errors: [{ code: "SOURCE_WARNING", message: "sensitive provider message must never persist", severity: "WARNING" }],
      } },
    } }],
    bureauEvidence: [{ bureau: "EQUIFAX", reportDate: { presence: "PRESENT", precision: "DAY", value: "2026-08-01", sourceLocator: locator }, scores: [{ presence: "PRESENT", occurrence: 0, score: 704, scaleMin: 300, scaleMax: 850, model: { presence: "NOT_PROVIDED", sourceLocator: { ...locator, section: "SCORE_MODEL" } }, sourceLocator: locator, confidence: 0.94 }], identity: [{ presence: "PRESENT", factKey: "former-address-1", factType: "FORMER_ADDRESS", value: "12 Old Road", sourceLocator: locator, confidence: 0.93 }, { presence: "PRESENT", factKey: "phone-1", factType: "PHONE", value: "555-0100", sourceLocator: locator, confidence: 0.91 }], round0Completeness: round0Completeness(locator), errors: [{ code: "SOURCE_WARNING", severity: "WARNING", bureau: "EQUIFAX" }] }],
    status: "SUCCEEDED", safeErrorCodes: ["SOURCE_WARNING"],
  };
}

function round0Completeness(
  locator: { readonly section: "ACCOUNT_DETAIL"; readonly page: number; readonly lineStart: number; readonly lineEnd: number; readonly charStart: number; readonly charEnd: number },
): readonly P0Round0CompletenessEvidence[] {
  return P0_ROUND0_COMPLETENESS_CATEGORIES.map((category) => ({
    category,
    status: "COMPLETE" as const,
    sourceLocator: {
      ...locator,
      section: category === "UNRECOGNIZED_ACCOUNT"
        ? "ACCOUNT_INDEX" as const
        : "REPORT_HEADER" as const,
    },
    ruleKey: "regex-v2-round0-completeness",
    ruleVersion: "regex-v2.1",
  }));
}

function ingestion(receipt: VerifiedP0SourceArtifactWriteReceipt): P0ReportIngestion {
  const now = new Date().toISOString();
  const originalSha256 = receipt.object.sha256;
  const originalArtifactId = `report_source_${createHash("sha256").update(JSON.stringify([receipt.object.scope.ingestionId, originalSha256]), "utf8").digest("hex").slice(0, 40)}`;
  return { contractVersion: "p0-report-ingestion-v1", id: receipt.object.scope.ingestionId, tenantId: receipt.object.scope.tenantId, consumerId: receipt.object.scope.consumerId, actorId: "parser-worker", authorizationKind: "SYSTEM_WORKER", authorizationVersion: "worker-v2", idempotencyKey: "idem-shadow", operationKey: "reserve-shadow", reportSeriesKey: "series-shadow", reservedVersion: 1, sourceSha256: originalSha256, sourceByteLength: receipt.object.byteLength, sourceDeclaredMimeType: "text/plain", sourceDetectedMimeType: "text/plain", sourceStorageProviderKey: receipt.object.providerKey, sourceLocatorCiphertext: receipt.object.locator.ciphertextBase64, sourceLocatorIv: receipt.object.locator.ivBase64, sourceLocatorAuthTag: receipt.object.locator.authTagBase64, sourceLocatorKeyVersion: receipt.object.locator.keyVersion, sourceLocatorAlgorithm: "AES_256_GCM", sourceLocatorEnvelopeVersion: receipt.object.locator.envelopeVersion, sourceLocatorAadVersion: receipt.object.locator.aadVersion, sourceReadbackSha256: receipt.readbackSha256, sourceReadbackByteLength: receipt.readbackByteLength, sourceVerifiedAt: receipt.verifiedAt, sourceDisposition: "RETAINED", sourceDispositionReasonCode: null, sourceDispositionAt: null, state: "EXTRACTING", safeFailureCode: null, revision: 7, attemptCount: 1, maxAttempts: 3, leaseToken: "lease-shadow", leaseOwnerId: "parser-worker", leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(), nextAttemptAt: now, reportVersionId: "report-version-shadow-1", sourceArtifactId: originalArtifactId, extractionRunId: null, createdAt: now, updatedAt: now };
}

async function reportVersionReceipt(
  authenticated: P0Principal,
  row: P0ReportIngestion,
  key: string,
): Promise<VerifiedP0RepositoryAttestation<P0ReportVersionCommitReadback>> {
  assert(row.reportVersionId && row.sourceArtifactId && row.sourceStorageProviderKey);
  const snapshot: P0ReportVersionCommitReadback = Object.freeze({
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    reportSeriesKey: row.reportSeriesKey,
    version: row.reservedVersion,
    inputSha256: row.sourceSha256,
    authorityStatus: "SHADOW_V2",
    sourceArtifact: Object.freeze({
      tenantId: row.tenantId,
      consumerId: row.consumerId,
      artifactId: row.sourceArtifactId,
      artifactVersion: 1,
      artifactKind: "REPORT_SOURCE",
      reportVersionId: row.reportVersionId,
      sha256: row.sourceSha256,
      mimeType: row.sourceDetectedMimeType,
      byteLength: row.sourceByteLength,
      storageProviderKey: row.sourceStorageProviderKey,
      storageLocatorCiphertext: row.sourceLocatorCiphertext!,
      storageLocatorIv: row.sourceLocatorIv!,
      storageLocatorAuthTag: row.sourceLocatorAuthTag!,
      storageLocatorKeyVersion: row.sourceLocatorKeyVersion!,
      storageLocatorAlgorithm: "AES_256_GCM",
      storageLocatorEnvelopeVersion: row.sourceLocatorEnvelopeVersion!,
      storageLocatorAadVersion: row.sourceLocatorAadVersion!,
      createdByActorId: authenticated.actorId,
    }),
  });
  const attestation = await verifyLocalP0RepositoryReadback({
    operationId: `report-version-${key}`,
    purpose: "REPORT_VERSION_COMMIT",
    scope: p0ScopeFromPrincipal(authenticated),
    expectedSnapshot: snapshot,
    readbackSnapshot: structuredClone(snapshot),
    sourceRefs: [{
      resourceType: "REPORT_VERSION",
      resourceId: row.reportVersionId,
      resourceVersion: String(row.reservedVersion),
      integritySha256: row.sourceSha256,
    }],
    verifier: {
      repositoryId: P0_LOCAL_REPOSITORY_ID,
      semanticsVersion: P0_LOCAL_REPOSITORY_SEMANTICS_VERSION,
      verifyReadback: async () => true,
    },
  });
  assert(attestation);
  return attestation;
}

async function main() {
  await check("resource limits reject malformed or unbounded limit objects", () => {
    assert.equal(validateP0ReportResourceLimits({ ...P0_DEFAULT_REPORT_RESOURCE_LIMITS, maxPages: Number.NaN }), false);
    assert.equal(validateP0ReportResourceLimits({ ...P0_DEFAULT_REPORT_RESOURCE_LIMITS, maxTenantConcurrency: P0_DEFAULT_REPORT_RESOURCE_LIMITS.maxGlobalConcurrency + 1 }), false);
  });
  await check("MIME magic encrypted PDFs and polyglots fail closed", () => {
    const mismatch = inspectP0ReportSource({ content: new TextEncoder().encode("plain report"), declaredMimeType: "application/pdf" }); assert(!mismatch.ok); assert.equal(mismatch.code, "MIME_MAGIC_MISMATCH");
    const encrypted = inspectP0ReportSource({ content: new TextEncoder().encode("%PDF-1.4\n/Encrypt 1 0 R\n%%EOF"), declaredMimeType: "application/pdf" }); assert(!encrypted.ok); assert.equal(encrypted.code, "ENCRYPTED_PDF_REJECTED");
    const polyglot = inspectP0ReportSource({ content: new TextEncoder().encode("%PDF-1.4\n<script>x</script>\n%%EOF"), declaredMimeType: "application/pdf" }); assert(!polyglot.ok); assert.equal(polyglot.code, "POLYGLOT_REJECTED");
    const newlinePdf = new TextEncoder().encode("\n%PDF-1.4\n%%EOF"); const newlineAsText = inspectP0ReportSource({ content: newlinePdf, declaredMimeType: "text/plain" }); assert(!newlineAsText.ok); assert.equal(newlineAsText.code, "MIME_MAGIC_MISMATCH"); assert.equal(inspectP0ReportSource({ content: newlinePdf, declaredMimeType: "application/pdf" }).ok, true);
    const bomPdf = new TextEncoder().encode("\uFEFF%PDF-1.4\n%%EOF"); const bomAsText = inspectP0ReportSource({ content: bomPdf, declaredMimeType: "text/plain" }); assert(!bomAsText.ok); assert.equal(bomAsText.code, "MIME_MAGIC_MISMATCH"); assert.equal(inspectP0ReportSource({ content: bomPdf, declaredMimeType: "application/pdf" }).ok, true);
    const embeddedPdf = new TextEncoder().encode(`${"A".repeat(1_100)}%PDF-1.4\n%%EOF`); const embedded = inspectP0ReportSource({ content: embeddedPdf, declaredMimeType: "text/plain" }); assert(!embedded.ok); assert.equal(embedded.code, "MALFORMED_TEXT");
    const embeddedScript = inspectP0ReportSource({ content: new TextEncoder().encode("credit report\n<script>alert(1)</script>"), declaredMimeType: "text/plain" }); assert(!embeddedScript.ok); assert.equal(embeddedScript.code, "MALFORMED_TEXT");
  });
  await check("malformed COMPLETE PDF output cannot be treated as complete", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
    const result = await extractP0ReportSource({ content: pdf, declaredMimeType: "application/pdf", pdfExtractor: { adapterKey: "synthetic", adapterVersion: "1", extract: async () => ({ status: "COMPLETE", text: "", pageCount: 1, decompressedBytes: 1, processingMs: 1, peakMemoryBytes: 1, safeErrorCodes: [] }) } });
    assert.deepEqual(result, { ok: false, kind: "FAILED", code: "MALFORMED_EXTRACTED_TEXT" });
  });
  await check("timeout aborts safely and depends on adapter AbortSignal cooperation", async () => {
    let observedAbort = false; const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF"); const limits = { ...P0_DEFAULT_REPORT_RESOURCE_LIMITS, maxProcessingMs: 1 };
    const result = await extractP0ReportSource({ content: pdf, declaredMimeType: "application/pdf", limits, pdfExtractor: { adapterKey: "abort-aware", adapterVersion: "1", extract: ({ signal }) => new Promise((resolve) => signal.addEventListener("abort", () => { observedAbort = true; resolve({ status: "FAILED", text: "", pageCount: 0, decompressedBytes: 0, processingMs: 1, peakMemoryBytes: 0, safeErrorCodes: [] }); }, { once: true })) } });
    assert.deepEqual(result, { ok: false, kind: "TIMEOUT", code: "PDF_EXTRACTION_TIMEOUT" }); assert.equal(observedAbort, true);
  });
  await check("authorized extraction requires an exact tenant admission and always releases it", async () => {
    const controller = new LocalP0ResourceAdmissionController({ ...P0_DEFAULT_REPORT_RESOURCE_LIMITS, maxProcessingMs: 1 }); const admission = controller.request("tenant-a"); assert.equal(admission.kind, "ADMITTED"); if (admission.kind !== "ADMITTED") return;
    const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF"); const source = { content: pdf, declaredMimeType: "application/pdf", limits: { ...P0_DEFAULT_REPORT_RESOURCE_LIMITS, maxProcessingMs: 1 }, pdfExtractor: { adapterKey: "abort-aware", adapterVersion: "1", extract: ({ signal }: { signal: AbortSignal }) => new Promise<any>((resolve) => signal.addEventListener("abort", () => resolve({ status: "FAILED", text: "", pageCount: 0, decompressedBytes: 0, processingMs: 1, peakMemoryBytes: 0, safeErrorCodes: [] }), { once: true })) } };
    const crossTenant = await extractP0ReportSourceWithAdmission({ tenantId: "tenant-b", controller, lease: admission.lease, source }); assert.equal(crossTenant.ok, false); assert.equal(controller.authorizes(admission.lease, "tenant-a"), true);
    const forged = { ...admission.lease } as P0ResourceLease; const forgedResult = await extractP0ReportSourceWithAdmission({ tenantId: "tenant-a", controller, lease: forged, source }); assert.equal(forgedResult.ok, false);
    const timedOut = await extractP0ReportSourceWithAdmission({ tenantId: "tenant-a", controller, lease: admission.lease, source }); assert.equal(timedOut.ok, false); assert.equal(controller.authorizes(admission.lease, "tenant-a"), false); const next = controller.request("tenant-a"); assert.equal(next.kind, "ADMITTED"); if (next.kind === "ADMITTED") controller.releaseExact(next.lease);
    const ignoredAdmission = controller.request("tenant-ignore"); assert.equal(ignoredAdmission.kind, "ADMITTED"); if (ignoredAdmission.kind !== "ADMITTED") return; let settle!: (value: any) => void; const ignoredSource = { ...source, pdfExtractor: { adapterKey: "abort-ignoring", adapterVersion: "1", extract: async () => new Promise<any>((resolve) => { settle = resolve; }) } }; const ignoredTimeout = await extractP0ReportSourceWithAdmission({ tenantId: "tenant-ignore", controller, lease: ignoredAdmission.lease, source: ignoredSource }); assert.equal(ignoredTimeout.ok, false); assert.equal(controller.authorizes(ignoredAdmission.lease, "tenant-ignore"), true); settle({ status: "FAILED", text: "", pageCount: 0, decompressedBytes: 0, processingMs: 1, peakMemoryBytes: 0, safeErrorCodes: [] }); await new Promise((resolve) => setTimeout(resolve, 0)); assert.equal(controller.authorizes(ignoredAdmission.lease, "tenant-ignore"), false);
  });
  await check("STORE_SOURCE capability cannot be minted without the matching operation gate", async () => {
    const authenticated = await principal(); const now = new Date(); const scope = { ...p0ScopeFromPrincipal(authenticated), ingestionId: "ing-no-gate", artifactId: "artifact-no-gate", artifactVersion: 1 };
    const capability = await verifyP0SourceArtifactCapability({ scope, purpose: "STORE_SOURCE", actorId: authenticated.actorId, authorizationDecisionId: "store-no-gate", authorizationVersion: authenticated.authorizationVersion, issuedAt: new Date(now.getTime() - 1_000).toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString() }, { verifyDecision: async () => true });
    assert.equal(capability, null);
  });
  await check("direct provider calls revalidate authority and cross-purpose reads fail", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-direct", "artifact-direct", "store-direct", new TextEncoder().encode("normalized report"));
    await assert.rejects(() => stored.provider.readExact({ contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, capability: stored.capability as typeof stored.capability & { purpose: "READ_SOURCE" }, principal: authenticated, sensitiveAccessGrant: stored.grant, sensitiveResource: stored.resource, sensitiveAccessKind: "WORKER", sensitiveAccessPurposeCode: "INTEGRITY_VERIFICATION", object: stored.receipt.object }));
    const forged = { ...stored.capability } as VerifiedP0SourceArtifactCapability & { purpose: "STORE_SOURCE" };
    await assert.rejects(() => (stored.provider.putImmutable as any)({ contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, selectedProviderKey: P0_LOCAL_SOURCE_PROVIDER_KEY, capability: forged, principal: authenticated, gatePermit: stored.permit, operationId: "store-direct", sourceOperationId: stored.sourceOperationId, writeFence: stored.retentionState.writeFence, ingestionRevision: 1, sensitiveAccessGrant: stored.grant, sensitiveResource: stored.resource, sensitiveAccessKind: "WORKER", sensitiveAccessPurposeCode: "REPORT_INGESTION", scope: stored.receipt.object.scope, kind: "NORMALIZED_TEXT", mimeType: "text/plain", content: new TextEncoder().encode("normalized report"), sha256: stored.receipt.object.sha256, byteLength: stored.receipt.object.byteLength, idempotencyKey: stored.receipt.object.providerOperationId }));
  });
  await check("crash-after-put recovery discovers only the durable exact source operation and byte binding", async () => {
    const authenticated = await principal(); const ingestionId = "ing-orphan-recovery"; const stored = await storeNormalized(authenticated, ingestionId, "ignored-caller-artifact", "initial-source-write", new TextEncoder().encode("recover exact orphan bytes")); const retryOperationId = "retry-source-discovery"; const now = new Date(); const retryPermit = await gate(authenticated, retryOperationId, now); const access = await accessGrant(authenticated, { artifactId: ingestionId, eventKey: "audit-retry-source-discovery", resourceType: "REPORT_INGESTION", purposeCode: "REPORT_INGESTION" }); assert(access); const capability = await verifyP0SourceArtifactCapability({ scope: stored.receipt.object.scope, purpose: "STORE_SOURCE", actorId: authenticated.actorId, authorizationDecisionId: retryOperationId, authorizationVersion: authenticated.authorizationVersion, issuedAt: new Date(now.getTime() - 1_000).toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString() }, { verifyDecision: async () => true }, { principal: authenticated, permit: retryPermit, operationId: retryOperationId }); assert(capability); const recovered = await reconcileP0SourceArtifactUnknownWrite(stored.provider, { contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, selectedProviderKey: P0_LOCAL_SOURCE_PROVIDER_KEY, capability: capability as typeof capability & { purpose: "STORE_SOURCE" }, principal: authenticated, gatePermit: retryPermit, operationId: retryOperationId, sourceOperationId: stored.sourceOperationId, writeFence: stored.retentionState.writeFence, ingestionRevision: 1, sensitiveAccessGrant: access.grant, sensitiveResource: access.resource, sensitiveAccessKind: "WORKER", sensitiveAccessPurposeCode: "REPORT_INGESTION", scope: stored.receipt.object.scope, kind: stored.receipt.object.kind, mimeType: stored.receipt.object.mimeType, sha256: stored.receipt.object.sha256, byteLength: stored.receipt.object.byteLength }); assert(recovered.ok); if (recovered.ok) assert.equal(recovered.value.objectBindingSha256, stored.receipt.objectBindingSha256);
  });
  await check("audit persistence failure or kill denial releases no source bytes", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-audit-deny", "artifact-audit-deny", "store-audit-deny", new TextEncoder().encode("protected bytes")); const now = new Date();
    const readCapability = await verifyP0SourceArtifactCapability({ scope: stored.receipt.object.scope, purpose: "READ_SOURCE", actorId: authenticated.actorId, authorizationDecisionId: "read-audit-deny", authorizationVersion: authenticated.authorizationVersion, issuedAt: new Date(now.getTime() - 1_000).toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString() }, { verifyDecision: async () => true }); assert(readCapability);
    const failedAudit = await accessGrant(authenticated, { artifactId: stored.receipt.object.scope.artifactId, eventKey: "audit-repository-failed", failRepository: true }); assert.equal(failedAudit, null);
    const killed = await accessGrant(authenticated, { artifactId: stored.receipt.object.scope.artifactId, eventKey: "audit-kill-denied", allow: false }); assert.equal(killed, null);
    const denied = await dispatchP0SourceArtifactRead(stored.provider, { contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, capability: readCapability as typeof readCapability & { purpose: "READ_SOURCE" }, principal: authenticated, sensitiveAccessGrant: failedAudit as unknown as VerifiedP0SensitiveAccessGrant, sensitiveResource: stored.resource, sensitiveAccessKind: "DECRYPT", sensitiveAccessPurposeCode: "INTEGRITY_VERIFICATION", object: stored.receipt.object });
    assert.equal(denied.ok, false); if (!denied.ok) assert.equal(denied.code, "INVALID_SOURCE_READ");
  });
  await check("source read grant is exact to actor scope purpose resource version and live time", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-grant", "artifact-grant", "store-grant", new TextEncoder().encode("protected exact bytes")); const now = new Date();
    const readCapability = await verifyP0SourceArtifactCapability({ scope: stored.receipt.object.scope, purpose: "READ_SOURCE", actorId: authenticated.actorId, authorizationDecisionId: "read-grant", authorizationVersion: authenticated.authorizationVersion, issuedAt: new Date(now.getTime() - 1_000).toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString() }, { verifyDecision: async () => true }); assert(readCapability);
    const exactGrant = await accessGrant(authenticated, { artifactId: stored.receipt.object.scope.artifactId, eventKey: "audit-read-exact", accessKind: "DECRYPT" }); assert(exactGrant);
    const exact = await dispatchP0SourceArtifactRead(stored.provider, { contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, capability: readCapability as typeof readCapability & { purpose: "READ_SOURCE" }, principal: authenticated, sensitiveAccessGrant: exactGrant.grant, sensitiveResource: exactGrant.resource, sensitiveAccessKind: "DECRYPT", sensitiveAccessPurposeCode: "INTEGRITY_VERIFICATION", object: stored.receipt.object }); assert(exact.ok);
    const substituted = await accessGrant(authenticated, { artifactId: "artifact-substituted", eventKey: "audit-read-substituted", accessKind: "DECRYPT" }); assert(substituted);
    const wrongResource = await dispatchP0SourceArtifactRead(stored.provider, { contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, capability: readCapability as typeof readCapability & { purpose: "READ_SOURCE" }, principal: authenticated, sensitiveAccessGrant: substituted.grant, sensitiveResource: substituted.resource, sensitiveAccessKind: "DECRYPT", sensitiveAccessPurposeCode: "INTEGRITY_VERIFICATION", object: stored.receipt.object }); assert.equal(wrongResource.ok, false);
    const expired = await accessGrant(authenticated, { artifactId: stored.receipt.object.scope.artifactId, eventKey: "audit-read-expired", accessKind: "DECRYPT", ttlSeconds: 1 }); assert(expired); await new Promise((resolve) => setTimeout(resolve, 1_100));
    const stale = await dispatchP0SourceArtifactRead(stored.provider, { contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, capability: readCapability as typeof readCapability & { purpose: "READ_SOURCE" }, principal: authenticated, sensitiveAccessGrant: expired.grant, sensitiveResource: expired.resource, sensitiveAccessKind: "DECRYPT", sensitiveAccessPurposeCode: "INTEGRITY_VERIFICATION", object: stored.receipt.object }); assert.equal(stale.ok, false);
  });
  await check("capability and erasure authority reject backdating and are rechecked at use", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-expiry", "artifact-expiry", "store-expiry", new TextEncoder().encode("expiry protected")); const now = new Date();
    const backdatedCapability = await verifyP0SourceArtifactCapability({ scope: stored.receipt.object.scope, purpose: "READ_SOURCE", actorId: authenticated.actorId, authorizationDecisionId: "read-backdated", authorizationVersion: authenticated.authorizationVersion, issuedAt: new Date(now.getTime() - 120_000).toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString() }, { verifyDecision: async () => true }); assert.equal(backdatedCapability, null);
    const expiringCapability = await verifyP0SourceArtifactCapability({ scope: stored.receipt.object.scope, purpose: "READ_SOURCE", actorId: authenticated.actorId, authorizationDecisionId: "read-expiring", authorizationVersion: authenticated.authorizationVersion, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1_000).toISOString() }, { verifyDecision: async () => true }); assert(expiringCapability);
    const readAccess = await accessGrant(authenticated, { artifactId: stored.receipt.object.scope.artifactId, eventKey: "audit-expiring-capability", accessKind: "DECRYPT" }); assert(readAccess); await new Promise((resolve) => setTimeout(resolve, 1_100));
    const expiredRead = await dispatchP0SourceArtifactRead(stored.provider, { contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, capability: expiringCapability as typeof expiringCapability & { purpose: "READ_SOURCE" }, principal: authenticated, sensitiveAccessGrant: readAccess.grant, sensitiveResource: readAccess.resource, sensitiveAccessKind: "DECRYPT", sensitiveAccessPurposeCode: "INTEGRITY_VERIFICATION", object: stored.receipt.object }); assert.equal(expiredRead.ok, false); if (!expiredRead.ok) assert.equal(expiredRead.code, "INVALID_SOURCE_READ");
    const eraseCapability = await verifyP0SourceArtifactCapability({ scope: stored.receipt.object.scope, purpose: "ERASE_SOURCE", actorId: authenticated.actorId, authorizationDecisionId: "erase-expiry", authorizationVersion: authenticated.authorizationVersion, issuedAt: new Date(now.getTime() - 1_000).toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString() }, { verifyDecision: async () => true }); assert(eraseCapability);
    const binding = computeP0StoredSourceObjectBindingSha256(stored.receipt.object);
    const backdatedEligibility = await verifyP0SourceArtifactErasure({ decisionId: "erase-backdated", decisionVersion: "v1", disposition: "DELETE_OR_CRYPTO_SHRED", scope: stored.receipt.object.scope, objectBindingSha256: binding, issuedAt: new Date(now.getTime() - 10_000).toISOString(), expiresAt: new Date(now.getTime() + 10_000).toISOString() }, stored.receipt.object, { verifyDecision: async () => true }); assert.equal(backdatedEligibility, null);
    const eligibility = await verifyP0SourceArtifactErasure({ decisionId: "erase-expiring", decisionVersion: "v1", disposition: "DELETE_OR_CRYPTO_SHRED", scope: stored.receipt.object.scope, objectBindingSha256: binding, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1_000).toISOString() }, stored.receipt.object, { verifyDecision: async () => true }); assert(eligibility); await new Promise((resolve) => setTimeout(resolve, 1_100));
    const result = await dispatchP0SourceArtifactTombstone(stored.provider, { contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, capability: eraseCapability as typeof eraseCapability & { purpose: "ERASE_SOURCE" }, object: stored.receipt.object, eligibility, tombstoneEventKey: "erase-expired-event" }); assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, "INVALID_SOURCE_ERASURE");
  });
  await check("erasure coordinator enumerates original and derived bytes, rejects substitution, and retries idempotently", async () => {
    const authenticated = await principal(); const ingestionId = "ing-erasure-all"; const sharedRetention = createLocalSyntheticP0SourceRetentionState({ ...p0ScopeFromPrincipal(authenticated), ingestionId, sourceOperationId: `source-${ingestionId}`, revision: 1, state: "EXTRACTING", sourceDisposition: "RETAINED" }); const original = await storeNormalized(authenticated, ingestionId, "artifact-original", "store-erasure-original", new TextEncoder().encode("original report"), createLocalSyntheticP0SourceArtifactProvider(), "ORIGINAL_TEXT", sharedRetention); const derived = await storeNormalized(authenticated, ingestionId, "artifact-derived", "store-erasure-derived", new TextEncoder().encode("normalized report"), createLocalSyntheticP0SourceArtifactProvider(), "NORMALIZED_TEXT", sharedRetention); const originalBinding = computeP0StoredSourceObjectBindingSha256(original.receipt.object); const derivedBinding = computeP0StoredSourceObjectBindingSha256(derived.receipt.object);
    const snapshot = { contractVersion: P0_SOURCE_ERASURE_COORDINATOR_VERSION, tenantId: authenticated.tenantId, consumerId: authenticated.consumerId, ingestionId, revision: 1, state: "EXTRACTING" as const, sourceDisposition: "RETAINED" as const, sourceDispositionReasonCode: null, sourceDispositionAt: null, safeFailureCode: null, enumerationComplete: true as const, members: [{ role: "ORIGINAL_SOURCE" as const, extractionRunId: null, object: original.receipt.object, objectBindingSha256: originalBinding }, { role: "DERIVED_NORMALIZED_INPUT" as const, extractionRunId: "run-derived-1", object: derived.receipt.object, objectBindingSha256: derivedBinding }] };
    const repository = createLocalSyntheticP0SourceErasureRepository(snapshot, { retentionState: sharedRetention }); const coordinator = createP0SourceErasureCoordinator(repository); const originalAuthority = await erasureAuthority(authenticated, original, "erase-original"); const derivedAuthority = await erasureAuthority(authenticated, derived, "erase-derived");
    const substitution = await coordinator.erase({ principal: authenticated, ingestionId, operationId: "erase-substitution", authorities: [originalAuthority] }); assert.equal(substitution.ok, false); if (!substitution.ok) assert.equal(substitution.code, "ERASURE_AUTHORITY_SUBSTITUTION");
    const completed = await coordinator.erase({ principal: authenticated, ingestionId, operationId: "erase-complete", authorities: [originalAuthority, derivedAuthority] }); assert(completed.ok); if (!completed.ok) return; assert.equal(completed.tombstones.length, 2); assert.equal(completed.snapshot.sourceDisposition, "OBJECT_DELETED"); assert.equal(completed.snapshot.state, "QUARANTINED");
    const lateIdentity = deriveP0SourceArtifactOperationIdentity({ ...p0ScopeFromPrincipal(authenticated), ingestionId, operationId: `source-${ingestionId}`, kind: "NORMALIZED_TEXT" }); const lateFence = await sharedRetention.writeFence.runWhileRetained({ principal: authenticated, scope: { ...p0ScopeFromPrincipal(authenticated), ingestionId, artifactId: lateIdentity.artifactId, artifactVersion: 1 }, ingestionRevision: completed.snapshot.revision, operationId: "late-store-after-quarantine", sourceOperationId: `source-${ingestionId}`, execute: async () => true }); assert.equal(lateFence.kind, "DENIED");
    const replay = await coordinator.erase({ principal: authenticated, ingestionId, operationId: "erase-replay", authorities: [originalAuthority, derivedAuthority] }); assert(replay.ok); if (replay.ok) assert.equal(replay.kind, "IDEMPOTENT_REPLAY");
  });
  await check("ambiguous provider erasure becomes OUTCOME_UNKNOWN and exact retry reconciles remaining objects", async () => {
    const authenticated = await principal(); const ingestionId = "ing-erasure-unknown"; const sharedRetention = createLocalSyntheticP0SourceRetentionState({ ...p0ScopeFromPrincipal(authenticated), ingestionId, sourceOperationId: `source-${ingestionId}`, revision: 1, state: "EXTRACTING", sourceDisposition: "RETAINED" }); const original = await storeNormalized(authenticated, ingestionId, "artifact-original-unknown", "store-original-unknown", new TextEncoder().encode("original unknown"), createLocalSyntheticP0SourceArtifactProvider(), "ORIGINAL_TEXT", sharedRetention); const derived = await storeNormalized(authenticated, ingestionId, "artifact-derived-unknown", "store-derived-unknown", new TextEncoder().encode("derived unknown"), createLocalSyntheticP0SourceArtifactProvider(), "NORMALIZED_TEXT", sharedRetention); const originalBinding = computeP0StoredSourceObjectBindingSha256(original.receipt.object); const derivedBinding = computeP0StoredSourceObjectBindingSha256(derived.receipt.object); const snapshot = { contractVersion: P0_SOURCE_ERASURE_COORDINATOR_VERSION, tenantId: authenticated.tenantId, consumerId: authenticated.consumerId, ingestionId, revision: 1, state: "EXTRACTING" as const, sourceDisposition: "RETAINED" as const, sourceDispositionReasonCode: null, sourceDispositionAt: null, safeFailureCode: null, enumerationComplete: true as const, members: [{ role: "ORIGINAL_SOURCE" as const, extractionRunId: null, object: original.receipt.object, objectBindingSha256: originalBinding }, { role: "DERIVED_NORMALIZED_INPUT" as const, extractionRunId: "run-derived-unknown", object: derived.receipt.object, objectBindingSha256: derivedBinding }] }; const dispositions: string[] = []; const repository = createLocalSyntheticP0SourceErasureRepository(snapshot, { retentionState: sharedRetention, mutateReadback: (resourceType, value) => { if (resourceType === "ERASURE_SET") dispositions.push((value as { sourceDisposition: string }).sourceDisposition); return value; } }); const coordinator = createP0SourceErasureCoordinator(repository); const originalAuthority = await erasureAuthority(authenticated, original, "erase-original-unknown"); const derivedAuthority = await erasureAuthority(authenticated, derived, "erase-derived-unknown"); const ambiguousProvider = Object.freeze({ ...original.provider, tombstoneExact: async () => { throw new Error("ambiguous provider outcome"); } });
    const ambiguous = await coordinator.erase({ principal: authenticated, ingestionId, operationId: "erase-unknown", authorities: [{ ...originalAuthority, provider: ambiguousProvider }, derivedAuthority] }); assert.equal(ambiguous.ok, false); if (!ambiguous.ok) { assert.equal(ambiguous.kind, "OUTCOME_UNKNOWN"); assert.equal(ambiguous.snapshot?.state, "QUARANTINED"); assert.equal(ambiguous.snapshot?.sourceDisposition, "DISPOSITION_FAILED"); assert.equal(ambiguous.tombstones.length, 1); }
    const reconciled = await coordinator.erase({ principal: authenticated, ingestionId, operationId: "erase-reconcile", authorities: [originalAuthority, derivedAuthority] }); assert(reconciled.ok); if (reconciled.ok) assert.equal(reconciled.tombstones.length, 2); assert.deepEqual(dispositions.filter((value, index) => index === 0 || value !== dispositions[index - 1]), ["RETAINED", "TOMBSTONE_REQUESTED", "DISPOSITION_FAILED", "TOMBSTONE_REQUESTED", "OBJECT_DELETED"]);
  });
  await check("erasure rejects a shaped unbranded enumeration attestation", async () => {
    const authenticated = await principal(); const ingestionId = "ing-erasure-forged"; const stored = await storeNormalized(authenticated, ingestionId, "artifact-erasure-forged", "store-erasure-forged", new TextEncoder().encode("original forged erasure"), createLocalSyntheticP0SourceArtifactProvider(), "ORIGINAL_TEXT"); const binding = computeP0StoredSourceObjectBindingSha256(stored.receipt.object); const snapshot = { contractVersion: P0_SOURCE_ERASURE_COORDINATOR_VERSION, tenantId: authenticated.tenantId, consumerId: authenticated.consumerId, ingestionId, revision: 1, state: "RECEIVED" as const, sourceDisposition: "RETAINED" as const, sourceDispositionReasonCode: null, sourceDispositionAt: null, safeFailureCode: null, enumerationComplete: true as const, members: [{ role: "ORIGINAL_SOURCE" as const, extractionRunId: null, object: stored.receipt.object, objectBindingSha256: binding }] }; const base = createLocalSyntheticP0SourceErasureRepository(snapshot, { retentionState: stored.retentionState }); const forged = Object.freeze({ ...base, readErasureSet: async (input: any) => { const result = await base.readErasureSet(input); return result.kind === "FOUND" ? { ...result, attestation: { ...result.attestation } } : result; } }); const authority = await erasureAuthority(authenticated, stored, "erase-forged-attestation"); const result = await createP0SourceErasureCoordinator(forged as any).erase({ principal: authenticated, ingestionId, operationId: "erase-forged-attestation", authorities: [authority] }); assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, "UNATTESTED_ERASURE_ENUMERATION");
  });
  await check("parser envelope rejects cross-bureau flattening", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-flat", "artifact-flat", "store-flat", new TextEncoder().encode("normalized report")); const candidate = envelope(stored.receipt);
    const account = candidate.accounts[0]!.account;
    const flattened = { ...candidate, accounts: [{ bureau: "EQUIFAX", account: { ...account, bureaus: { ...account.bureaus, EXPERIAN: account.bureaus?.EQUIFAX } } }] } as P0ParserShadowEnvelopeCandidate;
    assert(validateP0ParserShadowEnvelope(flattened).includes("NON_BUREAU_SCOPED_ACCOUNT_INPUT")); assert.equal(verifyP0ParserShadowEnvelope(flattened), null);
  });
  await check("negative-integrity and malformed nested envelopes reject without throwing", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-malformed", "artifact-malformed", "store-malformed", new TextEncoder().encode("normalized report")); const candidate = envelope(stored.receipt);
    const negative = structuredClone(candidate) as any; negative.bureauEvidence[0].scores = [{ presence: "UNKNOWN", occurrence: 0, score: 700 }]; assert(validateP0ParserShadowEnvelope(negative).includes("INVALID_BUREAU_EVIDENCE"));
    const malformed = structuredClone(candidate) as any; malformed.bureauEvidence[0].identity = undefined; assert.doesNotThrow(() => validateP0ParserShadowEnvelope(malformed)); assert(validateP0ParserShadowEnvelope(malformed).length > 0);
    const extra = structuredClone(candidate) as any; extra.source.plaintext = "smuggled"; assert(validateP0ParserShadowEnvelope(extra).includes("INVALID_SOURCE_BINDING"));
    const nestedLocator = structuredClone(candidate) as any; nestedLocator.bureauEvidence[0].reportDate.sourceLocator.plaintext = "smuggled date"; assert(validateP0ParserShadowEnvelope(nestedLocator).includes("INVALID_BUREAU_EVIDENCE"));
    const nestedScore = structuredClone(candidate) as any; nestedScore.bureauEvidence[0].scores[0].inventedModel = "smuggled model"; assert(validateP0ParserShadowEnvelope(nestedScore).includes("INVALID_BUREAU_EVIDENCE"));
    const controlModel = structuredClone(candidate) as any; controlModel.bureauEvidence[0].scores[0].model = { presence: "PRESENT", modelValue: "FICO\nScore 8", sourceLocator: { section: "SCORE_MODEL", page: 1 } }; assert(validateP0ParserShadowEnvelope(controlModel).includes("INVALID_BUREAU_EVIDENCE"));
    const blankModel = structuredClone(candidate) as any; blankModel.bureauEvidence[0].scores[0].model = { presence: "PRESENT", modelValue: "   ", sourceLocator: { section: "SCORE_MODEL", page: 1 } }; assert(validateP0ParserShadowEnvelope(blankModel).includes("INVALID_BUREAU_EVIDENCE"));
    const zeroYear = structuredClone(candidate) as any; zeroYear.bureauEvidence[0].reportDate.value = "0000-08-01"; assert(validateP0ParserShadowEnvelope(zeroYear).includes("INVALID_BUREAU_EVIDENCE"));
    const misroutedError = structuredClone(candidate) as any; misroutedError.bureauEvidence[0].errors = [{ code: "PARSER_WARNING", severity: "WARNING", bureau: "TRANSUNION" }]; assert(validateP0ParserShadowEnvelope(misroutedError).includes("INVALID_BUREAU_EVIDENCE"));
  });
  await check("Round 0 completeness requires an exact nine-category covered-bureau manifest", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-completeness-shape", "artifact-completeness-shape", "store-completeness-shape", new TextEncoder().encode("normalized completeness shape")); const candidate = envelope(stored.receipt);
    const missing = structuredClone(candidate) as any; missing.bureauEvidence[0].round0Completeness.pop(); assert(validateP0ParserShadowEnvelope(missing).includes("INVALID_BUREAU_EVIDENCE"));
    const duplicate = structuredClone(candidate) as any; duplicate.bureauEvidence[0].round0Completeness[8].category = "LEGAL_NAME"; assert(validateP0ParserShadowEnvelope(duplicate).includes("INVALID_BUREAU_EVIDENCE"));
    const noLocator = structuredClone(candidate) as any; delete noLocator.bureauEvidence[0].round0Completeness[0].sourceLocator; assert(validateP0ParserShadowEnvelope(noLocator).includes("INVALID_BUREAU_EVIDENCE"));
    const partialWithoutLocator = structuredClone(candidate) as any; partialWithoutLocator.bureauEvidence[0].round0Completeness[0].status = "PARTIAL"; delete partialWithoutLocator.bureauEvidence[0].round0Completeness[0].sourceLocator; assert(validateP0ParserShadowEnvelope(partialWithoutLocator).includes("INVALID_BUREAU_EVIDENCE"));
    const failedClaim = structuredClone(candidate) as any; failedClaim.status = "FAILED"; assert(validateP0ParserShadowEnvelope(failedClaim).includes("FAILED_EXTRACTION_ASSERTS_COMPLETENESS"));
  });
  await check("covered bureau score state is explicit: present values or one no-score sentinel", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-score-shape", "artifact-score-shape", "store-score-shape", new TextEncoder().encode("normalized report"));
    const noScore = structuredClone(envelope(stored.receipt)) as any; noScore.bureauEvidence[0].scores = [{ presence: "NOT_PROVIDED", occurrence: 0, model: { presence: "NOT_PROVIDED", sourceLocator: { section: "SCORE_MODEL", page: 1 } }, sourceLocator: { section: "SCORE", page: 1 } }]; assert.equal(validateP0ParserShadowEnvelope(noScore).length, 0); const unlocatedNoScore = structuredClone(noScore); delete unlocatedNoScore.bureauEvidence[0].scores[0].sourceLocator; assert(validateP0ParserShadowEnvelope(unlocatedNoScore).includes("INVALID_BUREAU_EVIDENCE"));
    const unlocatedModelAbsence = structuredClone(noScore); delete unlocatedModelAbsence.bureauEvidence[0].scores[0].model.sourceLocator; assert(validateP0ParserShadowEnvelope(unlocatedModelAbsence).includes("INVALID_BUREAU_EVIDENCE"));
    const empty = structuredClone(noScore) as any; empty.bureauEvidence[0].scores = []; assert(validateP0ParserShadowEnvelope(empty).includes("INVALID_BUREAU_EVIDENCE"));
    const mixed = structuredClone(envelope(stored.receipt)) as any; mixed.bureauEvidence[0].scores.push({ presence: "UNKNOWN", occurrence: 1, model: { presence: "UNKNOWN" } }); assert(validateP0ParserShadowEnvelope(mixed).includes("INVALID_BUREAU_EVIDENCE"));
    const missingIndependentModel = structuredClone(noScore) as any; delete missingIndependentModel.bureauEvidence[0].scores[0].model; assert(validateP0ParserShadowEnvelope(missingIndependentModel).includes("INVALID_BUREAU_EVIDENCE"));
    const verifiedNoScore = verifyP0ParserShadowEnvelope(noScore); assert(verifiedNoScore); const operationId = "shadow-explicit-no-score"; const now = new Date(); const row = ingestion(stored.receipt); const persisted = await createP0ShadowExtractionService({ repository: createLocalSyntheticP0ShadowTruthGraphRepository(), protector: createLocalSyntheticP0ShadowValueProtector() }).persist({ principal: authenticated, gatePermit: await gate(authenticated, operationId, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, operationId), inputReceipt: stored.receipt, envelope: verifiedNoScore, operationId, now }); assert(persisted.ok); if (persisted.ok) { const score = persisted.value.creditScoreObservations[0]!; assert.deepEqual([score.presence, score.protectedScore, score.scoreModelPresence, score.scoreModelEvidenceValue], ["NOT_PROVIDED", null, "NOT_PROVIDED", null]); assert(score.sourceLocatorToken); assert(score.scoreModelSourceLocatorToken); assert.notEqual(score.sourceLocatorToken, score.scoreModelSourceLocatorToken); }
  });
  await check("explicit score and model absence locators participate in the parser source seal", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-score-absence-seal", "artifact-score-absence-seal", "store-score-absence-seal", new TextEncoder().encode("normalized score absence seal"));
    const first = structuredClone(envelope(stored.receipt)) as any; first.bureauEvidence[0].scores = [{ presence: "NOT_PROVIDED", occurrence: 0, model: { presence: "NOT_PROVIDED", sourceLocator: { section: "SCORE_MODEL", page: 1, lineStart: 4, lineEnd: 4 } }, sourceLocator: { section: "SCORE", page: 1, lineStart: 3, lineEnd: 3 } }];
    const second = structuredClone(first) as any; second.bureauEvidence[0].scores[0].sourceLocator.lineStart = 30; second.bureauEvidence[0].scores[0].sourceLocator.lineEnd = 30; second.bureauEvidence[0].scores[0].model.sourceLocator.lineStart = 40; second.bureauEvidence[0].scores[0].model.sourceLocator.lineEnd = 40;
    const verifiedFirst = verifyP0ParserShadowEnvelope(first); const verifiedSecond = verifyP0ParserShadowEnvelope(second); assert(verifiedFirst); assert(verifiedSecond);
    const adaptedFirst = adaptP0ParserShadowEnvelope(verifiedFirst); const adaptedSecond = adaptP0ParserShadowEnvelope(verifiedSecond); assert(adaptedFirst.ok); assert(adaptedSecond.ok); if (!adaptedFirst.ok || !adaptedSecond.ok) return;
    assert.notEqual(adaptedFirst.value.sourceSetSha256, adaptedSecond.value.sourceSetSha256);
  });
  await check("verified parser envelopes bind and deep-freeze all nested facts", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-freeze", "artifact-freeze", "store-freeze", new TextEncoder().encode("normalized report")); const verified = verifyP0ParserShadowEnvelope(envelope(stored.receipt)); assert(verified);
    assert(Object.isFrozen(verified.accounts[0]!.account.bureaus!.EQUIFAX!.fields!.summaryStatus));
    assert.throws(() => { (verified.accounts[0]!.account.bureaus!.EQUIFAX!.fields!.summaryStatus as any).value = "mutated"; });
    assert.equal(adaptP0ParserShadowEnvelope(verified).ok, true);
  });
  await check("truth-graph persistence preserves bureau history and source provenance without plaintext/error messages", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-graph", "artifact-graph", "store-graph", new TextEncoder().encode("normalized report graph")); const verified = verifyP0ParserShadowEnvelope(envelope(stored.receipt)); assert(verified); const now = new Date(); const operationId = "shadow-graph-write"; const permit = await gate(authenticated, operationId, now);
    const service = createP0ShadowExtractionService({ repository: createLocalSyntheticP0ShadowTruthGraphRepository(), protector: createLocalSyntheticP0ShadowValueProtector() });
    const row = ingestion(stored.receipt); const result = await service.persist({ principal: authenticated, gatePermit: permit, ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, operationId), inputReceipt: stored.receipt, envelope: verified, operationId, now }); assert(result.ok, JSON.stringify(result)); if (!result.ok) return;
    assert.equal(result.value.bureauCoverage.length, 3); assert.equal(result.value.bureauCoverage.find((item) => item.bureau === "EQUIFAX")?.coverageStatus, "COVERED"); assert.equal(result.value.bureauCoverage.find((item) => item.bureau === "EXPERIAN")?.coverageStatus, "OUTSIDE_COVERAGE");
    assert.equal(result.value.round0SourceCompleteness.length, 27); assert.equal(new Set(result.value.round0SourceCompleteness.map((item) => `${item.bureau}:${item.category}`)).size, 27); const baseline = result.value.identityBaselines[0]!; assert(result.value.round0SourceCompleteness.every((item) => item.identityBaselineId === baseline.id && item.baselineInputSetSha256 === baseline.inputSetSha256)); assert(result.value.round0SourceCompleteness.filter((item) => item.coverageStatus === "OUTSIDE_COVERAGE").every((item) => item.status === "NOT_PROVIDED" && item.sourceMemberCount === 0 && item.sourceLocatorToken === null));
    assert(result.value.historicalEvidence.length > 0); assert.equal(result.value.creditScoreObservations.length, 1); const score = result.value.creditScoreObservations[0]!; assert.equal(score.scoreModelPresence, "NOT_PROVIDED"); assert.equal(score.scoreModelEvidenceValue, null); assert(score.scoreModelSourceLocatorToken); assert.notEqual(score.scoreModelSourceLocatorToken, score.sourceLocatorToken); assert.equal(score.scoreScaleMin, 300); assert.equal(score.scoreScaleMax, 850); assert.deepEqual([score.sourceMethodKey, score.sourceMethodVersion], [result.value.extractionRun.engine, result.value.extractionRun.engineVersion]); assert.equal(score.parserConfidence, 0.94); assert.match(score.integritySha256, /^[a-f0-9]{64}$/); assert.equal(result.value.identityFacts[0]?.classification, "REVIEW_NEEDED"); assert.equal(result.value.identityFacts.find((fact) => fact.reviewCategory === "PHONE")?.factType, "IDENTIFIER"); assert.equal(result.value.extractionRun.inputArtifactId, stored.receipt.object.scope.artifactId); assert.equal(result.value.extractionRun.inputSha256, stored.receipt.object.sha256);
    const durable = JSON.stringify(result.value); assert(!durable.includes("sensitive provider message")); assert(!durable.includes("Paid as agreed")); assert(!durable.includes("12 Old Road")); assert(!durable.includes("555-0100")); assert(!durable.includes('"message"'));
  });
  await check("H1 persists bureau dates and independent score-model evidence losslessly", async () => {
    const authenticated = await principal();
    const stored = await storeNormalized(authenticated, "ing-h1-metadata", "artifact-h1-metadata", "store-h1-metadata", new TextEncoder().encode("normalized h1 metadata"));
    const candidate = structuredClone(envelope(stored.receipt)) as any;
    const scoreLocator = { section: "SCORE", page: 2, lineStart: 10, lineEnd: 10, charStart: 0, charEnd: 3 };
    const modelLocator = { section: "SCORE_MODEL", page: 2, lineStart: 11, lineEnd: 11, charStart: 0, charEnd: 12 };
    const monthLocator = { section: "REPORT_HEADER", page: 1, lineStart: 1, lineEnd: 1, charStart: 0, charEnd: 7 };
    candidate.coveredBureaus = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];
    candidate.bureauEvidence = [
      {
        ...candidate.bureauEvidence[0],
        bureau: "EQUIFAX",
        reportDate: { presence: "PRESENT", precision: "DAY", value: "2026-08-01", sourceLocator: { ...monthLocator, charEnd: 10 } },
        scores: [{ presence: "PRESENT", occurrence: 0, score: 704, scaleMin: 300, scaleMax: 850, model: { presence: "PRESENT", modelValue: "VantageScore 3.0®", sourceLocator: modelLocator }, sourceLocator: scoreLocator, confidence: 0.94 }],
      },
      {
        bureau: "EXPERIAN",
        reportDate: { presence: "PRESENT", precision: "MONTH", value: "2026-07", sourceLocator: monthLocator },
        scores: [{ presence: "PRESENT", occurrence: 0, score: 701, scaleMin: 300, scaleMax: 850, model: { presence: "NOT_PROVIDED", sourceLocator: { ...modelLocator, page: 3 } }, sourceLocator: { ...scoreLocator, page: 3 }, confidence: 0.91 }],
        identity: [],
        round0Completeness: round0Completeness({ ...monthLocator, section: "ACCOUNT_DETAIL", page: 3, lineStart: 1, lineEnd: 1, charStart: 0, charEnd: 7 }),
        errors: [],
      },
      {
        bureau: "TRANSUNION",
        reportDate: { presence: "EXPLICIT_NOT_PROVIDED", precision: "UNKNOWN", sourceLocator: { ...monthLocator, page: 4 } },
        scores: [{ presence: "PRESENT", occurrence: 0, score: 699, scaleMin: 300, scaleMax: 850, model: { presence: "UNKNOWN" }, sourceLocator: { ...scoreLocator, page: 4 }, confidence: 0.89 }],
        identity: [],
        round0Completeness: round0Completeness({ ...monthLocator, section: "ACCOUNT_DETAIL", page: 4, lineStart: 1, lineEnd: 1, charStart: 0, charEnd: 7 }),
        errors: [],
      },
    ];
    const verified = verifyP0ParserShadowEnvelope(candidate); assert(verified);
    const now = new Date(); const operationId = "shadow-h1-metadata";
    const service = createP0ShadowExtractionService({ repository: createLocalSyntheticP0ShadowTruthGraphRepository(), protector: createLocalSyntheticP0ShadowValueProtector() });
    const row = ingestion(stored.receipt); const result = await service.persist({ principal: authenticated, gatePermit: await gate(authenticated, operationId, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, operationId), inputReceipt: stored.receipt, envelope: verified, operationId, now });
    assert(result.ok); if (!result.ok) return;
    assert.equal(result.value.reportDateEvidence.length, 3);
    const equifaxDate = result.value.reportDateEvidence.find((row) => row.bureau === "EQUIFAX")!;
    const experianDate = result.value.reportDateEvidence.find((row) => row.bureau === "EXPERIAN")!;
    const transunionDate = result.value.reportDateEvidence.find((row) => row.bureau === "TRANSUNION")!;
    assert.deepEqual([equifaxDate.sourceValue, equifaxDate.precision, equifaxDate.provenance], ["2026-08-01", "DAY", "SOURCE_REPORTED"]);
    assert.deepEqual([experianDate.sourceValue, experianDate.precision, experianDate.provenance], ["2026-07", "MONTH", "SOURCE_REPORTED"]);
    assert.deepEqual([transunionDate.sourceValue, transunionDate.precision, transunionDate.provenance], [null, "UNKNOWN", "EXPLICIT_NOT_PROVIDED"]); assert(transunionDate.sourceLocatorToken);
    assert(result.value.reportDateEvidence.every((row) => /^[a-f0-9]{64}$/.test(row.integritySha256)));
    const equifaxScore = result.value.creditScoreObservations.find((row) => row.bureau === "EQUIFAX")!;
    const experianScore = result.value.creditScoreObservations.find((row) => row.bureau === "EXPERIAN")!;
    const transunionScore = result.value.creditScoreObservations.find((row) => row.bureau === "TRANSUNION")!;
    assert.equal(equifaxScore.scoreModelPresence, "PRESENT"); assert.equal(equifaxScore.scoreModelEvidenceValue, "VantageScore 3.0®"); assert.deepEqual([equifaxScore.sourceMethodKey, equifaxScore.sourceMethodVersion], ["REGEX_V2", "regex-v2.1"]);
    assert(equifaxScore.scoreModelSourceLocatorToken); assert.notEqual(equifaxScore.scoreModelSourceLocatorToken, equifaxScore.sourceLocatorToken);
    assert.deepEqual([experianScore.presence, experianScore.scoreModelPresence, experianScore.scoreModelEvidenceValue], ["PRESENT", "NOT_PROVIDED", null]); assert(experianScore.scoreModelSourceLocatorToken); assert.notEqual(experianScore.scoreModelSourceLocatorToken, experianScore.sourceLocatorToken);
    assert.deepEqual([transunionScore.presence, transunionScore.scoreModelPresence, transunionScore.scoreModelEvidenceValue], ["PRESENT", "UNKNOWN", null]);
  });
  await check("H1 wrong-bureau or stale extraction metadata cannot pass exact readback", async () => {
    const authenticated = await principal();
    const stored = await storeNormalized(authenticated, "ing-h1-substitution", "artifact-h1-substitution", "store-h1-substitution", new TextEncoder().encode("normalized h1 substitution"));
    const candidate = structuredClone(envelope(stored.receipt)) as any;
    candidate.bureauEvidence[0].reportDate = { presence: "UNKNOWN", precision: "UNKNOWN" };
    candidate.bureauEvidence[0].scores = [{ presence: "UNKNOWN", occurrence: 0, model: { presence: "PRESENT", modelValue: "FICO® Score 8", sourceLocator: { section: "SCORE_MODEL", page: 1 } } }];
    const verified = verifyP0ParserShadowEnvelope(candidate); assert(verified);
    const unknownOperationId = "shadow-h1-unknown-date"; const unknownNow = new Date();
    const unknownRow = ingestion(stored.receipt); const unknown = await createP0ShadowExtractionService({ repository: createLocalSyntheticP0ShadowTruthGraphRepository(), protector: createLocalSyntheticP0ShadowValueProtector() }).persist({ principal: authenticated, gatePermit: await gate(authenticated, unknownOperationId, unknownNow), ingestion: unknownRow, reportVersionReceipt: await reportVersionReceipt(authenticated, unknownRow, unknownOperationId), inputReceipt: stored.receipt, envelope: verified, operationId: unknownOperationId, now: unknownNow });
    assert(unknown.ok); if (unknown.ok) { assert.equal(unknown.value.reportDateEvidence[0]?.presence, "UNKNOWN"); assert.equal(unknown.value.reportDateEvidence[0]?.sourceValue, null); assert.equal(unknown.value.reportDateEvidence[0]?.sourceLocatorToken, null); const score = unknown.value.creditScoreObservations[0]!; assert.deepEqual([score.presence, score.protectedScore, score.scoreModelPresence, score.scoreModelEvidenceValue], ["UNKNOWN", null, "PRESENT", "FICO® Score 8"]); assert(score.scoreModelSourceLocatorToken); }
    const now = new Date(); const wrongBureauOperationId = "shadow-h1-wrong-bureau";
    const wrongBureauRepository = createLocalSyntheticP0ShadowTruthGraphRepository({
      mutateReadback: (value) => ({
        ...value,
        creditScoreObservations: value.creditScoreObservations.map((row, index) => index === 0
          ? { ...row, bureau: "EXPERIAN" }
          : row),
      }),
    });
    const row = ingestion(stored.receipt); const wrongBureau = await createP0ShadowExtractionService({ repository: wrongBureauRepository, protector: createLocalSyntheticP0ShadowValueProtector() }).persist({ principal: authenticated, gatePermit: await gate(authenticated, wrongBureauOperationId, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, wrongBureauOperationId), inputReceipt: stored.receipt, envelope: verified, operationId: wrongBureauOperationId, now });
    assert.equal(wrongBureau.ok, false); if (!wrongBureau.ok) assert.equal(wrongBureau.code, "SHADOW_READBACK_MISMATCH");
    const wrongMethodOperationId = "shadow-h1-wrong-source-method"; const wrongMethodRepository = createLocalSyntheticP0ShadowTruthGraphRepository({ mutateReadback: (value) => ({ ...value, creditScoreObservations: value.creditScoreObservations.map((score, index) => index === 0 ? { ...score, sourceMethodVersion: "substituted-parser-version" } : score) }) }); const wrongMethod = await createP0ShadowExtractionService({ repository: wrongMethodRepository, protector: createLocalSyntheticP0ShadowValueProtector() }).persist({ principal: authenticated, gatePermit: await gate(authenticated, wrongMethodOperationId, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, wrongMethodOperationId), inputReceipt: stored.receipt, envelope: verified, operationId: wrongMethodOperationId, now }); assert.equal(wrongMethod.ok, false); if (!wrongMethod.ok) assert.equal(wrongMethod.code, "SHADOW_READBACK_MISMATCH");
    const staleRunOperationId = "shadow-h1-stale-run"; const staleRunRepository = createLocalSyntheticP0ShadowTruthGraphRepository({ mutateReadback: (value) => ({ ...value, reportDateEvidence: value.reportDateEvidence.map((date, index) => index === 0 ? { ...date, extractionRunId: "stale-extraction-run" } : date) }) }); const staleRun = await createP0ShadowExtractionService({ repository: staleRunRepository, protector: createLocalSyntheticP0ShadowValueProtector() }).persist({ principal: authenticated, gatePermit: await gate(authenticated, staleRunOperationId, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, staleRunOperationId), inputReceipt: stored.receipt, envelope: verified, operationId: staleRunOperationId, now }); assert.equal(staleRun.ok, false); if (!staleRun.ok) assert.equal(staleRun.code, "SHADOW_READBACK_MISMATCH");
  });
  await check("H2 shadow source seal rejects unbranded or substituted original report artifacts", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-h2-source-artifact", "artifact-h2-source-artifact", "store-h2-source-artifact", new TextEncoder().encode("normalized h2 source artifact")); const verified = verifyP0ParserShadowEnvelope(envelope(stored.receipt)); assert(verified); const row = ingestion(stored.receipt); const service = createP0ShadowExtractionService({ repository: createLocalSyntheticP0ShadowTruthGraphRepository(), protector: createLocalSyntheticP0ShadowValueProtector() });
    const unbrandedOperation = "shadow-h2-unbranded-source"; const unbrandedNow = new Date(); const exactReceipt = await reportVersionReceipt(authenticated, row, unbrandedOperation); const unbranded = await service.persist({ principal: authenticated, gatePermit: await gate(authenticated, unbrandedOperation, unbrandedNow), ingestion: row, reportVersionReceipt: { ...exactReceipt } as any, inputReceipt: stored.receipt, envelope: verified, operationId: unbrandedOperation, now: unbrandedNow }); assert.equal(unbranded.ok, false); if (!unbranded.ok) assert.equal(unbranded.code, "SOURCE_REPORT_READBACK_MISMATCH");
    const substitutedOperation = "shadow-h2-substituted-source"; const substitutedNow = new Date(); const substitutedRow = Object.freeze({ ...row, sourceArtifactId: "report_source_substituted" }); const substituted = await service.persist({ principal: authenticated, gatePermit: await gate(authenticated, substitutedOperation, substitutedNow), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, substitutedRow, substitutedOperation), inputReceipt: stored.receipt, envelope: verified, operationId: substitutedOperation, now: substitutedNow }); assert.equal(substituted.ok, false); if (!substituted.ok) assert.equal(substituted.code, "SOURCE_REPORT_READBACK_MISMATCH");
    const digestOperation = "shadow-h2-substituted-digest"; const digestNow = new Date(); const digestRow = Object.freeze({ ...row, sourceSha256: "e".repeat(64), sourceReadbackSha256: "e".repeat(64) }); const digestSubstitution = await service.persist({ principal: authenticated, gatePermit: await gate(authenticated, digestOperation, digestNow), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, digestRow, digestOperation), inputReceipt: stored.receipt, envelope: verified, operationId: digestOperation, now: digestNow }); assert.equal(digestSubstitution.ok, false); if (!digestSubstitution.ok) assert.equal(digestSubstitution.code, "SOURCE_REPORT_READBACK_MISMATCH");
    const selfPinOperation = "shadow-h2-substituted-self-pin"; const selfPinNow = new Date(); const selfPinRepository = createLocalSyntheticP0ShadowTruthGraphRepository({ mutateReadback: (value) => ({ ...value, round0SourceCompleteness: value.round0SourceCompleteness.map((member, index) => index === 0 ? { ...member, baselineInputSetSha256: "f".repeat(64) } : member) }) }); const selfPin = await createP0ShadowExtractionService({ repository: selfPinRepository, protector: createLocalSyntheticP0ShadowValueProtector() }).persist({ principal: authenticated, gatePermit: await gate(authenticated, selfPinOperation, selfPinNow), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, selfPinOperation), inputReceipt: stored.receipt, envelope: verified, operationId: selfPinOperation, now: selfPinNow }); assert.equal(selfPin.ok, false); if (!selfPin.ok) assert.equal(selfPin.code, "SHADOW_READBACK_MISMATCH");
  });
  await check("H2 seals source-listed UNKNOWN account presence without converting uncertainty to absence", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-h2-unknown-account", "artifact-h2-unknown-account", "store-h2-unknown-account", new TextEncoder().encode("normalized unknown account presence")); const candidate = structuredClone(envelope(stored.receipt)) as any; candidate.accounts[0].account.bureaus.EQUIFAX.accountPresence = { presence: "UNKNOWN", reason: "PARSER_SILENCE" }; const verified = verifyP0ParserShadowEnvelope(candidate); assert(verified); const operationId = "shadow-h2-unknown-account"; const now = new Date(); const row = ingestion(stored.receipt); const result = await createP0ShadowExtractionService({ repository: createLocalSyntheticP0ShadowTruthGraphRepository(), protector: createLocalSyntheticP0ShadowValueProtector() }).persist({ principal: authenticated, gatePermit: await gate(authenticated, operationId, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, operationId), inputReceipt: stored.receipt, envelope: verified, operationId, now }); assert(result.ok); if (!result.ok) return; const presence = result.value.accountPresence[0]!; assert.equal(presence.presence, "UNKNOWN"); assert.equal(presence.sourceLocatorToken, null); const membership = result.value.round0SourceCompleteness.find((item) => item.bureau === "EQUIFAX" && item.category === "UNRECOGNIZED_ACCOUNT"); assert(membership); assert.equal(membership.sourceMemberCount, 1); assert(result.value.identityBaselines[0]);
  });
  await check("complete no-identity extraction still creates an immutable DRAFT baseline", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-no-identity", "artifact-no-identity", "store-no-identity", new TextEncoder().encode("normalized no identity")); const candidate = structuredClone(envelope(stored.receipt)) as any; candidate.bureauEvidence[0].identity = []; const verified = verifyP0ParserShadowEnvelope(candidate); assert(verified); const now = new Date(); const operationId = "shadow-no-identity"; const service = createP0ShadowExtractionService({ repository: createLocalSyntheticP0ShadowTruthGraphRepository(), protector: createLocalSyntheticP0ShadowValueProtector() }); const row = ingestion(stored.receipt); const result = await service.persist({ principal: authenticated, gatePermit: await gate(authenticated, operationId, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, operationId), inputReceipt: stored.receipt, envelope: verified, operationId, now }); assert(result.ok); if (result.ok) { assert.equal(result.value.identityBaselines.length, 1); assert.equal(result.value.identityBaselines[0]?.status, "DRAFT"); assert.equal(result.value.identityFacts.length, 0); assert.equal(result.value.round0SourceCompleteness.length, 27); }
  });
  await check("identity baseline series/version is exact to report version and extraction run", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-baseline-series", "artifact-baseline-series", "store-baseline-series", new TextEncoder().encode("normalized baseline series")); const verified = verifyP0ParserShadowEnvelope(envelope(stored.receipt)); assert(verified); const rowA = ingestion(stored.receipt); const rowB = Object.freeze({ ...rowA, reportVersionId: "report-version-shadow-2", reservedVersion: 2, sourceArtifactId: `${rowA.sourceArtifactId}_v2` }); const repository = createLocalSyntheticP0ShadowTruthGraphRepository(); const service = createP0ShadowExtractionService({ repository, protector: createLocalSyntheticP0ShadowValueProtector() }); const now = new Date(); const persist = async (row: P0ReportIngestion, operationId: string) => service.persist({ principal: authenticated, gatePermit: await gate(authenticated, operationId, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, operationId), inputReceipt: stored.receipt, envelope: verified, operationId, now }); const firstRun = await persist(rowA, "baseline-series-run-a"); const secondRun = await persist(rowA, "baseline-series-run-b"); const nextReportRun = await persist(rowB, "baseline-series-run-c"); assert(firstRun.ok); assert(secondRun.ok); assert(nextReportRun.ok); if (!firstRun.ok || !secondRun.ok || !nextReportRun.ok) return; const baselines = [firstRun.value.identityBaselines[0]!, secondRun.value.identityBaselines[0]!, nextReportRun.value.identityBaselines[0]!]; assert.equal(new Set(baselines.map((baseline) => `${baseline.baselineSeriesKey}:${baseline.version}`)).size, 3); assert(baselines.every((baseline) => baseline.version === 1 && baseline.status === "DRAFT"));
  });
  await check("truth-graph exact retry is idempotent and readback mismatch is unknown", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-replay", "artifact-replay", "store-replay", new TextEncoder().encode("normalized replay")); const verified = verifyP0ParserShadowEnvelope(envelope(stored.receipt)); assert(verified); const now = new Date(); const operationId = "shadow-replay"; const permit = await gate(authenticated, operationId, now); const protector = createLocalSyntheticP0ShadowValueProtector(); const repository = createLocalSyntheticP0ShadowTruthGraphRepository(); const service = createP0ShadowExtractionService({ repository, protector }); const row = ingestion(stored.receipt);
    const versionReceipt = await reportVersionReceipt(authenticated, row, operationId); const first = await service.persist({ principal: authenticated, gatePermit: permit, ingestion: row, reportVersionReceipt: versionReceipt, inputReceipt: stored.receipt, envelope: verified, operationId, now }); const replay = await service.persist({ principal: authenticated, gatePermit: permit, ingestion: row, reportVersionReceipt: versionReceipt, inputReceipt: stored.receipt, envelope: verified, operationId, now }); assert(first.ok); assert(replay.ok); if (replay.ok) assert.equal(replay.kind, "IDEMPOTENT_REPLAY");
    const mismatchService = createP0ShadowExtractionService({ repository: createLocalSyntheticP0ShadowTruthGraphRepository({ mutateReadback: (value) => ({ ...value, authorityStatus: "AUTHORITATIVE_V2" as any }) }), protector: createLocalSyntheticP0ShadowValueProtector() }); const mismatchOperation = "shadow-mismatch"; const mismatch = await mismatchService.persist({ principal: authenticated, gatePermit: await gate(authenticated, mismatchOperation, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, mismatchOperation), inputReceipt: stored.receipt, envelope: verified, operationId: mismatchOperation, now }); assert.equal(mismatch.ok, false); if (!mismatch.ok) assert.equal(mismatch.code, "SHADOW_READBACK_MISMATCH");
  });
  await check("shadow persistence rejects shaped unbranded batch and run attestations", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-forged-shadow", "artifact-forged-shadow", "store-forged-shadow", new TextEncoder().encode("normalized forged shadow")); const verified = verifyP0ParserShadowEnvelope(envelope(stored.receipt)); assert(verified); const base = createLocalSyntheticP0ShadowTruthGraphRepository(); const forgedRepository = Object.freeze({ persistExact: async (input: any) => { const result = await base.persistExact(input); return "value" in result ? { ...result, attestation: { ...result.attestation }, extractionRunAttestation: { ...result.extractionRunAttestation } } : result; } }); const operationId = "shadow-forged-attestation"; const now = new Date(); const row = ingestion(stored.receipt); const result = await createP0ShadowExtractionService({ repository: forgedRepository as any, protector: createLocalSyntheticP0ShadowValueProtector() }).persist({ principal: authenticated, gatePermit: await gate(authenticated, operationId, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, operationId), inputReceipt: stored.receipt, envelope: verified, operationId, now }); assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, "SHADOW_READBACK_UNATTESTED");
  });
  await check("FAILED parser timeout persists only exact coverage, uncertainty sentinels, and safe errors", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-failed", "artifact-failed", "store-failed", new TextEncoder().encode("normalized failed")); const candidate = structuredClone(envelope(stored.receipt)) as any; candidate.status = "FAILED"; candidate.accounts = []; candidate.bureauEvidence[0].reportDate = { presence: "UNKNOWN", precision: "UNKNOWN" }; candidate.bureauEvidence[0].scores = [{ presence: "UNKNOWN", occurrence: 0, model: { presence: "UNKNOWN" } }]; candidate.bureauEvidence[0].identity = []; candidate.bureauEvidence[0].round0Completeness = P0_ROUND0_COMPLETENESS_CATEGORIES.map((category) => ({ category, status: "UNKNOWN", ruleKey: "regex-v2-round0-completeness", ruleVersion: "regex-v2.1" })); candidate.bureauEvidence[0].errors = [{ code: "PARSER_TIMEOUT", severity: "ERROR" }]; candidate.safeErrorCodes = ["PARSER_TIMEOUT"]; const verified = verifyP0ParserShadowEnvelope(candidate); assert(verified); const now = new Date(); const operationId = "shadow-failed"; const service = createP0ShadowExtractionService({ repository: createLocalSyntheticP0ShadowTruthGraphRepository(), protector: createLocalSyntheticP0ShadowValueProtector() }); const row = ingestion(stored.receipt); const result = await service.persist({ principal: authenticated, gatePermit: await gate(authenticated, operationId, now), ingestion: row, reportVersionReceipt: await reportVersionReceipt(authenticated, row, operationId), inputReceipt: stored.receipt, envelope: verified, operationId, now }); assert(result.ok); if (!result.ok) return; assert.equal(result.value.extractionRun.status, "FAILED"); assert.equal(result.value.bureauCoverage.length, 3); assert.deepEqual(result.value.accounts, []); assert.deepEqual(result.value.fieldObservations, []); assert.deepEqual(result.value.historicalEvidence, []); assert.equal(result.value.reportDateEvidence.length, 1); assert.deepEqual([result.value.reportDateEvidence[0]?.presence, result.value.reportDateEvidence[0]?.precision, result.value.reportDateEvidence[0]?.sourceValue, result.value.reportDateEvidence[0]?.sourceLocatorToken], ["UNKNOWN", "UNKNOWN", null, null]); assert.deepEqual(result.value.identityBaselines, []); assert.deepEqual(result.value.identityFacts, []); assert.equal(result.value.round0SourceCompleteness.length, 27); assert(result.value.round0SourceCompleteness.every((item) => item.identityBaselineId === null && item.baselineInputSetSha256 === null)); assert(result.value.round0SourceCompleteness.filter((item) => item.coverageStatus === "COVERED").every((item) => item.status === "UNKNOWN" && item.sourceMemberCount === 0 && item.sourceLocatorToken === null)); assert.equal(result.value.creditScoreObservations.length, 1); assert.equal(result.value.creditScoreObservations[0]?.presence, "UNKNOWN"); assert.equal(result.value.creditScoreObservations[0]?.scoreModelPresence, "UNKNOWN"); assert.equal(result.value.creditScoreObservations[0]?.protectedScore, null); assert.equal(result.value.safeErrorRefs[0]?.code, "PARSER_TIMEOUT"); assert.equal(result.value.safeErrorRefs[0]?.bureau, "EQUIFAX");
  });
  await check("FAILED extraction cannot assert score values, explicit absence, or model facts", async () => {
    const authenticated = await principal(); const stored = await storeNormalized(authenticated, "ing-failed-value", "artifact-failed-value", "store-failed-value", new TextEncoder().encode("normalized failed value")); const candidate = structuredClone(envelope(stored.receipt)) as any; candidate.status = "FAILED"; candidate.accounts = []; candidate.bureauEvidence[0].reportDate = { presence: "UNKNOWN", precision: "UNKNOWN" }; candidate.bureauEvidence[0].identity = []; candidate.bureauEvidence[0].round0Completeness = P0_ROUND0_COMPLETENESS_CATEGORIES.map((category) => ({ category, status: "UNKNOWN", ruleKey: "regex-v2-round0-completeness", ruleVersion: "regex-v2.1" })); candidate.safeErrorCodes = ["PARSER_TIMEOUT"]; assert(validateP0ParserShadowEnvelope(candidate).includes("FAILED_EXTRACTION_ASSERTS_SOURCE_FACTS")); assert.equal(verifyP0ParserShadowEnvelope(candidate), null); const absent = structuredClone(candidate); absent.bureauEvidence[0].scores = [{ presence: "NOT_PROVIDED", occurrence: 0, model: { presence: "NOT_PROVIDED", sourceLocator: { section: "SCORE_MODEL", page: 1 } }, sourceLocator: { section: "SCORE", page: 1 } }]; assert(validateP0ParserShadowEnvelope(absent).includes("FAILED_EXTRACTION_ASSERTS_SOURCE_FACTS")); assert.equal(verifyP0ParserShadowEnvelope(absent), null); const modelFact = structuredClone(candidate); modelFact.bureauEvidence[0].scores = [{ presence: "UNKNOWN", occurrence: 0, model: { presence: "PRESENT", modelValue: "FICO® Score 8", sourceLocator: { section: "SCORE_MODEL", page: 1 } } }]; assert(validateP0ParserShadowEnvelope(modelFact).includes("FAILED_EXTRACTION_ASSERTS_SOURCE_FACTS")); assert.equal(verifyP0ParserShadowEnvelope(modelFact), null);
  });

  process.stdout.write(`${passed}/${passed} PASS p0-phase2a-source-parser\n`);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
