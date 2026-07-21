# CreditVector v0.8.0 — Gate C Release Record

**Point-in-time release record · 2026-07-21.** Sprint 7 + Sprint 8 + Constitutional Era merged to production; Platform Services Era begins. For **live** state, [`CURRENT-STATE.md`](CURRENT-STATE.md) is authoritative; for the full package, see [`RELEASE-REVIEW-sprint7-8.md`](RELEASE-REVIEW-sprint7-8.md).

## Status
`Merged & Deployed` · `0 blockers` · **All flags OFF** · **No migration run** · **Prod DB unchanged**

| | |
|---|---|
| Release / tag | **v0.8.0** = `291899b` |
| Prod HEAD (docs follow-up) | `d7b30e8` (runtime identical to `291899b`) |
| Prior base | `f1e26b0` |
| Deployment | `dpl_7t47rzw8x` — READY, `target: production`, aliased `creditvector.app` |
| Merge type | fast-forward, no force, no history rewrite |

The founder-authorized merge (Gate C) fast-forwarded `review/sprint7-8-constitutional` into `main` and auto-deployed to production. Every new capability is dormant behind fail-closed flags; no production data was touched.

## 1 · What shipped (35 commits)
- **Sprint 7 — Operator Network (dormant):** migration-first message persistence, tenant-safe idempotent message API, cursor-polling chat UI at `/network`. Gated by `OPERATOR_NETWORK_ENABLED` (OFF) + cohort.
- **Sprint 8 — Event Fabric (dormant):** typed versioned event contracts, durable `EventEnvelope` log (idempotent append, isolation-scoped replay), publisher pipeline, admin-only read/replay + erasure. Gated by `EVENT_BUS_ENABLED` (OFF).
- **Constitutional (docs):** ADR-0035…0038, Vector XP, Performance Intelligence, Operator Identity, Economy architecture. Principles founder-ratified; all policy **values** remain PROPOSED / owner-gated.

## 2 · Verification (against the running production deployment)
- ✅ **Deployment READY & promoted** — `dpl_7t47rzw8x` at `291899b`, `target: production`, aliased to creditvector.app (built ~112s).
- ✅ **Health** — `/`, `/pricing`, `/login`, `/community` → 200; release header `x-cv-release: d7b30e8`.
- ✅ **Flags OFF — verified at runtime (fail-closed):** `/network` → 307→`/dashboard` · `/api/event-bus/read` & `/redact` → 404 · `/api/network/messages` → 403.
- ✅ **No migration ran — prod DB unchanged** — build = `prisma generate && next build` (build logs); no `migrate deploy`, no `db push`. The 3 additive tables are not yet in production.
- ✅ **Pre-push validation** — typecheck 0 · build ✓ · secret-scan clean · `git fsck` clean · guard suite **56 pass / 2 fail** (the 2 — `execution`, `missionEngine` — are pre-existing on `main`, in untouched subsystems).
- ✅ **Two independent adversarial reviews → 0 blockers** — 14-agent runtime safety sweep + final merge-safety review. All dimensions CLEAR: tenant isolation, authz/RBAC, flag-gating, event idempotency/replay, migration additivity, PII, secrets, history integrity.

## 3 · Still owner-gated (independent — none implies the next)
- **⚠ Gate D — production migration:** `prisma migrate resolve --applied 0_init` → `prisma migrate deploy`. Additive (0 DROP). Must precede **any** flag flip — otherwise a flag-on request 500s on missing tables. Owner-run (prod DB creds are Production-scoped/sensitive).
- **⚠ Gate F — feature activation:** turn on `OPERATOR_NETWORK_ENABLED` / `EVENT_BUS_ENABLED`. Before enabling the network, resolve **DW-D14** — the demo account is auto-included in the cohort (`lib/network/cohort.ts`) and is prod-authenticatable via a public `/api/demo/seed` endpoint; latent today (403 on every channel) but close it first.

## 4 · Governance
**⚖️ New engineering law:** *Every sprint must increase production capability.* Architecture is no longer the primary deliverable — production software is. Future ADRs exist only when implementation reveals a genuine architectural discovery.

**🧊 Constitution frozen** (change only on repository evidence, never speculation): Platform & Product Constitutions · ADR-0035/0036 (Event Fabric) · ADR-0037 (Operator Growth) · ADR-0038 (Professional Growth Economy) · Vector XP · Performance Intelligence · CreditVector Economy · Operator Identity · release gates. Policy **values** (XP weights, legal terms, fraud thresholds, public-profile fields) remain PROPOSED / owner-gated.

## 5 · Next — Platform Services Era Phase II
Workspace opened ([`PLATFORM-SERVICES-PHASE-II.md`](PLATFORM-SERVICES-PHASE-II.md)). Dependency-ordered; do not build a later service first:

`1 Operator Identity` ← next → 2 Organizations → 3 RBAC → 4 Profiles → 5 Identity Events → 6 Reputation Runtime → 7 Milestones → 8 Entitlements → 9 Claims → 10 Performance Intelligence → 11 Arena → 12 Marketplace → 13 Operator Network → 14 Knowledge Graph → 15 Kai Runtime.

Per-slice discipline: migration-first (never in the build; preview-validate; prod apply owner-gated) · fail-closed flag from commit 1 · own-data-only defaults · small reviewable commits.

## 6 · Follow-ups
- **DW-D14** — demo-account cohort exposure (before `OPERATOR_NETWORK_ENABLED`).
- **DW-D15** — event PII value-scan misses bare 9-digit SSN (refs-only contracts are primary defense; no producers today).
- Pre-existing guard failures (`execution` / `missionEngine` "business-credit locked").
- `.gitignore` hygiene for local skill tooling.
- Next.js 14.2.18 carries a published security advisory (pre-existing; version unchanged by this release).
- Full deferred-work register: [`RELEASE-REVIEW-sprint7-8.md`](RELEASE-REVIEW-sprint7-8.md) §9–§10 (DW-C1…C5, DW-D1…D15).

---
*Explicit confirmations: local `main` not force-pushed · nothing rewritten · production migration not executed · no feature flag enabled · no Platform Services implementation begun.*
