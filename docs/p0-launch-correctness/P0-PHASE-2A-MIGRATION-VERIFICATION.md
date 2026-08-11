# P0 Phase 2A Migration Verification

Status: **DYNAMIC DISPOSABLE POSTGRESQL 16.14 — TWO PRISTINE RUNS PASS**

**LOCAL/DISPOSABLE DATABASE ONLY.** The verifier accepts no database target.
It was executed only against self-created, synthetic PostgreSQL containers on a
local loopback endpoint. No production, staging, shared developer database,
consumer data, credential, or remote registry was used.

## Frozen inputs

| Input | Exact identity |
| --- | --- |
| Branch | `codex/p0-launch-correctness` |
| Accepted parent | `4bbdf5c561f94a132962d27971551096b53528d9` |
| Migration | `20260810_p0_phase2a_ingestion_round0` |
| Prisma schema SHA-256 | `e5cd3765f0d60ff0757c41ee5fdd1ee4be758cbb729bc28633aa77f8fc89765a` |
| Forward migration SHA-256 | `d9e9615318db3df0a484ead860523890041598115eade298e611b14af845fa55` |
| Disposable verifier SHA-256 | `745b5bdad2fdc576255b2fa1358743ee9f30500137fecc7e828603425e547001` |
| Static guard SHA-256 | `d057cddb571d4335ff53a9ef820c4d7924fab5c00d3290c21b24bbf79c8695d4` |
| Guarded rollback SHA-256 | `9a920cdd8e55785fb1beb6033786e2d5bdf767456d9fab7e27ac68502b6d306a` |
| Compatibility protocol SHA-256 | `a55967795516e24760990bdc4031096fe37c83f6e0a9af19a5d746e000192e97` |
| 37-file non-document content manifest | `5953e26210c70689b6a65dbb33380f3e19b3653bfd1aabda03b9ec9804519de5` |
| Required local image | `postgres:16-alpine` |
| Required image ID | `sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777` |

The guard and verifier stop before migration execution when the exact schema or
migration digest drifts. The runtime uses the already-cached image by pinned ID
with no pull.

## Execution environment

- Colima profile: `gios-p03`
- Docker transport: verified local Unix socket
- PostgreSQL: `16.14`
- Network exposure: Docker-assigned `127.0.0.1` port only
- Database and role: random sentinel names, synthetic credential, verifier-only
- Container lifecycle: new container per run, removed on every exit path
- Temporary files: isolated verifier directory, removed on teardown
- Existing databases: neither discovered nor accepted as a target

Both full runs started from a pristine disposable container. The verifier
reported and checked server major version 16 before applying migration SQL.

## Additive manifest

The migration creates these ten Phase 2A tables:

- `ReportIngestion`
- `BureauReportDateEvidence`
- `Round0SourceCompletenessEvidence`
- `IdentityCategoryCompletion`
- `IdentityCorrespondenceAssertion`
- `ConsumerAccountReviewReceipt`
- `IdentityBaselineAccountReviewMembership`
- `CaseActionDecision`
- `CaseActionSourceRef`
- `P0SensitiveAccessEvent`

It adds twenty closed enums and nineteen nullable,
old-runtime-compatible columns. The columns pin exact ExtractionRun input,
source representation/digest, Round 0 source and confirmation seals, score
model provenance, account-review membership, Case Action membership, and
sensitive-access authority without backfilling or inferring legacy truth.

| Object class | Exact count |
| --- | ---: |
| Closed enums | 20 |
| New tables | 10 |
| Nullable columns on existing tables | 19 |
| Unique indexes | 46 |
| Query indexes | 14 |
| Composite `RESTRICT/RESTRICT` foreign keys | 44 |
| Validator/guard functions | 21 |
| Transition, attestation, append-only triggers | 41 |

The tracked Prisma schema addition is **615 insertions / 0 deletions**. Forward
SQL contains no `DROP`, rename, data update/delete/truncate, backfill,
legacy-to-P0 inference, `CASCADE`, or `db push` behavior. Every new FK is
`ON DELETE RESTRICT ON UPDATE RESTRICT`. All explicit constraint, index, and
trigger identifiers fit PostgreSQL's 63-byte identifier limit.

## What the dynamic proof established

Each pristine run passed:

1. clean forward Prisma migration apply;
2. expected no-op second deploy;
3. Prisma/schema catalog parity;
4. creation and behavior of every required function and trigger;
5. exact tenant/consumer/report/run/artifact/bureau/provenance foreign keys;
6. H1 report-date and score-model presence/provenance contracts;
7. H2 exact 3-bureau × 9-category source completeness and reconstruction;
8. H3 bounded account-review authority and exact current membership;
9. Case Action append-only source-set authority;
10. ingestion CAS, idempotency, leases, stale-worker protection, and recovery;
11. source-artifact write/readback and digest substitution rejection;
12. valid DRAFT/CONFIRMED construction in both supported insertion orders;
13. malformed and incomplete reconstruction rejection;
14. six post-`SET CONSTRAINTS ALL IMMEDIATE` append attacks;
15. concurrent behavior and exact PostgreSQL `40P01` handling;
16. sentinel-guarded rollback while preserving Phase 1 authority;
17. clean rebuild after rollback; and
18. complete teardown.

Per run, the active database harness produced **17 affirmative/readback
assertions + 73 negative/adversarial assertions = 90 behavior assertions**.
The concurrency harness then separately proved **exactly one `40P01` victim and
one committed transaction**. The second pristine run reproduced the same
result.

## Same-transaction seal repair

### Failure mechanism

Deferred parent validation allowed a valid graph to be assembled in either
order. However, after a caller explicitly forced and discharged the deferred
events with `SET CONSTRAINTS ALL IMMEDIATE`, a later child insert in that same
transaction needed its own reverse proof. Depending only on the earlier parent
event left a seal-then-append window: the parent was exact at validation time,
but later durable membership could exceed its fixed count.

### Enforced result

Every authoritative child path now rechecks its exact scoped sealed count. The
six post-`SET` attacks all reject with SQLSTATE `23514`:

| Post-seal append | Result |
| --- | --- |
| Source `IdentityFact` | PASS — rejected |
| Counted account pair (`ReportVersionAccount` + presence) | PASS — rejected |
| Source-listed `ReportVersionAccount` without counted presence | PASS — rejected |
| CONFIRMED `IdentityFact` | PASS — rejected |
| `IdentityCategoryCompletion` | PASS — rejected |
| Confirmed account-review membership | PASS — rejected |

The two valid atomic construction orders also pass:

- completeness evidence → baseline/member graph → immediate validation;
- baseline/member graph → completeness evidence → immediate validation.

This retains deferred construction without allowing a later append to exceed
fixed authority.

Same-transaction `ABSENT_CONFIRMED` identity evidence is not an authoritative
source member: it has no integrity digest, is excluded from sealed membership,
and cannot supply consumer-review authority. Its semantic use remains within
the separately authenticated trusted-writer pre-activation boundary. The
database seal does not purport to close that boundary.

## Other issues found and repaired dynamically

- **Verifier Bash binding:** split a `local` label declaration from the derived
  log-file declaration so `set -u` cannot observe an unbound name.
- **PL/pgSQL row target:** replaced an invalid `%ROWTYPE` plus scalar
  multi-target `INTO` with one locked select into explicit scalars.
- **Identifier identity:** shortened over-63-byte identifiers and mapped the
  relevant Prisma FK explicitly to prevent silent PostgreSQL truncation.
- **Fixture provenance:** made legacy-compatible coverage/source evidence
  internally consistent and pinned the wrong-bureau attack to an otherwise
  compatible row so the intended FK failure is observed.
- **Readiness/version:** added a bounded 60-second readiness loop, diagnostic
  failure output, and exact PostgreSQL major-version check.
- **Failed-run seal:** excluded failed, unbound completeness evidence from
  sealing later successful source-listed account membership.
- **Trigger branching:** moved table-specific `NEW` field reads behind explicit
  `TG_TABLE_NAME` branches in Round 0 and Case Action validators.
- **Post-SET count seals:** added reverse child count verification for exact
  source and confirmed-baseline memberships.
- **Rollback order:** removes dependent foreign keys before backing indexes.

## Rollback and rebuild

The rollback requires all three independent sentinels before its first
mutation:

- a `p0_2a_disposable_*` database;
- the `p0_2a_disposable_verifier` role; and
- the exact `DISPOSABLE_DATABASE_ONLY` sentinel.

It removes only the exact Phase 2A objects. It does not use `CASCADE`, drop a
database/schema, drop any Phase 1 authority table, or mutate
`_prisma_migrations`. Dependency-bearing foreign keys are dropped before their
indexes; membership tables are removed before parents. The verifier proves the
Phase 1 catalog remains, then reapplies Phase 2A from a clean reconstruction.

## Static and regression binding

| Verification | Result |
| --- | ---: |
| Phase 1 / 1.1 frozen matrix | 515/515 PASS |
| Phase 2A runtime/adversarial suites | 138/138 PASS |
| Phase 2A static migration guard | 73/73 PASS |
| Phase 1 compatibility protocol | 7/7 PASS |
| **Phase 2A counted total** | **218/218 PASS** |
| **Aggregate counted total** | **733/733 PASS** |
| Dynamic DB behavior, pristine run 1 | 90/90 PASS + exact `40P01` PASS |
| Dynamic DB behavior, pristine run 2 | 90/90 PASS + exact `40P01` PASS |
| TypeScript | PASS |
| Prisma validate | PASS |
| Bash syntax | PASS |
| Schema/migration parity and diff checks | PASS |
| Privacy/secrets scan | PASS |

Prisma in-place formatting is **not applicable** to this narrow closure because
it would rewrite frozen Phase 1 schema formatting outside the authorized delta.
Prisma validation, catalog parity, static guards, and diff hygiene provide the
applicable correctness evidence.

## Safety properties of the verifier

`scripts/p0-phase2a-migration-verify.sh`:

- accepts no CLI database target;
- clears Prisma/PostgreSQL connection environment variables;
- rejects `DOCKER_HOST`, `DOCKER_CONTEXT`, TLS/certificate, and custom Docker
  configuration overrides;
- resolves and pins a local canonical Unix-socket endpoint;
- uses only the exact already-cached image ID with no pull;
- creates random sentinel database/container identities and synthetic values;
- publishes only to Docker-assigned loopback;
- binds all PostgreSQL commands to that disposable instance;
- applies only repository migrations and synthetic fixtures;
- bounds readiness and concurrency waits;
- asserts exact `40P01` behavior instead of converting it into success; and
- removes its container and temporary directory on every exit path.

## Activation boundary

The dynamic database proof does not establish production readiness.

**TRUSTED-WRITER SEMANTIC ATTESTATION = BOUNDED — MANDATORY PRE-ACTIVATION
DEPENDENCY.** Same-transaction non-authoritative `ABSENT_CONFIRMED` semantics
remain inside this boundary.

**HARD PROCESS-ISOLATED PDF TERMINATION = MANDATORY PRE-ACTIVATION
DEPENDENCY.** Local parser resource checks do not establish hard hostile-process
termination.

**RETENTION / LEGAL-HOLD POLICY = FOUNDER / COUNSEL DECISION REQUIRED.** No
duration or legal-hold exception is encoded here.

No production connection, production migration, backfill, report reanalysis,
push, merge, deployment, activation, or Phase 2B work is authorized or
evidenced by this result.
