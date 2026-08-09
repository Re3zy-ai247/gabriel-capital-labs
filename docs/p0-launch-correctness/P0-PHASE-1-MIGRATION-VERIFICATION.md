# P0 Phase 1 Migration Verification

Status: **PASS — disposable Phase 1 migration verification**

**DISPOSABLE DATABASE ONLY.** This report covers a generated, loopback-only,
synthetic PostgreSQL target. It is not evidence of a production migration,
production backfill, or M2 activation.

## Frozen inputs

- Prisma schema SHA-256:
  `ea1665d6708e8b170e486b69ae8bd734f62ca548fa20ab3f7685aa3ddb1c531a`
- Forward migration SHA-256:
  `95e18c20735e152baad6e8a995a951dab792e999469b7cf77dbc973148ad426a`
- Migration: `20260808_p0_credit_truth_foundation`
- Already-local image: `postgres:16-alpine`
- Safe image digest:
  `postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`
- Image platform observed during preflight: `linux/amd64`

The verifier aborts before its first Docker operation if either frozen input
hash, the rollback manifest, the local image ID, or the local image digest
drifts.

## Safety boundary

The verifier:

- accepts no database URL or command-line target;
- clears ordinary Prisma and PostgreSQL environment variables;
- invokes Prisma through a minimal `env -i` environment;
- generates sentinel container and database names;
- publishes PostgreSQL only on a Docker-assigned `127.0.0.1` port;
- uses `--pull=never` and makes no vendor or application network calls;
- inserts synthetic rows only;
- redacts transient credentials and database URLs from emitted logs; and
- stops and confirms removal of the disposable container on every exit path.

The rollback has a second independent guard. It requires a
`p0_disposable_*` database name, the `p0_disposable_verifier` role, and the
exact `DISPOSABLE_DATABASE_ONLY` psql sentinel before its first drop.

## Commands executed

```text
shasum -a 256 prisma/schema.prisma \
  prisma/migrations/20260808_p0_credit_truth_foundation/migration.sql
bash -n scripts/p0-phase1-migration-verify.sh
node --no-warnings --experimental-strip-types \
  scripts/p0-phase1-migration-guard.test.ts
bash scripts/p0-phase1-migration-verify.sh
docker ps -a --filter label=creditvector.p0.disposable=true
```

No production credential, URL, consumer identifier, source-report content, or
consumer-derived fingerprint is included in this report.

## Results

| Verification | Result |
| --- | --- |
| Static guard | PASS — 48 assertions |
| Baseline migrations | PASS — 6 applied before P0 |
| Full migration history | PASS — 7 applied on fresh rebuild |
| P0 migration application count | PASS — exactly 1 |
| Second `prisma migrate deploy` | PASS — explicit no-op |
| Prisma schema parity | PASS — empty diff |
| Behavioral suites | PASS — 3 positive suites, 47 negative cases |
| Persisted progress chain | PASS — `2|1|3|2|2` exact rows after commit |
| Assessment-first race | PASS — `CLEAN=1`, adverse evidence `=0` |
| Adverse-evidence-first race | PASS — `CLEAN=0`, adverse evidence `=1` |
| Stale `CLEAN` + adverse coexistence | PASS — 0 pairs |
| Sealed-packet concurrent inserts | PASS fail-closed — 0 committed |
| Verification rollback | PASS — baseline retained |
| Fresh rebuild after rollback | PASS |
| Teardown | PASS — sentinel container removed |

The synthetic baseline snapshot was identical before forward migration, after
forward migration, and after verification rollback. Its synthetic-only
SHA-256 was
`ab427e38e5e4986410b097bba9077d917b82b46bff0fd10399f31cb2106f163b`.

### Exact catalog manifest

| Object class | Exact count |
| --- | ---: |
| P0 enums | 49 |
| P0 tables/models | 32 |
| Unique indexes | 122 |
| Secondary indexes | 38 |
| `RESTRICT` / `RESTRICT` foreign keys | 106 |
| Check constraints | 127 |
| Triggers | 72 |
| Functions | 29 |

All expected objects were present in both the primary disposable database and
the fresh rebuild. Every P0 foreign key was confirmed as `ON DELETE RESTRICT`
and `ON UPDATE RESTRICT`.

## Behavioral coverage

The synthetic suite exercised the relevant Phase 1 invariants:

- authorized tenant/consumer scope and exact source-report ownership;
- legacy non-promotion, rejection from the v2 report-account subject graph,
  and rejection of v2 extraction against legacy authority;
- all-bureau coverage, account presence, section completeness, and required
  condition-field completeness;
- exact `FieldObservation` and `HistoricalEvidence` section pins, including
  wrong primary section, wrong section row, and
  `ABSENT_CONFIRMED`-to-`PARTIAL` exploits;
- `CLEAN` affirmative-evidence requirements and neutral-only rejection;
- exact assertion observation/assessment/run binding;
- correspondence recipient, round, parent, supersession, assertion-chain, and
  approved-version item-count seals;
- current validated recipient address and current confirmed identity baseline;
- packet policy, baseline, round, claim, approval status, child-count seal, and
  exact correspondence-version membership;
- canonical artifact primary membership, ACV membership/status/count,
  `PacketEnclosure` packet/recipient/artifact pins, enclosure kind, and encrypted
  locator metadata;
- score source-role separation, duplicate-run comparison rejection, exact
  difference parent rejection, and temporal outcome parent rejection;
- source-dated comparable report-derived scores using the same method, version,
  and occurrence, persisted as an exact `SCORE_CHANGED` difference;
- persisted account `PRESENT` to `ABSENT_CONFIRMED` progress as
  `NO_LONGER_REPORTED`, and field `PRESENT` to `ABSENT_CONFIRMED` progress as
  `STATUS_CHANGED` with `NOT_APPLICABLE` deletion state;
- exact approved correspondence-version memberships supporting both a bounded
  `SYSTEM_DERIVED` outcome and a `HUMAN_CONFIRMED` `CORRECTED` outcome;
- append-only update, delete, and truncate rejection;
- post-seal child insert rejection and explicit correspondence, packet, and
  canonical-artifact count mismatches; and
- two-session assessment-versus-adverse-evidence races in both orderings.

For the repaired assessment/evidence race, both writers acquire the exact
`ExtractionRun` and `ReportVersionAccount` locks in the same order. The first
ordering committed the assessment and rejected later evidence with `55000`.
The reverse ordering committed adverse evidence and rejected the later
`CLEAN` assessment with `23514`. The final cross-table stale-pair query returned
zero.

### Persisted progress chain

The third positive suite uses dedicated prior/current extraction runs and a
same-series report successor with source-reported dates. PostgreSQL accepted
and committed the following exact synthetic graph:

| Persisted object | Exact count |
| --- | ---: |
| Report-derived score observations | 2 |
| Comparable temporal comparisons | 1 |
| Typed report differences | 3 |
| Dispute outcomes | 2 |
| Approved correspondence-item memberships | 2 |

The three differences are independently pinned to a compatible
`SCORE_CHANGED` score pair, an account-level
`PRESENT`/`ABSENT_CONFIRMED` pair, and a field-level
`PRESENT`/`ABSENT_CONFIRMED` pair. The two outcomes point to exact items in one
approved correspondence version: `NO_LONGER_REPORTED` is system-derived, while
`CORRECTED` is human-confirmed by a synthetic actor. An in-transaction graph
assertion passed, the transaction committed with all deferred seals satisfied,
and an independent post-commit query returned `2|1|3|2|2`.

### Refrozen High-closure proof

The exact-hash static guard additionally binds each repaired invariant to the
body of its owning frozen SQL validator instead of accepting a name-only
signal:

- field `PRESENT` to `ABSENT_CONFIRMED` remains a field-specific changed fact,
  with `NOT_APPLICABLE` deletion state; it cannot borrow whole-account
  `NO_LONGER_REPORTED` vocabulary;
- account presence is exhaustive for `PRESENT/PRESENT`,
  `PRESENT/ABSENT_CONFIRMED`, `ABSENT_CONFIRMED/PRESENT`, and
  `ABSENT_CONFIRMED/ABSENT_CONFIRMED`, including exact comparability,
  change-state, and deletion-state semantics;
- score comparison pins prior and current source-method key/version
  independently, pins occurrence on both sides, requires compatible
  source-reported dates in nondecreasing order, and preserves exact
  report/run/method/occurrence context across score and difference
  supersession; and
- outcome `decisionSource` is state-exact: pending has none,
  `CORRECTED`/`NEW_CONFLICT` require named human confirmation, and bounded
  observable states require system-derived provenance.

These five closure-specific assertions are part of the reported 48-assertion
guard. The executable disposable suite then independently reapplied the entire
frozen migration and its 47 synthetic negative probes against PostgreSQL; it
did not substitute Prisma schema generation or a mocked database for the
migration SQL.

## Rollback proof

The rollback target sets exactly match all 32 forward-created tables, 49 enums,
and 29 functions. It also removes only the two P0 indexes added to baseline
tables. It contains no `CASCADE`, database/schema drop, baseline-table drop, or
Prisma migration-history mutation.

The artifact leaf order was executed successfully without `CASCADE`:

```text
PacketEnclosure / ArtifactCorrespondenceVersion
  -> Artifact
  -> PacketCorrespondenceVersion
  -> Packet
```

The addendum graph was also removed in reverse dependency order:

```text
DisputeOutcome -> ReportDifference -> ReportComparison -> CreditScoreObservation
```

Missing sentinel, wrong sentinel, and a non-sentinel control database all
aborted before mutation. After the accepted disposable rollback, baseline
`User`, `Report`, and `Tradeline` tables and synthetic rows remained unchanged.
A separate fresh sentinel database then replayed all seven migrations and
produced the same catalog and empty Prisma diff.

## Known limitation

**Medium — dormant concurrency/operational limitation.** Two simultaneous
invalid child inserts against an already sealed approved packet were both
rolled back, and membership remained exactly unchanged. One writer received
the intended `23514` seal rejection; PostgreSQL selected the other as a
`40P01` deadlock victim during the foreign-key-key-share to parent-`FOR UPDATE`
lock upgrade. Correctness remains fail-closed with zero unauthorized rows, so
this is not a Phase 1 blocker. Before activation, callers must safely translate
or retry `40P01` and observability should distinguish it from a validation
failure. The seal was not weakened.

Additional boundaries:

- No production database or ordinary `DATABASE_URL` was accessed.
- No real consumer evidence or PII was loaded; all fixtures are synthetic.
- No production reanalysis, backfill, read-path switch, or M2 behavior was run.
- The verification rollback intentionally does not rewrite
  `_prisma_migrations`; rebuild proof uses a fresh disposable database.
- Runtime/migration role separation, performance, and broad load testing are
  outside this disposable correctness harness.

## Conclusion

The final frozen Phase 1 schema and migration pass the authorized disposable
migration-correctness gate. There is no open High correctness blocker in this
lane. The one observed Medium concurrency behavior is fail-closed and must be
handled operationally before activation.
