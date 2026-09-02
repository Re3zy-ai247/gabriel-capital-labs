// Gate D production migration preflight.
//
// This command is intentionally read-only. In this held post-DB5 artifact it
// derives the canonical applied expectation from all eight committed migration.sql
// files; any future authored/unapplied files remain a separate exact-absence
// expectation. It verifies a separately
// owner-approved database fingerprint as consistency evidence only (not a
// later-connection attestation), reads PostgreSQL catalogs inside a READ ONLY
// transaction, and emits deterministic JSON. It never executes or prints
// migration mutation commands.
//
// Static manifest only:
//   npx tsx scripts/gate-d-preflight.ts --manifest
//
// Owner-authorized identity observation (read-only; does not classify schema).
// Securely export GATE_D_DATABASE_URL without echoing it, then run:
//   npx tsx scripts/gate-d-preflight.ts --observe-fingerprint
//
// Full preflight. Securely export GATE_D_DATABASE_URL and the separately approved
// GATE_D_EXPECTED_DB_FINGERPRINT, then run:
//   npx tsx scripts/gate-d-preflight.ts
import { join } from "node:path";

import {
  buildPreflightReport,
  buildUnknownPreflightReport,
  db5DeployCandidateList,
  loadGateDManifest,
  manifestCoverage,
  renderPreflightReport,
  stableStringify,
} from "./gate-d-preflight-core";
import {
  GateDDatabaseInspectionError,
  inspectGateDDatabase,
  observeGateDDatabaseFingerprint,
} from "./gate-d-preflight-catalog";

const repoRoot = join(__dirname, "..");

function write(value: unknown): void {
  process.stdout.write(`${stableStringify(value)}\n`);
}

async function main(): Promise<void> {
  let manifest: ReturnType<typeof loadGateDManifest>;
  try {
    manifest = loadGateDManifest(repoRoot);
  } catch {
    write({
      decision: "ABORT",
      error: "MIGRATION_MANIFEST_UNSUPPORTED_OR_INCOMPLETE",
      formatVersion: 1,
      mutationAuthorized: false,
    });
    process.exitCode = 1;
    return;
  }
  const args = process.argv.slice(2);
  const allowed = new Set(["--manifest", "--observe-fingerprint"]);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0 || args.length > 1) {
    write({
      decision: "ABORT",
      error: "UNSUPPORTED_ARGUMENTS",
      formatVersion: 1,
      mutationAuthorized: false,
    });
    process.exitCode = 1;
    return;
  }

  if (args[0] === "--manifest") {
    write({
      coverage: manifestCoverage(manifest),
      formatVersion: 1,
      manifestHash: manifest.manifestHash,
      preDb5AbsenceGate: {
        authoredUnappliedMigrations: manifest.authoredUnappliedMigrations.map((migration) => ({
          checksum: migration.checksum,
          name: migration.name,
        })),
        deployCandidateList: db5DeployCandidateList(manifest),
        mutationAuthorized: false,
        requiredState: "ALL_ABSENT",
      },
      migrations: manifest.migrations.map((migration) => ({
        checksum: migration.checksum,
        name: migration.name,
      })),
      mutationAuthorized: false,
    });
    return;
  }

  const databaseUrl = process.env.GATE_D_DATABASE_URL;
  if (!databaseUrl) {
    process.stdout.write(
      renderPreflightReport(buildUnknownPreflightReport(manifest, "GATE_D_DATABASE_URL_MISSING")),
    );
    process.exitCode = 1;
    return;
  }

  if (args[0] === "--observe-fingerprint") {
    try {
      const fingerprint = await observeGateDDatabaseFingerprint(databaseUrl);
      write({
        databaseFingerprint: fingerprint,
        decision: "OWNER_VERIFICATION_REQUIRED",
        formatVersion: 1,
        fingerprintScope: "CONSISTENCY_EVIDENCE_ONLY",
        identitySource: "pg_control_system+pg_database+pg_namespace",
        mutationAuthorized: false,
      });
      process.exitCode = 2;
    } catch (error) {
      const code =
        error instanceof GateDDatabaseInspectionError
          ? error.code
          : "DATABASE_IDENTITY_UNAVAILABLE";
      process.stdout.write(renderPreflightReport(buildUnknownPreflightReport(manifest, code)));
      process.exitCode = 1;
    }
    return;
  }

  const expectedFingerprint = process.env.GATE_D_EXPECTED_DB_FINGERPRINT;
  if (!expectedFingerprint || !/^[a-f0-9]{64}$/.test(expectedFingerprint)) {
    process.stdout.write(
      renderPreflightReport(
        buildUnknownPreflightReport(manifest, "OWNER_APPROVED_DATABASE_FINGERPRINT_MISSING"),
      ),
    );
    process.exitCode = 1;
    return;
  }

  try {
    const snapshot = await inspectGateDDatabase(databaseUrl, expectedFingerprint);
    const report = buildPreflightReport(manifest, snapshot, expectedFingerprint);
    process.stdout.write(renderPreflightReport(report));
    process.exitCode =
      report.decision === "READY_FOR_OWNER_APPROVAL" ||
      report.decision === "READY_FOR_DB5_APPROVAL" ||
      report.decision === "NO_PENDING_MIGRATIONS"
        ? 0
        : 2;
  } catch (error) {
    const inspection =
      error instanceof GateDDatabaseInspectionError
        ? error
        : new GateDDatabaseInspectionError("DATABASE_CONNECTION_FAILED");
    process.stdout.write(
      renderPreflightReport(
        buildUnknownPreflightReport(
          manifest,
          inspection.code,
          expectedFingerprint,
          inspection.observedFingerprint,
        ),
      ),
    );
    process.exitCode = 1;
  }
}

void main();
