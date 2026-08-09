# CreditVector P0 Phase 1 — Founder Checkpoint

- **Date:** 2026-08-09
- **Branch:** `codex/p0-launch-correctness`
- **Phase 1 verdict:** `GO FOR PHASE 1 CHECKPOINT`
- **Production verdict:** `NO-GO`
- **Scope:** dormant, isolated, additive, build-only foundation

## 1. Final verdict

Phase 1 is closure-ready. The four authoritative final-red-team High findings
were repaired, independently exercised on disposable PostgreSQL, and attacked
again against the exact repaired state. Final closure severity is **0 Critical / 0
High**.

This is permission to preserve the dormant Phase 1 checkpoint in Git only. It
does **not** authorize a production migration, backfill, report reanalysis,
read-path switch, UI/Kai activation, correspondence, fulfillment, deployment,
push, or merge to `main`.

## 2. Red-team closure

| Finding | Root cause | Repair | Regression protection | Independent result |
|---|---|---|---|---|
| “No longer reported” disagreement | Runtime used account-level disappearance vocabulary for a field transition while database authority reserved it for whole-account presence. | Whole-account complete `PRESENT → ABSENT_CONFIRMED` alone yields `NO_LONGER_REPORTED`. Field disappearance uses its field-specific change kind with `NOT_APPLICABLE`; it never proves deletion. | Progress RED TEAM 3, SQL truth-table checks, static function-body guard, and committed positive field/account chains. | **PASS** |
| Incomplete account-presence transitions | Direct writers could relabel some prior/current presence pairs, and complete absent/absent was not representable. | Runtime and SQL now exhaustively enforce P/P, P/A, A/P, and A/A. Incomplete or `UNKNOWN` evidence remains non-comparable and unable to determine. | Progress RED TEAM 2, direct-writer negatives, static guard, and persisted P/A positive chain. | **PASS** |
| Missing durable score comparability | Database checks omitted source method/version, occurrence, and source-report chronology; score revision semantics diverged from runtime. | Exact report/run/bureau, primary report role, model/scale, method/version, occurrence, source-reported date order, and same-slot revision pins are enforced. | Progress RED TEAM 6–8, composite FKs/checks, static guard, and persisted `SCORE_CHANGED` positive chain. | **PASS** |
| Permissive causal-language filtering | A short regex denylist allowed unsupported causal claims that avoided its phrases. | Only module-generated, frozen, `WeakSet`-registered templates with exact statement equality are accepted. Free-form variants fail closed. | Progress RED TEAM 1 plus five whitespace, Unicode, chronology, and causal-claim bypass probes. | **PASS** |

Outcome authority was aligned at the same boundary: comparison-only absence is
`NO_LONGER_REPORTED`, never `DELETED`; `DELETED` is rejected in Phase 1;
`CORRECTED` and `NEW_CONFLICT` require exact human confirmation; bounded
observable outcomes use system-derived provenance.

## 3. Test and verification matrix

| Suite | Result |
|---|---:|
| Sanitized source-truth fixture | 23 / 23 |
| Parser-v2 shadow contract | 69 / 69 |
| Assessment and assertion binding | 79 / 79 |
| Executable strategy policy | 85 / 85 |
| Artifact storage contract | 71 / 71 |
| Progress Intelligence | 30 / 30 |
| Existing classification regression | 29 / 29 |
| Migration static guard | 48 / 48 |
| Independent disposable migration | 3 positive suites / 47 negative cases |
| Whole-tree TypeScript | PASS |
| Prisma format / validate / generate | PASS |
| Schema ↔ migration ↔ database parity | PASS — empty Prisma diff |
| Forward / no-op / rollback / rebuild | PASS |
| Assessment-versus-evidence races | PASS — `1|0`, `0|1`, stale pairs `0` |
| Sealed-packet concurrent invalid writers | PASS fail-closed — zero commits |
| Disposable teardown | PASS — no labeled container remained |

The persisted progress proof commits and reads back exactly two compatible score
observations, one temporal comparison, three differences, two outcomes, and two
approved correspondence memberships. It covers comparable score change,
account P/A, field P/A, a system-derived observable outcome, and a
human-confirmed correction.

## 4. Schema and migration state

- `prisma/schema.prisma` SHA-256:
  `ea1665d6708e8b170e486b69ae8bd734f62ca548fa20ab3f7685aa3ddb1c531a`
- `prisma/migrations/20260808_p0_credit_truth_foundation/migration.sql`
  SHA-256:
  `95e18c20735e152baad6e8a995a951dab792e999469b7cf77dbc973148ad426a`
- Additive inventory: 49 enums, 32 tables, 122 unique indexes, 38 secondary
  indexes, 106 `RESTRICT` foreign keys, 127 checks, 72 triggers, and 29
  functions.
- No `CASCADE`, destructive baseline mutation, backfill, or legacy truth
  invention.
- Disposable verification used loopback-only PostgreSQL 16 for the independent
  verifier and PostgreSQL 17 for the schema-owner harness, each with an isolated
  generated database. Ordinary application `DATABASE_URL` was not used.
- Rollback removed only the Phase 1 graph, preserved legacy sentinels, and was
  followed by a clean rebuild and empty parity diff.

## 5. Progress Intelligence state

- **ReportVersion:** immutable report checkpoints; reanalysis appends an
  ExtractionRun; report date is `SOURCE_REPORTED`, explicit not-provided, or
  unknown—never inferred from upload time.
- **Score provenance:** report-derived scores retain bureau, report/run,
  encrypted value envelope, source locator, extraction method/version,
  occurrence, model/scale, confidence/errors, and integrity metadata. Missing
  scores are explicit and never invented.
- **Score comparability:** a delta requires matching bureau, primary
  report-derived role, model/version/scale, method/version, occurrence, complete
  coverage, and ordered source-reported dates. Manual scores remain secondary
  and cannot back a durable report delta.
- **Report differences:** account, field, score, bureau-coverage, and identity
  changes remain bureau- and source-exact. Parser uncertainty cannot become
  absence or deletion.
- **Account presence:** P/P is unchanged-present; P/A is
  `NO_LONGER_REPORTED`; A/P is `NEW_ITEM`; A/A is unchanged/non-deletion.
- **Dispute outcomes:** exact case, comparison, difference, assertion,
  correspondence item/version, and approved membership are pinned. Report
  comparison alone cannot produce `DELETED`.
- **Causal language:** only closed structured noncausal templates are accepted.
  The contract may describe chronology; it cannot claim that correspondence,
  an item, or a dispute caused score movement.

No production import, route, UI, Score Tracker, Kai, or read path uses this
module.

## 6. Credit-truth foundation state

- Parser-v2 remains opt-in `SHADOW_ONLY`; legacy parser behavior and writes are
  unchanged.
- Bureau observations remain isolated; silence/failure/out-of-coverage remain
  `UNKNOWN`; confirmed absence requires complete canonical section provenance.
- Current and historical adversity are monotonic against `CLEAN`; neutral-only
  evidence requires review; `CLEAN` needs affirmative non-adverse evidence.
- Consumer assertions bind exact tenant, consumer, report, run, account,
  bureau, field, observation, series, revision, and digest. Drift requires
  reconfirmation.
- All 12 strategies remain `DORMANT_PHASE_1`; seven counsel-dependent policies
  remain `PENDING_COUNSEL`.
- The provider-neutral artifact interface remains dormant and exact-scope,
  create-only, digest-bound, replay-resistant, and legal-hold aware.
- Invariants I1–I10 and progress requirements P1–P12 are green for the dormant
  foundation.

## 7. Security and privacy

- Tenant/consumer/report/run/case/recipient boundaries use scoped composite
  foreign keys and fail-closed validators.
- Sensitive values, bodies, addresses, and storage locators are modeled as
  authenticated ciphertext envelopes; evidence events remain refs-only.
- Synthetic fixtures contain no consumer identity or source-report content.
- Final repository, staged-file, PII, secret, evidence-path, PDF/image/base64,
  and diff checks passed before commit.
- No Founder report, generated consumer letter, screenshot, or private evidence
  was copied into the worktree or staged.

Compliance result after terminology correction: **0 Critical / 0 High** for the
dormant progress contract. Complete current-report absence means only
`NO_LONGER_REPORTED`; it does not prove deletion, recipient action, or dispute
causation.

## 8. Repository state

- Worktree: `/private/tmp/creditvector-p0-launch-correctness`
- Branch: `codex/p0-launch-correctness`
- Pre-closure checkpoint HEAD: `f57c7f7afa559b25e071add7624c3b92a08a0af1`
- The exact closure commit is the commit containing this document; its SHA is
  reported in the Founder handoff because a file cannot embed the hash of its
  own commit.
- Scope changed: additive Prisma schema/migration; nine dormant
  `lib/creditTruth` modules; two opt-in parser re-exports; seven P0 test/verify
  scripts plus rollback SQL; and five Phase 1 documents.
- Explicit file staging was used; no blanket `git add .`.
- Post-commit staged and unstaged state: clean.

## 9. Production and M2 isolation

- Production access: **NONE**.
- Production credentials or fingerprints: **NOT READ OR PRINTED**.
- Production migration/backfill/reanalysis/source processing: **NONE**.
- Deployment, feature activation, fulfillment, push, and merge: **NONE**.
- M2 worktree/lineage/artifacts: **UNTOUCHED**; its prior detached HEAD and two
  pre-existing untracked probe files remained unchanged.
- Founder/private evidence: **LOCAL, UNTRACKED, UNSTAGED, NOT COMMITTED**.

## 10. Remaining findings

| Severity | Count | Residuals |
|---|---:|---|
| Critical | 0 | None |
| High | 0 | None |
| Medium | 4 | Trusted repository/writer semantic attestation for encrypted-value equality before activation; truthful post-I/O artifact result state; strict negative-integrity result shape; retry/translation for fail-closed PostgreSQL `40P01` during simultaneous invalid sealed-packet writes. |
| Low | 2 | Strict ISO-instant parsing and runtime schema parsing for malformed nested artifact-contract inputs. |

These residuals do not activate or expose a production path. Each remains an
explicit pre-activation gate.

## 11. Next Founder decision

No further authorization is required to preserve this Phase 1 checkpoint in
Git. Stop here.

Recommended next authorization, if desired: a separately bounded **Phase 2
shadow-integration program** for authenticated repository-backed writers,
semantic attestation over decrypted values, concrete storage/KMS adapter
conformance, and opt-in non-authoritative shadow comparison. Production schema
application, backfill, user-facing output, correspondence, fulfillment, deploy,
and merge to `main` must remain separately authorized.
