import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { P0_TRUSTED_WRITER_IMPLEMENTATION_SOURCE_MANIFEST } from "../lib/creditTruth/trustedWriterReadiness";

const root = resolve(import.meta.dirname, "..");

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function walkProductionSource(directory: string): string[] {
  const absolute = resolve(root, directory);
  const result: string[] = [];
  for (const entry of readdirSync(absolute).sort()) {
    const path = resolve(absolute, entry);
    const metadata = statSync(path);
    if (metadata.isDirectory()) {
      result.push(...walkProductionSource(relative(root, path)));
    } else if (/\.(?:ts|tsx)$/.test(entry) && !/\.test\.(?:ts|tsx)$/.test(entry)) {
      result.push(relative(root, path));
    }
  }
  return result;
}

let passed = 0;
function check(name: string, condition: unknown): void {
  assert(condition, name);
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

function sameSet(actual: Iterable<string>, expected: Iterable<string>): boolean {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

const productionFiles = [
  ...walkProductionSource("app"),
  ...walkProductionSource("lib"),
].sort();
const productionSource = new Map(
  productionFiles.map((path) => [path, read(path)] as const),
);

const routePath = "app/api/reports/upload/route.ts";
const route = read(routePath);
const uploadHookPath = "lib/creditTruth/trustedWriterUploadHook.ts";
const uploadHook = read(uploadHookPath);
const principalPath = "lib/creditTruth/principalPrismaAdapter.ts";
const principal = read(principalPath);
const dedicatedDatabaseClientPath =
  "lib/creditTruth/trustedWriterPrismaClient.ts";
const dedicatedDatabaseClient = read(dedicatedDatabaseClientPath);
const flags = read("lib/creditTruth/phase2Flags.ts");
const readiness = read("lib/creditTruth/phase2Readiness.ts");
const signedReadiness = read("lib/creditTruth/trustedWriterReadiness.ts");
const migration = read("prisma/migrations/20260811_p0_trusted_writer_gate/migration.sql");
const verifier = read("scripts/p0-trusted-writer-disposable-verify.sh");
const schema = read("prisma/schema.prisma");

check(
  "upload route installs only the server-owned dormant hook factory",
  route.includes("const dispatchP0ReportUploadShadow: ReturnType<") &&
    route.includes("hook: createP0ProductionTrustedWriterUploadHook(),") &&
    route.includes('from "@/lib/creditTruth/trustedWriterUploadHook"'),
);
check(
  "live-route dispatch resolves the dormant hook per invocation",
  route.includes(
    "createP0ReportUploadShadowDispatcher({\n    hook: createP0ProductionTrustedWriterUploadHook(),\n  })(input);",
  ),
);
check(
  "upload route cannot construct or receive Prisma composition dependencies",
  !route.includes("createP0TrustedWriterPrismaUploadHook") &&
    !route.includes("P0TrustedWriterPrismaUploadHookDependencies"),
);
check(
  "dormant upload dispatch materializes selectors only behind the injected hook",
  route.includes("await dispatchP0ReportUploadShadow(() => ({") &&
    route.includes("legacyReportId: report!.id"),
);
check(
  "real Prisma trusted-writer composition factory exists",
  uploadHook.includes("export function createP0TrustedWriterPrismaUploadHook(") &&
    uploadHook.includes("const hook = createP0TrustedWriterUploadHook({") &&
    uploadHook.includes("concretePrismaUploadHooks.add(hook);") &&
    uploadHook.includes("return hook;"),
);
check(
  "real composition installs ingestion, access-audit, source, and report-version adapters",
  [
    "createPrismaP0ReportIngestionRepository({",
    "createP0PrismaSensitiveAccessRepository({",
    "createP0PrismaSourceArtifactAdapter({",
    "createP0PrismaReportVersionRepository({",
    "createP0TrustedWriterPrismaSourcePersister({",
  ].every((needle) => uploadHook.includes(needle)),
);
const productionFactory = uploadHook.slice(
  uploadHook.indexOf("export function createP0ProductionTrustedWriterUploadHook"),
  uploadHook.indexOf("export type P0TrustedWriterSourceKind"),
);
check(
  "route factory requires server flags and supports only async-local disposable or production-dormant composition",
  productionFactory.includes("p0Phase2AFlagsFromEnv()") &&
    productionFactory.includes("disposableHookContext.getStore()") &&
    productionFactory.includes("P0_TRUSTED_WRITER_DISPOSABLE_MODE") &&
    productionFactory.includes("P0_TRUSTED_WRITER_PRODUCTION_DORMANT_MODE") &&
    productionFactory.includes("flags.killSwitchEngaged") &&
    productionFactory.includes("loadP0TrustedWriterReadinessFromServerEnvironment()") &&
    productionFactory.includes("p0WorkerTokenConfigurationFromServerEnvironment()") &&
    productionFactory.includes("createServerEnvironmentP0ValueProtectionAdapter()") &&
    productionFactory.includes("createP0ProductionTrustedWriterPrismaClientProvider()") &&
    productionFactory.includes("databaseRoleIdentitySha256") &&
    productionFactory.includes("createP0TrustedWriterPrismaUploadHook({") &&
    productionFactory.includes('"PRODUCTION_ACTIVATION"'),
);
check(
  "disposable installer is branded, async-local, and invalidates descendants after callback",
  uploadHook.includes("export async function withP0DisposableTrustedWriterUploadHook") &&
    uploadHook.includes("new AsyncLocalStorage<P0DisposableHookContext>()") &&
    uploadHook.includes("concretePrismaUploadHooks.has(input.hook)") &&
    uploadHook.includes("return disposableHookContext.run(context, async () => {") &&
    uploadHook.includes("return await input.execute();") &&
    uploadHook.includes("finally {") &&
    uploadHook.includes("context.active = false;") &&
    !uploadHook.includes("disposableInstalledHook") &&
    !route.includes("withP0DisposableTrustedWriterUploadHook"),
);
check(
  "only concrete Prisma hooks receive non-copyable installation provenance",
  uploadHook.includes("const concretePrismaUploadHooks = new WeakSet<object>();") &&
    uploadHook.includes("concretePrismaUploadHooks.add(hook);") &&
    !uploadHook.includes("[CONCRETE_PRISMA_UPLOAD_HOOK]"),
);
check(
  "production trusted writer never imports or passes the global application Prisma client",
  !uploadHook.includes('from "../prisma"') &&
    !principal.includes('from "../prisma"') &&
    productionFactory.includes("currentDatabaseClientProvider.getClient()") &&
    productionFactory.includes("client: trustedWriterClient"),
);
check(
  "dedicated client config is server-only, separate, lazy, and exact-role bound",
  dedicatedDatabaseClient.includes('"P0_TRUSTED_WRITER_DATABASE_URL"') &&
    dedicatedDatabaseClient.includes('"P0_TRUSTED_WRITER_DATABASE_ROLE"') &&
    dedicatedDatabaseClient.includes("process.env.DATABASE_URL === databaseUrl") &&
    dedicatedDatabaseClient.includes("current_user::text") &&
    dedicatedDatabaseClient.includes("session_user::text") &&
    dedicatedDatabaseClient.includes("new WeakMap<object, string>()") &&
    dedicatedDatabaseClient.indexOf("new PrismaClient({") >
      dedicatedDatabaseClient.indexOf("getClient(): PrismaClient"),
);
check(
  "every concrete trusted-writer transaction requires the role-bound client brand",
  uploadHook.includes(
    "isP0TrustedWriterDatabaseRoleBoundPrismaClient(dependencies.client)",
  ) &&
    uploadHook.includes("trusted-writer database role-bound client required") &&
    uploadHook.includes("issueP0WorkerOperationToken(request, {") &&
    uploadHook.includes('{ isolationLevel: "Serializable" }'),
);

check(
  "authenticated principal adapter imports the real current account boundary",
  principal.includes('import { currentAccount } from "../session";') &&
    principal.includes("const account = await currentAccount();"),
);
check(
  "P0 principal adapter never uses demo or effective-user identity",
  !principal.includes("currentUserOrDemo") &&
    !principal.includes("effectiveUser") &&
    !principal.includes("demoUser"),
);
check(
  "P0 admin cookie impersonation remains denied",
  principal.includes("async revalidateAdminDelegation()") &&
    principal.includes('principal.authorizationKind === "ADMIN_IMPERSONATION") return false'),
);
check(
  "worker authority is server-secret, scoped, expiring, and repository-purpose checked",
  principal.includes("P0_WORKER_TOKEN_HMAC_KEY_BASE64URL") &&
    principal.includes("WORKER_TOKEN_MAX_LIFETIME_MS") &&
    principal.includes("p0WorkerOperationAuthorizesRepositoryPurpose(") &&
    principal.includes("row.revision !== token.expectedRevision"),
);

const writerManifest = Object.freeze({
  "lib/creditTruth/prismaCaseActionRepository.ts": [
    "caseActionDecision.create",
    "caseActionSourceRef.create",
  ],
  "lib/creditTruth/prismaConsumerConfirmationRepository.ts": [
    "consumerAssertion.create",
  ],
  "lib/creditTruth/prismaExtractionInputRepository.ts": ["artifact.create"],
  "lib/creditTruth/prismaReportIngestionRepository.ts": [
    "creditTruthScope.createMany",
    "reportIngestion.create",
    "reportIngestion.updateMany",
  ],
  "lib/creditTruth/prismaReportVersionRepository.ts": [
    "artifact.create",
    "creditTruthScope.createMany",
    "reportVersion.create",
  ],
  "lib/creditTruth/prismaRound0Repository.ts": [
    "consumerAccountReviewReceipt.create",
    "identityBaseline.create",
    "identityBaselineAccountReviewMembership.create",
    "identityCategoryCompletion.create",
    "identityCorrespondenceAssertion.create",
    "identityFact.create",
  ],
  "lib/creditTruth/prismaSensitiveAccessRepository.ts": [
    "p0SensitiveAccessEvent.create",
  ],
  "lib/creditTruth/prismaShadowTruthGraphRepository.ts": [
    "extractionRun.create",
  ],
  "lib/creditTruth/prismaSourceArtifactProvider.ts": ["p0SourceObject.create"],
} as const);

const writerPaths = Object.keys(writerManifest).sort();
const concretePrismaFiles = readdirSync(resolve(root, "lib/creditTruth"))
  .filter((name) => /^prisma.*(?:Repository|Provider)\.ts$/.test(name))
  .map((name) => `lib/creditTruth/${name}`)
  .sort();
check(
  `all ${writerPaths.length} concrete Prisma writer files are explicitly enumerated`,
  sameSet(concretePrismaFiles, writerPaths),
);
check(
  "signed readiness source identity includes every concrete writer and verification boundary",
  writerPaths.every((path) =>
    P0_TRUSTED_WRITER_IMPLEMENTATION_SOURCE_MANIFEST.includes(path as never),
  ) &&
    [
      routePath,
      "lib/auth.ts",
      "lib/classify.ts",
      "lib/prisma.ts",
      "lib/session.ts",
      "lib/creditTruth/principalPrismaAdapter.ts",
      dedicatedDatabaseClientPath,
      "lib/creditTruth/consumerAssertion.ts",
      "lib/creditTruth/trustedWriterUploadHook.ts",
      "lib/creditTruth/trustedWriterParserExecution.ts",
      "lib/creditTruth/trustedWriterValueProtection.ts",
      "lib/creditTruth/types.ts",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "prisma/schema.prisma",
      "prisma/migrations/migration_lock.toml",
      "prisma/migrations/20260808_p0_credit_truth_foundation/migration.sql",
      "prisma/migrations/20260810_p0_phase2a_ingestion_round0/migration.sql",
      "prisma/migrations/20260811_p0_trusted_writer_gate/migration.sql",
      "scripts/p0-trusted-writer-disposable-verify.sh",
      "scripts/p0-trusted-writer-real-adapter.test.ts",
      "scripts/sql/p0-trusted-writer-db-role-contract.sql",
      "scripts/sql/p0-trusted-writer-validator-boundary.sql",
    ].every((path) =>
      P0_TRUSTED_WRITER_IMPLEMENTATION_SOURCE_MANIFEST.includes(path as never),
    ) &&
    new Set(P0_TRUSTED_WRITER_IMPLEMENTATION_SOURCE_MANIFEST).size ===
      P0_TRUSTED_WRITER_IMPLEMENTATION_SOURCE_MANIFEST.length,
);
check(
  "every enumerated concrete writer is a serializable transactional adapter",
  writerPaths.every((path) => {
    const source = read(path);
    return source.includes("$transaction") && source.includes('isolationLevel: "Serializable"');
  }),
);
check(
  "every enumerated writer performs repository-side principal revalidation",
  writerPaths.every((path) => {
    const source = read(path);
    return path === "lib/creditTruth/prismaSourceArtifactProvider.ts"
      ? source.includes("revalidatePrincipal(")
      : source.includes("principalRevalidator.revalidateInTransaction(") ||
          source.includes("dependencies.revalidatePrincipal(");
  }),
);
check(
  "every enumerated writer contains persisted-state readback logic",
  writerPaths.every((path) => /readback|read back|persisted/i.test(read(path))),
);

const schemaP0Start = schema.indexOf("model CreditTruthScope");
assert(schemaP0Start >= 0, "CreditTruthScope schema boundary is missing");
const p0Models = [...schema.slice(schemaP0Start).matchAll(/^model\s+([A-Za-z][A-Za-z0-9]*)\s+\{/gm)]
  .map((match) => match[1]!);
const p0Delegates = new Set(
  p0Models.map((model) => `${model[0]!.toLowerCase()}${model.slice(1)}`),
);
const mutationPattern = /\b(?:prisma|transaction|tx|client)\.([a-z][A-Za-z0-9]*)\.(createMany|create|updateMany|update|upsert|deleteMany|delete)\s*\(/g;
const observedDirectMutations = new Map<string, Set<string>>();
for (const [path, source] of productionSource) {
  for (const match of source.matchAll(mutationPattern)) {
    const delegate = match[1]!;
    if (!p0Delegates.has(delegate)) continue;
    const operation = `${delegate}.${match[2]}`;
    const entries = observedDirectMutations.get(path) ?? new Set<string>();
    entries.add(operation);
    observedDirectMutations.set(path, entries);
  }
}
check(
  "no direct P0 Prisma mutation exists outside the explicit writer allowlist",
  [...observedDirectMutations.keys()].every((path) => path in writerManifest),
);
for (const path of writerPaths) {
  check(
    `${path} exposes only its enumerated direct P0 mutations`,
    sameSet(observedDirectMutations.get(path) ?? [], writerManifest[path as keyof typeof writerManifest]),
  );
}
check(
  "P0 evidence writers contain no direct delete or deleteMany surface",
  [...observedDirectMutations.values()].every((operations) =>
    [...operations].every((operation) => !/\.delete(?:Many)?$/.test(operation)),
  ),
);
check(
  "mutable P0 update authority is limited to revisioned ReportIngestion CAS",
  [...observedDirectMutations.entries()].every(([path, operations]) =>
    [...operations]
      .filter((operation) => /\.update(?:Many)?$/.test(operation))
      .every(
        (operation) =>
          path === "lib/creditTruth/prismaReportIngestionRepository.ts" &&
          operation === "reportIngestion.updateMany",
      ),
  ),
);

const graph = read("lib/creditTruth/prismaShadowTruthGraphRepository.ts");
const graphDelegates = [
  ...graph.matchAll(
    /create(?:Many|ReusableMembership)\(transaction\.([a-z][A-Za-z0-9]*),/g,
  ),
].map((match) => match[1]!);
check(
  "generic shadow-graph inserts enumerate the exact Phase 2A graph membership",
  sameSet(graphDelegates, [
    "account",
    "accountPresenceObservation",
    "bureauReportDateEvidence",
    "creditScoreObservation",
    "extractionBureauCoverage",
    "fieldObservation",
    "historicalEvidence",
    "identityBaseline",
    "identityFact",
    "reportVersionAccount",
    "round0SourceCompletenessEvidence",
    "sectionCompleteness",
  ]),
);
check(
  "generic shadow-graph insert helper rejects partial row creation",
  graph.includes('if (result.count !== data.length) throw new Error("partial graph write")') &&
    /full readback below must still prove every\s+\/\/ expected id and semantic field/.test(graph),
);
const dynamicDelegateMutations = [...productionSource]
  .flatMap(([path, source]) =>
    [...source.matchAll(/(?:\[[^\]]+\]|\bdelegate)\.(createMany|create|updateMany|update|upsert|deleteMany|delete)\s*\(/g)]
      .map((match) => `${path}:${match[0]}`),
  );
check(
  "dynamic delegate mutation is confined to the enumerated shadow-graph insert helper",
  dynamicDelegateMutations.length === 2 &&
    dynamicDelegateMutations.every(
      (entry) =>
        entry ===
        "lib/creditTruth/prismaShadowTruthGraphRepository.ts:delegate.createMany(",
    ),
);

const forbiddenPhase2BDelegates = [
  "recipient",
  "recipientAddressVersion",
  "disputeCase",
  "correspondence",
  "correspondenceItem",
  "correspondenceVersion",
  "correspondenceVersionItem",
  "packet",
  "packetCorrespondenceVersion",
  "packetEnclosure",
  "artifactCorrespondenceVersion",
  "artifactTombstone",
  "evidenceEvent",
  "reportComparison",
  "reportDifference",
  "disputeOutcome",
];
check(
  "no Phase 2B delegate is mutated by a concrete trusted writer",
  writerPaths.every((path) =>
    forbiddenPhase2BDelegates.every(
      (delegate) =>
        !new RegExp(`\\b(?:transaction|prisma|client|tx)\\.${delegate}\\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\\s*\\(`).test(read(path)),
    ),
  ),
);
check(
  "trusted-writer migration creates no Phase 2B table",
  [
    "Recipient",
    "Correspondence",
    "CorrespondenceItem",
    "CorrespondenceVersion",
    "Packet",
    "ArtifactCorrespondenceVersion",
    "ReportComparison",
    "ReportDifference",
    "DisputeOutcome",
  ].every((model) => !migration.includes(`CREATE TABLE \"${model}\"`)),
);

const rawWritePattern = /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+(?:public\.)?["`]?([A-Za-z][A-Za-z0-9]*)["`]?/gi;
const rawP0Writes: string[] = [];
for (const [path, source] of productionSource) {
  for (const match of source.matchAll(rawWritePattern)) {
    if (p0Models.includes(match[1]!)) rawP0Writes.push(`${path}:${match[0]}`);
  }
}
check("no production source contains a raw-SQL P0 mutation", rawP0Writes.length === 0);
check(
  "CreditTruth production code has no executeRaw mutation escape hatch",
  productionFiles
    .filter((path) => path.startsWith("lib/creditTruth/"))
    .every((path) => !read(path).includes("$executeRaw")),
);
const creditTruthRawQueryFiles = productionFiles
  .filter((path) => path.startsWith("lib/creditTruth/"))
  .filter((path) => /\$queryRaw(?:Unsafe)?/.test(read(path)));
check(
  "CreditTruth raw SQL is confined to reviewed locks plus exact database-role identity",
  sameSet(creditTruthRawQueryFiles, [
    "lib/creditTruth/prismaExtractionInputRepository.ts",
    "lib/creditTruth/prismaReportVersionRepository.ts",
    "lib/creditTruth/prismaSourceArtifactProvider.ts",
    dedicatedDatabaseClientPath,
  ]) &&
    creditTruthRawQueryFiles.every((path) => {
      const source = read(path);
      return source.includes("SELECT") &&
        (path === dedicatedDatabaseClientPath
          ? source.includes("current_user::text") &&
            source.includes("session_user::text")
          : source.includes("FOR UPDATE")) &&
        !/(?:INSERT\s+INTO|DELETE\s+FROM|TRUNCATE\s|\bUPDATE\s+\")/i.test(source);
    }),
);

const concreteChainPaths = [
  routePath,
  uploadHookPath,
  principalPath,
  dedicatedDatabaseClientPath,
  ...writerPaths,
  "lib/creditTruth/trustedWriterValueProtection.ts",
  "lib/creditTruth/trustedWriterReadiness.ts",
  "lib/creditTruth/trustedWriterParserExecution.ts",
];
const localSyntheticSymbols = /\b(?:createLocalSynthetic|attestLocalSynthetic|LOCAL_SYNTHETIC_ONLY)\b/;
check(
  "no local-synthetic adapter symbol is imported or invoked by the concrete chain",
  concreteChainPaths.every((path) => !localSyntheticSymbols.test(read(path))),
);
check(
  "concrete chain imports only shared repository contracts, never the local factory namespace",
  concreteChainPaths.every(
    (path) =>
      !/import\s+\*\s+as\s+\w+\s+from\s+["']\.\/repository["']/.test(read(path)) &&
      !/import[\s\S]{0,500}createLocalSyntheticP0Repository[\s\S]{0,500}from\s+["']\.\/repository["']/.test(read(path)),
  ),
);
const localSyntheticAuthorityFactories = new Map<string, string>();
for (const [path, source] of productionSource) {
  if (!path.startsWith("lib/creditTruth/")) continue;
  for (const match of source.matchAll(
    /^export\s+(?:async\s+)?function\s+(createLocalSynthetic[A-Za-z0-9]+)\s*\(/gm,
  )) {
    localSyntheticAuthorityFactories.set(match[1]!, path);
  }
}
check(
  "all local-synthetic authority factories are explicitly inventoried",
  sameSet(localSyntheticAuthorityFactories.keys(), [
    "createLocalSyntheticP0Repository",
    "createLocalSyntheticP0ShadowTruthGraphRepository",
    "createLocalSyntheticP0ShadowValueProtector",
    "createLocalSyntheticP0SourceArtifactProvider",
    "createLocalSyntheticP0SourceErasureRepository",
    "createLocalSyntheticP0SourceRetentionState",
  ]),
);
check(
  "every local-synthetic authority factory rejects production before creating state",
  [...localSyntheticAuthorityFactories].every(([factory, path]) => {
    const source = read(path);
    const start = source.indexOf(`function ${factory}`);
    const nextExport = source.indexOf("\nexport ", start + factory.length);
    const segment = source.slice(start, nextExport < 0 ? undefined : nextExport);
    const guard = segment.indexOf('if (process.env.NODE_ENV === "production")');
    const denial = segment.indexOf("throw new Error(", guard);
    return start >= 0 && guard >= 0 && guard < 500 && denial > guard && denial < guard + 300;
  }),
);
check(
  "production application source imports neither verifier scripts nor migrations",
  [...productionSource.values()].every(
    (source) =>
      !/from\s+["'][^"']*(?:scripts\/|prisma\/migrations\/)/.test(source) &&
      !/import\s*\(["'][^"']*(?:scripts\/|prisma\/migrations\/)/.test(source),
  ),
);

check(
  "server flags are exact-true and absent values resolve disabled",
  flags.includes('function exactTrue(value: unknown): boolean') &&
    flags.includes('return value === "true";') &&
    flags.includes("phase2Enabled: exactTrue(process.env.P0_PHASE2_ENABLED)") &&
    flags.includes("ingestionShadowEnabled: exactTrue("),
);
check(
  "root kill switch always contributes a denial reason",
  flags.includes('if (flags.killSwitchEngaged) reasons.push("KILL_SWITCH_ENGAGED")'),
);
check(
  "cohort authority is server-resolved from an opaque exact-scope allowlist",
  flags.includes("export async function resolveP0Phase2ACohortFromServerEnvironment") &&
    flags.includes("process.env.P0_PHASE2_COHORT_SCOPE_SHA256S") &&
    flags.includes("p0Phase2ACohortScopeSha256(input.scope)") &&
    flags.includes('resolverId: "server-env:p0-phase2a-cohort-v1"'),
);
check(
  "missing, invalid, or excluded cohort always fails closed",
  flags.includes('reasons.push("COHORT_DECISION_MISSING_OR_INVALID")') &&
    flags.includes('reasons.push("COHORT_EXCLUDED")'),
);
check(
  "production activation requires signed writer evidence and remains blocked",
  readiness.includes('mode === "PRODUCTION_ACTIVATION"') &&
    readiness.includes('reasons.push("AUTHENTICATED_PRODUCTION_REPOSITORY_RECEIPT_REQUIRED")') &&
    readiness.includes('productionActivation: "BLOCKED"'),
);
check(
  "deployment role, hard PDF isolation, retention approval, and Founder authorization remain mandatory",
  [
    "DEPLOYED_DB_ROLE_ATTESTATION_REQUIRED",
    "HARD_PROCESS_ISOLATED_PDF_TERMINATION_REQUIRED",
    "RETENTION_LEGAL_HOLD_APPROVAL_REQUIRED",
    "FOUNDER_ACTIVATION_AUTHORIZATION_REQUIRED",
  ].every((reason) => readiness.includes(`reasons.push(\"${reason}\")`)),
);
check(
  "trusted-writer receipt is verify-only, signed, exact-manifest, and dormant-mode bound",
  signedReadiness.includes("createPublicKey") &&
    signedReadiness.includes("verifySignature") &&
    signedReadiness.includes('configurationMode: "DORMANT_DEFAULT_OFF"') &&
    signedReadiness.includes('attestationResult: "PASS"') &&
    signedReadiness.includes("exactOrderedSet(") &&
    !signedReadiness.includes("createPrivateKey"),
);

check(
  "disposable verifier accepts no caller target and clears inherited database targets",
  verifier.includes('[[ $# -eq 0 ]] || fail "no arguments are accepted; this verifier creates its own targets"') &&
    verifier.includes("unset DATABASE_URL DIRECT_URL SHADOW_DATABASE_URL PRISMA_DATABASE_URL") &&
    verifier.includes("unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE"),
);
check(
  "disposable verifier pins local PostgreSQL 16.14 by immutable image identity",
  verifier.includes('readonly POSTGRES_IMAGE_ID="sha256:') &&
    verifier.includes('readonly POSTGRES_VERSION_PREFIX="postgres (PostgreSQL) 16.14"') &&
    verifier.includes('[[ "${local_image_id}" == "${POSTGRES_IMAGE_ID}" ]]') &&
    verifier.includes("--pull=never"),
);
check(
  "disposable verifier permits only a local unix Docker endpoint and loopback port",
  verifier.includes('[[ "${docker_endpoint}" =~ ^unix:///') &&
    verifier.includes("--publish 127.0.0.1::5432") &&
    verifier.includes("@127.0.0.1:${host_port}"),
);
check(
  "disposable verifier performs exactly two pristine runs and confirms teardown",
  verifier.includes("run_pristine_pass 1") &&
    verifier.includes("run_pristine_pass 2") &&
    verifier.includes("stop_active_container") &&
    verifier.includes("teardown confirmed"),
);
check(
  "disposable verifier forbids test-runtime dependency leakage into the worktree",
  verifier.includes("P0 worktree node_modules must be absent before isolated generation") &&
    verifier.includes("isolated node_modules leaked into the P0 worktree"),
);

process.stdout.write(
  `${passed}/${passed} PASS p0-trusted-writer-surface-audit (${writerPaths.length} concrete writers, ${p0Models.length} P0 models scanned)\n`,
);
