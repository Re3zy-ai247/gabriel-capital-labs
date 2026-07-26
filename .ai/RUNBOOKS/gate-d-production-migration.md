# Gate D — Production Migration Runbook (Operator Platform Schema)

**Status:** HARDENED FOR REVIEW · NOT EXECUTED · GATE D NOT AUTHORIZED
**Repository baseline:** `main` / `origin/main` at `c28188fbd8a557c556ea89f124b7293cb769b5a3` on 2026-07-25
**Production observation:** `x-cv-release: c28188fbd8a5` on 2026-07-25; reverify at execution time
**Production database migration state:** **UNKNOWN** until the owner authorizes and reviews the read-only preflight below

This runbook is an execution package, not execution approval. It applies the six committed additive migrations while all platform capabilities remain dormant. It does not activate Identity, Reputation, Arena, Network, or Event Fabric.

## 1. Immutable boundaries

- Use a clean checkout of the exact production release.
- Use a direct PostgreSQL connection, never an Accelerate URL. Its grammar is exact: `postgres:`/`postgresql:`, authority `db.prisma.io:5432`, one database path, no fragment, and **only** one query parameter, `sslmode=require`. Reject every other parameter—including `host`, `hostaddr`, `port`, `service`, `servicefile`, `options`, `schema`, pooler controls, and duplicates—because Prisma can honor effective-target overrides after URI authority parsing.
- All catalog inspection runs through `scripts/gate-d-preflight.ts` inside an explicitly `READ ONLY` transaction.
- Expected schema is derived on every run from the six committed `migration.sql` files. A representative-object probe is prohibited.
- The database fingerprint must be captured from a separately owner-approved production invariant and supplied back to the full preflight. Never infer or invent it.
- Production/Preview database-value equality is **UNKNOWN**. Separate Vercel scope entries do not prove equal or unequal encrypted values.
- `prisma migrate resolve` and `prisma migrate deploy` are separate, owner-approved mutations. The preflight never executes or prints either command.
- No `db push`, `migrate dev`, reset, hand-written DDL, history edit, grant, backup, environment mutation, or flag change is part of the preflight.
- Keep all five platform flags OFF throughout Gate D:
  - `OPERATOR_IDENTITY_ENABLED`
  - `OPERATOR_REPUTATION_ENABLED`
  - `OPERATOR_NETWORK_ENABLED`
  - `EVENT_BUS_ENABLED`
  - `ARENA_ENABLED`

## 2. Exact migration chain and manifest coverage

| Order | Migration | Enum types | Tables | Columns | Explicit indexes | Primary keys | FKs |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | `0_init` | 6 | 26 | 240 | 39 | 26 | 13 |
| 2 | `20260720204355_operator_network_messages` | 0 | 2 | 15 | 5 | 2 | 2 |
| 3 | `20260720223438_event_bus` | 0 | 1 | 11 | 4 | 1 | 0 |
| 4 | `20260720231803_event_bus_agency_index` | 0 | 0 | 0 | 1 | 0 | 0 |
| 5 | `20260721120000_operator_identity` | 5 | 3 | 22 | 9 | 3 | 4 |
| 6 | `20260721160000_operator_reputation` | 0 | 2 | 16 | 4 | 2 | 2 |
| **Total** |  | **11** | **34** | **304** | **62** | **34** | **21** |

> **Review gate:** run `npx --no-install tsx scripts/gate-d-preflight.ts --manifest` and use its machine-derived totals as authority. If this table differs from the tool, STOP and correct this document before any database access. The current reviewed manifest also reports 48 enum values, 0 SQL unique constraints, 0 check constraints, and 0 extension requirements.

The parser recognizes only the SQL forms present in this chain: enum creation, table/column/primary-key definitions, explicit indexes, foreign keys, and extension declarations. Any unsupported statement or type/default construct aborts manifest generation. It verifies:

- object schema;
- enum label order and values;
- table kind;
- exact column set, types, nullability, and defaults;
- primary keys and SQL unique/check constraints;
- index table, uniqueness, method, key order, direction/null ordering, default opclasses/collations, included columns, predicate, readiness/validity, exclusion, and null-distinct behavior;
- FK source/target columns, match type, update/delete actions, deferrability, and validation;
- extension requirements;
- migration-history checksum and completion state.

The dependency order is fixed: `User` precedes Network and Identity; `EventEnvelope` precedes its agency index; `OperatorIdentity` precedes Reputation. Do not reorder or hand-apply files.

## 3. State taxonomy

Each migration receives exactly one state:

| State | Exact meaning | Runbook treatment |
|---|---|---|
| `ALL_PRESENT_AND_MATCHING` | Every expected physical object matches and one completed history row has the committed checksum. | Safe evidence; no reconciliation. |
| `ALL_ABSENT` | No expected root object exists and history does not claim the migration applied. | May remain pending for owner-approved deploy if chain order and privileges pass. |
| `PARTIAL` | Some expected objects exist and others are absent, with no applied history. | **ABORT.** |
| `DRIFTED` | An expected object exists with a different definition, or a migration-owned table has an unexpected column/index/constraint. | **ABORT.** |
| `HISTORY_ONLY` | History says applied, but the expected physical schema is absent, incomplete, or divergent. | **ABORT.** |
| `SCHEMA_ONLY` | The complete physical schema matches byte-for-byte expectations, but applied history is absent. | Owner-reviewed baseline candidate only; not permission to resolve. |
| `UNKNOWN` | Identity, catalog, history, checksum, permission, history-object proof, or outcome evidence is missing/ambiguous. Any `rolled_back_at` row—regardless of `finished_at`—is historically ambiguous, never absent. | **ABORT.** |

Safe chain order is zero or more complete migrations followed by zero or more absent migrations. Once an `ALL_ABSENT` migration appears, every later migration must also be `ALL_ABSENT`. Any later present migration is incoherent and aborts. Production's live application requires the `0_init` baseline; `0_init = ALL_ABSENT` is therefore contradictory wrong-target/data-loss evidence and always aborts.

## 4. Preconditions — every item must pass

| ID | Required evidence |
|---|---|
| P1 | Clean isolated checkout; `HEAD == origin/main`; no overlapping Gate D worktree/branch. |
| P2 | Production has exactly one `x-cv-release` field whose complete value is the lowercase 12-character prefix of the reviewed `origin/main` SHA. HTTP 200 alone is insufficient; duplicate, folded, combined, suffixed, prefixed, or internal-whitespace-bearing values fail. |
| P3 | All five flags above are absent or not exactly `true` both in the immutable environment snapshot of the exact active Production deployment and in current Production configuration—and in any environment proven to share the target database. Record the evidence; do not change flags. |
| P4 | Fresh production backup/snapshot identifier, UTC completion time, source database fingerprint, successful completion evidence, retention, integrity validation, and a restore procedure previously proven on an isolated target. A vague “backup exists” assertion fails. |
| P5 | Owner-approved direct PostgreSQL URL obtained from the provider console: exact URI grammar from §1, including only `sslmode=require`. `prisma:`, `pooled.db.prisma.io`, arbitrary/effective override hosts, pooler mode, unapproved query parameters, and missing TLS invariant abort. |
| P6 | Owner-approved expected database fingerprint from §5. A newly observed value is not self-approving. |
| P7 | Full preflight output retained; no `PARTIAL`, `DRIFTED`, `HISTORY_ONLY`, or `UNKNOWN`; chain order coherent. |
| P8 | Read-only privilege report passes required `CONNECT`, `public` `USAGE`/`CREATE`, table ownership/ALTER-equivalent checks, and column `REFERENCES` checks. |
| P9 | No Docker/container `db push` or other non-migration schema synchronizer has touched the target since the approved fingerprint/state evidence. |
| P10 | Owner approves the exact reconciliation list, if any; full preflight is rerun afterward; owner then separately approves deploy. |

Before any Gate D command, install and prove the lockfile-pinned local tools from the clean checkout. Do not let `npx` fetch a different CLI version:

```bash
npm ci
npx --no-install prisma --version   # must report 5.22.0
npx --no-install tsx --version
```

### Disposable local Prisma-engine proof (not a Gate D command)

An isolated PostgreSQL integration can prove the six SQL files against the pinned Prisma engine, but it is **not** a Gate D preflight and supplies no Production evidence. The inspector intentionally rejects a local URL under §1; do not weaken that policy, add a `host` override, alter DNS, or use a shared Preview/Production target to make it run.

Required local prerequisites are a Docker-compatible runtime and a previously approved, locally available PostgreSQL 16 image pinned by digest. Never run `docker compose up` or the application `Dockerfile` for this proof: the application startup path contains `db push` and is prohibited here.

```bash
: "${GATE_D_LOCAL_POSTGRES_IMAGE:?approved local postgres:16 image@sha256 digest is required}"
docker image inspect "$GATE_D_LOCAL_POSTGRES_IMAGE" >/dev/null
GATE_D_LOCAL_CONTAINER=creditvector-gate-d-local-pg
if docker container inspect "$GATE_D_LOCAL_CONTAINER" >/dev/null 2>&1; then
  echo "refusing to reuse existing $GATE_D_LOCAL_CONTAINER" >&2; exit 1
fi
cleanup_gate_d_local_pg() { docker rm -f "$GATE_D_LOCAL_CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup_gate_d_local_pg EXIT
docker run -d --rm --name "$GATE_D_LOCAL_CONTAINER" \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=256m \
  --publish 127.0.0.1:55432:5432 \
  --env POSTGRES_USER=gate_d \
  --env POSTGRES_PASSWORD=gate_d_local_only \
  --env POSTGRES_DB=gate_d \
  "$GATE_D_LOCAL_POSTGRES_IMAGE"
for attempt in {1..30}; do
  docker exec "$GATE_D_LOCAL_CONTAINER" pg_isready -U gate_d -d gate_d >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$GATE_D_LOCAL_CONTAINER" pg_isready -U gate_d -d gate_d >/dev/null
DATABASE_URL='postgresql://gate_d:gate_d_local_only@127.0.0.1:55432/gate_d' \
  npx --no-install prisma migrate deploy
DATABASE_URL='postgresql://gate_d:gate_d_local_only@127.0.0.1:55432/gate_d' \
  npx --no-install prisma migrate status
trap - EXIT
cleanup_gate_d_local_pg
```

The loopback password and database above are disposable only; the `--tmpfs` data directory and `--rm` cleanup prevent persistence. This engine proof does **not** satisfy P4's provider backup/restore evidence and cannot validate the production-target inspector. A dedicated catalog/recovery/restore harness for this deliberately non-production URL is separate work; do not mistake it for preflight or execution authorization.

Execution-time release check:

```bash
git fetch origin
git status --short
git rev-parse HEAD
git rev-parse origin/main
curl -fsSI https://www.creditvector.app/ | tr -d '\r' | grep -i '^x-cv-release:'
scripts/release-verify.sh https://www.creditvector.app "$(git rev-parse HEAD)"
```

Require a clean status, equal full Git SHAs, and exactly one syntactically valid `x-cv-release` field whose entire value equals that SHA's first 12 characters. `release-verify.sh` permits only normal HTTP optional whitespace around the field value; a matching prefix with any suffix, duplicate, folded, combined, or internal-whitespace value fails. Any mismatch aborts.

Flag evidence:

```bash
: "${GATE_D_VERCEL_PROJECT:?owner-approved Vercel project ID/name is required}"
: "${GATE_D_VERCEL_SCOPE:?owner-approved Vercel team scope is required}"
GATE_D_FLAG_AUDIT_DIR="$(mktemp -d)"
chmod 700 "$GATE_D_FLAG_AUDIT_DIR"
set -euo pipefail

npx vercel project inspect "$GATE_D_VERCEL_PROJECT" \
  --scope "$GATE_D_VERCEL_SCOPE" \
  --cwd "$GATE_D_FLAG_AUDIT_DIR"

npx vercel inspect https://www.creditvector.app \
  --scope "$GATE_D_VERCEL_SCOPE" \
  --cwd "$GATE_D_FLAG_AUDIT_DIR"

npx vercel env ls production --format json \
  --project "$GATE_D_VERCEL_PROJECT" \
  --scope "$GATE_D_VERCEL_SCOPE" \
  --cwd "$GATE_D_FLAG_AUDIT_DIR" |
node -e '
const fs = require("node:fs");
const names = [
  "OPERATOR_IDENTITY_ENABLED",
  "OPERATOR_REPUTATION_ENABLED",
  "OPERATOR_NETWORK_ENABLED",
  "EVENT_BUS_ENABLED",
  "ARENA_ENABLED",
];
let failed = false;
let records;
try {
  const parsed = JSON.parse(fs.readFileSync(0, "utf8"));
  records = Array.isArray(parsed.envs) ? parsed.envs : null;
} catch {}
if (!records) {
  console.log("FLAG_METADATA=UNKNOWN");
  process.exit(1);
}
for (const name of names) {
  const matches = records.filter((record) => record && record.key === name);
  const readable =
    matches.length === 1 && ["plain", "encrypted"].includes(matches[0].type);
  const state =
    matches.length === 0
      ? "ABSENT"
      : readable
        ? "PRESENT_READABLE"
        : "UNKNOWN_DUPLICATE_OR_UNREADABLE";
  console.log(`${name}=${state}`);
  failed ||= state === "UNKNOWN_DUPLICATE_OR_UNREADABLE";
}
process.exitCode = failed ? 1 : 0;
'

env \
  -u OPERATOR_IDENTITY_ENABLED \
  -u OPERATOR_REPUTATION_ENABLED \
  -u OPERATOR_NETWORK_ENABLED \
  -u EVENT_BUS_ENABLED \
  -u ARENA_ENABLED \
  npx vercel env run -e production \
    --project "$GATE_D_VERCEL_PROJECT" \
    --scope "$GATE_D_VERCEL_SCOPE" \
    --cwd "$GATE_D_FLAG_AUDIT_DIR" \
    -- node -e '
const names = [
  "OPERATOR_IDENTITY_ENABLED",
  "OPERATOR_REPUTATION_ENABLED",
  "OPERATOR_NETWORK_ENABLED",
  "EVENT_BUS_ENABLED",
  "ARENA_ENABLED",
];
let enabled = false;
for (const name of names) {
  const value = process.env[name];
  const state = value === undefined ? "ABSENT" : value === "true" ? "ON" : "OFF_NOT_TRUE";
  console.log(`${name}=${state}`);
  enabled ||= state === "ON";
}
process.exitCode = enabled ? 1 : 0;
'

test -z "$(find "$GATE_D_FLAG_AUDIT_DIR" -mindepth 1 -print -quit)"
rmdir "$GATE_D_FLAG_AUDIT_DIR"
unset GATE_D_FLAG_AUDIT_DIR
```

Require `project inspect` to identify the exact owner-approved Gabriel Capital Labs/CreditVector project and scope; an absent, auto-created, ambiguous, or wrong target aborts. The first audit proves whether each flag is absent or has one readable `plain`/`encrypted` record. A duplicate, `sensitive`, `system`, legacy/unrecognized type, parse failure, or non-zero pipeline is `UNKNOWN` and aborts. Sensitive values are not locally readable and must never be treated as OFF.

The second audit runs from a newly created empty directory with all five ambient variables explicitly unset. This is mandatory because Vercel CLI otherwise merges local dotenv and ambient values over fetched values. It prints only `ABSENT`, `OFF_NOT_TRUE`, or `ON`, never actual values or unrelated variables. Reconcile the two outputs name-by-name: metadata `ABSENT` must equal value `ABSENT`; metadata `PRESENT_READABLE` must yield a value result. Any mismatch, missing line, non-zero command, file appearing in the audit directory, or `ON` aborts. Retain both outputs, then remove only the empty temporary directory.

Those two audits prove current project configuration, not by themselves the immutable environment snapshot of the deployment already serving Production. `vercel inspect` supplies the exact active deployment ID, creation time, target, and URL. It does **not** prove Git provenance or per-deployment environment overrides. The owner must separately retain authenticated Vercel Dashboard deployment details (or an authenticated deployment-API response filtered so it cannot print environment values) proving the Git source/commit and absence of a custom per-deployment environment override; reconcile that commit with P2.

The owner must then review Vercel's Activity Log from that deployment's creation time through the flag-audit time. Require conclusive evidence that none of these five keys was added, edited, deleted, renamed, moved through a shared variable, or affected by a shared-variable change during that interval. If provenance/override evidence is unavailable, the deployment was not created by the reviewed Git integration, the complete interval is unavailable, an event is ambiguous, any relevant event occurred, or a deployment-specific value cannot otherwise be proved, the active-deployment flag state is **UNKNOWN** and Gate D aborts. Current settings must never be substituted for this historical proof because Vercel applies environment changes only to new deployments.

If the target database is proven to be shared with Preview or another environment, rerun both audits with that exact target (and branch where applicable). If sharing cannot be established, record **UNKNOWN**; do not assert it. Primary references: Vercel's [`env run` documentation](https://vercel.com/docs/cli/env), [Sensitive-variable behavior](https://vercel.com/docs/environment-variables/sensitive-environment-variables), [environment-change deployment semantics](https://vercel.com/docs/environment-variables/managing-environment-variables), [Activity Log](https://vercel.com/docs/activity-log), and [CLI merge order](https://github.com/vercel/vercel/blob/main/packages/cli/src/commands/env/run.ts).

## 5. Database fingerprint — owner approval point 1

The fingerprint is SHA-256 over PostgreSQL's stable cluster identifier plus database/schema OIDs and names, the active schema, and effective explicit search path. The tool obtains these from `pg_control_system`, `pg_database`, and `pg_namespace`; it never prints credentials or the underlying identifiers. It is **consistency evidence only**: it is not cryptographic authorization, does not attest provider provenance, and cannot bind a later Prisma process or connection to the identical physical target.

1. The owner separately authorizes a read-only identity observation against a direct URL known from the provider console to be Production.
2. Load `GATE_D_DATABASE_URL` through a secure, non-echoing mechanism in a dedicated shell. Do not paste it into a recorded command, log it, or reuse ambient `DATABASE_URL`. Require it to be non-empty, then make it immutable for that shell:

   ```bash
   : "${GATE_D_DATABASE_URL:?owner-supplied direct URL is required}"
   readonly GATE_D_DATABASE_URL
   export GATE_D_DATABASE_URL
   npx --no-install tsx scripts/gate-d-preflight.ts --observe-fingerprint
   ```

3. The command deliberately exits non-zero with `OWNER_VERIFICATION_REQUIRED`. The owner compares/records the hash with the provider project/database record and approves it as the expected invariant.
4. If `pg_control_system` cannot be read, the active schema is not `public`, `public` is not first in the explicit search path, or the provider evidence cannot distinguish Production from Preview, state is `UNKNOWN` and Gate D stops.

Do not generate and approve a fingerprint from an untrusted URL in the same step. Preserve separate provider-side Production evidence, retain the approved output, and rerun §5/§6 immediately before any later reconciliation or deploy. A changed shell, URL variable, provider target, or material delay invalidates the evidence.

## 6. Exhaustive read-only preflight — owner approval point 2

```bash
: "${GATE_D_DATABASE_URL:?owner-supplied direct URL is required}"
: "${GATE_D_EXPECTED_DB_FINGERPRINT:?owner-approved fingerprint is required}"
readonly GATE_D_DATABASE_URL GATE_D_EXPECTED_DB_FINGERPRINT
export GATE_D_DATABASE_URL GATE_D_EXPECTED_DB_FINGERPRINT
npx --no-install tsx scripts/gate-d-preflight.ts
```

Properties:

- the transaction uses `REPEATABLE READ`, and its first database statement after begin is `SET TRANSACTION READ ONLY`;
- it must acquire Prisma 5.22's advisory-lock key `72707369` transactionally, preventing a concurrent Prisma migration from tearing the snapshot;
- fingerprint mismatch stops before detailed catalog reads;
- output is stable-key JSON with no timestamp or duration;
- rerunning against unchanged catalog/history produces byte-identical output;
- the tool emits only `proposedResolveList` and `pendingDeployList` names;
- `mutationAuthorized` is always `false`.

Interpret the top-level decision:

- `ABORT`: stop. Preserve output and investigate.
- `OWNER_BASELINE_REVIEW_REQUIRED`: one or more migrations are `SCHEMA_ONLY`. Do not deploy or resolve yet.
- `READY_FOR_OWNER_APPROVAL`: states, order, fingerprint, and required privileges passed; one or more migrations are genuinely absent. This is still not deploy authorization.
- `NO_PENDING_MIGRATIONS`: all six are fully present with matching history. Gate D schema may already be complete; verify postconditions.

## 7. Privilege proof

The preflight reads, but never exercises, privileges:

- database `CONNECT`;
- schema `public` `USAGE`;
- schema `public` `CREATE` when pending DDL creates types, tables, or indexes;
- owner-role usability for an index or constraint added to an already-existing table;
- column-level `REFERENCES` on existing FK targets such as `public."User"("id")` and, when applicable, `public."OperatorIdentity"("id")`;
- database `CREATE` only if a future reviewed manifest requires an extension (current chain requires none).
- `INSERT` and `UPDATE` on an existing `_prisma_migrations`, or schema `CREATE` when Prisma must create it;
- execution and successful acquisition of Prisma's PostgreSQL advisory lock.

Before reading migration rows or evaluating those privileges, the tool proves any existing `_prisma_migrations` relation is the pinned Prisma 5.22 ordinary permanent table: its exact eight columns/types/nullability/defaults, no identity/generated columns, sole `id` primary key, no partition attachment or inheritance parent/child, and no RLS/policies/rules/triggers. A same-named view, partitioned/unlogged/inherited table, malformed shape, or extra constraint is `UNKNOWN`; the tool does not select from an untrusted relation. This is intentionally pinned to the lockfile's Prisma 5.22.0 engine—upgrade review must re-derive the invariant rather than silently accepting a different shape.

It derives explicit capability results for type creation, table creation, index creation, constraint addition, and FK addition. `FALSE` or `UNKNOWN` on any required check aborts. Do not grant privileges during this runbook; access changes require a separate reviewed procedure.

## 8. Schema-only reconciliation — owner approval point 3

Only migrations classified `SCHEMA_ONLY` are eligible for consideration. `PARTIAL`, `DRIFTED`, `HISTORY_ONLY`, and `UNKNOWN` are never resolve candidates. A rolled-back, failed, incomplete, duplicate, contradictory, or malformed-history state is never treated as absent or schema-only.

1. Compare `proposedResolveList` to the retained exhaustive evidence and migration checksums.
2. Confirm P9: no Docker/non-migration synchronizer touched the target. If one did, stop even when the schema happens to match.
3. Owner explicitly approves the exact ordered list.
4. In the same dedicated shell whose immutable `GATE_D_DATABASE_URL` passed the immediately preceding full preflight, an operator may then, one name at a time, run:

   ```bash
   : "${GATE_D_DATABASE_URL:?validated direct URL is required}"
   DATABASE_URL="${GATE_D_DATABASE_URL}" \
     npx --no-install prisma migrate resolve --applied <owner-approved-exact-migration-name>
   ```

5. Preserve command output and updated history evidence.
6. Rerun the **full** §6 preflight after every resolution. Continue only when no `SCHEMA_ONLY` state remains and the reviewed `pendingDeployList` is unchanged or otherwise explicitly reconciled. A new shell, changed URL variable, or fingerprint change invalidates the approval and requires §5/§6 again.

Never resolve `0_init` merely because `User` exists. Never infer a whole migration from one table/index. Never resolve an absent migration.

## 9. Deploy — owner approval point 4

After backup proof, fingerprint match, full preflight, any separately approved reconciliation, and the mandatory rerun, the owner may authorize this one schema mutation:

```bash
: "${GATE_D_DATABASE_URL:?validated direct URL is required}"
DATABASE_URL="${GATE_D_DATABASE_URL}" \
  npx --no-install prisma migrate deploy
```

Run this only in the same dedicated shell whose immutable URL and owner-approved fingerprint passed the immediately preceding full preflight. Before running, compare the approved pending list with the preflight's exact `pendingDeployList`. Any difference aborts. Do not use `db push`, `migrate dev`, `reset`, `--accept-data-loss`, manual DDL, an ambient `DATABASE_URL`, or a different connection.

## 10. Interrupted migration recovery

Repository migrations are additive, but interruption outcomes are not reducible to “rerun resumes.” Prisma 5.22 records migration start, executes the SQL script, then records successful steps/finish separately. Its PostgreSQL connector sends each migration script as one simple-query message; PostgreSQL normally treats the script's multiple statements as one implicit transaction, but that DDL transaction is not atomic with Prisma's surrounding history bookkeeping.

After any disconnect, timeout, process death, or failed deploy:

1. Stop all migration operators. Do not retry.
2. Preserve CLI output, logs, connection metadata, backup ID, and the unedited `_prisma_migrations` evidence.
3. Establish that the original database execution has conclusively stopped.
4. Rerun both physical-catalog and migration-history inspection through the full preflight.
5. Apply the matching case:

| Observed case | Required treatment |
|---|---|
| DDL fully committed; no history row exists | `SCHEMA_ONLY` candidate. Owner-reviewed resolution only after exhaustive proof. |
| DDL fully committed; Prisma start row exists but finish bookkeeping is absent | `UNKNOWN` with complete physical evidence. Abort; use a separately reviewed failed-migration recovery/resolve procedure only after exhaustive proof. |
| Prisma history says applied; physical schema incomplete/divergent | `HISTORY_ONLY`; abort. Prefer a separately reviewed forward corrective migration. |
| Migration transaction fully rolled back; unfinished history remains | `UNKNOWN` even if every expected object is absent. Preserve the row and use a separately reviewed Prisma failed-migration recovery procedure; never blind retry or baseline-resolve it. |
| A non-transactional statement or external actor left partial schema | `PARTIAL`/`DRIFTED`; abort and design a forward corrective migration. |
| Network interruption leaves server outcome unknown | `UNKNOWN`; wait/inspect until physical and history outcomes are conclusive. |
| Earlier migrations completed; a later migration failed | Preserve earlier additive objects/history; recover only the later migration after full-chain reprobe. |
| Deploy client stopped while database execution continued | Do not start a second deploy. Wait for conclusive server state, then reprobe both planes. |

Never delete a valid live table to simulate rollback. Never delete a successful migration-history row casually. Never hand-edit `_prisma_migrations` without a separately reviewed recovery procedure. Preserve additive objects that older flag-off runtime safely ignores.

Primary behavior references: [Prisma 5.22 apply-migrations engine](https://github.com/prisma/prisma-engines/blob/5.22.0/schema-engine/core/src/commands/apply_migrations.rs), [Prisma 5.22 PostgreSQL connector](https://github.com/prisma/prisma-engines/blob/5.22.0/schema-engine/connectors/sql-schema-connector/src/flavour/postgres/connection.rs), and [PostgreSQL simple-query transaction behavior](https://www.postgresql.org/docs/current/protocol-flow.html).

## 11. Rollback and database reversal

- **Application rollback:** safe and independent. Revert application code while leaving compatible additive schema inert and all five flags OFF.
- **Routine database rollback:** do nothing. Empty/additive objects are safer left in place when older runtime ignores them.
- **Required database reversal:** create a separately reviewed forward migration after dependency/data analysis. Do not hand-drop objects or rewrite successful history.
- **Backup restore:** disaster recovery only—not an ordinary migration rollback. It requires an owner-declared incident, write freeze, accepted RPO/RTO and loss window, target fingerprint revalidation, and the verified restore procedure. Restoring a live snapshot can erase legitimate post-snapshot writes.

## 12. Docker `db push` governance

Repository truth on 2026-07-25:

- `Dockerfile` startup runs `npx prisma db push --skip-generate && npm run start`.
- The current command **does not** contain `--accept-data-loss`; any document saying it does is stale.
- `vercel.json` production build is `prisma generate && next build`; no migration or `db push`.
- `docker-compose.yml` is a local path that builds the Dockerfile and supplies its own `gcl` PostgreSQL 16 service. No repository CI, Preview, staging, or production configuration invokes it. Current Vercel production reachability is therefore **not found**; external/manual container use is **UNKNOWN**.
- A manually run container can receive any `DATABASE_URL`, including Production or a shared production-like database. Its unconditional startup `db push` bypasses migration history and conflicts with migration-first law.

The Docker path is prohibited for Production and any shared Preview/staging database. If it has touched the Gate D target since approved evidence, abort and investigate; a superficially matching `SCHEMA_ONLY` result is not automatically baseline-safe. Removing `db push` or redesigning container startup is a required follow-up, outside this narrow runbook-hardening task.

## 13. Post-deploy verification

Immediately rerun §6 against the same fingerprint. Require:

- all six migrations `ALL_PRESENT_AND_MATCHING`;
- empty `proposedResolveList`, empty `pendingDeployList`, and `NO_PENDING_MIGRATIONS`;
- all five new Operator tables exist with exact columns/defaults/indexes/FKs;
- row counts on `OperatorIdentity`, `Organization`, `OrganizationMembership`, `XpAward`, and `ReputationMilestone` are zero unless separately explained by an already-existing, owner-reviewed state;
- all five flags remain OFF;
- production `x-cv-release` is unchanged;
- `/`, `/pricing`, `/login`, `/community` retain expected success; dormant surfaces retain their pre-recorded redirect/404/403 behavior;
- no new migration/runtime errors during the owner-defined observation window.

If any check fails, keep flags OFF, preserve additive schema/evidence, and use §10/§11. Do not improvise reversal.

## 14. Stop conditions

Stop immediately on:

- dirty/non-isolated checkout or active overlapping Gate D work;
- release SHA/header mismatch;
- any flag ON or flag state unknown on a database-sharing environment;
- missing/unverified backup evidence;
- credential exposure risk;
- non-direct connection;
- missing, mismatched, or non-unique database identity evidence;
- unreadable or malformed required catalog/history relation;
- unsupported migration SQL;
- `0_init = ALL_ABSENT`;
- `PARTIAL`, `DRIFTED`, `HISTORY_ONLY`, `UNKNOWN`, checksum mismatch, any rolled-back/unfinished history row, or chain inversion;
- insufficient/unknown required privilege;
- evidence that Docker `db push` or another synchronizer touched the target;
- any preflight output change without an explained catalog/history change;
- any command proposing reset or data loss;
- any need for a grant, backup, restore, history edit, hand-written DDL, or unreviewed recovery;
- owner authorization required for the next step.

## 15. Approval ledger

Record separately:

1. owner authorization for read-only Production identity/preflight access;
2. approved fingerprint and provider evidence;
3. backup/restore evidence;
4. exact preflight output hash/file;
5. exact `proposedResolveList` approval, if non-empty;
6. full rerun output after resolution;
7. explicit deploy approval for the exact `pendingDeployList`;
8. post-deploy output;
9. any recovery approval.

Activation remains a later gate. Enabling flags, wiring producers, exposing new behavior, or beginning Sprint 11 product work is not part of Gate D.
