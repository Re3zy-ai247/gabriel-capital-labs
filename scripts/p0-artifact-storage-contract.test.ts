import assert from "node:assert/strict";
import {
  ARTIFACT_STORAGE_CONTRACT_VERSION,
  MAX_ARTIFACT_AUTHORITY_MEMBERS,
  MAX_ARTIFACT_ERASURE_DECISION_SECONDS,
  MAX_ARTIFACT_READ_GRANT_SECONDS,
  artifactIntegrityPermitsRelease,
  computeArtifactAuthorityManifestSha256,
  computeArtifactIdempotencyKey,
  computeArtifactMembershipSha256,
  computeArtifactScopeSha256,
  computeArtifactSha256,
  computeArtifactSourceBindingSha256,
  computeStoredArtifactObjectBindingSha256,
  dispatchArtifactIntegrityVerification,
  dispatchArtifactReadGrant,
  dispatchArtifactReadRedemption,
  dispatchArtifactTombstone,
  dispatchImmutableArtifactWrite,
  isStrictIsoInstant,
  validateArtifactIntegrityRequest,
  validateArtifactIntegrityResult,
  validateArtifactReadGrantRequest,
  validateArtifactReadGrantResult,
  validateArtifactReadRedemption,
  validateArtifactTombstoneRequest,
  validateArtifactTombstoneResult,
  validateImmutableArtifactWrite,
  validateImmutableArtifactReadback,
  validateStoredArtifactObject,
  verifyArtifactCapability,
  verifyArtifactErasureEligibility,
  verifyArtifactReadGrant,
  verifyArtifactSourceBinding,
  type ArtifactAccessPurpose,
  type ArtifactAuthorityManifest,
  type ArtifactAuthorizationDecisionVerifier,
  type ArtifactIntegrityRequest,
  type ArtifactIntegrityResult,
  type ArtifactReadGrant,
  type ArtifactReadGrantSignatureVerifier,
  type ArtifactReadGrantRequest,
  type ArtifactReadRedemptionRequest,
  type ArtifactSourceBinding,
  type ArtifactSourceDecisionVerifier,
  type ArtifactStorageProvider,
  type ArtifactStorageScope,
  type ArtifactTombstoneRequest,
  type ArtifactErasureDecisionVerifier,
  type AuthorizedArtifactCapability,
  type ImmutableArtifactWriteRequest,
  type ImmutableArtifactReadbackResult,
  type StoredArtifactObject,
  type VerifiedArtifactCapability,
} from "../lib/creditTruth/artifactStorage";

let passed = 0;
const now = new Date("2026-08-08T16:00:00.000Z");
const encoder = new TextEncoder();
const content = encoder.encode("%PDF-1.7\nsynthetic artifact\n%%EOF");
const contentSha256 = computeArtifactSha256(content);

async function check(name: string, run: () => void | Promise<void>): Promise<void> {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
}

const scope: ArtifactStorageScope = {
  tenantId: "tenant_synthetic",
  consumerId: "consumer_synthetic",
  reportVersionId: "report_version_synthetic",
  caseId: "case_synthetic",
  artifactId: "artifact_synthetic",
  artifactVersion: 1,
};

const sourceBinding: ArtifactSourceBinding = {
  kind: "APPROVED_CANONICAL",
  decisionId: "approval_decision_synthetic",
  sourceVersionId: "correspondence_version_synthetic",
  sourceInputSha256: computeArtifactSha256(encoder.encode("synthetic render input")),
  policyVersion: "policy_synthetic_v1",
};

const authorityMembers = [
  {
    kind: "CORRESPONDENCE_VERSION" as const,
    memberId: "correspondence_version_synthetic",
    ordinal: 0,
    sha256: computeArtifactSha256(encoder.encode("synthetic correspondence member")),
  },
  {
    kind: "ENCLOSURE" as const,
    memberId: "enclosure_version_synthetic",
    ordinal: 1,
    sha256: computeArtifactSha256(encoder.encode("synthetic enclosure member")),
  },
] as const;

const authorityManifest: ArtifactAuthorityManifest = {
  recipient: {
    recipientId: "recipient_synthetic",
    recipientKind: "CRA",
    bureau: "EQUIFAX",
  },
  members: authorityMembers,
  membershipSha256: computeArtifactMembershipSha256(authorityMembers),
};

const verifier: ArtifactAuthorizationDecisionVerifier = {
  async verifyDecision() {
    return true;
  },
};

const sourceVerifier: ArtifactSourceDecisionVerifier = {
  async verifyDecision() {
    return true;
  },
};

const grantVerifier: ArtifactReadGrantSignatureVerifier = {
  async verifyGrant() {
    return true;
  },
};

const erasureVerifier: ArtifactErasureDecisionVerifier = {
  async verifyDecision() {
    return true;
  },
};

function authorization(purpose: ArtifactAccessPurpose, decision: string): AuthorizedArtifactCapability {
  return {
    scope,
    purpose,
    actorId: "actor_synthetic",
    authorizationDecisionId: decision,
    issuedAt: "2026-08-08T15:59:00.000Z",
    expiresAt: "2026-08-08T16:05:00.000Z",
  };
}

async function verified(
  purpose: ArtifactAccessPurpose,
  decision: string,
  allowed: readonly ArtifactAccessPurpose[] = [purpose]
): Promise<VerifiedArtifactCapability> {
  const result = await verifyArtifactCapability(authorization(purpose, decision), scope, allowed, now, verifier);
  assert.ok(result);
  return result;
}

function storedObject(providerKey = "provider_alpha"): StoredArtifactObject {
  return {
    scope,
    providerKey,
    providerObjectVersion: `${providerKey}_version_1`,
    providerLocatorOpaque: `${providerKey}_opaque_locator_1`,
    sha256: contentSha256,
    byteLength: content.byteLength,
    contentKind: "PDF",
    mimeType: "application/pdf",
    sourceBindingSha256: computeArtifactSourceBindingSha256(sourceBinding),
    authorityManifestSha256: computeArtifactAuthorityManifestSha256(authorityManifest),
    encryption: {
      serverSideEncrypted: true,
      algorithm: "PROVIDER-SSE-KMS",
      keyReferenceOpaque: `${providerKey}_key_ref`,
      keyVersion: "key_version_1",
      aadVersion: "artifact-aad-v1",
      encryptionContextSha256: computeArtifactScopeSha256(scope),
    },
    writeDisposition: "CREATED",
    immutable: true,
  };
}

async function main(): Promise<void> {
  const writeCapability = await verified("STORE_CANONICAL", "decision_write_synthetic");
  const approvedSource = await verifyArtifactSourceBinding(
    sourceBinding,
    scope,
    "STORE_CANONICAL",
    sourceVerifier
  );
  assert.ok(approvedSource);
  const validWrite: ImmutableArtifactWriteRequest = {
    contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
    selectedProviderKey: "provider_alpha",
    scope,
    capability: writeCapability,
    content,
    sha256: contentSha256,
    byteLength: content.byteLength,
    contentKind: "PDF",
    mimeType: "application/pdf",
    idempotencyKey: computeArtifactIdempotencyKey(scope, contentSha256),
    sourceBinding: approvedSource,
    authorityManifest,
    writeMode: "CREATE_EXACT_VERSION_ONLY",
    immutability: "REQUIRED",
    serverSideEncryption: "REQUIRED",
    aadVersion: "artifact-aad-v1",
  };

  await check("authorization verifier issues a branded exact-scope capability", () => {
    assert.equal(writeCapability.scope.artifactId, scope.artifactId);
    assert.match(writeCapability.decisionSha256, /^[0-9a-f]{64}$/);
    assert.equal(Object.isFrozen(writeCapability), true);
    assert.equal(Object.isFrozen(writeCapability.scope), true);
  });

  await check("verified capability cannot be retargeted through its caller-owned scope", async () => {
    const callerOwnedScope = { ...scope };
    const candidate = { ...authorization("STORE_CANONICAL", "decision_mutable_scope"), scope: callerOwnedScope };
    const verifiedCandidate = await verifyArtifactCapability(
      candidate,
      callerOwnedScope,
      ["STORE_CANONICAL"],
      now,
      verifier
    );
    assert.ok(verifiedCandidate);
    callerOwnedScope.tenantId = "tenant_retargeted";
    assert.equal(verifiedCandidate.scope.tenantId, scope.tenantId);
    assert.throws(() => {
      (verifiedCandidate.scope as { tenantId: string }).tenantId = "tenant_retargeted";
    }, TypeError);
    const retargetedScope = { ...scope, tenantId: "tenant_retargeted" };
    const retargetedWrite = {
      ...validWrite,
      scope: retargetedScope,
      capability: verifiedCandidate,
      idempotencyKey: computeArtifactIdempotencyKey(retargetedScope, contentSha256),
    };
    assert.ok(validateImmutableArtifactWrite(retargetedWrite, now).includes("INVALID_CAPABILITY"));
  });

  await check("authorization verifier fails closed on a denied decision", async () => {
    const denied = await verifyArtifactCapability(
      authorization("STORE_CANONICAL", "denied_synthetic"),
      scope,
      ["STORE_CANONICAL"],
      now,
      { async verifyDecision() { return false; } }
    );
    assert.equal(denied, null);
  });

  await check("strict artifact instants accept real zoned values only", () => {
    assert.equal(isStrictIsoInstant("2024-02-29T23:59:59.123456789Z"), true);
    assert.equal(isStrictIsoInstant("2026-08-08T12:00:00-04:00"), true);
    for (const invalid of [
      "2026-02-30T00:00:00Z",
      "2025-02-29T00:00:00Z",
      "2026-08-08T16:00:00",
      "2026-08-08",
      "08/08/2026 16:00:00",
      "2026-08-08T16:00:00+14:01",
      "2026-08-08T16:00:00+24:00",
      "2026-08-08T16:00:00-00:00",
      "2026-08-08T16:00:00Z trailing",
      "2026-08-08T24:00:00Z",
    ]) {
      assert.equal(isStrictIsoInstant(invalid), false, invalid);
    }
  });

  await check("impossible or zone-ambiguous capability timestamps are rejected", async () => {
    for (const issuedAt of ["2026-02-30T15:59:00Z", "2026-08-08T15:59:00"] as const) {
      const denied = await verifyArtifactCapability(
        { ...authorization("STORE_CANONICAL", "invalid_time_synthetic"), issuedAt },
        scope,
        ["STORE_CANONICAL"],
        now,
        verifier
      );
      assert.equal(denied, null);
    }
  });

  await check("valid immutable write passes", () => {
    assert.deepEqual(validateImmutableArtifactWrite(validWrite, now), []);
  });

  await check("authority manifest binds exact CRA recipient, bureau, and ordered membership", () => {
    assert.match(computeArtifactAuthorityManifestSha256(authorityManifest), /^[0-9a-f]{64}$/);
    assert.equal(authorityManifest.membershipSha256, computeArtifactMembershipSha256(authorityManifest.members));
  });

  await check("CRA authority without a bureau fails closed", () => {
    const invalid = {
      ...validWrite,
      authorityManifest: {
        ...authorityManifest,
        recipient: { ...authorityManifest.recipient, bureau: null },
      },
    };
    assert.ok(validateImmutableArtifactWrite(invalid as never, now).includes("INVALID_AUTHORITY_MANIFEST"));
  });

  await check("non-CRA authority carrying a recipient bureau fails closed", () => {
    const invalid = {
      ...validWrite,
      authorityManifest: {
        ...authorityManifest,
        recipient: { ...authorityManifest.recipient, recipientKind: "NON_CRA" as const },
      },
    };
    assert.ok(validateImmutableArtifactWrite(invalid as never, now).includes("INVALID_AUTHORITY_MANIFEST"));
  });

  await check("duplicate nested member IDs fail closed", () => {
    const members = [authorityMembers[0], { ...authorityMembers[1], memberId: authorityMembers[0].memberId }] as const;
    const invalid = {
      ...validWrite,
      authorityManifest: {
        ...authorityManifest,
        members,
        membershipSha256: computeArtifactMembershipSha256(members),
      },
    };
    assert.ok(validateImmutableArtifactWrite(invalid as never, now).includes("INVALID_AUTHORITY_MANIFEST"));
  });

  await check("duplicate or non-contiguous nested ordinals fail closed", () => {
    const members = [authorityMembers[0], { ...authorityMembers[1], ordinal: 0 }] as const;
    const invalid = {
      ...validWrite,
      authorityManifest: {
        ...authorityManifest,
        members,
        membershipSha256: computeArtifactMembershipSha256(members),
      },
    };
    assert.ok(validateImmutableArtifactWrite(invalid as never, now).includes("INVALID_AUTHORITY_MANIFEST"));
  });

  await check("sparse authority membership fails as a structured request denial", () => {
    const sparseMembers = new Array(2) as Array<(typeof authorityMembers)[number]>;
    sparseMembers[0] = authorityMembers[0];
    const invalid = {
      ...validWrite,
      authorityManifest: {
        ...authorityManifest,
        members: sparseMembers,
        membershipSha256: "a".repeat(64),
      },
    };
    assert.doesNotThrow(() => validateImmutableArtifactWrite(invalid as never, now));
    assert.ok(validateImmutableArtifactWrite(invalid as never, now).includes("INVALID_AUTHORITY_MANIFEST"));
  });

  await check("unexpected authoritative nested keys fail closed", () => {
    const invalid = {
      ...validWrite,
      authorityManifest: {
        ...authorityManifest,
        recipient: { ...authorityManifest.recipient, unexpected: { arbitrarily: ["nested"] } },
      },
    };
    assert.ok(validateImmutableArtifactWrite(invalid as never, now).includes("INVALID_AUTHORITY_MANIFEST"));
  });

  await check("authority membership is explicitly bounded", () => {
    const members = Array.from({ length: MAX_ARTIFACT_AUTHORITY_MEMBERS + 1 }, (_, ordinal) => ({
      kind: "ENCLOSURE" as const,
      memberId: `enclosure_${ordinal}`,
      ordinal,
      sha256: "a".repeat(64),
    }));
    const invalid = {
      ...validWrite,
      authorityManifest: {
        ...authorityManifest,
        members,
        membershipSha256: computeArtifactMembershipSha256(members),
      },
    };
    assert.ok(validateImmutableArtifactWrite(invalid as never, now).includes("INVALID_AUTHORITY_MANIFEST"));
  });

  await check("verified source approval is immutable and exact-scope bound", async () => {
    assert.equal(Object.isFrozen(approvedSource), true);
    assert.equal(Object.isFrozen(approvedSource.authorizedScope), true);
    const otherScope = {
      ...scope,
      tenantId: "tenant_other",
      consumerId: "consumer_other",
      artifactId: "artifact_other",
    };
    const otherCapabilityCandidate = {
      ...authorization("STORE_CANONICAL", "decision_other_tenant"),
      scope: otherScope,
    };
    const otherCapability = await verifyArtifactCapability(
      otherCapabilityCandidate,
      otherScope,
      ["STORE_CANONICAL"],
      now,
      verifier
    );
    assert.ok(otherCapability);
    const replayedSourceWrite = {
      ...validWrite,
      scope: otherScope,
      capability: otherCapability,
      idempotencyKey: computeArtifactIdempotencyKey(otherScope, contentSha256),
      sourceBinding: approvedSource,
    };
    assert.ok(validateImmutableArtifactWrite(replayedSourceWrite, now).includes("INVALID_SOURCE_BINDING"));
  });

  await check("verified source approval snapshots its caller-owned scope", async () => {
    const callerOwnedScope = { ...scope };
    const verifiedSource = await verifyArtifactSourceBinding(
      sourceBinding,
      callerOwnedScope,
      "STORE_CANONICAL",
      sourceVerifier
    );
    assert.ok(verifiedSource);
    callerOwnedScope.caseId = "case_retargeted";
    assert.equal(verifiedSource.authorizedScope.caseId, scope.caseId);
    assert.throws(() => {
      (verifiedSource.authorizedScope as { caseId: string }).caseId = "case_retargeted";
    }, TypeError);
  });

  await check("structurally forged unverified capability fails", () => {
    const forged = { ...validWrite, capability: authorization("STORE_CANONICAL", "forged") as never };
    assert.ok(validateImmutableArtifactWrite(forged, now).includes("INVALID_CAPABILITY"));
  });

  await check("spread-cloned verified capability loses runtime authority", () => {
    const forged = {
      ...validWrite,
      capability: { ...writeCapability, actorId: "different_actor" } as never,
    };
    assert.ok(validateImmutableArtifactWrite(forged, now).includes("INVALID_CAPABILITY"));
  });

  await check("write digest is computed over exact bytes", () => {
    const invalid = { ...validWrite, sha256: "a".repeat(64) };
    assert.ok(validateImmutableArtifactWrite(invalid, now).includes("CONTENT_DIGEST_MISMATCH"));
  });

  await check("one-byte content change invalidates the approved digest", () => {
    const changed = new Uint8Array(validWrite.content);
    changed[changed.byteLength - 1] ^= 1;
    assert.ok(validateImmutableArtifactWrite({ ...validWrite, content: changed }, now).includes("CONTENT_DIGEST_MISMATCH"));
  });

  await check("content length mismatch fails", () => {
    assert.ok(validateImmutableArtifactWrite({ ...validWrite, byteLength: content.byteLength + 1 }, now).includes("CONTENT_LENGTH_MISMATCH"));
  });

  await check("content kind requires matching magic bytes", () => {
    const invalid = { ...validWrite, contentKind: "PNG" as const, mimeType: "image/png" };
    assert.ok(validateImmutableArtifactWrite(invalid, now).includes("CONTENT_KIND_MISMATCH"));
  });

  await check("content kind requires matching MIME type", () => {
    assert.ok(validateImmutableArtifactWrite({ ...validWrite, mimeType: "image/png" }, now).includes("INVALID_MIME_TYPE"));
  });

  await check("idempotency key is derived from exact scope and digest", () => {
    const otherScope = { ...scope, artifactVersion: 2 };
    const invalid = { ...validWrite, scope: otherScope, capability: writeCapability };
    const errors = validateImmutableArtifactWrite(invalid, now);
    assert.ok(errors.includes("INVALID_CAPABILITY"));
    assert.ok(errors.includes("INVALID_IDEMPOTENCY_KEY"));
  });

  await check("create-only semantics are mandatory", () => {
    const invalid = { ...validWrite, writeMode: "OVERWRITE" as never };
    assert.ok(validateImmutableArtifactWrite(invalid, now).includes("CREATE_ONLY_REQUIRED"));
  });

  await check("approved source binding is required", () => {
    const invalid = { ...validWrite, sourceBinding: { ...sourceBinding, decisionId: "" } };
    assert.ok(validateImmutableArtifactWrite(invalid as never, now).includes("INVALID_SOURCE_BINDING"));
  });

  await check("shape-correct fabricated approval binding is rejected", () => {
    const invalid = { ...validWrite, sourceBinding: { ...sourceBinding } as never };
    assert.ok(validateImmutableArtifactWrite(invalid as never, now).includes("INVALID_SOURCE_BINDING"));
  });

  await check("source binding class must match the authorized write purpose", () => {
    const invalid = {
      ...validWrite,
      sourceBinding: { ...sourceBinding, kind: "INGESTED_RESPONSE" as const },
    };
    assert.ok(validateImmutableArtifactWrite(invalid as never, now).includes("INVALID_SOURCE_BINDING"));
  });

  const validStored = storedObject();
  await check("stored object binds exact scope, digest, source, and encryption receipt", () => {
    assert.deepEqual(validateStoredArtifactObject(validWrite, validStored, "provider_alpha"), []);
  });

  await check("stored object must come from the selected provider adapter", () => {
    assert.ok(validateStoredArtifactObject(validWrite, validStored, "provider_beta").includes("INVALID_PROVIDER_KEY"));
  });

  await check("stored object cannot return a public locator", () => {
    const invalid = { ...validStored, providerLocatorOpaque: "https://public.invalid/artifact" };
    assert.ok(validateStoredArtifactObject(validWrite, invalid, "provider_alpha").includes("PUBLIC_URL_FORBIDDEN"));
  });

  await check("stored object cannot return a protocol-relative locator", () => {
    const invalid = { ...validStored, providerLocatorOpaque: "//public.invalid/artifact" };
    assert.ok(validateStoredArtifactObject(validWrite, invalid, "provider_alpha").includes("PUBLIC_URL_FORBIDDEN"));
  });

  await check("stored object rejects browser-normalized control characters in a URL", () => {
    const invalid = { ...validStored, providerLocatorOpaque: "h\tttps://public.invalid/artifact" };
    assert.ok(validateStoredArtifactObject(validWrite, invalid, "provider_alpha").includes("PUBLIC_URL_FORBIDDEN"));
  });

  await check("stored object digest drift fails", () => {
    const invalid = { ...validStored, sha256: "b".repeat(64) };
    assert.ok(validateStoredArtifactObject(validWrite, invalid, "provider_alpha").includes("INVALID_STORED_OBJECT"));
  });

  await check("stored object encryption context is exact-scope bound", () => {
    const invalid = {
      ...validStored,
      encryption: { ...validStored.encryption, encryptionContextSha256: "b".repeat(64) },
    };
    assert.ok(validateStoredArtifactObject(validWrite, invalid, "provider_alpha").includes("INVALID_ENCRYPTION_RECEIPT"));
  });

  await check("encryption key references reject ASCII control characters", () => {
    const invalid = {
      ...validStored,
      encryption: { ...validStored.encryption, keyReferenceOpaque: "key\nreference" },
    };
    assert.ok(validateStoredArtifactObject(validWrite, invalid, "provider_alpha").includes("INVALID_ENCRYPTION_RECEIPT"));
  });

  await check("malformed authoritative inner objects return errors instead of throwing", () => {
    for (const malformed of [
      { ...validStored, encryption: undefined },
      { ...validStored, encryption: [] },
      { ...validStored, scope: [] },
      { ...validStored, encryption: { ...validStored.encryption, unexpected: true } },
    ]) {
      assert.doesNotThrow(() => validateStoredArtifactObject(validWrite, malformed as never, "provider_alpha"));
      assert.ok(validateStoredArtifactObject(validWrite, malformed as never, "provider_alpha").length > 0);
    }
  });

  await check("partially valid outer write cannot bless malformed authoritative children", () => {
    const malformed = { ...validWrite, authorityManifest: { ...authorityManifest, members: [42] } };
    assert.doesNotThrow(() => validateImmutableArtifactWrite(malformed as never, now));
    assert.ok(validateImmutableArtifactWrite(malformed as never, now).includes("INVALID_AUTHORITY_MANIFEST"));
  });

  const readCapability = await verified("DOWNLOAD", "decision_read_synthetic");
  const validRead: ArtifactReadGrantRequest = {
    contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
    capability: readCapability,
    object: validStored,
    expiresInSeconds: MAX_ARTIFACT_READ_GRANT_SECONDS,
    singleUse: true,
  };

  await check("valid exact-object read request passes", () => {
    assert.deepEqual(validateArtifactReadGrantRequest(validRead, now), []);
  });

  await check("read request cannot reuse a write capability", () => {
    const invalid = { ...validRead, capability: writeCapability };
    assert.ok(validateArtifactReadGrantRequest(invalid, now).includes("INVALID_CAPABILITY"));
  });

  await check("read object scope must match independent capability scope", () => {
    const invalid = { ...validRead, object: { ...validStored, scope: { ...scope, caseId: "other_case" } } };
    assert.ok(validateArtifactReadGrantRequest(invalid, now).includes("INVALID_SCOPE"));
  });

  await check("grant TTL is capped by contract and authorization", () => {
    const invalid = { ...validRead, expiresInSeconds: MAX_ARTIFACT_READ_GRANT_SECONDS + 1 };
    assert.ok(validateArtifactReadGrantRequest(invalid, now).includes("INVALID_GRANT_TTL"));
  });

  const validGrant: ArtifactReadGrant = {
    brokerGrantId: "grant_synthetic_1",
    brokerGrantToken: "signed_opaque_grant_synthetic_1",
    tokenFormat: "SIGNED_OPAQUE",
    scope,
    purpose: "DOWNLOAD",
    providerKey: validStored.providerKey,
    providerObjectVersion: validStored.providerObjectVersion,
    objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
    expectedSha256: contentSha256,
    expectedByteLength: content.byteLength,
    issuedAt: now.toISOString(),
    expiresAt: "2026-08-08T16:05:00.000Z",
    singleUse: true,
  };

  await check("issued grant binds the exact request", () => {
    assert.deepEqual(validateArtifactReadGrantResult(validRead, validGrant, now), []);
  });

  await check("issued grant cannot be a public URL", () => {
    const invalid = { ...validGrant, brokerGrantToken: "https://public.invalid/grant" };
    assert.ok(validateArtifactReadGrantResult(validRead, invalid, now).includes("PUBLIC_URL_FORBIDDEN"));
  });

  await check("issued grant cannot substitute an object version", () => {
    const invalid = { ...validGrant, providerObjectVersion: "other_version" };
    assert.ok(validateArtifactReadGrantResult(validRead, invalid, now).includes("INVALID_GRANT"));
  });

  await check("all URI schemes are forbidden for locators and broker tokens", () => {
    for (const token of [
      "data:opaque",
      "blob:opaque",
      "s3:opaque",
      "gs:opaque",
      "//public.invalid/grant",
      "\\\\public.invalid\\grant",
      "h\tttps://public.invalid/grant",
      "ht\ntps://public.invalid/grant",
    ]) {
      assert.ok(
        validateArtifactReadGrantResult(validRead, { ...validGrant, brokerGrantToken: token }, now).includes(
          "PUBLIC_URL_FORBIDDEN"
        )
      );
    }
  });

  const verifiedGrant = await verifyArtifactReadGrant(validRead, validGrant, now, grantVerifier);
  assert.ok(verifiedGrant);

  await check("verified read grant snapshots and freezes its caller-owned scope", async () => {
    const callerOwnedScope = { ...scope };
    const mutableGrant = {
      ...validGrant,
      brokerGrantId: "grant_mutable_scope",
      brokerGrantToken: "signed_opaque_grant_mutable_scope",
      scope: callerOwnedScope,
    };
    const verifiedMutableGrant = await verifyArtifactReadGrant(validRead, mutableGrant, now, grantVerifier);
    assert.ok(verifiedMutableGrant);
    callerOwnedScope.tenantId = "tenant_retargeted";
    assert.equal(verifiedMutableGrant.scope.tenantId, scope.tenantId);
    assert.equal(Object.isFrozen(verifiedMutableGrant), true);
    assert.equal(Object.isFrozen(verifiedMutableGrant.scope), true);
    assert.throws(() => {
      (verifiedMutableGrant.scope as { tenantId: string }).tenantId = "tenant_retargeted";
    }, TypeError);
  });

  await check("signed grant verifier fails closed on a denied signature", async () => {
    const denied = await verifyArtifactReadGrant(validRead, validGrant, now, {
      async verifyGrant() { return false; },
    });
    assert.equal(denied, null);
  });

  const redemptionRequest: ArtifactReadRedemptionRequest = {
    contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
    capability: readCapability,
    grant: verifiedGrant,
  };
  const validRedemption = {
    status: "REDEEMED" as const,
    brokerGrantId: validGrant.brokerGrantId,
    providerKey: validGrant.providerKey,
    objectBindingSha256: validGrant.objectBindingSha256,
    content,
    observedSha256: contentSha256,
    observedByteLength: content.byteLength,
    redeemedAt: now.toISOString(),
    singleUseConsumed: true,
  };

  await check("atomic first redemption validates bytes and digest", () => {
    assert.deepEqual(validateArtifactReadRedemption(redemptionRequest, validRedemption, now), []);
  });

  await check("shape-correct unsigned grant cannot be redeemed", () => {
    const unsigned = { ...redemptionRequest, grant: { ...validGrant } as never };
    assert.ok(validateArtifactReadRedemption(unsigned, validRedemption, now).includes("INVALID_CAPABILITY"));
  });

  await check("redemption rejects post-read digest mismatch", () => {
    const changed = new Uint8Array(content);
    changed[changed.byteLength - 1] ^= 1;
    const invalid = { ...validRedemption, content: changed };
    assert.ok(validateArtifactReadRedemption(redemptionRequest, invalid, now).includes("CONTENT_DIGEST_MISMATCH"));
  });

  await check("redemption result cannot substitute a provider with matching bytes", () => {
    const invalid = { ...validRedemption, providerKey: "provider_beta" };
    assert.ok(validateArtifactReadRedemption(redemptionRequest, invalid, now).includes("INVALID_PROVIDER_KEY"));
  });

  await check("successful redemption must atomically consume the grant", () => {
    const invalid = { ...validRedemption, singleUseConsumed: false };
    assert.ok(validateArtifactReadRedemption(redemptionRequest, invalid, now).includes("GRANT_REPLAY_NOT_ENFORCED"));
  });

  await check("replay result must preserve consumed state and return no bytes", () => {
    const replay = {
      status: "ALREADY_REDEEMED" as const,
      brokerGrantId: validGrant.brokerGrantId,
      providerKey: validGrant.providerKey,
      objectBindingSha256: validGrant.objectBindingSha256,
      redeemedAt: now.toISOString(),
      singleUseConsumed: true,
    };
    assert.deepEqual(validateArtifactReadRedemption(redemptionRequest, replay, now), []);
  });

  await check("expired broker grant cannot be redeemed with a still-valid capability", () => {
    const expiredRequest = {
      ...redemptionRequest,
      grant: { ...validGrant, expiresAt: "2026-08-08T15:59:59.000Z" },
    };
    assert.ok(validateArtifactReadRedemption(expiredRequest as never, validRedemption, now).includes("INVALID_GRANT"));
  });

  const integrityCapability = await verified("INTEGRITY_VERIFY", "decision_integrity_synthetic");
  const integrityRequest: ArtifactIntegrityRequest = {
    contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
    capability: integrityCapability,
    object: validStored,
  };

  await check("integrity request requires exact object and purpose", () => {
    assert.deepEqual(validateArtifactIntegrityRequest(integrityRequest, now), []);
  });

  await check("integrity result cannot lie about a mismatch", () => {
    const invalid = {
      kind: "ARTIFACT_INTEGRITY_VERIFIED" as const,
      providerKey: validStored.providerKey,
      providerObjectVersion: validStored.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
      observedSha256: "b".repeat(64),
      observedByteLength: content.byteLength,
      verifiedAt: now.toISOString(),
    };
    assert.ok(validateArtifactIntegrityResult(integrityRequest, invalid).includes("INVALID_INTEGRITY_RESULT"));
    assert.equal(artifactIntegrityPermitsRelease(integrityRequest, invalid), false);
  });

  await check("negative integrity result must still identify the exact provider object", () => {
    const invalid = {
      kind: "ARTIFACT_INTEGRITY_FAILURE" as const,
      failure: { code: "DIGEST_AND_BYTE_LENGTH_MISMATCH" as const },
      providerKey: "provider_beta",
      providerObjectVersion: "provider_beta_version_1",
      objectBindingSha256: "b".repeat(64),
      observedSha256: "b".repeat(64),
      observedByteLength: content.byteLength + 1,
      verifiedAt: now.toISOString(),
    };
    assert.ok(validateArtifactIntegrityResult(integrityRequest, invalid).includes("INVALID_INTEGRITY_RESULT"));
  });

  await check("exact-object integrity check may report a real content mismatch", () => {
    const mismatch = {
      kind: "ARTIFACT_INTEGRITY_FAILURE" as const,
      failure: { code: "DIGEST_MISMATCH" as const },
      providerKey: validStored.providerKey,
      providerObjectVersion: validStored.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
      observedSha256: "b".repeat(64),
      observedByteLength: content.byteLength,
      verifiedAt: now.toISOString(),
    };
    assert.deepEqual(validateArtifactIntegrityResult(integrityRequest, mismatch), []);
  });

  await check("integrity failure is structurally distinct and blocks a consuming caller", () => {
    const verifiedResult: ArtifactIntegrityResult = {
      kind: "ARTIFACT_INTEGRITY_VERIFIED",
      providerKey: validStored.providerKey,
      providerObjectVersion: validStored.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
      observedSha256: validStored.sha256,
      observedByteLength: validStored.byteLength,
      verifiedAt: now.toISOString(),
    };
    const failedResult: ArtifactIntegrityResult = {
      kind: "ARTIFACT_INTEGRITY_FAILURE",
      failure: { code: "DIGEST_MISMATCH" },
      providerKey: validStored.providerKey,
      providerObjectVersion: validStored.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
      observedSha256: "b".repeat(64),
      observedByteLength: validStored.byteLength,
      verifiedAt: now.toISOString(),
    };
    assert.equal(artifactIntegrityPermitsRelease(integrityRequest, verifiedResult), true);
    assert.equal(artifactIntegrityPermitsRelease(integrityRequest, failedResult), false);
    assert.deepEqual(validateArtifactIntegrityResult(integrityRequest, failedResult), []);
    assert.notEqual(failedResult.kind, "ARTIFACT_INTEGRITY_VERIFIED");
  });

  await check("legacy boolean and business-negative integrity shapes are rejected", () => {
    for (const malformed of [
      {
        matches: false,
        providerKey: validStored.providerKey,
        providerObjectVersion: validStored.providerObjectVersion,
        objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
        observedSha256: "b".repeat(64),
        observedByteLength: validStored.byteLength,
        verifiedAt: now.toISOString(),
      },
      {
        kind: "CLEAN",
        providerKey: validStored.providerKey,
        providerObjectVersion: validStored.providerObjectVersion,
        objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
        observedSha256: validStored.sha256,
        observedByteLength: validStored.byteLength,
        verifiedAt: now.toISOString(),
      },
    ]) {
      assert.ok(validateArtifactIntegrityResult(integrityRequest, malformed as never).includes("INVALID_INTEGRITY_RESULT"));
    }
  });

  await check("integrity failure reason must exactly describe observed mismatch", () => {
    const invalid = {
      kind: "ARTIFACT_INTEGRITY_FAILURE" as const,
      failure: { code: "BYTE_LENGTH_MISMATCH" as const },
      providerKey: validStored.providerKey,
      providerObjectVersion: validStored.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
      observedSha256: "b".repeat(64),
      observedByteLength: validStored.byteLength,
      verifiedAt: now.toISOString(),
    };
    assert.ok(validateArtifactIntegrityResult(integrityRequest, invalid).includes("INVALID_INTEGRITY_RESULT"));
  });

  const erasureCapability = await verified("ERASURE", "decision_erasure_synthetic");
  const erasureEligibility = {
    retentionDecision: "ERASURE_ELIGIBLE" as const,
    legalHoldStatus: "CLEAR" as const,
    replicaDisposition: "TOMBSTONE_PROPAGATION_REQUIRED" as const,
    backupDisposition: "TOMBSTONE_PROPAGATION_REQUIRED" as const,
    decisionId: "retention_decision_synthetic",
    decisionSha256: computeArtifactSha256(encoder.encode("synthetic retention decision")),
    retentionPolicyVersion: "retention_policy_synthetic_v1",
    issuedAt: "2026-08-08T15:59:55.000Z",
    expiresAt: "2026-08-08T16:00:25.000Z",
    scope,
    providerObjectVersion: validStored.providerObjectVersion,
    objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
    objectSha256: validStored.sha256,
  };
  const verifiedErasureEligibility = await verifyArtifactErasureEligibility(
    erasureEligibility,
    validStored,
    now,
    erasureVerifier
  );
  assert.ok(verifiedErasureEligibility);

  await check("verified erasure decision snapshots and freezes its caller-owned scope", async () => {
    const callerOwnedScope = { ...scope };
    const mutableEligibility = { ...erasureEligibility, scope: callerOwnedScope };
    const verifiedMutableEligibility = await verifyArtifactErasureEligibility(
      mutableEligibility,
      validStored,
      now,
      erasureVerifier
    );
    assert.ok(verifiedMutableEligibility);
    callerOwnedScope.consumerId = "consumer_retargeted";
    assert.equal(verifiedMutableEligibility.scope.consumerId, scope.consumerId);
    assert.equal(Object.isFrozen(verifiedMutableEligibility), true);
    assert.equal(Object.isFrozen(verifiedMutableEligibility.scope), true);
    assert.throws(() => {
      (verifiedMutableEligibility.scope as { consumerId: string }).consumerId = "consumer_retargeted";
    }, TypeError);
  });
  const tombstoneRequest: ArtifactTombstoneRequest = {
    contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
    capability: erasureCapability as VerifiedArtifactCapability & { readonly purpose: "ERASURE" },
    object: validStored,
    eligibility: verifiedErasureEligibility,
    tombstoneEventKey: "tombstone_event_synthetic_1",
  };

  await check("eligible exact-version tombstone request passes", () => {
    assert.deepEqual(validateArtifactTombstoneRequest(tombstoneRequest, now), []);
  });

  await check("erasure decisions are short-lived and stale decisions fail closed", () => {
    assert.equal(
      Date.parse(erasureEligibility.expiresAt) - Date.parse(erasureEligibility.issuedAt),
      MAX_ARTIFACT_ERASURE_DECISION_SECONDS * 1000
    );
    const afterExpiry = new Date("2026-08-08T16:00:26.000Z");
    assert.ok(
      validateArtifactTombstoneRequest(tombstoneRequest, afterExpiry).includes(
        "INVALID_ERASURE_DECISION"
      )
    );
  });

  await check("retention verifier fails closed on a denied authority decision", async () => {
    const denied = await verifyArtifactErasureEligibility(erasureEligibility, validStored, now, {
      async verifyDecision() { return false; },
    });
    assert.equal(denied, null);
  });

  await check("shape-correct fabricated erasure eligibility is rejected", () => {
    const invalid = { ...tombstoneRequest, eligibility: { ...erasureEligibility } as never };
    assert.ok(validateArtifactTombstoneRequest(invalid, now).includes("INVALID_ERASURE_DECISION"));
  });

  await check("legal hold blocks tombstoning", () => {
    const invalid = {
      ...tombstoneRequest,
      eligibility: { ...tombstoneRequest.eligibility, legalHoldStatus: "ACTIVE" as never },
    };
    assert.ok(validateArtifactTombstoneRequest(invalid, now).includes("LEGAL_HOLD_ACTIVE"));
  });

  await check("retention ineligibility blocks tombstoning", () => {
    const invalid = {
      ...tombstoneRequest,
      eligibility: { ...tombstoneRequest.eligibility, retentionDecision: "RETAIN" as never },
    };
    assert.ok(validateArtifactTombstoneRequest(invalid, now).includes("RETENTION_NOT_ELIGIBLE"));
  });

  await check("erasure decision is exact-object bound", () => {
    const invalid = {
      ...tombstoneRequest,
      eligibility: { ...tombstoneRequest.eligibility, providerObjectVersion: "other_version" },
    };
    assert.ok(validateArtifactTombstoneRequest(invalid, now).includes("INVALID_TOMBSTONE_RESULT"));
  });

  await check("verified erasure decision rejects provider substitution", () => {
    const substitutedObject = { ...validStored, providerKey: "provider_beta" };
    const invalid = { ...tombstoneRequest, object: substitutedObject };
    assert.ok(validateArtifactTombstoneRequest(invalid, now).includes("INVALID_ERASURE_DECISION"));
  });

  await check("verified erasure decision rejects opaque-locator substitution", () => {
    const substitutedObject = { ...validStored, providerLocatorOpaque: "provider_alpha_other_locator" };
    const invalid = { ...tombstoneRequest, object: substitutedObject };
    assert.ok(validateArtifactTombstoneRequest(invalid, now).includes("INVALID_ERASURE_DECISION"));
  });

  await check("verified erasure decision rejects object-version substitution", () => {
    const substitutedObject = { ...validStored, providerObjectVersion: "provider_alpha_other_version" };
    const invalid = { ...tombstoneRequest, object: substitutedObject };
    assert.ok(validateArtifactTombstoneRequest(invalid, now).includes("INVALID_ERASURE_DECISION"));
  });

  await check("successful tombstone result accounts for replica and backup propagation", () => {
    const result = {
      status: "OBJECT_DELETED" as const,
      providerKey: validStored.providerKey,
      providerObjectVersion: validStored.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
      providerDeletionRef: "opaque_deletion_ref_synthetic",
      replicaTombstoneEventKey: "replica_tombstone_synthetic",
      backupTombstoneEventKey: "backup_tombstone_synthetic",
      completedAt: now.toISOString(),
    };
    assert.deepEqual(validateArtifactTombstoneResult(tombstoneRequest, result), []);
  });

  await check("tombstone result cannot return a public deletion URL", () => {
    const invalid = {
      status: "OBJECT_DELETED" as const,
      providerKey: validStored.providerKey,
      providerObjectVersion: validStored.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
      providerDeletionRef: "https://public.invalid/deletion",
      replicaTombstoneEventKey: "replica_tombstone_synthetic",
      backupTombstoneEventKey: "backup_tombstone_synthetic",
      completedAt: now.toISOString(),
    };
    assert.ok(validateArtifactTombstoneResult(tombstoneRequest, invalid).includes("PUBLIC_URL_FORBIDDEN"));
  });

  await check("tombstone result cannot return a protocol-relative deletion URL", () => {
    const invalid = {
      status: "OBJECT_DELETED" as const,
      providerKey: validStored.providerKey,
      providerObjectVersion: validStored.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
      providerDeletionRef: "//public.invalid/deletion",
      replicaTombstoneEventKey: "replica_tombstone_synthetic",
      backupTombstoneEventKey: "backup_tombstone_synthetic",
      completedAt: now.toISOString(),
    };
    assert.ok(validateArtifactTombstoneResult(tombstoneRequest, invalid).includes("PUBLIC_URL_FORBIDDEN"));
  });

  await check("tombstone result rejects control-obfuscated deletion URLs", () => {
    const invalid = {
      status: "OBJECT_DELETED" as const,
      providerKey: validStored.providerKey,
      providerObjectVersion: validStored.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(validStored),
      providerDeletionRef: "h\tttps://public.invalid/deletion",
      replicaTombstoneEventKey: "replica_tombstone_synthetic",
      backupTombstoneEventKey: "backup_tombstone_synthetic",
      completedAt: now.toISOString(),
    };
    assert.ok(validateArtifactTombstoneResult(tombstoneRequest, invalid).includes("PUBLIC_URL_FORBIDDEN"));
  });

  function conformingProvider(providerKey: string): ArtifactStorageProvider {
    const consumed = new Set<string>();
    return {
      providerKey,
      async putImmutable(request) {
        return { ...storedObject(providerKey), scope: request.scope };
      },
      async readBackImmutable(request) {
        return {
          object: request.object,
          authorityManifest,
          content,
          readAt: now.toISOString(),
        };
      },
      async issueReadGrant(request) {
        return {
          ...validGrant,
          brokerGrantId: `${providerKey}_grant`,
          brokerGrantToken: `${providerKey}_signed_opaque_token`,
          providerKey,
          providerObjectVersion: request.object.providerObjectVersion,
          objectBindingSha256: computeStoredArtifactObjectBindingSha256(request.object),
          expectedSha256: request.object.sha256,
          expectedByteLength: request.object.byteLength,
          purpose: request.capability.purpose,
          scope: request.object.scope,
        };
      },
      async redeemReadGrantAtomically(request) {
        if (consumed.has(request.grant.brokerGrantId)) {
          return {
            status: "ALREADY_REDEEMED",
            brokerGrantId: request.grant.brokerGrantId,
            providerKey,
            objectBindingSha256: request.grant.objectBindingSha256,
            redeemedAt: now.toISOString(),
            singleUseConsumed: true,
          };
        }
        consumed.add(request.grant.brokerGrantId);
        return {
          status: "REDEEMED",
          brokerGrantId: request.grant.brokerGrantId,
          providerKey,
          objectBindingSha256: request.grant.objectBindingSha256,
          content,
          observedSha256: contentSha256,
          observedByteLength: content.byteLength,
          redeemedAt: now.toISOString(),
          singleUseConsumed: true,
        };
      },
      async verifyIntegrity(request) {
        return {
          kind: "ARTIFACT_INTEGRITY_VERIFIED",
          providerKey,
          providerObjectVersion: request.object.providerObjectVersion,
          objectBindingSha256: computeStoredArtifactObjectBindingSha256(request.object),
          observedSha256: request.object.sha256,
          observedByteLength: request.object.byteLength,
          verifiedAt: now.toISOString(),
        };
      },
      async tombstoneExactVersion(request) {
        return {
          status: "OBJECT_DELETED",
          providerKey,
          providerObjectVersion: request.object.providerObjectVersion,
          objectBindingSha256: computeStoredArtifactObjectBindingSha256(request.object),
          providerDeletionRef: `${providerKey}_deletion_ref`,
          replicaTombstoneEventKey: `${request.tombstoneEventKey}_replica`,
          backupTombstoneEventKey: `${request.tombstoneEventKey}_backup`,
          completedAt: now.toISOString(),
        };
      },
    };
  }

  await check("write success requires one exact persisted readback", async () => {
    const base = conformingProvider("provider_alpha");
    let putCalls = 0;
    let readbackCalls = 0;
    const provider: ArtifactStorageProvider = {
      ...base,
      async putImmutable(request) {
        putCalls += 1;
        return base.putImmutable(request);
      },
      async readBackImmutable(request) {
        readbackCalls += 1;
        return base.readBackImmutable(request);
      },
    };
    const result = await dispatchImmutableArtifactWrite(provider, validWrite, now);
    assert.equal(result.dispatched, true);
    assert.equal(putCalls, 1);
    assert.equal(readbackCalls, 1);
    if (!result.dispatched) throw new Error("verified synthetic write was denied");
    assert.equal(Object.isFrozen(result.result), true);
  });

  await check("adapter without readback is denied before any write I/O", async () => {
    const base = conformingProvider("provider_alpha");
    let putCalls = 0;
    const missingReadback = {
      ...base,
      readBackImmutable: undefined,
      async putImmutable(request: ImmutableArtifactWriteRequest) {
        putCalls += 1;
        return base.putImmutable(request);
      },
    } as unknown as ArtifactStorageProvider;
    const denied = await dispatchImmutableArtifactWrite(missingReadback, validWrite, now);
    assert.equal(denied.dispatched, false);
    assert.ok(denied.errors.includes("INVALID_PROVIDER_ADAPTER"));
    assert.equal(putCalls, 0);
  });

  async function expectReadbackDenied(
    mutate: (readback: ImmutableArtifactReadbackResult) => ImmutableArtifactReadbackResult,
    expectedError: string
  ): Promise<void> {
    const base = conformingProvider("provider_alpha");
    const provider: ArtifactStorageProvider = {
      ...base,
      async readBackImmutable(request) {
        return mutate(await base.readBackImmutable(request));
      },
    };
    const denied = await dispatchImmutableArtifactWrite(provider, validWrite, now);
    assert.equal(denied.dispatched, false);
    assert.ok(denied.errors.includes(expectedError as never), JSON.stringify(denied.errors));
  }

  await check("partial persisted bytes fail post-I/O truth", () =>
    expectReadbackDenied(
      (readback) => ({ ...readback, content: readback.content.slice(0, -1) }),
      "CONTENT_LENGTH_MISMATCH"
    ));

  await check("substituted persisted artifact identity or version fails post-I/O truth", async () => {
    await expectReadbackDenied(
      (readback) => ({
        ...readback,
        object: { ...readback.object, scope: { ...readback.object.scope, artifactId: "artifact_substituted" } },
      }),
      "INVALID_POST_WRITE_READBACK"
    );
    await expectReadbackDenied(
      (readback) => ({
        ...readback,
        object: { ...readback.object, providerObjectVersion: "stale_provider_version" },
      }),
      "INVALID_POST_WRITE_READBACK"
    );
  });

  await check("wrong persisted recipient or bureau fails post-I/O truth", async () => {
    await expectReadbackDenied(
      (readback) => ({
        ...readback,
        authorityManifest: {
          ...readback.authorityManifest,
          recipient: { ...readback.authorityManifest.recipient, recipientId: "recipient_substituted" },
        },
      }),
      "INVALID_AUTHORITY_MANIFEST"
    );
    await expectReadbackDenied(
      (readback) => ({
        ...readback,
        authorityManifest: {
          ...readback.authorityManifest,
          recipient: { ...readback.authorityManifest.recipient, bureau: "TRANSUNION" },
        },
      }),
      "INVALID_AUTHORITY_MANIFEST"
    );
  });

  await check("wrong persisted membership ID, order, or digest fails post-I/O truth", async () => {
    const substitutedMembers = [
      { ...authorityMembers[0], memberId: "correspondence_version_substituted" },
      authorityMembers[1],
    ] as const;
    await expectReadbackDenied(
      (readback) => ({
        ...readback,
        authorityManifest: {
          ...readback.authorityManifest,
          members: substitutedMembers,
          membershipSha256: computeArtifactMembershipSha256(substitutedMembers),
        },
      }),
      "INVALID_AUTHORITY_MANIFEST"
    );
    await expectReadbackDenied(
      (readback) => ({
        ...readback,
        authorityManifest: { ...readback.authorityManifest, membershipSha256: "b".repeat(64) },
      }),
      "INVALID_AUTHORITY_MANIFEST"
    );
  });

  await check("stale or impossible readback time fails post-I/O truth", async () => {
    await expectReadbackDenied(
      (readback) => ({ ...readback, readAt: "2026-08-08T15:59:59.999Z" }),
      "INVALID_POST_WRITE_READBACK"
    );
    await expectReadbackDenied(
      (readback) => ({ ...readback, readAt: "2026-02-30T16:00:00Z" }),
      "INVALID_POST_WRITE_READBACK"
    );
  });

  await check("malformed nested readback returns a denial rather than throwing", async () => {
    const base = conformingProvider("provider_alpha");
    const provider: ArtifactStorageProvider = {
      ...base,
      async readBackImmutable() {
        return { object: { scope: [] } } as never;
      },
    };
    const denied = await dispatchImmutableArtifactWrite(provider, validWrite, now);
    assert.equal(denied.dispatched, false);
    assert.ok(denied.errors.includes("MALFORMED_ARTIFACT_INPUT"));
  });

  await check("sparse persisted membership returns a structured readback denial", async () => {
    const base = conformingProvider("provider_alpha");
    const sparseMembers = new Array(2) as Array<(typeof authorityMembers)[number]>;
    sparseMembers[0] = authorityMembers[0];
    const provider: ArtifactStorageProvider = {
      ...base,
      async readBackImmutable(request) {
        const readback = await base.readBackImmutable(request);
        return {
          ...readback,
          authorityManifest: {
            ...readback.authorityManifest,
            members: sparseMembers,
            membershipSha256: "a".repeat(64),
          },
        };
      },
    };
    let denied: Awaited<ReturnType<typeof dispatchImmutableArtifactWrite>> | undefined;
    await assert.doesNotReject(async () => {
      denied = await dispatchImmutableArtifactWrite(provider, validWrite, now);
    });
    assert.ok(denied);
    assert.equal(denied.dispatched, false);
    assert.ok(denied.errors.includes("INVALID_AUTHORITY_MANIFEST"));
    assert.ok(denied.errors.includes("INVALID_POST_WRITE_READBACK"));
  });

  await check("integrity dispatch preserves failure as a blocking typed outcome", async () => {
    const base = conformingProvider("provider_alpha");
    const provider: ArtifactStorageProvider = {
      ...base,
      async verifyIntegrity(request) {
        return {
          kind: "ARTIFACT_INTEGRITY_FAILURE",
          failure: { code: "DIGEST_MISMATCH" },
          providerKey: request.object.providerKey,
          providerObjectVersion: request.object.providerObjectVersion,
          objectBindingSha256: computeStoredArtifactObjectBindingSha256(request.object),
          observedSha256: "b".repeat(64),
          observedByteLength: request.object.byteLength,
          verifiedAt: now.toISOString(),
        };
      },
    };
    const dispatch = await dispatchArtifactIntegrityVerification(provider, integrityRequest, now);
    assert.equal(dispatch.dispatched, true);
    if (!dispatch.dispatched) throw new Error("valid negative-integrity result was denied");
    assert.equal(dispatch.result.kind, "ARTIFACT_INTEGRITY_FAILURE");
    assert.equal(artifactIntegrityPermitsRelease(integrityRequest, dispatch.result), false);
  });

  async function verifyProviderConformance(providerKey: string): Promise<void> {
    const provider = conformingProvider(providerKey);
    const providerWrite = { ...validWrite, selectedProviderKey: providerKey };
    const writeDispatch = await dispatchImmutableArtifactWrite(provider, providerWrite, now);
    assert.equal(writeDispatch.dispatched, true);
    if (!writeDispatch.dispatched) throw new Error("synthetic provider write was denied");
    const stored = writeDispatch.result;
    assert.deepEqual(validateStoredArtifactObject(providerWrite, stored, provider.providerKey), []);
    const request = { ...validRead, object: stored };
    const grantDispatch = await dispatchArtifactReadGrant(provider, request, now);
    assert.equal(grantDispatch.dispatched, true);
    if (!grantDispatch.dispatched) throw new Error("synthetic provider grant was denied");
    const grant = grantDispatch.result;
    assert.deepEqual(validateArtifactReadGrantResult(request, grant, now), []);
    const signedGrant = await verifyArtifactReadGrant(request, grant, now, grantVerifier);
    assert.ok(signedGrant);
    const redemption: ArtifactReadRedemptionRequest = {
      contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
      capability: readCapability,
      grant: signedGrant,
    };
    const firstDispatch = await dispatchArtifactReadRedemption(provider, redemption, now);
    assert.equal(firstDispatch.dispatched, true);
    if (!firstDispatch.dispatched) throw new Error("synthetic provider redemption was denied");
    const first = firstDispatch.result;
    assert.deepEqual(validateArtifactReadRedemption(redemption, first, now), []);
    const replayDispatch = await dispatchArtifactReadRedemption(provider, redemption, now);
    assert.equal(replayDispatch.dispatched, true);
    if (!replayDispatch.dispatched) throw new Error("synthetic provider replay result was denied");
    const replay = replayDispatch.result;
    assert.equal(replay.status, "ALREADY_REDEEMED");
    assert.deepEqual(validateArtifactReadRedemption(redemption, replay, now), []);

    const integrity: ArtifactIntegrityRequest = {
      contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
      capability: integrityCapability,
      object: stored,
    };
    assert.deepEqual(validateArtifactIntegrityRequest(integrity, now), []);
    const integrityDispatch = await dispatchArtifactIntegrityVerification(provider, integrity, now);
    assert.equal(integrityDispatch.dispatched, true);
    if (!integrityDispatch.dispatched) throw new Error("synthetic integrity check was denied");
    const integrityResult = integrityDispatch.result;
    assert.deepEqual(validateArtifactIntegrityResult(integrity, integrityResult), []);

    const providerEligibility = {
      ...erasureEligibility,
      decisionId: `${providerKey}_retention_decision`,
      scope: stored.scope,
      providerObjectVersion: stored.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(stored),
      objectSha256: stored.sha256,
    };
    const approvedErasure = await verifyArtifactErasureEligibility(
      providerEligibility,
      stored,
      now,
      erasureVerifier
    );
    assert.ok(approvedErasure);
    const providerTombstone: ArtifactTombstoneRequest = {
      contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
      capability: erasureCapability as VerifiedArtifactCapability & { readonly purpose: "ERASURE" },
      object: stored,
      eligibility: approvedErasure,
      tombstoneEventKey: `${providerKey}_tombstone_event`,
    };
    assert.deepEqual(validateArtifactTombstoneRequest(providerTombstone, now), []);
    const tombstoneDispatch = await dispatchArtifactTombstone(
      provider,
      providerTombstone,
      now,
      erasureVerifier
    );
    assert.equal(tombstoneDispatch.dispatched, true);
    if (!tombstoneDispatch.dispatched) throw new Error("synthetic tombstone was denied");
    const tombstoneResult = tombstoneDispatch.result;
    assert.deepEqual(validateArtifactTombstoneResult(providerTombstone, tombstoneResult), []);
  }

  await check("provider-neutral conformance passes provider alpha", () => verifyProviderConformance("provider_alpha"));
  await check("provider-neutral conformance passes provider beta without domain rewrites", () => verifyProviderConformance("provider_beta"));

  await check("mismatched write provider is denied before provider I/O", async () => {
    const alpha = conformingProvider("provider_alpha");
    let putCalls = 0;
    const countingAlpha: ArtifactStorageProvider = {
      ...alpha,
      async putImmutable(request) {
        putCalls += 1;
        return alpha.putImmutable(request);
      },
    };
    const denied = await dispatchImmutableArtifactWrite(
      countingAlpha,
      { ...validWrite, selectedProviderKey: "provider_beta" },
      now
    );
    assert.equal(denied.dispatched, false);
    assert.deepEqual(denied.errors, ["INVALID_PROVIDER_KEY"]);
    assert.equal(putCalls, 0);
  });

  await check("write dispatch pins provider identity across the provider await", async () => {
    const base = conformingProvider("provider_alpha");
    let currentProviderKey = "provider_alpha";
    let putCalls = 0;
    const mutableIdentityProvider: ArtifactStorageProvider = {
      ...base,
      get providerKey() {
        return currentProviderKey;
      },
      async putImmutable(request) {
        putCalls += 1;
        currentProviderKey = "provider_beta";
        return { ...storedObject("provider_beta"), scope: request.scope };
      },
    };
    const denied = await dispatchImmutableArtifactWrite(mutableIdentityProvider, validWrite, now);
    assert.equal(denied.dispatched, false);
    assert.ok(denied.errors.includes("INVALID_PROVIDER_KEY"));
    assert.equal(putCalls, 1);
  });

  await check("mismatched grant provider is denied before provider I/O", async () => {
    const alpha = conformingProvider("provider_alpha");
    let grantCalls = 0;
    const countingAlpha: ArtifactStorageProvider = {
      ...alpha,
      async issueReadGrant(request) {
        grantCalls += 1;
        return alpha.issueReadGrant(request);
      },
    };
    const denied = await dispatchArtifactReadGrant(
      countingAlpha,
      { ...validRead, object: storedObject("provider_beta") },
      now
    );
    assert.equal(denied.dispatched, false);
    assert.deepEqual(denied.errors, ["INVALID_PROVIDER_KEY"]);
    assert.equal(grantCalls, 0);
  });

  await check("mismatched integrity provider is denied before provider I/O", async () => {
    const alpha = conformingProvider("provider_alpha");
    let integrityCalls = 0;
    const countingAlpha: ArtifactStorageProvider = {
      ...alpha,
      async verifyIntegrity(request) {
        integrityCalls += 1;
        return alpha.verifyIntegrity(request);
      },
    };
    const denied = await dispatchArtifactIntegrityVerification(
      countingAlpha,
      {
        contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
        capability: integrityCapability,
        object: storedObject("provider_beta"),
      },
      now
    );
    assert.equal(denied.dispatched, false);
    assert.deepEqual(denied.errors, ["INVALID_PROVIDER_KEY"]);
    assert.equal(integrityCalls, 0);
  });

  await check("cross-provider tombstone is denied before provider I/O", async () => {
    const betaObject = storedObject("provider_beta");
    const betaEligibilityInput = {
      ...erasureEligibility,
      decisionId: "provider_beta_retention_decision",
      providerObjectVersion: betaObject.providerObjectVersion,
      objectBindingSha256: computeStoredArtifactObjectBindingSha256(betaObject),
      objectSha256: betaObject.sha256,
    };
    const betaEligibility = await verifyArtifactErasureEligibility(
      betaEligibilityInput,
      betaObject,
      now,
      erasureVerifier
    );
    assert.ok(betaEligibility);
    const betaRequest: ArtifactTombstoneRequest = {
      contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
      capability: erasureCapability as VerifiedArtifactCapability & { readonly purpose: "ERASURE" },
      object: betaObject,
      eligibility: betaEligibility,
      tombstoneEventKey: "provider_beta_tombstone_event",
    };
    assert.deepEqual(validateArtifactTombstoneRequest(betaRequest, now), []);
    const alpha = conformingProvider("provider_alpha");
    let tombstoneCalls = 0;
    const countingAlpha: ArtifactStorageProvider = {
      ...alpha,
      async tombstoneExactVersion(request) {
        tombstoneCalls += 1;
        return alpha.tombstoneExactVersion(request);
      },
    };
    const denied = await dispatchArtifactTombstone(countingAlpha, betaRequest, now, erasureVerifier);
    assert.equal(denied.dispatched, false);
    assert.deepEqual(denied.errors, ["INVALID_PROVIDER_KEY"]);
    assert.equal(tombstoneCalls, 0);
  });

  await check("a newly active legal hold is rechecked before provider deletion", async () => {
    const alpha = conformingProvider("provider_alpha");
    let tombstoneCalls = 0;
    const countingAlpha: ArtifactStorageProvider = {
      ...alpha,
      async tombstoneExactVersion(request) {
        tombstoneCalls += 1;
        return alpha.tombstoneExactVersion(request);
      },
    };
    const denied = await dispatchArtifactTombstone(countingAlpha, tombstoneRequest, now, {
      async verifyDecision() { return false; },
    });
    assert.equal(denied.dispatched, false);
    assert.deepEqual(denied.errors, ["INVALID_ERASURE_DECISION"]);
    assert.equal(tombstoneCalls, 0);
  });

  await check("cross-provider redemption is denied before consuming the grant", async () => {
    const beta = conformingProvider("provider_beta");
    const betaObject = storedObject("provider_beta");
    const betaRead = { ...validRead, object: betaObject };
    const betaGrantDispatch = await dispatchArtifactReadGrant(beta, betaRead, now);
    assert.equal(betaGrantDispatch.dispatched, true);
    if (!betaGrantDispatch.dispatched) throw new Error("synthetic beta grant was denied");
    const betaGrant = await verifyArtifactReadGrant(
      betaRead,
      betaGrantDispatch.result,
      now,
      grantVerifier
    );
    assert.ok(betaGrant);
    const betaRedemption: ArtifactReadRedemptionRequest = {
      contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
      capability: readCapability,
      grant: betaGrant,
    };
    const alpha = conformingProvider("provider_alpha");
    let redemptionCalls = 0;
    const countingAlpha: ArtifactStorageProvider = {
      ...alpha,
      async redeemReadGrantAtomically(request) {
        redemptionCalls += 1;
        return alpha.redeemReadGrantAtomically(request);
      },
    };
    const denied = await dispatchArtifactReadRedemption(countingAlpha, betaRedemption, now);
    assert.equal(denied.dispatched, false);
    assert.deepEqual(denied.errors, ["INVALID_PROVIDER_KEY"]);
    assert.equal(redemptionCalls, 0);
  });

  console.log(`\nArtifact storage contract: ${passed}/${passed} passed`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
