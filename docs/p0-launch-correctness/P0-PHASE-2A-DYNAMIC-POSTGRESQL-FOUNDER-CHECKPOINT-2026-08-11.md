# CreditVector P0 Phase 2A — Dynamic PostgreSQL Founder Checkpoint

**Date:** August 11, 2026

**Authorization:** deferred dynamic database closure and local checkpoint only

**Repository:** `/private/tmp/creditvector-p0-launch-correctness`

**Branch:** `codex/p0-launch-correctness`

**Accepted parent:** `4bbdf5c561f94a132962d27971551096b53528d9`

## Executive status

**DYNAMIC DISPOSABLE POSTGRESQL PROOF: PASS**

**FINAL EXACT-SOURCE ADVERSARIAL GATE: RESULT RECORDED IN FIELD 16**

**LOCAL CHECKPOINT IDENTITY: RECORDED IN THE POST-COMMIT FOUNDER RECEIPT**

The exact Phase 2A migration package completed two full runs from pristine,
synthetic PostgreSQL 16.14 instances. Each run passed forward apply, no-op
reapply, Prisma/schema parity, valid reconstruction, malformed reconstruction
rejection, rollback with Phase 1 authority preserved, fresh rebuild,
concurrency, exact PostgreSQL `40P01` handling, and teardown. Each run executed
**17 affirmative/readback assertions plus 73 negative/adversarial assertions =
90 behavior assertions**, followed by the separate deadlock proof requiring
**exactly one `40P01` victim and one committed transaction**.

The frozen regression binding is **515/515 Phase 1/1.1**, **218/218 Phase 2A**,
and **733/733 aggregate**. A fresh independent reviewer reattacked the exact
final source and earned **Critical 0 / High 0 / Medium 0 / Low 0**. This is a
new verdict after the dynamic repairs, not an inherited result.

## Seal-then-append closure

### Root cause

The deferred constraints correctly supported valid atomic graph construction,
but a transaction could establish and force-check a parent's fixed manifest or
child-count authority with `SET CONSTRAINTS ALL IMMEDIATE`, then append a child
later in the same transaction. A previously discharged parent-side deferred
event was not by itself proof against every later child insertion. Some reverse
paths also depended on table-specific `NEW` fields and could be masked by
PostgreSQL evaluation behavior. In short: the seal was true when checked, but
not every subsequent append independently re-proved that the new durable count
still fit the sealed authority.

### Repair

The narrow repair keeps deferred, valid atomic construction while adding
reverse, child-triggered count enforcement. Once a fixed source manifest or
confirmed-baseline child-count seal exists, every later relevant child insert
recounts the exact scoped durable membership and rejects an overrun with
SQLSTATE `23514`. Table-dependent trigger fields are selected only after
branching on `TG_TABLE_NAME`, so an irrelevant field cannot mask the intended
integrity decision.

Six active post-`SET` probes now fail closed:

1. source `IdentityFact` append;
2. counted account membership append (`ReportVersionAccount` plus presence);
3. source-listed `ReportVersionAccount` append without a counted presence;
4. CONFIRMED-baseline `IdentityFact` append;
5. `IdentityCategoryCompletion` append; and
6. `IdentityBaselineAccountReviewMembership` append.

Both valid construction orders pass before sealing:

- completeness evidence before baseline/member construction; and
- baseline/facts/members before completeness evidence.

The migration therefore preserves atomic construction without allowing a
post-seal child to exceed fixed authority.

### Explicit trusted-writer boundary

Same-transaction `ABSENT_CONFIRMED` identity evidence is intentionally not
counted as authoritative source membership. Such a row has no authoritative
integrity digest and can never become source-set membership or consumer-review
authority. Its semantics remain inside the authenticated trusted-writer
pre-activation dependency; this local database seal does **not** claim that
boundary closed.

## Dynamic repairs discovered by executable PostgreSQL

The dynamic proof found and narrowly repaired the following issues rather than
weakening tests:

- a Bash `local` declaration evaluated a derived variable before its label was
  bound under `set -u`;
- a PL/pgSQL `SELECT ... INTO` combined a `%ROWTYPE` target with an additional
  scalar and did not compile;
- PostgreSQL's 63-byte identifier limit silently truncated long trigger/FK
  names, so explicit short names and the Prisma FK map were added;
- a legacy-compatible fixture asserted exact coverage with inconsistent source
  provenance;
- container readiness and exact server-version proof needed a bounded,
  diagnostic wait;
- a failed, unbound extraction manifest could incorrectly seal a later
  successful source-listed account path;
- table-dependent `NEW` fields were referenced before the trigger table branch;
- the same-transaction post-`SET` source and confirmed-child count gaps required
  reverse count seals;
- the Case Action source-seal trigger required a table branch before reading
  `NEW.decisionId`; and
- rollback had to remove dependent foreign keys before their backing indexes.

## Founder checkpoint — 30 fields

### 1. Baseline identity — PASS

- Worktree: `/private/tmp/creditvector-p0-launch-correctness`
- Branch: `codex/p0-launch-correctness`
- Accepted Phase 1.1 parent:
  `4bbdf5c561f94a132962d27971551096b53528d9`
- Accepted Phase 1 checkpoint:
  `6f3058d53f7428184da48755a6646c4002fc932d`
- Exact 37-file non-document content manifest SHA-256:
  `5953e26210c70689b6a65dbb33380f3e19b3653bfd1aabda03b9ec9804519de5`

### 2. Disposable PostgreSQL environment — PASS

- Local Colima profile: `gios-p03`
- Runtime: local Docker Unix-socket context
- Image: already-cached `postgres:16-alpine`; no pull
- Image ID:
  `sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`
- PostgreSQL: **16.14**
- Exposure: Docker-assigned loopback `127.0.0.1` port only
- Data: synthetic only; sentinel database, role, and container names

### 3. Forward apply — PASS

Clean forward migration applied successfully in each pristine run. All
expected enums, tables, columns, indexes, foreign keys, functions, and triggers
were created.

### 4. Reapply / no-op — PASS

The second Prisma deploy was an expected no-op in each run. It neither replayed
the migration nor changed the catalog.

### 5. Schema parity — PASS

Prisma/schema parity passed after apply. Explicit short database identifiers
and the mapped identity-baseline account-review FK agree across schema and SQL.

### 6. Rebuild / reconstruction — PASS

Valid state reconstructed from a clean database and again after guarded
rollback. Malformed reconstruction and authoritative nested inconsistencies
were rejected fail closed.

### 7. Rollback verification — PASS

The sentinel-guarded disposable rollback removed only Phase 2A objects, removed
dependency-bearing foreign keys before their backing indexes, preserved the
Phase 1 catalog, and permitted a clean Phase 2A rebuild. It used no `CASCADE`
and never targeted a production, shared, or non-sentinel database.

### 8. Concurrency / 40P01 — PASS

Lease/CAS, stale-worker, idempotency, append-only, and concurrent membership
behavior passed. The deadlock harness produced **exactly one PostgreSQL
`40P01` victim and one committed transaction**; no false success, infinite
retry, duplicate durable truth, or ambiguous success was accepted.

### 9. Teardown — PASS

Both sentinel containers and temporary verifier directories were removed. No
unexpected Phase 2A database object or disposable runtime output was retained.

### 10. Schema SHA-256

`e5cd3765f0d60ff0757c41ee5fdd1ee4be758cbb729bc28633aa77f8fc89765a`

### 11. Migration SHA-256

`d9e9615318db3df0a484ead860523890041598115eade298e611b14af845fa55`

### 12. Verifier SHA-256

`745b5bdad2fdc576255b2fa1358743ee9f30500137fecc7e828603425e547001`

Additional frozen evidence:

- static guard:
  `d057cddb571d4335ff53a9ef820c4d7924fab5c00d3290c21b24bbf79c8695d4`
- guarded rollback:
  `9a920cdd8e55785fb1beb6033786e2d5bdf767456d9fab7e27ac68502b6d306a`
- Phase 1 compatibility:
  `a55967795516e24760990bdc4031096fe37c83f6e0a9af19a5d746e000192e97`

### 13. Phase 1 / 1.1 tests — 515/515 PASS

The frozen Phase 1/1.1 correctness matrix remains green.

### 14. Phase 2A tests — 218/218 PASS

| Binding | Exact result |
| --- | ---: |
| Runtime and adversarial suites | 138/138 PASS |
| Static migration guard | 73/73 PASS |
| Phase 1 compatibility protocol | 7/7 PASS |
| **Phase 2A total** | **218/218 PASS** |

The two dynamic runs are reported separately: each passed 90 behavior
assertions plus the exact one-victim/one-commit `40P01` proof.

### 15. Aggregate tests — 733/733 PASS

The counted aggregate is 515 frozen Phase 1/1.1 checks plus 218 Phase 2A
checks. TypeScript, Prisma validate, verifier Bash syntax, compatibility, static
privacy/secrets review, and diff checks also pass. Prisma in-place formatting
was not run because it would create out-of-scope churn in the frozen Phase 1
schema; validation, parity, and diff checks are the applicable proof.

### 16. Adversarial final state — C0 / H0 / M0 / L0

A fresh independent reviewer reattacked the exact final source after the
dynamic repairs. The review reran and independently accepted the **218/218
Phase 2A** binding and did not reopen any Critical, High, Medium, or Low
finding. No earlier verdict was inherited or downgraded.

### 17. Trusted-writer dependency — BOUNDED

**TRUSTED-WRITER SEMANTIC ATTESTATION = BOUNDED — MANDATORY PRE-ACTIVATION
DEPENDENCY.**

**PRODUCTION ACTIVATION BLOCKED UNTIL THE AUTHENTICATED PRODUCTION REPOSITORY
VERIFIER/ADAPTER IS SEPARATELY IMPLEMENTED AND ATTESTED.**

### 18. Resource-safety dependency — BOUNDED

**HARD PROCESS-ISOLATED PDF TERMINATION = MANDATORY PRE-ACTIVATION
DEPENDENCY.** Local byte, page, decompression, time, memory, concurrency,
backpressure, and tenant-admission checks do not prove hostile-parser process
termination.

### 19. Retention / legal hold — FOUNDER/COUNSEL DECISION REQUIRED

Only scoped mechanical erasure, tombstone, object-delete, crypto-shred, and
race/orphan behavior is implemented. No retention period, legal-hold duration,
or silent exception was invented.

### 20. M2 isolation — PASS

The M2 branch/worktree and its pre-existing local state were not modified by
this Phase 2A closure.

### 21. Fable isolation — PASS

The Fable/cinematic repository and worktree were not modified.

### 22. Overnight closure isolation — PASS

The overnight launch-closure worktree remained separate and unchanged.

### 23. Production mutations — NONE

No production connection, read, write, migration, report processing,
reanalysis, backfill, or consumer-data access occurred.

### 24. Local checkpoint commit — POST-COMMIT RECEIPT AUTHORITY

The exact SHA is recorded in the post-commit Founder chat receipt. This tracked
artifact cannot contain the SHA of the commit that contains it. Its stable
binding is the accepted parent, the frozen artifact hashes, the 37-file
non-document content manifest, and its own Git blob in the one local checkpoint.

### 25. Push — NONE

No branch, commit, tag, artifact, or document was pushed.

### 26. Merge — NONE

No branch was merged.

### 27. Deploy — NONE

No deployment or production migration occurred.

### 28. Activation — NONE

All Phase 2A behavior remains dormant/default-false. No feature or cohort was
activated.

### 29. Phase 2B — NOT STARTED

No correspondence, policy evaluation, canonical packet, Mail Center,
fulfillment, response intelligence, report diff, Progress Intelligence, or Kai
Phase 2 behavior was implemented.

### 30. Recommended next Founder decision

Review the post-commit Founder receipt for the exact local checkpoint SHA, then
decide separately whether to authorize work on a still-open pre-activation
dependency. Do not push, merge, deploy, activate, connect to production, or
begin Phase 2B without separate Founder authorization.

## Launch and compliance status

**PRODUCTION: NO-GO.** The dynamic database proof establishes local migration
behavior only. It does not establish authenticated production writer truth,
hard PDF process termination, retention/legal-hold policy, strategy-policy
counsel approval, deployment safety, or activation authority.
