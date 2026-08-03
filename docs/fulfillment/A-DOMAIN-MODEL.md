# A-DOMAIN-MODEL.md — Case + Dispute Package Domain

Agent A · Architecture only · Every new concept labeled **PROPOSED** · Every migration/dependency/founder call labeled **FOUNDER-GATE**. Source of truth for repository facts is the code, path-cited; where this document's reading of the brief's digest (`docs/fulfillment/PROGRAM-BRIEF.md` §2) differs from what the code actually shows, the discrepancy is called out inline and repeated in the closing conflicts list.

Cross-reference: `DisputePackage.stage` (fulfillment progress) is NOT redefined here — it is the canonical `FulfillmentStage` vocabulary owned by `A-STATE-MACHINE.md`. This document defines identity, ownership, and relationships only.

## 0. Existing truth this model is layered over (verbatim facts, path-cited)

| Concept | Where | Shape | Notes |
|---|---|---|---|
| `User` | `prisma/schema.prisma:55-108` | agency via `isAgency`/`managedByAgencyId` self-relation `"AgencyClients"` (line 96, `onDelete: Cascade`) | a managed client is a full `User` row; no separate Client model |
| `Report` | `prisma/schema.prisma:195-206` | `userId` FK `onDelete: Cascade`; `tradelines Tradeline[]` | one upload |
| `Tradeline` | `prisma/schema.prisma:208-242` | `userId`, `reportId` FKs (both Cascade); `resolved Boolean`; `duplicateGroup String?` | the account being disputed |
| `Letter` | `prisma/schema.prisma:244-271` | `tradelineId String?` FK `onDelete: SetNull` (line 248); `strategy`, `recipientType`, `round Int @default(1)` (line 255), `parentLetterId String?` **plain string, no FK** (line 267); `status LetterStatus` | **no Dispute/DisputeItem/Case/Round/Client model exists** |
| `LetterStatus` | `prisma/schema.prisma:46-53` | `DRAFT\|GENERATED\|PRINTED\|MAILED\|RESPONSE_RECEIVED\|RESOLVED` | `DRAFT`/`PRINTED` are enum-valid and PATCH-accepted (`app/api/letters/[id]/route.ts:24-30`) but no server route ever writes them and the only client call sets `"MAILED"` literally (`app/letters/page.tsx:381`) — dormant values today |
| `MailManifest` | `lib/mail/MailManifest.ts`, `lib/mail/MailStore.ts:70-112` | self-heal raw-SQL table, **not in `schema.prisma`**, id `mail_<letterId>` (`app/api/mail/prepare/route.ts:52`), identity write-once, `auditTrail` append-only (`assertAppendOnly`, `lib/mail/MailAudit.ts:54-65`) | one manifest per `Letter`, 1:1 by construction |
| `Campaign` | `lib/campaign/CampaignModel.ts`, `lib/campaign/CampaignStore.ts:73-90` | self-heal raw-SQL table, **not in `schema.prisma`**; state machine `DRAFT→RECOMMENDED/NEEDS_REVIEW→APPROVED→ACTIVE→WAITING/RESPONSE_RECEIVED→COMPLETED` + `CANCELED`/`SUPERSEDED` (`CampaignModel.ts:36-47`); `items: CampaignItem[]` spans **multiple tradelines**; `snapshot` frozen at approval (write-once, `CampaignStore.ts:53-54`); append-only `auditTrail` | **this is the closest existing prior art to "Case"** — see §2 |
| `EventEnvelope` | `prisma/schema.prisma:619-637` | migration-backed; `redactedAt` tombstone (line 629) | erasure precedent, §6 |
| `XpAward` | `prisma/schema.prisma:766-786` | migration-backed; `@@unique([subjectId, operatorId, awardKind])`; `onDelete: Restrict` | append-only ledger precedent used for FK-policy reasoning below |
| Self-heal allowlist | `scripts/schema-safety.test.ts:106-114` | 32 frozen legacy tables (incl. `MailManifest`, `Campaign`, `DecisionRegistry`) | **"no NEW table may self-heal"** (`scripts/schema-safety.test.ts:117-120`) — any new Case/DisputePackage table is categorically a migration, not a choice |

**Prior-art discovery (not in the brief's digest):** `lib/campaign/CampaignModel.ts` already implements most of what a "Case"-like container needs — a per-user sequence number, a documented rationale, a versioned size/safety policy (`lib/campaign/CampaignPolicy.ts`), a frozen approval snapshot, and an append-only audit trail. Every letter that gets queued today is already wrapped in a Campaign, real or an implicit single-item one auto-created by `CampaignService.attachLetterForQueue` (`lib/campaign/CampaignService.ts:168-187`). §2 and §3 build on this rather than inventing a parallel container.

## 1. Case — PROPOSED

### 1.1 Definition

`Case` is the durable identity for **one dispute target's whole history**: every round, package, campaign, and outcome for a given `(User, Tradeline)` pair (or a whole-file identity dispute with no tradeline — see §1.3). It is the thing that answers "what has ever happened with this account's dispute" independent of any single mailing.

### 1.2 Relationship to User / managedByAgencyId / Report / Tradeline

- `Case.userId` → `User.id`. The data-owning user — identical semantics to `Letter.userId`/`Tradeline.userId` (a managed client's own `User` row, never the agency's).
- `Case.agencyId` (nullable, denormalized) — stamped server-side from `user.managedByAgencyId` at creation, **never client input**. This mirrors the established row-level tenant-isolation backstop pattern: `NetworkMessage.audienceAgencyId` (`prisma/schema.prisma:584`, "row-level tenant backstop") and `EventEnvelope.agencyId` (field declared `prisma/schema.prisma:624`; "agency isolation axis (id, never name)" per the construction rule in `lib/eventBus/envelope.ts:76`). Without this, an agency-scoped Case list would have to join through `User.managedByAgencyId` on every read instead of an indexed column.
- `Case.tradelineId` (nullable) → `Tradeline.id`, `onDelete: SetNull` — mirrors `Letter.tradelineId` exactly (`prisma/schema.prisma:248`). Nullable for the same reason `Letter.tradelineId` is nullable: identity-only disputes exist with no tradeline (`app/api/identity/letter/route.ts`).
- `Case` has no direct `Report` relation. `Report` → `Tradeline` → `Case` is transitive; a Case does not need its own pointer to the report that originated the tradeline (the tradeline already carries `reportId`, `prisma/schema.prisma:213`). Duplicating it would violate the ownership table's own "single owner per fact" discipline (§5).

### 1.3 Scoping decision: per-(User, Tradeline), not per-User

**PROPOSED, argued:** A Case is scoped to one `(userId, tradelineId)` pair (or `(userId, null)` for identity-only disputes keyed by a synthetic anchor — see the `letter:<id>` fallback key already used by `CampaignService.attachLetterForQueue`, `lib/campaign/CampaignService.ts:175`, for exactly this situation). Rejected alternative: one Case per User (the whole client relationship). Reason for rejection — the existing waiting-period clock (`REINVESTIGATION_DAYS`, consumed in `lib/mailCenter.ts:131-146` and `lib/forecast.ts`) runs **per letter/per tradeline**, not per user; a user-wide Case would force an artificial single "state" across tradelines that are in genuinely different rounds and different clocks, which is exactly the kind of fabricated-coherence the Room Constitution's §9 forbidden-patterns list (brief §2.6) warns against for UI, and it is equally wrong as a data model. Multiple tradelines being disputed together in one mailing wave is already modeled correctly one level up, by `Campaign` (§0 table) — Case does not need to re-solve that problem.

### 1.4 New Prisma model vs. derived projection — argued and picked

Two live options, argued against the ratified migration-first law (`CLAUDE.md` "Critical gotchas" §1; `scripts/schema-safety.test.ts:117-120`):

| Option | What it costs | What it buys |
|---|---|---|
| **(a) Derived projection** — no table, computed live from `Tradeline` + `Letter` + `Campaign` + `MailManifest`, exactly like `lib/mailCenter.ts`'s `buildMailCenter()` | zero migration risk | no stable `caseId` to hang a `DisputePackage` FK off; no place to record a case-level action (e.g., an operator explicitly closing/archiving a case) that isn't simply reconstructible from child rows; no surviving shell after erasure (§6) |
| **(b) New migration-backed Prisma model** — thin: identity + lifecycle only, no duplicated tradeline/letter data | **FOUNDER-GATE**: a new migration | stable anchor for `DisputePackage.caseId`; supports an explicit lifecycle action; survives as a tombstone after erasure; indexable case list without reconstructing every row on every page view |

**Picked: (b), a new migration-backed model, kept thin.** The migration-first law does not forbid new schema — it forbids new schema arriving as *self-heal* (`scripts/schema-safety.test.ts:117`: "new tables need a migration"). Since Founder decision §1.2 makes **Dispute Package** — not Letter — the primary object, and a package needs a stable parent to be listed/grouped under, a derived-only Case would just push the same migration decision one level down onto `DisputePackage` while adding an extra layer of runtime recomputation for no savings. The model stays thin — no `title`, no duplicated `creditorName`, no cached counts — everything renderable is still derived from child rows (`Tradeline`, `DisputePackage`, `Letter`), exactly the same discipline `OperatorIdentity` uses toward `User` (`prisma/schema.prisma:102-105`: "Additive back-relations only... the auth User stays the source of truth").

### 1.5 Case lifecycle (data-model states, NOT the fulfillment `FulfillmentStage` — see A-STATE-MACHINE.md)

| State | Meaning | Derivation |
|---|---|---|
| `OPEN` | at least one package is active or a next round is available | default |
| `WAITING` | current package(s) fully sent, none yet past their window and no response logged | rollup of constituent package/manifest stages |
| `NEEDS_ATTENTION` | past-window with no response, OR a `FAILED`/`RETURNED` manifest needs a decision | mirrors `mailHealth()`'s `NEEDS_ATTENTION` rule today (`lib/mailCenter.ts:118-127`), promoted from a display-only computation to a stored fact so it can be queried/listed without recomputing every row |
| `CLOSED` | the dispute is resolved (mirrors `Letter.status = RESOLVED` + `Tradeline.resolved = true`, `app/api/letters/[id]/route.ts:89-93`) | operator action or automatic on tradeline resolution |
| `ARCHIVED` | closed and past retention review | operator or scheduled |

`Case.state` is a **cached rollup**, not a second source of truth — same "derived, never stored as truth elsewhere" discipline the wallet's balance-by-fold uses (brief §2.4, `XpAward`/reconciliation precedent) and `Campaign.status` uses today for its own items. Recomputed on every package/manifest transition; never hand-edited except the explicit `CLOSED`/`ARCHIVED` operator actions.

### 1.6 Additive migration sketch — FOUNDER-GATE

```prisma
// PROPOSED — additive only, 0 DROP. FOUNDER-GATE: new migration.
enum CaseState {
  OPEN
  WAITING
  NEEDS_ATTENTION
  CLOSED
  ARCHIVED
}

model Case {
  id            String    @id @default(cuid())
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId        String
  // Denormalized tenant-isolation backstop, server-stamped only.
  // Mirrors NetworkMessage.audienceAgencyId (prisma/schema.prisma:584) and
  // EventEnvelope.agencyId (prisma/schema.prisma:624).
  agencyId      String?
  // Nullable: mirrors Letter.tradelineId (prisma/schema.prisma:248-249) — a Case
  // can be whole-file (identity-only dispute) exactly as some Letters already are.
  tradeline     Tradeline? @relation(fields: [tradelineId], references: [id], onDelete: SetNull)
  tradelineId   String?
  state         CaseState  @default(OPEN)
  openedAt      DateTime   @default(now())
  closedAt      DateTime?
  // Erasure tombstone — mirrors EventEnvelope.redactedAt (prisma/schema.prisma:629).
  redactedAt    DateTime?

  packages      DisputePackage[]

  @@index([userId, state])
  @@index([tradelineId])
  @@index([agencyId])
}
```

No existing table's columns change. `User`/`Tradeline` gain only an additive back-relation (`cases Case[]`), same pattern as `OperatorIdentity`'s addition to `User` (`prisma/schema.prisma:106`).

## 2. Dispute Package — PROPOSED (the primary object, Founder decision §1.2)

### 2.1 Definition

The **Dispute Package** is what the operator reviews, approves, downloads, or sends — N letters (usually N bureaus for one round, or N tradelines for one coordinated wave) + enclosures + evidence + a Kai summary reference + the approval record + the link to fulfillment. It is the unit Founder decision §1.4 gives two buttons to: **Download Package** or **Send with CreditVector Fulfillment**.

### 2.2 Relationship to the existing Letter rows and the `mail_<letterId>` manifest identity

**The reconciling rule: a package does not replace the one-manifest-per-letter model — it aggregates over it.** Today one `MailManifest` = one `Letter` = one recipient = one physical piece (`mailId = mail_<letterId>`, `app/api/mail/prepare/route.ts:52`); that 1:1 relationship is correct and stays **exactly as-is**, because a package's N letters routinely target N *different* recipients (three bureaus + a furnisher have four different mailing addresses — they can never be combined into one physical piece). A `DisputePackage` therefore owns a **join to N `(Letter, MailManifest)` pairs**, never a single manifest of its own:

```
DisputePackage (1) ── (N) DisputePackageLetter ── (1) Letter
                                                 └─ (1) MailManifest   [via mailId, unchanged 1:1]
```

Package-level fulfillment progress (`DisputePackage.stage`, a `FulfillmentStage` value — A-STATE-MACHINE.md) is a **rollup**: the package is at the *least-progressed* stage among its constituent manifests, so the operator is never told "Delivered" while one of three bureau letters is still `IN_TRANSIT`. This is the same rollup discipline `Campaign.status` already uses across its multi-tradeline `items` (`lib/campaign/CampaignModel.ts:130-148`).

### 2.3 Relationship to the existing Campaign

**Reconciling rule:** `DisputePackage` does not duplicate `Campaign`'s composition/approval machinery — it is the **fulfillment-facing identity materialized when a Campaign is approved.** `CampaignService.approve()` already freezes an immutable snapshot at approval (`lib/campaign/CampaignService.ts:104-145`, "the mail gate matches queued letters against THIS"); a `DisputePackage` row is created at that same moment, holding `campaignId` + the fulfillment-specific facts a Campaign has no reason to know about (Kai summary ref, approval record shape the Founder specified in §1.9, the manifest join). This is "evolve, never redesign" applied to the domain model, not just the UI (brief §3, Agent B's mandate, extended here to data): reuse `Campaign`'s state machine, size policy (`CampaignPolicy.ts`), and audit trail wholesale; add only what Campaign genuinely lacks.

**⚠️ Conflict discovered — flagged, not resolved:** `Campaign` is a **self-heal raw-SQL table, not a Prisma model** (`lib/campaign/CampaignStore.ts:77-90`; confirmed on the frozen self-heal allowlist, `scripts/schema-safety.test.ts:108`). `DisputePackage` is being proposed here as a **migration-backed** Prisma model (§2.6) because it needs a real FK the join table (`DisputePackageLetter.letterId`) and `Case` can point at. **Prisma cannot declare a `@relation` FK from a migration-backed model to a table that has no Prisma model.** `DisputePackage.campaignId` is therefore modeled below as a **plain, unenforced `String`** — no referential integrity, no cascade behavior, nothing stopping it from pointing at a Campaign row that no longer exists. Two ways out, both **FOUNDER-GATE**, neither decided here: (i) promote `Campaign` to a migration-backed Prisma model in the same change (a bigger, riskier migration touching a table every mail-queue request already reads/writes), or (ii) accept the unenforced string reference and rely on application-level checks (the pattern `CommunityReport.targetId` already uses on purpose, `prisma/schema.prisma:314-316`, "no FK to the target... so the report row survives"). **Report this to Agent E; do not let either document silently pick one.**

### 2.4 Enclosures, evidence, Kai summary refs, approval record

| Sub-fact | Model | Reasoning |
|---|---|---|
| Enclosures (identity docs already embedded in a letter) | unchanged — `Document.includeInLetters` (`prisma/schema.prisma:164`) already governs this at generation time (`lib/letter.ts` composition happens before mailing) | no new modeling needed; a package references the letters, and the letters already carry their enclosure decision |
| Evidence artifacts (tracking events, return-receipt scans) | **reuse `Attachment`** (`prisma/schema.prisma:374-388`), already polymorphic (`scope`/`refId`, AES-256-GCM at rest) — add `scope = "dispute_package_evidence"` as an additive string value, no schema change | matches the brief's ask in A-PROVIDER-ABSTRACTION.md; the storage-or-pointer-only question is FOUNDER-GATE and detailed there, not duplicated here |
| Kai summary ref | `DisputePackage.kaiSummaryRef String?` — an **opaque reference**, never the summary text | see §2.5 — this field is FOUNDER-GATE by an existing, unrelated law before it is FOUNDER-GATE by a new one |
| Approval record | `approvedAt DateTime?`, `approvedBy String?` (the `userId` who approved) | mirrors `MailService.approve()`'s law verbatim: "A user — never Kai, never the system — approves" (`lib/mail/MailService.ts:125-132`) |

### 2.5 ⚠️ Kai summary persistence is gated by an existing law, not a new one

The Package Review chain (Founder decision §1.9: "Client → **Kai Summary** → Recommended Disputes → Educational Explanation → ...") implies a Kai-authored summary attached to the package. Persisting Kai AI output server-side is already governed by **ADR-0006's founder gate**, applied consistently across the codebase beyond the literal ADR-0006 document text:

- `app/strategist/AiPlan.tsx:8-14` — the 90-day plan is localStorage-only: "persisting a Kai AI output server-side is gated on founder approval (ADR-0006, the blocked `KaiAnswer` store)."
- `lib/intelligence/caseMemory.ts:7,47` — `KAI_CASE_MEMORY` flag, default OFF, "honors ADR-0006: the founder gate on a server-side" memory store.
- `lib/platform/modules.ts:30` — the "Persistent Memory (Kai Pro)" module is listed `status: "dormant"`, `gate: "ADR-0006 founder gate"`.

**PROPOSED, safe default:** `kaiSummaryRef` stays null / the summary is **regenerated on read** (the same discipline as `pickRecommendation`'s `basis` and `KaiWhy`'s structured-evidence explainability, brief §2.5 — never fabricated, never stored prose) until the Founder extends the ADR-0006 gate to cover package-level summaries specifically. Treat "persist the Kai Summary text server-side" as its own FOUNDER-GATE line item, separate from the schema migration itself — the column can ship inert (always null) without tripping ADR-0006, but *writing* to it requires the gate.

### 2.6 Additive migration sketch — FOUNDER-GATE

```prisma
// PROPOSED — additive only, 0 DROP. FOUNDER-GATE: new migration.
// PackageState values below are the DisputePackage's own approval/composition
// lifecycle (mirrors CampaignStatus, lib/campaign/CampaignModel.ts:18-28) — NOT
// the fulfillment FulfillmentStage vocabulary (A-STATE-MACHINE.md), which is a
// separate, rolled-up field.
enum PackageState {
  DRAFT
  RECOMMENDED
  IN_REVIEW
  APPROVED
  CANCELED
}

model DisputePackage {
  id           String        @id @default(cuid())
  case         Case          @relation(fields: [caseId], references: [id], onDelete: Restrict)
  caseId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       String
  // See §2.3 conflict — NOT a Prisma-enforced FK today. FOUNDER-GATE.
  campaignId   String?
  round        Int           @default(1)
  state        PackageState  @default(DRAFT)
  // FulfillmentStage rollup cache (A-STATE-MACHINE.md) — derived, recomputed on
  // every constituent manifest transition, never hand-written.
  stage        String?
  kaiSummaryRef String?      // opaque ref only — see §2.5, stays null until ADR-0006 gate clears
  approvedAt   DateTime?
  approvedBy   String?       // userId — Kai never approves (mirrors MailService.approve law)
  createdAt    DateTime      @default(now())
  redactedAt   DateTime?

  letters      DisputePackageLetter[]

  @@index([caseId])
  @@index([userId, state])
  @@unique([campaignId])
}

// Join: N letters (N recipients) per package. onDelete:Restrict on `letter`
// mirrors XpAward's reasoning (prisma/schema.prisma:768-772, "a cascade... would
// let a plain user-delete silently destroy XP history") — a packaged letter is
// evidence, not scratch data.
//
// ⚠️ Compatibility note: DELETE /api/letters/[id] (app/api/letters/[id]/route.ts:45-53)
// currently deletes ANY letter unconditionally. Once a Letter is joined into a
// DisputePackage via Restrict, that route starts throwing for packaged letters —
// a real behavior change that must be handled explicitly (either the route learns
// to check package membership and refuse with a clear message, or the FK uses
// SetNull + a package-side "letter removed" audit entry instead). Not resolved here.
model DisputePackageLetter {
  id        String         @id @default(cuid())
  package   DisputePackage @relation(fields: [packageId], references: [id], onDelete: Cascade)
  packageId String
  letter    Letter         @relation(fields: [letterId], references: [id], onDelete: Restrict)
  letterId  String
  // Formalizes the existing convention (app/api/mail/prepare/route.ts:52,
  // `mail_${letter.id}`) as a stored, joinable fact instead of a string template
  // recomputed at every read site.
  mailId    String

  @@unique([letterId])
  @@unique([mailId])
  @@index([packageId])
}
```

`Letter` and `User` gain only additive back-relations (`packages DisputePackageLetter[]` / `disputePackages DisputePackage[]`).

## 3. Round / waiting-period modeling

### 3.1 Existing truth

`Letter.round Int @default(1)` + `Letter.parentLetterId String?` (**plain string, no FK** — `prisma/schema.prisma:255,267`). A round-2 letter links back via `/api/letters/[id]/round2` (`app/api/letters/[id]/round2/route.ts:120-121`, `round: parent.round + 1, parentLetterId: parent.id`), gated on a logged response and refused when `responseOutcome === "deleted"` (lines 38-43).

### 3.2 Decision: keep `round`/`parentLetterId` on `Letter` exactly as-is; do not add a `Round` table

**Argued:** A `Round` model would either (a) duplicate `round`/`parentLetterId`'s information with no new fact attached, or (b) become a second place a round's identity lives, violating the single-owner discipline this document imposes on everything else (§5). The one real gap — `parentLetterId` has no FK, so a bad id silently orphans — is a **data-integrity nit, not a missing concept**; promoting it to a real FK (`onDelete: SetNull`, since a deleted parent letter shouldn't take its child down) is a small, additive, non-structural migration if the Founder wants it, but it does not require a new `Round` model. "Round" as a concept is **derived**: `DisputePackage.round` (§2.6) is the package-level round number (usually equal to every contained letter's `round`, since a package is composed within one round); a `Case`'s round history is simply `DisputePackage[] ordered by round`.

### 3.3 Waiting period: a computed clock, not a stored state

**Decision: waiting period stays a computed fact, never a persisted "we are waiting" row.** Precedent: `lib/mailCenter.ts:131-146` (`windowText`) and `lib/forecast.ts`'s `REINVESTIGATION_DAYS` already compute "past window" live from `mailedAt` + today's date — exactly the same "quiet is allowed / nothing predicted" discipline `pickRecommendation` uses (brief §2.5). Storing a `WAITING_SINCE` timestamp that could drift from the real clock would create a second, potentially-stale source of truth. `DisputePackage.stage = WAITING_PERIOD` (a `FulfillmentStage`, A-STATE-MACHINE.md) is therefore a **derived rollup state**, computed from `min(manifest.deliveredAt or returnReceiptArchivedAt)` across the package's manifests plus the existing recipient-correct statutory window logic (§611 bureau / §623 furnisher / FDCPA §1692g collector, already recipient-typed in `lib/mailCenter.ts:97-101,129-146`) — never a value written once and left to rot.

## 4. Ownership table — which subsystem owns which fact

| Fact | Owner | Path |
|---|---|---|
| Tradeline scoring, presence, dispute angles | Tradeline/scoring engine | `prisma/schema.prisma:208-242`, `lib/bureauData.ts` |
| Letter text, strategy, compliance flags | `lib/letter.ts` + `lib/compliance.ts` | letter generation pipeline |
| Case identity + lifecycle state | **NEW — Case (this doc)** | §1 |
| Package composition, approval snapshot, size policy | **existing `Campaign`**, referenced by `DisputePackage` | `lib/campaign/*` |
| Package fulfillment identity, evidence join, Kai summary ref | **NEW — DisputePackage (this doc)** | §2 |
| Per-recipient mail lifecycle, provider job, tracking, audit trail | existing `MailManifest`/`MailService` | `lib/mail/*` |
| Certified/provider/wallet/retry/duplicate-prevention decisions | **NEW — Fulfillment Policy Engine** | `A-POLICY-ENGINE.md` |
| Wallet authorization/consumption/ledger | **NEW — Wallet** (Agent C) | out of scope here; only the touchpoint is named |
| Recommendation basis, narration, education | Kai (`pickRecommendation`, `KaiWhy`, `recordKaiEvent`) | brief §2.5 |
| Cross-cutting timeline of record | `KaiEvent` (ADR-0007) | `lib/kaiEvents.ts` |
| Recommendation audit (why did Kai say this) | `DecisionRegistry` | `lib/decisionRegistry.ts` |
| Verified response outcome | `VerifiedOutcome` (upsert-in-place, **not** append-only — `lib/outcomeLedger.ts:177-183` uses `ON CONFLICT ... DO UPDATE`) | `lib/outcomeLedger.ts` |
| Cross-subsystem coordination facts | Platform Event Bus (`EventEnvelope`) | `lib/eventBus/*` |

**Note on `VerifiedOutcome`:** it is *not* append-only despite living beside append-only precedents — each response overwrites the prior row for that `letterId` (`ON CONFLICT ("letterId") DO UPDATE`, `lib/outcomeLedger.ts:180-183`). This document does not change that; flagged here only so Agent E does not mistake it for the tombstone precedent used in §6 below (that precedent is `EventEnvelope`, not `VerifiedOutcome`).

## 5. Single-owner discipline

No fact above is duplicated. Where a new model (`Case`, `DisputePackage`) could have cached a fact another table owns (creditor name, tradeline score, letter body), it deliberately does not — every renderable field is either owned locally (identity, lifecycle state, timestamps) or joined live. This mirrors `OperatorIdentity`'s explicit "no duplicating the auth User" discipline (`prisma/schema.prisma:640-641`).

## 6. Erasure / retention — the tombstone precedent

**Precedent:** `EventEnvelope.redactedAt` (`prisma/schema.prisma:629`) + `redactEvent()` (`lib/eventBus/store.ts:150-158`): on data-subject erasure, the **payload is cleared, the envelope row is kept** — "so the immutable log's ordering/idempotency stay intact." This is the correct precedent for `Case`/`DisputePackage` (not `VerifiedOutcome`'s upsert-in-place, and not a hard delete):

- `Case.redactedAt` / `DisputePackage.redactedAt` (both sketched above): on erasure, value-bearing fields (nothing on these thin models actually carries PII beyond ids — by design, per §5) are nulled and the shell + timestamps stay, so `MailManifest.auditTrail` and `EventEnvelope` rows that reference the package's `mailId`/dedupe keys keep resolving without a dangling reference.
- Evidence `Attachment` rows (§2.4) follow `Document`'s existing encrypted-at-rest pattern; an erasure request deletes the ciphertext row (not a tombstone — `Attachment` has no `redactedAt` today) exactly as any other `Document` deletion does. This document does not propose adding a tombstone to `Attachment` — that is a platform-wide change outside this assignment's scope; flagged for Agent E if erasure-consistency across `Attachment` matters to the merged design.
- **FOUNDER-GATE:** erasure of a `Case`/`DisputePackage` that still has a live `MailManifest` mid-transit (a physical letter already in the postal system) raises a real question — the manifest's own append-only audit trail (evidence of what was mailed and when) arguably must survive independent of the consumer's erasure request, the same tension `ADR-0028 §1.5` names for `docCrypto` ("single-key today, the hierarchy is net-new... crypto-shredding"). Not resolved here; report only.

## 7. Conflicts and open questions discovered (report only — Agent E resolves)

1. **`certified: false` is hardcoded today, contradicting Founder decision §1.3.** `app/api/mail/prepare/route.ts:46` builds every `MailPieceSpec` with `certified: false`. Founder decision §1.3 requires "Dispute Packages always use Certified Mail, Tracking, Electronic Return Receipt, Delivery Evidence, Immutable Timeline" with no exception named. This is a product-code fact, not an architecture gap — the Policy Engine (`A-POLICY-ENGINE.md`) is where this must be forced to `true`, but the current code is a live contradiction of a binding Founder decision and should be surfaced, not silently "fixed" by this architecture-only assignment.
2. **`Campaign` is self-heal, not a Prisma model** (§2.3) — `DisputePackage.campaignId` cannot be a real FK without also migrating `Campaign`, which is out of this assignment's scope and not decided here.
3. **Kai Summary persistence is gated by the *existing* ADR-0006 law** (§2.5), not a new one this program invents — Agent D's Kai-experience document should not treat package-summary persistence as its own novel decision; it inherits ADR-0006's default-OFF posture.
4. **Introducing a `Restrict` FK from `DisputePackageLetter` to `Letter` changes today's delete semantics** for `DELETE /api/letters/[id]` (§2.6 compatibility note) — a real behavior change hiding inside what looks like a purely additive migration.
5. **The brief's digest (§2.1) says the operator flow "stops at `IN_REVIEW → APPROVED → PAID → QUEUED`."** Verified accurate against `lib/mail/MailService.ts` and the confirm route (`app/api/mail/[mailId]/confirm/route.ts`) — `dispatch()` has zero callers, confirmed by `grep` across `app/`, `lib/`, `worker/`. No discrepancy here; noted only because it is load-bearing for §2.2's reconciliation and worth Agent E re-verifying if product code changes before merge.
