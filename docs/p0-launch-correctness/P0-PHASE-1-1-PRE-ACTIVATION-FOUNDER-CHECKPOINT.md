# CreditVector P0 Credit Intelligence & Correspondence Integrity

## Phase 1.1 — Pre-Activation Hardening Founder Checkpoint

- **Date:** August 10, 2026
- **Scope:** Delta hardening of the six accepted Phase 1 pre-activation findings
- **Implementation state:** **COMPLETE — LOCAL CHECKPOINT**
- **Production state:** **UNTOUCHED / NO-GO**
- **Adversarial state:** **C0 / H0 / M0 / L0**
- **Activation state:** **NOT AUTHORIZED**

The six known Phase 1 findings were investigated against the accepted local
baseline, repaired or explicitly bounded, tested, and independently
reattacked. Five are **CLOSED**. Trusted-writer semantic attestation is
**BOUNDED** because an authenticated production repository verifier/adapter is
intentionally absent from this dormant build-only phase; the local contract
fails closed without that authority, and the adapter remains a mandatory
pre-activation gate.

Phase 1.1 is not activation readiness. Founder accepted this dormant/local
implementation and authorized exactly one local checkpoint commit. This
artifact is included in that commit; its exact SHA is recorded in the external
post-commit Founder receipt because a commit cannot truthfully embed its own
SHA. There was no production interaction, M2 change, push, merge, deployment,
feature activation, or Phase 2 work.

## 1. BASELINE IDENTITY — PASS

| Evidence | Exact result |
| --- | --- |
| Branch | `codex/p0-launch-correctness` |
| Accepted Phase 1 baseline / checkpoint parent | `6f3058d53f7428184da48755a6646c4002fc932d` |
| Pre-change worktree | Clean |
| Pre-change index | Clean |
| Local Phase 1.1 checkpoint commit | Included; exact SHA recorded in the external Founder receipt |
| Post-commit worktree / index | Verified in the external Founder receipt |

The exact branch, parent commit, clean worktree, and clean index were verified
before the Phase 1.1 delta began. The accepted Phase 1 commit is the exact
parent of this local checkpoint.

## 2. M2 ISOLATION — PASS

- M2 identity and all recorded M2 fingerprints remained unchanged.
- No M2 source, migration, evidence, artifact, or working-tree change was used
  as Phase 1.1 authority.
- No production connection or production data was used.

## 3. TRUSTED-WRITER SEMANTIC ATTESTATION — BOUNDED

The hardened contract now requires module-minted, verifier-backed repository
reads with exact writer identity/version, semantic digest, source-set digest,
and immutable snapshot identity. Raw, forged, stale, mismatched, or replayed
inputs fail closed. Report-difference persistence candidates, score comparisons,
ConsumerAssertion bindings, correspondence evidence, and human confirmations
must bind to the exact attested source set.

The durable source-set digest is value-free; plaintext score and comparable
values are not persisted or logged by this attestation path. Ephemeral semantic
verification may include values in memory only.

**Explicit boundary:** an authenticated production repository
verifier/adapter is intentionally not part of dormant Phase 1.1. Schema
validity and direct database access do not prove semantic authority or
encrypted-value equality. The adapter must be separately implemented,
authenticated, and attested before any activation. Until then, the contract
fails closed.

## 4. POST-I/O ARTIFACT TRUTH — CLOSED

Successful storage I/O is no longer accepted as proof of final artifact truth.
The artifact contract now requires:

`write → immutable readback → independent exact verification`

Before success, it verifies object identity, contract version, exact bytes,
digest, recipient, bureau authority, ordered artifact membership, and readback
time. Partial writes, substituted IDs, stale or wrong versions, wrong routing,
wrong digests, and mismatched membership fail closed. No extra I/O was added to
pure/local contracts where persisted artifact state is not authoritative.

## 5. NEGATIVE-INTEGRITY RESULT SHAPE — CLOSED

Artifact integrity now returns a discriminated result:

- `ARTIFACT_INTEGRITY_VERIFIED`; or
- `ARTIFACT_INTEGRITY_FAILURE` with an exact failure code.

The failure branch is structurally distinct from Clean, absent, unknown,
parser uncertainty, deletion, unsupported, and not evaluated. Release is
permitted only by the verified branch; callers cannot treat an integrity
failure as a valid negative business result.

## 6. POSTGRESQL 40P01 HANDLING — CLOSED

The dormant transaction boundary now handles exact PostgreSQL `40P01`
deadlocks as explicit rolled-back failures, never success. Default behavior is
no retry. A retry requires a frozen, module-minted verifier attestation tied to
the exact operation, idempotency key, semantic attestation, and allowed retry
class.

- Retry count is bounded with a hard ceiling of three attempts.
- Exhaustion returns `DEADLOCK_RETRY_EXHAUSTED`.
- Exact `40P01` without retry authority returns `DEADLOCK_DETECTED`.
- Ambiguous provider errors and unknown outcomes return
  `TRANSACTION_OUTCOME_UNKNOWN` and are not retried.
- Messages are redacted; malformed and cyclic error shapes are bounded.

No concrete production database caller was added. A disposable local
PostgreSQL replay exercised a real concurrent `40P01` at the unchanged Phase 1
schema boundary.

## 7. STRICT ISO PARSING — CLOSED

Evidence and chronology dates now use strict calendar and offset validation.
Impossible dates, invalid leap dates, malformed offsets, ambiguous or missing
timezones where required, locale-dependent strings, trailing garbage, silent
normalization, and unsupported timestamp precision fail closed.

Partial source dates remain explicitly partial/unknown and never become
manufactured exact dates or timestamps. No precision is invented.

## 8. MALFORMED NESTED ARTIFACT VALIDATION — CLOSED

Authoritative nested artifact inputs now require exact plain-record shapes,
required children, child types, exact allowed keys, valid bureau/recipient
authority, consistent values, unique IDs and ordinals, bounded membership, and
matching sequence/digest truth.

Missing children, wrong child types, unexpected arrays or objects, duplicate
nested IDs, contradictory values, malformed provenance/authority, oversized
membership, and partially valid outer objects with invalid inner authority are
denied. An outer object can no longer bless malformed authoritative evidence.

## 9. PHASE 1 CONSTITUTIONAL NON-REGRESSION — PASS

The final exact source preserves every Phase 1 guarantee:

- Bureau A facts never become Bureau B claims.
- Closed, Paid, zero balance, or Pays as Agreed never erase supported
  historical derogatory evidence.
- Truly clean controls remain Clean.
- Parser uncertainty never becomes deletion.
- Missing score never produces an invented score.
- `ReportVersion` remains immutable and score provenance remains explicit.
- `ConsumerAssertion` remains bound to exact bureau, field, observation,
  revision, and evidence.
- CRA recipient routing remains bound to immutable bureau authority.
- Accurate former addresses and legitimate employment information are not
  automatically disputable.

The previously closed CRA routing High was included in the independent
reattack and remained closed.

## 10. TEST COUNTS — 515 / 515 PASS

| Suite | Exact result |
| --- | ---: |
| Sanitized source-truth fixture | 23 / 23 |
| Parser-v2 shadow contract | 69 / 69 |
| Assessment and assertion binding | 79 / 79 |
| Executable strategy policy | 102 / 102 |
| Artifact storage contract | 96 / 96 |
| Progress Intelligence | 33 / 33 |
| Existing classification regression | 29 / 29 |
| Migration static guard | 51 / 51 |
| PostgreSQL transaction hardening | 33 / 33 |
| **Contract/static total** | **515 / 515** |

Additional exact verification:

- Disposable local PostgreSQL: **3 positive suites / 65 negative cases**.
- The disposable proof was freshly replayed against the unchanged Phase 1
  schema/migration boundary and cleanly torn down.
- Whole-tree TypeScript typecheck: **PASS**.
- Prisma validation: **PASS**.
- Git whitespace/diff check: **PASS**.
- Temporary dependency link: **REMOVED**.

## 11. ADVERSARIAL FINDINGS — C0 / H0 / M0 / L0

| Severity | Open count | Result |
| --- | ---: | --- |
| Critical | 0 | None open. |
| High | 0 | None open. |
| Medium | 0 | None open. |
| Low | 0 | None open. |

Independent review reattacked all six findings plus CRA routing, cross-bureau
contamination, historical evidence loss, clean false positives, false
deletion, ConsumerAssertion misbinding, recipient retargeting,
concurrency/race corruption, and malformed evidence acceptance.

The trusted-writer item remains **BOUNDED**, not silently marked closed. Its
absent production adapter is an explicit fail-closed activation prerequisite,
not an open defect in this dormant Phase 1.1 delta.

## 12. FILES IN LOCAL CHECKPOINT — 8

Six source/test files plus this Markdown/HTML checkpoint pair are included in
the authorized local checkpoint. No schema or migration file changed.

| Frozen source/test file | SHA-256 |
| --- | --- |
| `lib/creditTruth/artifactStorage.ts` | `973eebe594ec5a004e66e2774112f3cf7f6e826e909eacb4b01b6b76af7f6c59` |
| `scripts/p0-artifact-storage-contract.test.ts` | `09acd9ef4dab848737ba36c9e78c0050eadcc70b98df5e458aa15c8bd5b501a9` |
| `lib/creditTruth/progressIntelligence.ts` | `f1ef16b24298b7a4bd77f36ea8bdcd4aff1b30d4a801547410830c1e4a2456ba` |
| `scripts/p0-progress-intelligence.test.ts` | `1b84bab395934561cbabb823a663b7c58babffe1674f8288c224ca621e12cd40` |
| `lib/creditTruth/postgresTransaction.ts` | `3e21f0c4900dd02e199b1efc325c818b0cddacd2591a89f632c0d2033c57a3db` |
| `scripts/p0-postgres-transaction.test.ts` | `6f9d8ea400f03c7289a725fb99673a1963107e3fea06f5d0635d4a354cd3d734` |
| **Ordered six-file manifest** | **`c0941f9fff76f50744bbc3e906b407f517da7a24e9b3dcd213443016adbfe230`** |

The manifest order is artifact source, artifact test, progress source,
progress test, transaction source, transaction test.

## 13. PRODUCTION MUTATIONS — NONE

No production connection, migration, write, backfill, report processing,
reanalysis, or feature interaction occurred. No private credit report,
consumer PII, credential, secret, or production identifier is present in the
Phase 1.1 delta or this checkpoint.

## 14. COMMIT — LOCAL CHECKPOINT INCLUDED

Founder authorized exactly one local Phase 1.1 checkpoint commit with parent
`6f3058d53f7428184da48755a6646c4002fc932d`. This artifact is included in that
commit. Its exact SHA, file count, worktree state, and index state are recorded
in the external post-commit Founder receipt.

## 15. PUSH — NONE

No branch, commit, tag, or artifact was pushed to any remote.

## 16. MERGE / DEPLOY / ACTIVATION — NONE

No merge, deployment, production migration, backfill, parser-v2 activation,
feature-flag change, correspondence activation, or other release action was
performed. Production remains **NO-GO**.

## 17. PHASE 2 — NOT STARTED

No Phase 2 design, implementation, migration, or activation work began.

## 18. NEXT FOUNDER DECISION

Review the external post-commit receipt. The next substantive Founder decision
is whether and when to authorize a separately scoped implementation and
attestation of the authenticated production repository verifier/adapter.
Before any future activation, that adapter must prove the trusted-writer
semantic boundary is satisfied. This checkpoint is not authorization to
connect to production, activate parser-v2, enable flags, migrate, backfill,
merge, deploy, push, or begin Phase 2.

**STOP. Await Founder authorization.**
