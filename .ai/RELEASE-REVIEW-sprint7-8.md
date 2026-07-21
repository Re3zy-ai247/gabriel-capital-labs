# Release Review — Sprint 7 + Sprint 8 + Constitutional Architecture

**Status: REVIEW RECORD — DO NOT MERGE / DO NOT DEPLOY without owner approval.** Architecture docs herein remain **PROPOSED** (founder ratification pending, ADR-0034). Created 2026-07-20 as the auditable package for the accumulated unpushed chain.

---

## 1. Repository & deployment truth (verified with evidence)

| Fact | Value | Evidence |
|---|---|---|
| Branch / HEAD | `main` @ `805e13f` (before this record) | `git rev-parse` |
| origin/main | `f1e26b0` | `git rev-parse origin/main` (post-fetch) |
| Ahead / behind | **24 ahead, 0 behind** — clean fast-forward, no divergence | `git rev-list --left-right --count` |
| Merge-base | `f1e26b0` (= origin/main) | `git merge-base` |
| **Production deployment** | `dpl_CtkHrE3m41WDh8Hs3P45z9dd3yQo` READY, target=production, **commit `f1e26b0`, branch `main`** | Vercel API `list_deployments` |
| Production branch | **`main`** (all prod deployments `githubCommitRef:main`; `git-main` alias) | Vercel API |
| Push-to-main behavior | **auto-deploys production** (`githubDeployment:1`) | Vercel API |
| Non-main branch behavior | **preview only** (`target:null`; e.g. `feat/operator-network-shell` → preview alias) | Vercel API |
| Preview isolation | own Prisma Postgres DB; prod `DATABASE_*` vars scoped Production-only (RC1 `6daadc9`); build runs **no** `db push`/migrate (RC1 `6611f10`, `vercel.json` build = `prisma generate && next build`) | prior RC1 work + `vercel.json` |
| CI (`.github/workflows/ci.yml`) | build/test on any push, placeholder secrets, **no deploy/migrate/merge** | file read |
| Scheduled workflows | daily-health (read-only prod probe), weekly-verify, monthly-review — **"no commits, no PRs, no auto-merge"** | file read |
| Secrets in range | none (`.env*` not tracked; only `.env.example`) | `git ls-files` |

**The 24 unpushed commits are NOT in production** — production sits exactly at the merge-base `f1e26b0`, the parent of the chain.

## 2. Commit inventory (`origin/main..HEAD`, oldest→newest)

**Sprint 7 — Operator Network message layer (runtime + migration):**
- `dc8e9a7` schema + migrations (baseline `0_init` + `operator_network_messages`) · migration
- `8125bf9` message API (cohort gate + tenant-safe) · runtime/API/authz · +tests
- `81d5ebe` cursor-polling chat UI (flag-gated) · runtime/UI
- `7cebc68` work-ledger (preview-validated) · docs

**Sprint 8 — Event Fabric (runtime + migrations):**
- `cdc6da9` work-ledger claim · docs
- `b3fd0a4` typed versioned contracts + validation · runtime · +test
- `23ff8eb` migration-first `EventEnvelope` + guard · schema + migration · +test
- `04db5b8` durable store (idempotent append, isolation-scoped reads) · runtime · +test
- `f566c2a` publisher runtime (validate→authorize→persist→fanout) · runtime · +tests
- `b6d1b27` effect idempotency + reference subscribers · runtime · +test
- `23d9a35` admin-only flag-gated read/replay endpoint · runtime/API
- `96268a1` correlationId + publisher-failure tests · test
- `3987e08` ADR-0035 + ledger + CURRENT-STATE · docs
- `7ee18a1` adversarial hardening (id collision, PII values, fanout) · runtime · +tests
- `a4d2588` erasure endpoint + agency-stream index · runtime/API + migration · +tests
- `99cb9ad` review outcome + guard counts · docs

**Constitutional passes (documentation only):**
- `5e85cf0` fix: reference subscriber must not author notification content · runtime (dormant) · +test
- `1e44fc9` ADR-0036 evolution · docs
- `5aca7b4` OPERATOR-IDENTITY index · docs
- `b0e1065` bounded-context reconciliation + navigation · docs
- `ab29e23` ADR-0037 + VECTOR-XP + PERFORMANCE-INTELLIGENCE · docs
- `b2cfe1a` Arena policy reconcile + no-star refusal · docs
- `a4a5952` Professional Operator Profile + media boundary · docs
- `805e13f` bounded-context + roadmap + navigation (operator growth) · docs

**Totals:** 12 runtime-code commits · 4 additive migrations · 12 docs/governance commits · 1 fail-closed flag (`lib/eventBus/flags.ts`). Runtime code is dormant behind `EVENT_BUS_ENABLED`, `OPERATOR_NETWORK_ENABLED`, `ARENA_ENABLED` (all fail-closed OFF).

## 3. Migration inventory (all additive, preview-validated, NOT in production)

| Migration | Effect | DROP | Prod apply |
|---|---|---|---|
| `0_init` | **baseline** — 26 tables (the existing prod schema) | 0 | `migrate resolve --applied 0_init` (mark applied; do NOT execute — tables already exist in prod) |
| `20260720204355_operator_network_messages` | 2 tables (NetworkMessage, NetworkMessageReadState) | 0 | `migrate deploy` |
| `20260720223438_event_bus` | 1 table (EventEnvelope) + 4 indexes | 0 | `migrate deploy` |
| `20260720231803_event_bus_agency_index` | 1 index | 0 | `migrate deploy` |

**Owner-gated prod procedure (do NOT run now):** `migrate resolve --applied 0_init` → `migrate deploy` → `migrate status`. Validated on the isolated preview DB (26→30 tables). Forward-only; no destructive step.

## 4. Release risk matrix

| # | Sev | Finding | Control | Blocks branch preserve? | Blocks PR? | Blocks merge/deploy? |
|---|---|---|---|---|---|---|
| R1 | **HIGH** | Pushing **local main** auto-deploys all 24 commits to production | **Never push main.** Push only the review branch (novel name → preview only) | no | no | — (this is the thing to avoid) |
| R2 | **HIGH** | Prod DB lacks the 3 new tables; enabling a flag before `migrate deploy` → runtime errors | Flags stay **OFF** (fail-closed); prod migration is owner-gated + must precede any flag flip | no | no | **yes** — migrate before flag |
| R3 | **MEDIUM** | `0_init` baseline would fail if executed against prod (tables exist) | Prod apply uses `migrate resolve --applied 0_init` first, never a raw run | no | no | yes (procedure) |
| R4 | **MEDIUM** | PROPOSED docs (ADR-0037, VECTOR-XP, PERFORMANCE-INTELLIGENCE) treated as RATIFIED | Statuses say PROPOSED; founder ratification pending (ADR-0034). This record does not flip them | no | no | n/a |
| R5 | **MEDIUM** | Cross-commit coupling in the event-bus chain (contracts→store→publisher→subscribers) | Do not cherry-pick individually; decompose only with care (see §6). History integrity first | no | no | n/a |
| R6 | **LOW** | Pushing the review branch triggers a **preview deploy** + CI build | Benign — preview isolated, dormant/flag-off code, public repo; provides remote CI evidence | no | no | no |
| R7 | **LOW** | Operator Network `/network` + Event Fabric are incomplete/dormant surfaces | Fail-closed flags; not reachable in prod | no | no | no |
| R8 | **INFO** | Tests validated locally; no remote CI evidence yet | Pushing the review branch runs CI (build/test) remotely | no | no | no |

**No BLOCKER to branch preservation or PR creation.** The only production-dangerous action (R1) is explicitly avoided.

## 5. Ratification decision — **B: CONDITIONAL (recommend founder ratification; retain PROPOSED)**

The constitutional package is **architecturally sound and internally consistent**: it derives from and cites the frozen `GIOS-PLATFORM.md` (ADR-0034 Law 26), introduces **no second source of truth** and **no frozen-law edit**, keeps identity ≻ reputation, business-health ≠ reputation, Vector-XP-never-decreases/spent/client-awarded, milestones/entitlements/claims distinct, Arena/Mission-Control as experiences (not truth), Marketplace-can't-mutate-XP, Kai-not-a-truth-source, no public 1–5 star rating, profile-media reusing the Attachment boundary, and one owner per bounded context. A 5-agent adversarial review hardened it (BLOCKER: award idempotency re-keyed to the stable `subjectId`; + HIGH controls added).

**Per ADR-0034, ratification (PROPOSED→RATIFIED) is a FOUNDER action** — not self-applied here. Statuses stay PROPOSED. The package is **ready for founder ratification with conditions**; the following remain **owner-gated and explicitly unratified**: XP weights/caps/formulas · referral & verified-client & verified-outcome definitions · Sybil primitive · public-profile fields & visibility defaults · marketplace legal terms & reward liability · consumer-facing visibility · CROA/FCRA/FTC treatment of public reputation · privacy/deletion over the immutable ledger · production migration approval · feature-flag activation.

## 6. Preservation, PR & future decomposition
- **Preservation:** a review branch at HEAD backs up the full chain remotely without touching production (proven §1). **Local main is never pushed.**
- **PR:** review-only, base `main`, marked **DO NOT MERGE / DO NOT DEPLOY**, honest mixed-scope (Sprint 7 code + Sprint 8 code + constitutional docs).
- **Future decomposition (recommended, requires owner approval — history rewrite):** split into (a) Sprint 7 network, (b) Sprint 8 Event Fabric, (c) constitutional docs. **Not performed** — history integrity first (no rebase/squash without approval).

## 7. Recommended next gate
**Release review first, then the owner-gated production migration + merge of the runtime range — before any new implementation.** Constitutional docs can be founder-ratified independently (docs-only, zero prod risk). Implementation order (unchanged): Operator Identity foundation → Profile/Media → Vector XP core → Milestones → Entitlements → Claims → Performance Intelligence → experiences.
