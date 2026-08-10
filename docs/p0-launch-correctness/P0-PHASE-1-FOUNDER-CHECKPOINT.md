# CreditVector P0 Credit Intelligence & Correspondence Integrity

## Phase 1 Continuation — Founder Checkpoint

- **Date:** August 10, 2026
- **Phase:** Phase 1 build-only foundation
- **Implementation verdict:** **COMPLETE**
- **Checkpoint verdict:** **GO — DORMANT, ISOLATED CHECKPOINT ONLY**
- **Production verdict:** **NO-GO**
- **Open findings:** **C0 / H0 / M4 / L2**

The exact prior P0 lineage was recovered from Git before any change. A fresh
adversarial pass then found one High correspondence-integrity gap: a valid
bureau-specific item was not durably bound to the bureau authority of its CRA
recipient. That High was repaired at the pure policy, database, direct-writer,
and concurrency boundaries and independently reattacked closed.

The Founder accepted Phase 1 as complete and authorized exactly one local P0
checkpoint commit. This artifact is included in that commit; its exact commit
SHA is recorded in the external post-commit Founder receipt because a commit
cannot truthfully embed its own SHA. All implementation remains dormant and
local. No M2 source or artifact was changed or used as P0 authority; no
production system, private report, or consumer record was accessed.

## 1. P0 LINEAGE — PASS

| Evidence | Exact value |
| --- | --- |
| Branch | `codex/p0-launch-correctness` |
| Checkpoint parent | `10ca22d85a522b48624309abc321139f0bf6e8fc` |
| Parent tree | `0adb1da6507460c8e9768264a646e4eeaa8725d3` |
| Local checkpoint commit | Included; exact SHA recorded in the external Founder receipt |
| Recovered worktree | Isolated local P0 worktree; private path withheld |
| Baseline / merge-base | `3a9943040da5648f1ae68fa9b8e0f06a276f75b1` |
| Plan commit | `f57c7f7afa559b25e071add7624c3b92a08a0af1` |
| Prior closure commit | `10ca22d85a522b48624309abc321139f0bf6e8fc` |

The registered historical worktree path was missing and prunable. Its stale Git
metadata was removed after a dry run, then the same path was recreated from the
verified local-only branch. Git object integrity passed. The branch is not on a
remote. `AGENTS.md` is absent from this lineage; no substitute was inferred.

## 2. ISOLATION FROM M2 — PASS

- P0 and M2 diverge from the same baseline; neither contains the other.
- The only overlapping changed pathname is `prisma/schema.prisma`; no content
  was copied, merged, or edited across worktrees.
- M2 status, tracked-diff, untracked-inventory, and empty-index fingerprints
  remained exactly unchanged throughout this continuation.
- P0 used only its recovered worktree and a temporary ignored dependency link
  to the exact-lockfile-matched local dependency tree.
- No M2 migration, source, evidence, artifact, or production access was used.

## 3. PHASE 1 IMPLEMENTATION — COMPLETE

Delta recovery reused the committed parser-v2, durable source-truth,
assessment, ConsumerAssertion, ReportVersion, score provenance, strategy,
Round 0, artifact, fixture, and migration foundations. It did not restart
discovery or redesign CreditVector.

The fresh adversarial review identified one remaining authorized delta and it is
now complete:

1. add immutable CRA bureau authority to `Recipient`;
2. reject CRA/non-CRA authority-shape violations;
3. prevent correspondence recipient retargeting;
4. validate each CRA correspondence item against its exact recipient bureau;
5. serialize item insertion against recipient retarget races;
6. require the same authority in strategy evaluation and consolidation; and
7. add direct, stale, duplicate, cross-bureau, downstream, and race regressions.

Seven engineering files changed. The checkpoint Markdown and HTML are the only
artifact files changed. No Phase 2, UI, mailing runtime, or production work was
performed.

## 4. PARSER-V2 SHADOW CONTRACT — PASS

- Parser-v2 remains opt-in and explicitly `SHADOW_ONLY`.
- Legacy parsing and legacy writes remain unchanged.
- Bureau observations retain bureau, section, source locator, method, version,
  confidence, and extraction-error provenance.
- Missing, failed, incomplete, or out-of-coverage fields remain `UNKNOWN`.
- Confirmed absence still requires complete canonical section evidence.
- Same-account bureau disagreements remain distinct observations.

## 5. DURABLE BUREAU-SPECIFIC SOURCE TRUTH — PASS

The durable graph preserves exact tenant, consumer, report, ReportVersion,
ExtractionRun, account, bureau, section, field, observation, series, revision,
and digest boundaries. Bureau-specific presence, completeness, current facts,
and historical evidence remain independent.

The repaired correspondence boundary now adds an exact CRA destination rule:
`Recipient.bureau` is required for a CRA and forbidden for a non-CRA; a CRA item
must match that immutable authority. Non-CRA correspondence preserves each
item's own bureau provenance without flattening it.

## 6. HISTORICAL EVIDENCE PRESERVATION — PASS

Supported historical derogatory evidence remains adverse when current fields
say Closed, Paid, zero balance, or Pays as Agreed. Current neutral or positive
fields cannot erase supported prior lateness, charge-off, collection, or other
derogatory evidence. Incomplete extraction cannot silently remove history.

## 7. CLEAN-CONTROL SAFETY — PASS

- `CLEAN` requires affirmative, complete, non-adverse evidence.
- Neutral-only, incomplete, uncertain, or conflicting input requires review.
- Supported adversity is monotonic against `CLEAN`.
- The synthetic clean control remains clean; the repair does not flag
  everything.
- Both assessment/adverse-evidence race orderings preserve zero stale
  `CLEAN`/adverse pairs.

## 8. REPORTVERSION / SCORE PROVENANCE — PASS

- Uploads can become immutable `ReportVersion` rows; reanalysis appends an
  `ExtractionRun` rather than overwriting truth.
- Present scores preserve bureau, encrypted value envelope, model/scale,
  method/version, occurrence, source locator, report date, and integrity data.
- A report without a score stays explicitly score-absent; no score is invented.
- Manual scores remain secondary and provenance-labeled.
- Before/after comparisons support score, account, field, bureau-coverage, and
  identity changes.
- Parser uncertainty never becomes deletion. Only complete
  `PRESENT → ABSENT_CONFIRMED` evidence can become `NO_LONGER_REPORTED`.
- Chronology/correlation is supported; unsupported causality is not.

## 9. CONSUMERASSERTION — PASS

`ConsumerAssertion` binds the exact tenant, consumer, report, run, account,
bureau, field, observation, series, revision, and evidence digest. Drift or
replacement requires reconfirmation; cross-bureau replay fails closed.

The repaired policy evaluator also rejects duplicate proof, orphan current
bindings, and stale extra evidence attempting to hitchhike behind a valid proof.
Parser inference still cannot autonomously create a factual dispute assertion.

## 10. STRATEGY POLICY FOUNDATION — PASS

- Twelve executable strategy policies remain present and dormant.
- Seven counsel-dependent policies remain `PENDING_COUNSEL`.
- Contract versions are now schema `1.1.0`, set `2026-08-10.phase1`, and policy
  `2026-08-10.1`.
- CRA evaluation requires a non-null recipient bureau equal to every supplied
  observation assertion and current binding.
- CRA consolidation rejects missing, conflicting, or mixed bureau authority.
- Non-CRA recipient authority must be null; item-level bureau evidence remains
  intact.
- No policy activates correspondence, fulfillment, or production behavior.

## 11. ROUND 0 FOUNDATION — PASS

The additive model supports an immutable, consumer-confirmed Identity Baseline
covering legal name, aliases, current/former addresses, safe identity fields,
reported phone/employment information, mixed-file indicators, and unrecognized
accounts. Accurate former addresses and legitimate employment information are
not automatically treated as disputable.

## 12. CORRESPONDENCE PROVENANCE FOUNDATION — PASS

Every future factual item can be pinned to recipient, bureau, creditor or
furnisher, masked account reference, exact field observation,
consumer-confirmed basis, requested action, and evidence digest.

The closed High is now guarded in both layers:

- **Runtime:** Equifax evidence cannot authorize Experian or TransUnion CRA
  correspondence; mixed CRA consolidation is denied.
- **Database:** direct writers cannot insert an item under a different CRA
  bureau, mutate immutable recipient authority, retarget a correspondence, or
  win either item-insert/retarget concurrency ordering.
- **Downstream:** correspondence versions, membership, packets, and artifacts
  retain the exact recipient lineage already enforced by composite keys.

Recipient-first packetization remains limited to compatible items. CRA,
collector, furnisher, goodwill, cease/desist, and regulator classes stay
separate unless an explicit dormant policy allows consolidation. No final
mailing runtime was built.

## 13. LOCAL/DISPOSABLE MIGRATION — PASS

| Frozen repaired input | SHA-256 |
| --- | --- |
| `prisma/schema.prisma` | `a18b04ab0026c3e1b6e4dd6f034fa59182acf39fdcc1181f714bb79039bb9d91` |
| Phase 1 migration | `bd2c03aa76f29d1f25258bb23786adaf39601c9401e4e5eafdf92ba0a8eeb7c9` |
| Migration static guard | `37cd3f70fc20a5dcc324891965b6673a517c86a79c5d9acb4dcb79f5a8a4ee1f` |
| Disposable verifier | `982f15a517d7647859b8cb84152333b2a6135d7018cff1d63a100abad41d7fc8` |
| Disposable rollback | `8e4b04734dd063a8ac04e6c5db98dc7c6026936df4317aa4758b5c619a9a9e39` |
| Strategy policy | `0f36c72fbadf8aef8ec453a418c064b490efebe84732db85de47986a646a7301` |
| Strategy test | `1796ca2756b98737373ce95c5ee9934bc3f1af061b2050f5af67dce7a4c8c9e5` |
| Synthetic fixture, unchanged | `b3afc9ae354f6966186851b31d7712a20929d15c559f08756ff90ff659db0b10` |

The disposable PostgreSQL proof passed forward deploy, exact no-op deploy,
empty Prisma parity diff, catalog validation, 65 negative probes, three positive
suites, both routing race orders, rollback, clean rebuild, rebuilt no-op, and
teardown. Final P0 catalog counts were 49 enums, 32 tables, 122 unique indexes,
38 secondary indexes, 106 foreign keys, 128 checks, 74 triggers, and 31
functions. The disposable container was removed and only the verifier-started
local Colima profile was stopped.

The committed migration-verification and red-team reports remain historical
pre-repair evidence for unchanged gates. For recipient routing and migration
counts, this continuation's frozen hashes and **51 / 51; 3 / 65** evidence
supersede their earlier **48 / 48; 3 / 47** snapshot.

Production migration, connection, write, backfill, reanalysis, report
processing, and feature activation were **NONE**.

## 14. TEST COUNTS — 454 / 454 GREEN

| Suite | Exact result |
| --- | ---: |
| Sanitized source-truth fixture | 23 / 23 |
| Parser-v2 shadow contract | 69 / 69 |
| Assessment and assertion binding | 79 / 79 |
| Executable strategy policy | 102 / 102 |
| Artifact storage contract | 71 / 71 |
| Progress Intelligence | 30 / 30 |
| Existing classification regression | 29 / 29 |
| Migration static guard | 51 / 51 |
| **Contract/static total** | **454 / 454** |
| Disposable migration | **3 positive suites / 65 negative cases** |

Whole-tree TypeScript, Prisma format and validate, shell syntax, whitespace,
schema/database parity, forward/no-op/rollback/rebuild, race checks, privacy
scans, and disposable teardown are also **PASS**.

Rendered local-file browser QA was **UNAVAILABLE** because the in-app browser
policy blocks `file:` URLs. Static responsive CSS, mobile overflow containment,
HTML structure, and anchor checks passed; no workaround was attempted.

The executable matrix covers all 16 Founder scenarios, including three-bureau
disagreement; current positive fields plus historical adversity; the clean
control; missing/conflicting fields and dates; historical-section evidence;
parser uncertainty; score present/absent; immutable ReportVersions; uncertainty
not deletion; exact ConsumerAssertion binding; Bureau A→B replay rejection;
noncausal score language; and clean remaining clean.

## 15. ADVERSARIAL FINDINGS — C0 / H0 / M4 / L2

The continuation found one High and closed it before this checkpoint:

| Finding | Final disposition |
| --- | --- |
| CRA recipient was not durably bound to item bureau | **CLOSED** — policy, schema, trigger, direct-writer, retarget, downstream, and concurrency tests pass. |

Open pre-activation findings remain unchanged:

| Severity | Count | Remaining pre-activation findings |
| --- | ---: | --- |
| Critical | 0 | None. |
| High | 0 | None. |
| Medium | 4 | Trusted writer semantic attestation for encrypted-value equality; truthful post-I/O artifact result state; strict negative-integrity result shape; safe translation/retry for fail-closed PostgreSQL `40P01`. |
| Low | 2 | Strict ISO-instant parsing; runtime schema parsing for malformed nested artifact inputs. |

These are explicit activation gates. They do not expose an active production
path and do not reopen this build-only Phase 1 checkpoint.

## 16. PRODUCTION MUTATIONS — NONE

- Production database connections, migrations, writes, backfills, reanalysis,
  and report processing: **NONE**.
- Production correspondence, fulfillment, feature activation, and user-data
  inspection: **NONE**.
- Founder reports, consumer PII, PDFs, screenshots, letters, credentials, and
  private evidence: **NOT READ OR COPIED**.
- M2, Stripe, and every other production system: **UNTOUCHED**.
- Local/disposable PostgreSQL only: **PASS, fully torn down**.

## 17. LOCAL CHECKPOINT / MERGE / DEPLOY / ACTIVATION

- One local P0-only checkpoint commit: **FOUNDER-AUTHORIZED AND INCLUDED**.
- Push: **NONE**.
- Merge to `main`: **NONE**.
- Deployment or production migration: **NONE**.
- Backfill, reanalysis, parser read-path switch, flag enablement, UI/Kai change,
  or correspondence runtime activation: **NONE**.

The commit contains only the seven reviewed engineering/migration-verification
files and this existing Markdown/HTML checkpoint pair. The exact commit SHA,
parent SHA, file count, clean-worktree result, and unchanged M2 fingerprints are
recorded in the external post-commit Founder receipt.

## 18. NEXT FOUNDER DECISION

Phase 1 is accepted and locally checkpointed. No additional engineering action
is authorized. Any push, merge, deploy, production migration, backfill,
activation, or Phase 2 work requires a separate Founder decision.

**STOP here. Phase 2 is not started. Wait for Founder authorization.**
