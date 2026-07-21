# ADR-0035: Platform Event Bus — a durable, replayable, typed event substrate

Status: **ACCEPTED — substrate built & preview-validated (2026-07-20). Flag OFF; prod migration + consumer wiring owner-gated.**
Date: 2026-07-20
Decision owners: Founder directive (Sprint 8 — "the nervous system") · Principal Engineer (reuse-first reconciliation)
Scope: New package `lib/eventBus/**` + one migration-first table + an admin read endpoint. **No existing subsystem was rewritten; no other session's files were edited.**

---

## 1. Context — four event-ish stores already exist; do not add a fifth blindly

A parallel-reader inventory (10-agent workflow) established the ground truth before any code:

| Store | Purpose | Typed | Versioned | Idempotent | Full-payload replay | Tenant | Agency | Subscribers |
|---|---|---|---|---|---|---|---|---|
| `KernelEvent` (kernel) | dispatch event log | envelope only | via stamp | yes (id PK) | **no — hash-only** | yes | no | in-proc only |
| `KaiEvent` | user timeline stream | partial | no | no | partial | user-scoped | no | pollers |
| `ProductEvent` | analytics funnel | no | no | no (random id) | no | user-only | no | none |
| `AdminAuditLog` | admin-action audit | no | no | no | n/a | no | no | none |
| `NetworkMessage` (Sprint 7) | operator chat | yes | no | **yes** | **yes (cursor)** | yes | yes(backstop) | cursor-poll |

The GIOS **Kai Kernel** is already an event-bus *substrate* — `emit()` → typed `KaiEvent` → `EventLog` port + `subscribe(pattern,handler)`; `dispatch()` = authorize → 3-state idempotent claim → execute → audit → emit → settle with correlationId + replay receipts — but it is **dormant** (`KERNEL_DURABLE` OFF, zero production callers), its durable event log is **hash-only** (persists `payloadHash`, not the payload, by founder privacy directive), and its persisted envelope carries no `actorId`/`agencyId`/`source`/`correlationId`.

## 2. Decision — build ONE new full-payload log; reuse everything else

The genuinely missing primitive is a **durable, replayable, full-payload event log with a platform envelope and typed+versioned contracts**. Everything else is reused, not rebuilt:

- **Envelope** — `PlatformEvent` is a superset of the kernel `KaiEvent`, adding `actorId` (principal), `agencyId` (2nd isolation axis, **id not name**), `source`, `correlationId`, and contract `version`. Identity resolution mirrors `lib/os/host/identity.ts`: **actor = `currentAccount().id`** (principal), **tenant = `currentUser().id`** (data owner — a client's id when an agency has it open), **agencyId = the agency id** (never `account.id ?? managedByAgencyId`).
- **Idempotency (outward effects)** — reuses the kernel's durable 3-state `durableIdempotency()` (`KernelIdempotency`, D-07-fixed). No second ledger.
- **Persistence** — reuses the **Sprint 7 `NetworkMessage` pattern**: deterministic tenant-scoped id as the idempotency key (`ON CONFLICT`/P2002 replay) and `[createdAt asc, id asc]` deterministic order (a `createdAtMs:id` cursor). No bespoke sequence.
- **Notifications** — `NOTIFICATION_CREATED` feeds the **existing** `buildNotificationPlan` (finally making its `plan.idempotencyKey` load-bearing) → existing `sendPushToUser`. **No parallel notification system.**
- **Authz** — reuses `entitlementSnapshot().grantedPermissions` + the account role/`isAgency` flags. Each contract declares a `scope` (self/agency/platform) + an **existing** permission. The publish PEP is never bypassed.
- **Contracts** — `zod` (already a dependency); 13 typed, versioned, **refs-only** payloads.

The one new table, `EventEnvelope`, is **migration-first** (Prisma model + offline `migrate diff`, additive: 1 CREATE TABLE, 0 DROP) — **not** self-heal (not on the `LEGACY_SELF_HEAL_ALLOWLIST`). It has **no FK to User**: events are an immutable coordination spine that must outlive the entities they mention (an `ACCOUNT_DELETED` event cannot cascade with the account).

## 3. Why this is not a duplicate (the load-bearing distinction)

`KernelEvent` is hash-only by directive and cannot be extended for replay; `KaiEvent` is a user-timeline render source; `ProductEvent` is fail-open analytics; `AdminAuditLog` is admin actions. None provides a durable, replayable, typed, tenant+agency-scoped, subscriber-fanned event backbone. The existing stores become **producers into** / **subscribers of** the bus over time (owner-gated), not replaced.

## 4. Isolation, privacy, and the refusal register

- **Tenant + agency isolation** is enforced on every read/replay against a **server-resolved `AuthContext`** (never a client-supplied tenantId/agencyId — the IDOR the adversarial review flagged as a BLOCKER). `scopeWhere` is fail-closed narrowest-first: admin=platform, agency=own+agency stream, everyone else=own tenant (a managed client cannot read the agency stream).
- **Refs-only payloads** — a structural PII denylist rejects value-bearing fields pre-persist; a `redactedAt` tombstone supports data-subject erasure without breaking the log.
- **No public publish endpoint** — publishing is internal-only ("only internal event publication"). The single HTTP surface is an **admin-only, flag-gated read**.
- **Still refused (privacy/counsel-gated, unchanged):** presence, typing indicators, read receipts, cross-user broadcasts, public activity feeds. `NOTIFICATION_CREATED` sends only to the tenant, **never** `sendPushToAdmins`.

## 5. Validation

Preview-validated on the isolated preview DB (`migrate deploy` → up-to-date; 29→30 tables, 4 migrations, 6 indexes). End-to-end on real Postgres (`eventbus-preview-integration` 14/14: idempotent replay, cross-tenant isolation, full-payload replay, deterministic order, correlationId stability, live fanout). DB-less guards: validate 57, authz-isolation 43, idempotency-replay 20, notification-nodup 9, migration-guard 18. Sprint 7 + kernel + schema-safety + arena + operator-shell all green. `flag EVENT_BUS_ENABLED` OFF.

**19-agent adversarial code review** of the built code found 9 verified findings, all MEDIUM/LOW (zero BLOCKER/HIGH — the core isolation/authz/idempotency/replay held), all fixed: (a) `deriveEventId` now folds the event TYPE into the id hash so two types sharing (tenant, source, dedupeKey) cannot collide on the PK and drop one as a false replay; (b) the PII guard scans string VALUES (email/SSN/card/phone), not only key names; (c) the registry's unbounded in-process dedupe Set was removed and the "at-least-once / catches up via replayEvents" claim corrected to the honest at-most-once-per-fresh-persist contract (durable effect ledger provides at-most-once for effects; replay-driven redelivery is deferred); (d) `redactEvent` was wired to an admin-only `POST /api/event-bus/redact`; (e) an `[agencyId, createdAt, id]` index (additive migration) backs the agency-stream OR-branch.

## 6. Deferred (owner-gated) — NOT done here

Prod migration apply + `EVENT_BUS_ENABLED=true`; wiring real producers/subscribers in Mission Control, Arena (`lib/arena/**` owned by another package — STOP/coordinate), Kai, the 5 inline notify send-sites, and Operator Network (owned by another package); live cross-instance catch-up delivery (needs a safe-low-watermark or per-event delivery-tracking design — the naïve scalar high-water drain was rejected in review because it drops late-committing low-seq events); routing publishes through kernel `dispatch` → `KernelAudit` (requires activating the durable kernel).

## 7. Consequences

Future features publish structured events instead of inventing bespoke realtime; consumers subscribe/replay instead of polling business tables. `EventEnvelope` is Prisma-managed and migration-backed (run `migrate deploy`, never `migrate dev`, to avoid drift reports). The substrate ships **dormant** — business value is latent until the owner-gated integrations land; this is stated, not oversold.

## 8. Terminology & evolution

This substrate is the implementation of the **CreditVector Event Fabric** (the platform-wide semantically-neutral backbone). The **`EventBus` / `lib/eventBus/**` package name is retained** (renaming reviewed code for terminology alone is churn). How the envelope and the 13 contracts are permitted to evolve — version-not-mutate, refs-only, content-ownership belongs to the emitting context, the `eventId`/`correlationId`/`causationId`/`traceId` distinction, the conceptual event taxonomy, and retention classes — is governed by [`ADR-0036`](ADR-0036-event-contract-evolution.md). `contracts.ts` remains the single source of truth for the taxonomy.
