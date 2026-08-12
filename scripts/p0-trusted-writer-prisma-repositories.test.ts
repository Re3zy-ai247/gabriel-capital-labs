import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  P0_PRISMA_REPOSITORY_ID,
  P0_PRISMA_REPOSITORY_SEMANTICS_VERSION,
  computeP0RepositorySemanticSha256,
  isVerifiedP0RepositoryAttestation,
  verifyPrismaP0RepositoryReadback,
} from "../lib/creditTruth/repositoryAttestation";
import {
  P0_PRISMA_REPORT_INGESTION_REPOSITORY_VERSION,
  P0_PRISMA_SCOPE_BOOTSTRAP_VERSION,
  createPrismaP0ReportIngestionRepository,
} from "../lib/creditTruth/prismaReportIngestionRepository";
import {
  P0_PRISMA_SHADOW_GRAPH_REPOSITORY_VERSION,
  createPrismaP0ShadowTruthGraphRepository,
} from "../lib/creditTruth/prismaShadowTruthGraphRepository";

let passed = 0;
const test = async (name: string, operation: () => Promise<void> | void) => {
  await operation();
  passed += 1;
  void name;
};

const scope = Object.freeze({ tenantId: "tenant-synthetic", consumerId: "consumer-synthetic" });
const verifier = Object.freeze({
  repositoryId: P0_PRISMA_REPOSITORY_ID,
  semanticsVersion: P0_PRISMA_REPOSITORY_SEMANTICS_VERSION,
  async verifyReadback(input: { readonly adapterClass: string }) {
    return input.adapterClass === "AUTHENTICATED_TENANT_SCOPED_PRISMA";
  },
});

const main = async () => {
await test("production attestation exact readback", async () => {
  const snapshot = Object.freeze({ id: "row-1", state: "RECEIVED" });
  const receipt = await verifyPrismaP0RepositoryReadback({
    operationId: "operation-1",
    purpose: "INGESTION_RESERVE",
    scope,
    expectedSnapshot: snapshot,
    readbackSnapshot: { ...snapshot },
    sourceRefs: [{ resourceType: "REPORT_INGESTION", resourceId: "row-1", resourceVersion: "state-v1" }],
    verifier,
  });
  assert(receipt);
  assert(isVerifiedP0RepositoryAttestation(receipt));
  assert.equal(receipt.adapterClass, "AUTHENTICATED_TENANT_SCOPED_PRISMA");
});

await test("production attestation mismatch fails", async () => {
  const receipt = await verifyPrismaP0RepositoryReadback({
    operationId: "operation-2",
    purpose: "INGESTION_RESERVE",
    scope,
    expectedSnapshot: { id: "row-1", revision: 1 },
    readbackSnapshot: { id: "row-1", revision: 2 },
    sourceRefs: [],
    verifier,
  });
  assert.equal(receipt, null);
});

await test("production verifier denial fails", async () => {
  const receipt = await verifyPrismaP0RepositoryReadback({
    operationId: "operation-3",
    purpose: "INGESTION_RESERVE",
    scope,
    expectedSnapshot: { id: "row-1" },
    readbackSnapshot: { id: "row-1" },
    sourceRefs: [],
    verifier: { ...verifier, verifyReadback: async () => false },
  });
  assert.equal(receipt, null);
});

await test("semantic digest order stable", () => {
  assert.equal(
    computeP0RepositorySemanticSha256({ b: 2, a: 1 }),
    computeP0RepositorySemanticSha256({ a: 1, b: 2 }),
  );
});

await test("ingestion repository rejects missing dependencies", () => {
  assert.throws(() => createPrismaP0ReportIngestionRepository({} as never));
});

await test("graph repository rejects missing dependencies", () => {
  assert.throws(() => createPrismaP0ShadowTruthGraphRepository({} as never));
});

await test("ingestion repository identity frozen", () => {
  assert.equal(P0_PRISMA_REPORT_INGESTION_REPOSITORY_VERSION, "p0-prisma-report-ingestion-repository-v1");
  assert.equal(P0_PRISMA_SCOPE_BOOTSTRAP_VERSION, "p0-prisma-scope-bootstrap-v1");
});

await test("ingestion reservation transaction bootstraps and rereads exact scope", () => {
  const source = readFileSync(
    "lib/creditTruth/prismaReportIngestionRepository.ts",
    "utf8",
  );
  assert.match(source, /creditTruthScope\.createMany\s*\(/);
  assert.match(source, /skipDuplicates:\s*true/);
  assert.match(source, /creditTruthScope\.findUnique\s*\(/);
  assert.match(source, /scope\.tenantId !== context\.scope\.tenantId/);
  assert.match(source, /scope\.consumerId !== context\.scope\.consumerId/);
});

await test("report-version scope bootstrap requires only INSERT and exact scoped reread", () => {
  const source = readFileSync(
    "lib/creditTruth/prismaReportVersionRepository.ts",
    "utf8",
  );
  assert.match(source, /creditTruthScope\.createMany\s*\(/);
  assert.match(source, /skipDuplicates:\s*true/);
  assert.match(source, /creditTruthScope\.findUnique\s*\(/);
  assert.match(source, /persistedScope\.tenantId !== scope\.tenantId/);
  assert.match(source, /persistedScope\.consumerId !== scope\.consumerId/);
  assert.match(source, /SCOPE_BOOTSTRAP_MISMATCH/);
  assert.doesNotMatch(source, /creditTruthScope\.upsert\s*\(/);
});

await test("graph repository identity frozen", () => {
  assert.equal(P0_PRISMA_SHADOW_GRAPH_REPOSITORY_VERSION, "p0-prisma-shadow-graph-repository-v1");
});

await test("graph repository permits reusable account membership only behind exact readback", () => {
  const source = readFileSync(
    "lib/creditTruth/prismaShadowTruthGraphRepository.ts",
    "utf8",
  );
  assert.match(source, /skipDuplicates:\s*true/);
  assert.match(source, /readbackBatch\(transaction, input\.batch\)/);
  assert.match(source, /computeP0RepositorySemanticSha256\(readback\)/);
});

await test("graph repository independently re-proves normalized Artifact and source object", () => {
  const source = readFileSync(
    "lib/creditTruth/prismaShadowTruthGraphRepository.ts",
    "utf8",
  );
  assert.match(source, /exactNormalizedInputAuthority/);
  assert.match(source, /transaction\.artifact\.findFirst/);
  assert.match(source, /transaction\.p0SourceObject\.findFirst/);
  assert.match(source, /isValidP0PrismaSourceObjectRow\(sourceObject\)/);
  assert.match(source, /inputRepresentation !== "DERIVED_NORMALIZED_TEXT"/);
  assert.match(source, /artifact\.sha256 === extraction\.inputSha256/);
  assert.match(source, /sourceObject\.sha256 === extraction\.inputSha256/);
  assert.match(source, /objectBytes === artifactBytes/);
  assert.match(source, /sourceObject\.id === physical\?\.id/);
  assert.match(source, /sourceObject\.providerObjectVersion === physical\?\.providerObjectVersion/);
  assert.match(source, /artifact\.storageLocatorCiphertext/);
  assert.match(source, /sourceObject\.locatorCiphertext/);
});

await test("normalized text artifacts preserve the accepted Phase 2A OTHER-kind contract", () => {
  const extraction = readFileSync(
    "lib/creditTruth/prismaExtractionInputRepository.ts",
    "utf8",
  );
  const graph = readFileSync(
    "lib/creditTruth/prismaShadowTruthGraphRepository.ts",
    "utf8",
  );
  const round0 = readFileSync(
    "lib/creditTruth/prismaRound0Repository.ts",
    "utf8",
  );
  assert.match(extraction, /kind:\s*"OTHER"/);
  assert.match(graph, /artifact\.kind === "OTHER"/);
  assert.match(round0, /inputArtifactId[\s\S]{0,300}kind:\s*"OTHER"/);
});

await test("parser history kinds map exhaustively into the durable Prisma enum", () => {
  const graph = readFileSync(
    "lib/creditTruth/prismaShadowTruthGraphRepository.ts",
    "utf8",
  );
  for (const mapping of [
    'case "COLLECTION": return "COLLECTION"',
    'case "CHARGE_OFF": return "CHARGE_OFF"',
    'case "PAYMENT_DELINQUENCY":',
    'case "FIRST_DELINQUENCY_DATE":',
    'return "DELINQUENCY"',
    'case "LOSS_REPORTED": return "LOSS"',
    'case "TRANSFER_OR_SALE": return "TRANSFER_OR_SALE"',
    'case "CONSUMER_DISPUTE_REMARK": return "CONSUMER_DISPUTE_REMARK"',
    'case "OTHER_ADVERSE_REMARK": return "OTHER_ADVERSE"',
  ]) {
    assert(graph.includes(mapping), `missing durable history mapping: ${mapping}`);
  }
  assert.match(graph, /historical evidence type readback mismatch/);
});

await test("score scale does not fabricate complete legacy model metadata", () => {
  const graph = readFileSync(
    "lib/creditTruth/prismaShadowTruthGraphRepository.ts",
    "utf8",
  );
  assert.match(
    graph,
    /modelMetadataCompleteness:[\s\S]{0,180}row\.scoreScaleMin !== null[\s\S]{0,120}\? "PARTIAL"[\s\S]{0,60}: "UNKNOWN"/,
  );
  assert.doesNotMatch(
    graph,
    /modelMetadataCompleteness:\s*row\.scoreModelPresence === "PRESENT" \? "COMPLETE"/,
  );
  assert.match(
    graph,
    /sourceMethodKey:[\s\S]{0,300}normalizationRuleKey: "PARSER_V2_SHADOW"[\s\S]{0,120}normalizationRuleVersion: run\.normalizationVersion/,
  );
});

await test("graph source reproof runs before any extraction graph insert", () => {
  const source = readFileSync(
    "lib/creditTruth/prismaShadowTruthGraphRepository.ts",
    "utf8",
  );
  const reproof = source.indexOf("await exactNormalizedInputAuthority({");
  const lookup = source.indexOf("const existing = await transaction.extractionRun.findUnique", reproof);
  const insert = source.indexOf("await createGraphRows(transaction, input.batch)", lookup);
  assert(reproof >= 0);
  assert(lookup > reproof);
  assert(insert > lookup);
});

await test("report-version and extraction-input adapters classify nested exact 40P01", () => {
  for (const file of [
    "lib/creditTruth/prismaReportVersionRepository.ts",
    "lib/creditTruth/prismaExtractionInputRepository.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /for \(const match of normalized\.matchAll/);
    assert.match(source, /if \(\/\\d\/\.test\(candidate\)\) found\.add\(candidate\)/);
    assert.match(source, /Reflect\.ownKeys\(object\)/);
    assert.match(source, /Object\.getOwnPropertyDescriptor/);
    assert.match(source, /databaseCodes\(error\)\.includes\("40P01"\)/);
    assert.match(source, /kind: "DEADLOCK_DETECTED"/);
    assert.match(source, /code: "POSTGRES_40P01_DEADLOCK_DETECTED"/);
    assert.match(source, /databaseCode: "40P01"/);
    assert.match(source, /retryable: false/);
  }
});

await test("40P01 classification adds no implicit repository retry", () => {
  for (const file of [
    "lib/creditTruth/prismaReportVersionRepository.ts",
    "lib/creditTruth/prismaExtractionInputRepository.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /retryAttestation|maxAttempts|setTimeout/);
    assert.match(source, /OUTCOME_UNKNOWN/);
  }
});

await test("repository identity frozen", () => {
  assert.equal(P0_PRISMA_REPOSITORY_ID, "P0_AUTHENTICATED_TENANT_SCOPED_PRISMA_REPOSITORY");
  assert.equal(P0_PRISMA_REPOSITORY_SEMANTICS_VERSION, "p0-prisma-repository-semantics-v1");
});

await test("plain object cannot forge receipt", () => {
  assert.equal(isVerifiedP0RepositoryAttestation({
    operationId: "operation-1",
    purpose: "INGESTION_RESERVE",
    scope,
    adapterClass: "AUTHENTICATED_TENANT_SCOPED_PRISMA",
    repositoryId: P0_PRISMA_REPOSITORY_ID,
    semanticsVersion: P0_PRISMA_REPOSITORY_SEMANTICS_VERSION,
    semanticSha256: "0".repeat(64),
    sourceSetSha256: "0".repeat(64),
    snapshot: {},
  } as never), false);
});

process.stdout.write(`${passed}/${passed} PASS p0-trusted-writer-prisma-repositories\n`);
};

void main();
