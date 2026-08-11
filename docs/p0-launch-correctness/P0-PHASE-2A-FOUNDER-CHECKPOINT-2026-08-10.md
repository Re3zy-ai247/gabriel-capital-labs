# CreditVector P0 Phase 2A — Founder Checkpoint

**Original checkpoint date:** August 10, 2026

**Dynamic proof rebound:** August 11, 2026

**Repository:** `/private/tmp/creditvector-p0-launch-correctness`

**Branch:** `codex/p0-launch-correctness`

**Accepted parent:** `4bbdf5c561f94a132962d27971551096b53528d9`

## Current result

**PHASE 2A LOCAL BUILD: ENGINEERING VERIFICATION PASS**

**DYNAMIC POSTGRESQL 16.14: TWO PRISTINE RUNS PASS**

**FRESH EXACT-SOURCE ADVERSARIAL GATE: RESULT RECORDED BELOW**

**PRODUCTION: NO-GO**

This document preserves the accepted H1/H2/H3 closure and is rebound to the
subsequent executable database proof. The earlier environment blocker is
closed: the exact migration completed two full runs against pristine,
synthetic PostgreSQL 16.14 containers. The previous adversarial verdict is not
reused because exact source changed during dynamic repair. A fresh verdict is
required before the authorized local checkpoint can be finalized.

The authoritative 30-field dynamic receipt is
`P0-PHASE-2A-DYNAMIC-POSTGRESQL-FOUNDER-CHECKPOINT-2026-08-11.md`. Detailed
database evidence is in `P0-PHASE-2A-MIGRATION-VERIFICATION.md`.

## Accepted Phase 2A scope

### H1 — lossless shadow metadata: CLOSED

Covered bureaus preserve independent report-date presence, actual
`YEAR`/`MONTH`/`DAY` precision, exact lexical evidence, provenance, source
locator, integrity, and extraction identity. Numeric score and score-model/type
evidence remain separate. `PRESENT`, `NOT_PROVIDED`, and `UNKNOWN` are distinct.
Missing score or date never creates an invented value or precision.

### H2 — Round 0 extraction/source-set seal: CLOSED

One durable Round 0 source authority binds the exact ReportIngestion,
ReportVersion, ExtractionRun, original source artifact, normalized input,
3-bureau × 9-category completeness manifest, source digest, fact membership,
and confirmation chronology. Parser uncertainty never becomes absence or
deletion. A changed report, run, bureau, source, locator, digest, revision, or
membership requires reconfirmation.

### H3 — unrecognized-account authority: CLOSED

`ConsumerAccountReviewReceipt` is the bounded, append-only authority for
`RECOGNIZED`, `UNRECOGNIZED`, `UNKNOWN`, `DEFERRED`, and `REVOKED` account
review. `UNRECOGNIZED` means only that the consumer does not recognize the
source-reported account. It confers no fraud, identity-theft, inaccuracy,
deletion, dispute, legal, correspondence, or policy conclusion.

### Authenticated principal and access audit: PASS

Authority is server-resolved from real actor, tenant, consumer,
authorization kind, and version. Bare IDs and client selectors are not
authority. Protected decrypt/preview/download/export/agency/admin/worker
decisions fail closed if the refs-only audit decision cannot be persisted. No
consumer value or free-form PII is stored in the audit event.

### Report ingestion and source truth: PASS

The sole durable queue is revisioned, idempotent, lease-bounded, recoverable,
and post-I/O readback verified. Exact source object and digest substitution,
stale leases, duplicate ReportVersions, ambiguous outcomes, and orphan
artifacts fail closed. Parser-v2 remains shadow-only and bureau-scoped; legacy
consumer-visible output remains authoritative.

### Round 0 and consumer confirmation: PASS

`IdentityFact.classification` remains the one per-fact disposition authority.
`NOT_APPLICABLE` is category completion only when no reported fact exists.
Accurate former addresses, legitimate employment, aliases, and unfamiliar
accounts are never auto-disputed. Machine observations do not become consumer
testimony. ConsumerAssertion and identity claim receipts pin the exact source
and immutable consumer-confirmed chronology.

### Case Action and feature gates: PASS

Case Action is append-only selection history, not legal or policy eligibility.
Round number is chronology only. Every Phase 2A gate defaults false, client
input cannot enable it, downstream readiness requires upstream readiness, and
the root kill switch prevents new work without deleting evidence. Phase 2B
behavior is absent.

## Dynamic PostgreSQL closure

Environment: local Colima profile `gios-p03`, local Docker Unix socket,
already-cached/pinned `postgres:16-alpine` image
`sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`,
PostgreSQL **16.14**, loopback-only synthetic containers, no pull and no remote
database.

Both pristine runs passed:

- clean forward apply and expected no-op reapply;
- Prisma/schema parity;
- valid reconstruction and malformed reconstruction rejection;
- both valid Round 0 construction orders;
- six same-transaction post-`SET` seal-then-append attacks;
- concurrency and exact `40P01` behavior;
- guarded rollback with Phase 1 catalog preserved;
- clean rebuild; and
- complete teardown.

Each run passed **17 affirmative/readback + 73 negative/adversarial = 90
behavior assertions**, plus a separate deadlock proof with **exactly one
`40P01` victim and one committed transaction**.

## Seal-then-append repair

The root defect was temporal: a deferred parent constraint could be proven and
discharged, after which a later same-transaction child could require a new
proof that its insertion did not exceed the fixed parent count. The repair
adds reverse child-triggered recounts for source identity facts, source-listed
account membership/presence, confirmed identity facts, category completion,
and confirmed account-review membership. Valid atomic construction remains
possible under deferred constraints; every post-seal overrun rejects with
SQLSTATE `23514`.

Same-transaction `ABSENT_CONFIRMED` identity evidence is deliberately
non-authoritative: it has no integrity digest, is excluded from source
membership counts, and cannot supply consumer-review authority. Its semantics
remain within trusted-writer production attestation and are not presented as
closed by a database seal.

## Verification binding

| Verification | Exact result |
| --- | ---: |
| Phase 1 / 1.1 | 515/515 PASS |
| Phase 2A runtime/adversarial | 138/138 PASS |
| Static migration guard | 73/73 PASS |
| Phase 1 compatibility | 7/7 PASS |
| **Phase 2A total** | **218/218 PASS** |
| **Aggregate** | **733/733 PASS** |
| Dynamic behavior, pristine run 1 | 90/90 + exact `40P01` PASS |
| Dynamic behavior, pristine run 2 | 90/90 + exact `40P01` PASS |
| TypeScript / Prisma validate / Bash syntax / diff | PASS |
| Privacy and secrets scan | PASS |

Prisma in-place formatting is not applicable to this narrow closure because it
would rewrite frozen Phase 1 schema formatting. Prisma validation, catalog
parity, the static guard, and diff checks pass without that out-of-scope churn.

## Frozen hashes

| Artifact | SHA-256 |
| --- | --- |
| Prisma schema | `e5cd3765f0d60ff0757c41ee5fdd1ee4be758cbb729bc28633aa77f8fc89765a` |
| Forward migration | `d9e9615318db3df0a484ead860523890041598115eade298e611b14af845fa55` |
| Disposable verifier | `745b5bdad2fdc576255b2fa1358743ee9f30500137fecc7e828603425e547001` |
| Static guard | `d057cddb571d4335ff53a9ef820c4d7924fab5c00d3290c21b24bbf79c8695d4` |
| Guarded rollback | `9a920cdd8e55785fb1beb6033786e2d5bdf767456d9fab7e27ac68502b6d306a` |
| Compatibility protocol | `a55967795516e24760990bdc4031096fe37c83f6e0a9af19a5d746e000192e97` |
| 37-file non-document content manifest | `5953e26210c70689b6a65dbb33380f3e19b3653bfd1aabda03b9ec9804519de5` |

## Scoped worktree explanation

The authoritative P0 audit contains **44 changed/untracked paths** before
commit:

- 37 intended executable/schema/migration/test/fixture files;
- 5 approved Phase 2A checkpoint/evidence documents (including this file and
  both standalone HTML handoffs); and
- 2 preserved, pre-existing Phase 2 Architecture Plan documents.

No generated database, container layer, verifier temporary directory,
`node_modules`, private report, consumer PII, production identifier, M2 file,
Fable/cinematic file, or overnight launch-closure file belongs in the
checkpoint. A broader UI count is not repository truth for this scoped
worktree; the exact scoped manifest and staged diff must govern the commit.

## Dynamic repairs, summarized

Executable PostgreSQL exposed and drove narrow fixes for Bash local binding,
PL/pgSQL row targeting, PostgreSQL identifier truncation/Prisma FK mapping,
fixture provenance, bounded readiness/version reporting, failed-run seals,
table-specific `NEW` field access, same-transaction post-`SET` counts, the Case
Action table branch, and rollback FK-before-index order. Tests were not weakened
to obtain green.

## Adversarial status

**FINAL EXACT-SOURCE REATTACK: C0 / H0 / M0 / L0.** A fresh independent
reviewer reattacked the exact final source after the dynamic repairs,
independently accepted the **218/218 Phase 2A** binding, and did not reopen any
Critical, High, Medium, or Low finding. No earlier verdict was inherited or
downgraded.

## Mandatory pre-activation boundaries

### Trusted writer — BOUNDED

**PRODUCTION ACTIVATION BLOCKED UNTIL THE AUTHENTICATED PRODUCTION REPOSITORY
VERIFIER/ADAPTER IS SEPARATELY IMPLEMENTED AND ATTESTED.** Local synthetic
readback proves the contract only.

### PDF resource safety — BOUNDED

**HARD PROCESS-ISOLATED PDF TERMINATION IS A MANDATORY PRE-ACTIVATION
DEPENDENCY.** Soft local resource limits do not close hostile-process
termination.

### Retention / legal hold — FOUNDER/COUNSEL DECISION REQUIRED

Mechanical erasure/tombstone/crypto-shred behavior is tested. No policy
duration or legal-hold exception was invented.

## Safety status

- M2 isolation: **PASS**
- Fable/cinematic isolation: **PASS**
- Overnight launch-closure isolation: **PASS**
- Production connection/mutation: **NONE**
- Push: **NONE**
- Merge: **NONE**
- Deploy: **NONE**
- Activation: **NONE**
- Phase 2B: **NOT STARTED**

## Local checkpoint identity

The exact local commit SHA is recorded in the post-commit Founder chat receipt.
This tracked artifact cannot contain the SHA of the commit that contains it.
Its stable binding is the accepted parent, the frozen artifact hashes, the
37-file non-document content manifest, and its own Git blob in that one local
checkpoint commit.

## Next Founder decision

Review the post-commit Founder receipt for the exact local checkpoint SHA, then
decide separately whether to authorize work on a still-open pre-activation
dependency. Do not push, merge, deploy, activate, connect to production, or
begin Phase 2B without separate Founder authorization.
