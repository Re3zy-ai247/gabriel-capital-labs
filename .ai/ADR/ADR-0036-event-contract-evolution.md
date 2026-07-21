# ADR-0036: Event Fabric — contract & envelope evolution policy

Status: **PROPOSED (2026-07-20 — policy/documentation only; no code or schema change).**
Decision owners: Founder directive (Event Fabric era) · Chief Architect (reconciliation).
Derives from & cites (ADR-0034 Law 26 mandate): [`GIOS-PLATFORM.md`](../GIOS-PLATFORM.md) (the frozen platform constitution — Architecture Laws, ownership registry) · [`ADR-0035`](ADR-0035-platform-event-bus.md) (the Event Fabric substrate — the shipped, preview-validated implementation) · [`lib/eventBus/contracts.ts`](../../lib/eventBus/contracts.ts) (the code source of truth for the event taxonomy).
Scope: **evolution POLICY only.** This ADR does **not** re-catalog the substrate or the contracts (ADR-0035 + `contracts.ts` own those). It records how the fabric's envelope and contracts are permitted to change over time, and reserves — in documentation, not schema — the concepts a future version will need. **No nullable columns are added to "reserve" fields; the schema changes only when repository evidence proves a field is needed now (Architecture Law: evidence earns architecture).**

---

## 1. Terminology — the CreditVector Event Fabric

The **CreditVector Event Fabric** is the platform-wide, semantically-neutral communication backbone connecting bounded contexts (Disputes, Letters, Arena/Reputation, Operator Network, Mission Control, Kai, Notifications, Analytics, Audit, …). It is **infrastructure, not a business domain**.

The **implementation package retains the `EventBus` / `lib/eventBus/**` naming** — renaming shipped, adversarially-reviewed code purely for terminology would be churn against Architecture Law (additive/reversible, no rename-for-taste). "Event Fabric" is the **architectural concept**; `EventBus` is the **package** that realizes it. Both names are canonical at their level; this ADR binds that mapping so future docs stop treating them as two things.

**The fabric owns** (ADR-0035): the envelope, contract versioning, validation, authorization gates, persistence, idempotency, replay, ordering, routing, subscriber invocation, redaction mechanics, isolation enforcement.
**The fabric never owns**: domain business logic, domain state transitions, domain authorization *policy definitions*, reputation/achievement calculations, marketplace rules, **notification content decisions** (fixed 2026-07-20 — the reference subscriber no longer authors push copy; content is the emitting context's, injected via `composePush`), Kai reasoning, projection meaning. **Meaning belongs to the producing and consuming bounded contexts.**

## 2. Truth → Fabric → Projection → Experience

```
   TRUTH  (a bounded context's own tables — the authoritative record)
     │  the context emits a typed, versioned, refs-only event AFTER it commits its truth
     ▼
   EVENT FABRIC  (EventEnvelope — durable, immutable, replayable transport; owns no meaning)
     │  subscribers read/replay; each interprets per its own context
     ▼
   PROJECTION  (a read-model a consuming context builds from events — NEVER promoted to truth)
     │
     ▼
   EXPERIENCE  (Mission Control / Arena / Operator Network — renders projections)
```
**Projections never become truth** (GIOS-PLATFORM Architecture Law). A projection is rebuildable by replaying the fabric from the beginning of the retained window; if a projection and a context's own tables disagree, the tables win and the projection is rebuilt.

## 3. Contract evolution — version, never mutate

Binding rules (the code already enforces the mechanism; this ADR makes the policy canonical):
1. **A contract is immutable once shipped.** A breaking payload change ships as a **new `@version`** (`TYPE@2`); the old version stays registered so persisted history and replay keep validating. Never edit a live contract's shape in place. (Same discipline as `ARENA_POLICY_VERSION`.)
2. **`contracts.ts` is the single source of truth** for the taxonomy — there is **13** registered contracts today (DISPUTE_CREATED, LETTER_GENERATED, LETTER_SENT, ACCOUNT_DELETED, ACCOUNT_UPDATED, CLIENT_CREATED, CLIENT_UPDATED, ACHIEVEMENT_UNLOCKED, ARENA_POINTS_CHANGED, MISSION_COMPLETED, NOTIFICATION_CREATED, SYSTEM_EVENT, KAI_INSIGHT_CREATED). Any doc citing a different count is stale and defers to the code. No parallel catalog is created.
3. **Refs-only payloads.** Payloads carry ids, enums, counts, booleans, and field *names* — never value-bearing PII. Enforced structurally (`validate.ts`: key-name denylist **and** high-confidence value scanning for email/SSN/card/phone). Details live in the owning context's tables behind that context's own authorization.
4. **Content ownership belongs to the emitting context.** The fabric transports a *fact* (e.g. "a notification was created for user U, purpose P"); it never carries or composes the human-facing *message*. The `NOTIFICATION_CREATED` reference subscriber takes `composePush` from the producer and fails closed with no composer. The durable content-resolution seam (how a consumer fetches composed content for a ref) is **future work**, gated with the real producer/subscriber wiring.
5. **`ARENA_POINTS_CHANGED` carries `totalXp` — considered, not drift.** The fabric transports a reputation *fact*; Arena/Reputation remains the computing, authoritative source (`defaultSource:"arena"`, `scope:"self"`). Optional future purity (carry only `xpDelta`+`classId`) is noted, not required.

## 4. Envelope evolution — reserved concepts (documented, not built)

Today's `PlatformEvent` (ADR-0035 §2) carries: `id, type, version, tenantId, agencyId, actorId, source, correlationId, payload, createdAt, redactedAt`. The following are the **anticipated** evolution; each is added only when a consumer needs it (evidence earns architecture), as a versioned, additive migration:

- **`eventId`** — already present as `id` (deterministic, tenant+type-scoped; the idempotency key).
- **`correlationId`** — already present. **Groups related work** (one request/saga). Stable across retries.
- **`causationId`** — *reserved.* The **direct parent** event/command id (what caused *this* event). Distinct from correlation: correlation is the group; causation is the edge to the immediate parent.
- **`traceId`** — *reserved.* The **broader execution path** across services/requests. A correlation group can span multiple traces; an event graph is **not always a single linear chain** — causation forms a DAG, trace is the umbrella.
- Reserved envelope concepts (docs only): **event category** (§5), **priority**, **privacy classification** (§6), **provenance** (which system/version produced it), **retention class** (§6), **producer identity** (beyond `actorId`/`source`), **schema identity** (a stable contract fingerprint), **external-delivery eligibility** (may this leave the CreditVector trust boundary — default NO).

**Trace semantics (canonical):** *correlation* groups related work; *causation* names the direct parent; *trace* is the broader path. An event graph is a DAG, not a chain.

## 5. Event taxonomy — conceptual categories

A classification lens over the existing contracts (NOT new fields, NOT a second catalog). Each conceptual category answers: does it carry business truth, may it update projections, may Kai consume it, does it belong in permanent audit, may it leave the trust boundary. Owning context is where meaning lives.

| Category | Meaning | Owning context | Business truth? | Replay-safe (no external re-effect)? | Kai may consume? | External-delivery eligible? | Permanent audit? | Today's contracts |
|---|---|---|---|---|---|---|---|---|
| **Domain** | a business fact happened | the domain context | yes | yes | yes | no (default) | per-retention | DISPUTE_CREATED, LETTER_GENERATED, ACCOUNT_/CLIENT_* , MISSION_COMPLETED |
| **Integration** | cross-context coordination | producer context | yes | yes | yes | no | operational | (implicit — any Domain event consumed cross-context) |
| **Audit** | who/what/why, tamper-evident | Audit/Compliance | yes | yes | no | no | **yes** | (kernel `KernelAudit`; SYSTEM_EVENT admin trail) |
| **Security** | authz/identity/security-relevant | Security/Identity | yes | yes | no | no | yes | (future — identity lifecycle) |
| **Compliance** | consent/erasure/regulatory | Compliance | yes | yes | no | no | yes | (future — consent/erasure) |
| **Knowledge** | a learnable/graph fact | Knowledge Graph | yes | yes | **yes** | no | knowledge-retained | KAI_INSIGHT_CREATED |
| **Notification** | a message should be delivered | Notifications | no (it's an intent) | **no** — replay must NOT re-send (durable effect ledger guards) | no | no | short-lived | NOTIFICATION_CREATED |
| **Analytics** | a funnel/metric datapoint | Analytics | no | yes | no | no | rollup | ARENA_POINTS_CHANGED, ACHIEVEMENT_UNLOCKED (as signals) |
| **Telemetry** | operational measurement | Infrastructure | no | yes | no | no | short-lived | (ProductEvent path — separate LIVE analytics stream) |
| **Infrastructure** | platform lifecycle | Infrastructure | no | yes | no | no | operational | SYSTEM_EVENT |

**Side-effect rule:** only **Notification** (and future effectful) categories perform outward effects; replay of those must not repeat the effect — the durable `claimEffect` ledger (ADR-0035) enforces at-most-once. All other categories are pure and replay-safe.

## 6. Retention as policy architecture (conceptual classes — no hardcoded durations)

Durations are **not** fixed here (no authoritative retention policy is ratified yet — that is a CCO/counsel decision). The conceptual classes:

- **Permanent audit** — never deleted; privacy handled by redaction, not deletion (§7). (Audit, Security, Compliance.)
- **Compliance-controlled** — retention set by statute/consent (FCRA/CROA windows). (Compliance.)
- **Knowledge-retained** — kept while it informs the graph. (Knowledge.)
- **Operational** — kept for the operational window (replay/catch-up horizon). (Domain, Integration, Infrastructure.)
- **Notification-short-lived** / **Telemetry-short-lived** — brief. (Notification, Telemetry.)
- **Analytics-rollup** — raw events roll up into aggregates, then age out. (Analytics.)
- **Privacy-redactable** — subject-erasable via the redaction tombstone regardless of class.

## 7. Immutable history vs privacy erasure

These are **distinct and both required**:
- **Immutability** — an event's envelope (id, ordering, type, timestamps, correlation) is never edited or deleted; this is what makes replay and audit trustworthy.
- **Privacy erasure** — a data-subject request clears the **payload** (`payload = {}`) and stamps `redactedAt`, keeping the envelope as a **tombstone**. Ordering and idempotency stay intact; replay of a redacted event yields an empty payload (a consuming projection treats it as "known-erased," not "never happened"). Wired today as admin-only `POST /api/event-bus/redact` (ADR-0035). Cascading redaction from account deletion is future work.

## 8. Governance

Subordinate to `GIOS-PLATFORM.md` (platform constitution) and `ADR-0035` (the substrate it evolves). This ADR owns **only** the evolution *policy*; the envelope shape lives in `ADR-0035`/`schema.prisma`, the taxonomy in `contracts.ts`. Amend only with founder approval + a superseding ADR; any envelope field promotion additionally requires migration-first + preview validation, and L3-touching changes require CCO (per GIOS-PLATFORM). No production change; the fabric stays dormant (`EVENT_BUS_ENABLED` off).
