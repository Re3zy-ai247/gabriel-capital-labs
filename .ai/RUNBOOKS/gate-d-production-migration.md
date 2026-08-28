# Gate D — Production Migration Runbook (Operator Platform Schema)

**Status:** HARDENED FOR REVIEW · NOT EXECUTED · GATE D NOT AUTHORIZED
**RC1 review base:** candidate `2c3919dca6bbe0fd5beab9280ded52206c365c55`, tree `70b46cd661d0711ce2d1dbb5a11060f328849968`
**Execution release:** **UNSET** until Control Tower authorizes the remediated release commit; never execute from the review-base SHA merely because it is printed here
**Control Tower recorded Production release (no Production contact in this lane):** `a72a47c0a9934522339a9adfa315a0636c853e0c`; reverify only in an authorized execution lane
**Production database migration state:** **UNKNOWN** until the owner authorizes and reviews the read-only preflight below

This runbook is an evidence and execution package, not execution approval. It
classifies the six-migration applied Gate D chain and separately identifies the
two exact RC1 DB5 deploy candidates while all platform capabilities remain
dormant. It does not activate Identity, Reputation, Arena, Network, or Event
Fabric.

## 1. Immutable boundaries

- Use a clean checkout of the exact production release.
- Use a direct PostgreSQL connection, never an Accelerate URL. Its grammar is exact: `postgres:`/`postgresql:`, authority `db.prisma.io:5432`, one database path, no fragment, and **only** one query parameter, `sslmode=require`. Reject every other parameter—including `host`, `hostaddr`, `port`, `service`, `servicefile`, `options`, `schema`, pooler controls, and duplicates—because Prisma can honor effective-target overrides after URI authority parsing.
- All catalog inspection runs through `scripts/gate-d-preflight.ts` inside an explicitly `READ ONLY` transaction.
- Applied schema is derived on every run from the six committed Gate D `migration.sql` files. The two acknowledged RC1 authored/unapplied SQL files are parsed separately into an exact-absence gate. A representative-object probe is prohibited.
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

The same manifest separately pins this exact checksummed DB5 deploy-candidate
list, without adding either migration to applied coverage, `pendingDeployList`,
or `proposedResolveList`:

1. `20260728000000_terms_acceptance` — `d67e5b4b4761d6328fb0786ea976a1f889a49e308bbd5b354a768e7324e3e922`
2. `20260823120000_consumer_assertion` — `d5a7ea7ac31a12119ad413e8fc1290c923b1f9b9a3fd4fa4e046f44904d15ad0`

Before DB5, `preDb5AbsenceGate` must be `PASS`. For each name it requires
`state=ALL_ABSENT`, `physicalState=ALL_ABSENT`, `history=ABSENT`, and an empty
`presentPhysicalObjects` list. The expected inventory is derived from SQL and
includes every authored table, column, primary key and backing index, explicit
index, and foreign key. Backing index/relation names are checked across the whole
expected schema namespace, even when a same-name index belongs to another table;
constraint evidence remains table-scoped. Any full or partial physical presence,
namespace collision, same-name history row regardless of completion/rollback
state, or unknown catalog/history evidence is an `ABORT`.

The rendered `preDb5AbsenceGate.deployCandidateList` repeats the two names and
checksums above in lexical order and carries `mutationAuthorized=false`. A clean
pre-DB5 catalog produces `READY_FOR_DB5_APPROVAL`, not
`NO_PENDING_MIGRATIONS`. That decision reports a reviewable database state only;
it does not authorize DB5. Any candidate-list difference aborts.

The parser recognizes only the SQL forms present in this chain: enum creation, table/column/primary-key definitions, explicit indexes, foreign keys, and extension declarations. Any unsupported statement or type/default construct aborts manifest generation. It verifies:

- object schema;
- enum label order and values;
- table kind, partition/inheritance state, and absence of RLS/policies/rules/user-defined triggers;
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

The authored/unapplied absence state is deliberately separate from that taxonomy.
It has only one passing state: exact physical and historical `ALL_ABSENT`. It is
not an applied migration state and cannot enter either mutation proposal list.

## 4. Preconditions — every item must pass

| ID | Required evidence |
|---|---|
| P1 | Clean isolated checkout whose `HEAD` **and tree** exactly equal the separately Control-Tower-authorized DB5 migration-source objects. Do not infer source custody from the ambient working tree, branch name, or `origin/main`; no overlapping Gate D worktree/branch. |
| P2 | Independently bind the currently active Production release to its separately approved full SHA. Production must expose exactly one `x-cv-release` field whose complete value is that SHA's lowercase 12-character prefix. Because DB5 precedes RC1 promotion, this active Production SHA is expected to differ from the authorized DB5 migration-source SHA. HTTP 200 alone is insufficient; duplicate, folded, combined, suffixed, prefixed, or internal-whitespace-bearing values fail. |
| P3 | All five flags above are absent or not exactly `true` both in the immutable environment snapshot of the exact active Production deployment and in current Production configuration—and in any environment proven to share the target database. Record the evidence; do not change flags. |
| P4 | For the read-only DB4 gate, the already accepted DB-1 backup is sufficient. Immediately before DB5, require a new hardened production backup/snapshot with identifier, UTC completion time, source database fingerprint, successful completion evidence, retention, integrity validation, and a restore procedure previously proven on an isolated target. A vague “backup exists” assertion fails. |
| P5 | The previously exposed production credential is invalid for all further contact. Rotate it **before the next production DB contact, including DB4**, and retain rotation evidence without recording the secret. Use only the newly issued owner-approved direct PostgreSQL URL from the provider console, with the exact URI grammar from §1. `prisma:`, `pooled.db.prisma.io`, arbitrary/effective override hosts, pooler mode, unapproved query parameters, and missing TLS invariant abort. |
| P6 | Owner-approved expected database fingerprint from §5. A newly observed value is not self-approving. |
| P7 | Full preflight output retained; all six applied migrations match; no `PARTIAL`, `DRIFTED`, `HISTORY_ONLY`, or `UNKNOWN`; chain order coherent; `preDb5AbsenceGate=PASS`; empty applied-chain proposal lists; exact checksummed two-item `deployCandidateList`; top-level `READY_FOR_DB5_APPROVAL`; `mutationAuthorized=false`. |
| P8 | Read-only privilege report passes required `CONNECT`, `public` `USAGE`/`CREATE`, table ownership/ALTER-equivalent checks, and column `REFERENCES` checks. |
| P9 | No Docker/container `db push` or other non-migration schema synchronizer has touched the target since the approved fingerprint/state evidence. |
| P10 | Control Tower accepts the read-only DB4 evidence. After that acceptance, the Founder separately authorizes one DB5 deploy for exactly the two candidates above, only after P5 rotation evidence and the fresh P4 pre-DB5 backup are locked. |

Before any Gate D command, install and prove the lockfile-pinned local tools from the clean checkout. Do not let `npx` fetch a different CLI version:

```bash
npm ci
npx --no-install prisma --version   # must report 5.22.0
npx --no-install tsx --version
```

### Disposable local Prisma-engine proof (not a Gate D command)

An isolated PostgreSQL integration can prove all eight committed SQL files against
the pinned Prisma engine, but it is **not** a Gate D preflight and supplies no
Production evidence. The inspector intentionally rejects a local URL under §1;
do not weaken that policy, add a `host` override, alter DNS, or use a shared
Preview/Production target to make it run.

Required local prerequisites are a Docker-compatible runtime and a previously approved, locally available PostgreSQL 16 image pinned by digest. Never run `docker compose up` or the application `Dockerfile` for this proof: the application image is a start-only runtime, not the isolated PostgreSQL engine harness specified below.

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
set -euo pipefail
: "${GATE_D_AUTHORIZED_SOURCE_SHA:?Control-Tower-authorized DB5 source SHA is required}"
: "${GATE_D_AUTHORIZED_SOURCE_TREE:?Control-Tower-authorized DB5 source tree is required}"
: "${GATE_D_EXPECTED_PRODUCTION_RELEASE_SHA:?separately approved active Production SHA is required}"
[[ "$GATE_D_AUTHORIZED_SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$GATE_D_AUTHORIZED_SOURCE_TREE" =~ ^[0-9a-f]{40}$ ]]
[[ "$GATE_D_EXPECTED_PRODUCTION_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]
test -z "$(git status --short)"
test "$(git rev-parse HEAD)" = "$GATE_D_AUTHORIZED_SOURCE_SHA"
test "$(git rev-parse 'HEAD^{tree}')" = "$GATE_D_AUTHORIZED_SOURCE_TREE"

GATE_D_EXPECTED_PRODUCTION_RELEASE_PREFIX="${GATE_D_EXPECTED_PRODUCTION_RELEASE_SHA:0:12}"
GATE_D_OBSERVED_PRODUCTION_RELEASE="$(
  curl -fsSI https://www.creditvector.app/ |
    awk '
      BEGIN { count = 0; malformed = 0; matched = 0; value = "" }
      /^HTTP\// { count = 0; malformed = 0; matched = 0; value = ""; next }
      /^[ \t]/ { if (matched) malformed = 1; next }
      {
        colon = index($0, ":")
        if (!colon) { matched = 0; next }
        name = tolower(substr($0, 1, colon - 1))
        matched = (name == "x-cv-release")
        if (matched) {
          count++
          value = substr($0, colon + 1)
          gsub(/^[ \t]+|[ \t\r]+$/, "", value)
          if (value ~ /[ \t,]/) malformed = 1
        }
      }
      END { if (count != 1 || malformed) exit 65; print value }
    '
)"
test "$GATE_D_OBSERVED_PRODUCTION_RELEASE" = "$GATE_D_EXPECTED_PRODUCTION_RELEASE_PREFIX"
readonly GATE_D_AUTHORIZED_SOURCE_SHA GATE_D_AUTHORIZED_SOURCE_TREE
readonly GATE_D_EXPECTED_PRODUCTION_RELEASE_SHA GATE_D_EXPECTED_PRODUCTION_RELEASE_PREFIX
readonly GATE_D_OBSERVED_PRODUCTION_RELEASE
```

These are two independent custody axes: the authorized checkout supplies the
reviewed migration SQL; the active Production SHA/header identifies the code
currently using the database. Do not force them equal before promotion. Require
a clean status, exact source SHA/tree, and exactly one syntactically valid final-
response `x-cv-release` value for the separately approved active Production SHA.
The full `scripts/release-verify.sh` readiness suite belongs after DB5 in §13;
running it here would conflate the intentionally pre-DB5 schema state with source
custody. Any mismatch aborts.

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

Before step 1, require P5 rotation evidence. The previously exposed credential is
burned: do not load it, test it, compare it, or use it for fingerprint observation.
Rotation must finish before this next Production database contact.

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
- the rendered output includes the separate `preDb5AbsenceGate`, its exact expected/present object inventory, same-name history evidence, and exact checksummed `deployCandidateList`;
- `proposedResolveList` and `pendingDeployList` remain applied-six-only; the two DB5 candidates can appear only in `preDb5AbsenceGate.deployCandidateList`;
- `mutationAuthorized` is always `false`.

Interpret the top-level decision:

- `ABORT`: stop. Preserve output and investigate.
- `OWNER_BASELINE_REVIEW_REQUIRED`: one or more migrations are `SCHEMA_ONLY`. Do not deploy or resolve yet.
- `READY_FOR_OWNER_APPROVAL`: one or more applied-chain migrations are genuinely absent. This is still not deploy authorization, and in the current eight-directory tree it is specifically **not** permission to run `migrate deploy`, which would also see the DB5 candidates.
- `READY_FOR_DB5_APPROVAL`: all six applied-chain migrations match, both applied-chain proposal lists are empty, the exact-absence gate passed, the exact two-item checksummed candidate list is non-empty, and required candidate privileges passed. This is a non-authorizing evidence state; DB4 acceptance, rotation, fresh backup, and separate Founder DB5 approval remain mandatory.
- `NO_PENDING_MIGRATIONS`: no applied-chain work and no DB5 candidate remain. This is expected only after the separately reviewed post-DB5 canonical-chain update (or in a later manifest with no authored/unapplied entries), never from the current clean pre-DB5 state.

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

When the authored absence gate passes, privilege derivation includes the exact DB5
candidate migrations without placing them in either applied-chain proposal list.
It derives explicit capability results for type creation, table creation, index
creation, constraint addition, FK addition, and migration-history writes. `FALSE`
or `UNKNOWN` on any required check aborts. Do not grant privileges during this
runbook; access changes require a separate reviewed procedure.

## 8. Schema-only reconciliation — owner approval point 3

Only migrations classified `SCHEMA_ONLY` are eligible for consideration. `PARTIAL`, `DRIFTED`, `HISTORY_ONLY`, and `UNKNOWN` are never resolve candidates. A rolled-back, failed, incomplete, duplicate, contradictory, or malformed-history state is never treated as absent or schema-only.

DB4 is read-only and does not authorize this section. Any `SCHEMA_ONLY` result
blocks DB4 acceptance. A later reconciliation would require a separate Founder-
reviewed mutation package, the rotated credential, and its own fresh hardened
backup immediately before `migrate resolve`; DB5 would still require another
fresh hardened backup immediately before its separate mutation.

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

## 9. DB5 deploy — Founder approval point 4

Prisma examines every pending directory under `prisma/migrations`; it does not
consume `pendingDeployList`, and this repository intentionally has two additional
DB5 directories. Therefore `READY_FOR_OWNER_APPROVAL` is not executable approval
in this RC1 tree. Any applied-six pending/baseline state requires a separate
Control Tower plan and a new accepted DB4 package before DB5.

One DB5 deploy may be authorized only after all of these are locked:

1. The exposed production credential was rotated before DB4, and only the new
   direct credential was used for the accepted evidence. The old credential is
   never reused.
2. ChatGPT Control Tower accepted DB4's read-only output. That exact output has
   `decision=READY_FOR_DB5_APPROVAL`, all six applied migrations matching,
   `preDb5AbsenceGate=PASS`, empty `proposedResolveList` and
   `pendingDeployList`, the exact two names/checksums from §2 in
   `deployCandidateList`, no stop reason, and `mutationAuthorized=false`.
3. A new hardened production backup satisfying P4 completed immediately before
   DB5. Retain its identifier, UTC completion, source fingerprint, success,
   retention/integrity evidence, and proven isolated-restore procedure. The
   accepted DB-1 backup is sufficient for DB4 but not for DB5.
4. The reviewed checkout, manifest hash, candidate checksums/order, direct target,
   rotated credential, and approved fingerprint are unchanged since accepted
   DB4 evidence. Any intervening schema actor or unexplained state change aborts.
5. The Founder explicitly authorizes exactly one controlled DB5 execution for:
   `20260728000000_terms_acceptance`, then
   `20260823120000_consumer_assertion`.

Only then may the operator run this one mutation in the dedicated shell:

```bash
: "${GATE_D_DATABASE_URL:?validated direct URL is required}"
DATABASE_URL="${GATE_D_DATABASE_URL}" \
  npx --no-install prisma migrate deploy
```

The one command applies both pending DB5 migrations in their existing lexical
order. Do not attempt staged `--to` deployment. Do not use `pendingDeployList` as
the DB5 execution list, rerun blindly, split the operation, or use `db push`,
`migrate dev`, `reset`, `--accept-data-loss`, manual DDL, an ambient
`DATABASE_URL`, or a different connection. Any interruption enters §10; it never
authorizes a retry.

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

## 12. Docker schema-mutation governance

Historical repository evidence from 2026-07-25 recorded application-container
startup as `npx prisma db push --skip-generate && npm run start`. That command did
not contain `--accept-data-loss`, but it still bypassed reviewed migration history
and could destructively reconcile runtime-owned objects.

Current remediated repository truth:

- `Dockerfile` startup is exactly `npm run start`; it performs no Prisma or schema command.
- `vercel.json` production build is `prisma generate && next build`; it performs no migration or `db push`.
- the schema-safety guard rejects `prisma db push` in release/runtime startup surfaces.
- `docker-compose.yml` remains a local path that builds the application image and supplies its own `gcl` PostgreSQL 16 service; it is not the disposable Gate D engine harness.

P9 remains mandatory historical-custody evidence. If the former Docker startup or
another non-migration synchronizer touched the Gate D target after the approved
fingerprint/state evidence, abort and investigate; a superficially matching
`SCHEMA_ONLY` result is not automatically baseline-safe. Current start-only Docker
must not be mistaken for migration authorization or a Gate D validation path.

## 13. Post-deploy verification

Preserve the unedited DB5 command output first. The pre-DB5 classifier
intentionally treats either authored history row as an `ABORT`; do not weaken or
pre-apply its constants merely to make a post-migration probe green. After DB5,
use the separately reviewed post-DB5 canonical-chain update that moves both exact
migrations from authored/unapplied into applied history, then rerun §6 against
the same approved target. Require:

- all eight canonical migrations `ALL_PRESENT_AND_MATCHING` with exact checksums;
- empty `proposedResolveList`, empty `pendingDeployList`, empty DB5
  `deployCandidateList`, and `NO_PENDING_MIGRATIONS`;
- `TermsAcceptance` and `ConsumerAssertion` exist with exact
  columns/defaults/primary keys/indexes/FKs;
- row counts on both new tables are zero unless separately explained by an
  owner-reviewed write during the controlled interval;
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
- missing accepted DB-1 backup evidence for DB4, or missing fresh hardened backup evidence immediately before DB5;
- any attempt to reuse the previously exposed credential, or missing rotation evidence before the next Production DB contact;
- non-direct connection;
- missing, mismatched, or non-unique database identity evidence;
- unreadable or malformed required catalog/history relation;
- unsupported migration SQL;
- `0_init = ALL_ABSENT`;
- `PARTIAL`, `DRIFTED`, `HISTORY_ONLY`, `UNKNOWN`, checksum mismatch, any rolled-back/unfinished history row, or chain inversion;
- any `preDb5AbsenceGate` result other than `PASS`, including full/partial authored physical presence, either authored history name, or unknown absence evidence;
- any pre-DB5 top-level decision other than `READY_FOR_DB5_APPROVAL`, any non-empty applied-chain proposal list, or any DB5 candidate name/order/checksum difference;
- insufficient/unknown required privilege;
- evidence that Docker `db push` or another synchronizer touched the target;
- any preflight output change without an explained catalog/history change;
- any staged `--to`, split DB5 execution, blind retry, or second deploy process;
- any command proposing reset or data loss;
- any need for a grant, restore, history edit, hand-written DDL, or unreviewed recovery;
- Founder authorization required for the next step.

## 15. Approval ledger

Record separately:

1. owner authorization for read-only Production identity/preflight access;
2. credential-rotation completion evidence without the secret value;
3. approved fingerprint and provider evidence;
4. accepted DB-1 backup evidence used for read-only DB4;
5. exact preflight output hash/file, exact `deployCandidateList`, and Control Tower DB4 acceptance;
6. exact `proposedResolveList` approval and full rerun output, if reconciliation was separately authorized;
7. fresh hardened pre-DB5 backup/restore evidence;
8. explicit Founder approval for exactly the ordered two-item DB5 candidate list and one `migrate deploy`;
9. unedited deploy output and post-DB5 canonical-chain verification output;
10. any recovery approval.

Activation remains a later gate. Enabling flags, wiring producers, exposing new behavior, or beginning Sprint 11 product work is not part of Gate D.
