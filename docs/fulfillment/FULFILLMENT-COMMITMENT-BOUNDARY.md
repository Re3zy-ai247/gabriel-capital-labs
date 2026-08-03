# FULFILLMENT-COMMITMENT-BOUNDARY.md — The Two-Layer Commitment Boundary + State Machine Delta

Agent W2 · Architecture only · Continuation of the accepted package (`e223e51`) refined per `COMMITMENT-REFINEMENT-BRIEF.md` (`f8cfb92`) · **DELTA document — does not restate `A-STATE-MACHINE.md`; every section below is either a supersession (`SUPERSEDES: <doc §>`) or a pure addition.** Labels **PROPOSED** / **FOUNDER-GATE** / **VENDOR-CONFIRMATION-REQUIRED** used rigorously and only where earned. **Refinement-2 pass (this revision): implements `REFINEMENT-2-DIRECTIVE.md` Ruling 1 (§4.2, §5, §7), Ruling 2 (§4.3), Ruling 3 (§1.4, §4.4, §5, §6, §7), and `COMMITMENT-REGATE.md` must-fixes B8/N5 (§4.1) — each change cites its source inline.**

> **CROA posture (unchanged, explicit — Brief S7, verbatim).** Settlement-at-acceptance strengthens the §1679b(b) posture versus capture-at-top-up but does NOT moot the counsel question — funds are still received in advance at top-up. The counsel question (`ADVERSARIAL-REVIEW.md` §3.4) remains the hard precondition before any wallet implementation phase. Every refinement doc carries this note verbatim in its header. F1 (Gate D Phase −1) also stands.

---

## 0. Scope and method

This document is the S5 deliverable: the two-layer commitment boundary, the vendor question list, and the DELTA over `A-STATE-MACHINE.md` needed to make the machine actually implementable (gates F9-i/F9-ii/F9-iii, F10, and the S1/S2 wallet-grain change). It assumes the reader has `A-STATE-MACHINE.md` open — every table below is a delta against a named section of that document, not a re-derivation. Where this document's ruling changes a mechanism `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` (the Agent-E merge) already resolved on paper (docket #5, the `UNKNOWN_PROVIDER_STATUS` in-machine quarantine), that supersession is stated explicitly, because gate F9-i proved the merged mechanism structurally impossible against the shipped `FORWARD` table — not a stylistic preference.

Source facts are re-verified directly against `lib/mail/*`, not re-derived from prior artifacts. Where a prior artifact's own line citation was off by one against the current worktree, this document notes the corrected line rather than silently repeating the error.

---

## 1. The two-layer commitment boundary (S5)

### 1.1 Layer (a) — FINANCIAL boundary (CreditVector law, ours to set)

**Permanent settlement occurs ONLY at provider acceptance — never earlier.** This is Founder ruling #2 (Brief, binding): `balance exists → Approve → Authorization Hold (not deduction) → CreditVector validation → Submit → Vendor accepts → Permanent Settlement → production → mail`. In `FulfillmentStage` terms (`A-STATE-MACHINE.md` §4): the hold is placed at `WALLET_AUTHORIZED`; it becomes permanent exactly at `ACCEPTED` (manifest `PROVIDER_ACCEPTED`, `lib/mail/MailStatus.ts:16` — "provider accepted the job (has a provider job id)"), the first externally-verifiable commitment, per §3 below. This boundary is entirely **within CreditVector's own control**: it is a rule this document/the Wallet enforce, not a fact about the vendor. It does not depend on any vendor confirmation and is not weakened by the absence of one.

### 1.2 Layer (b) — OPERATIONAL irreversibility (vendor fact, NOT ours to set)

**VENDOR CONFIRMATION REQUIRED.** LetterStream's actual cancellation window — the exact point at which a submitted job can no longer be stopped — is a fact about LetterStream's own systems, not about CreditVector's. **Verified: the repository contains no such fact.**

- `lib/mail/MailProvider.ts:109` declares `cancelMailJob(providerJobId): Promise<{ canceled: boolean; detail?: string }>` — a **result-typed**, honest contract (it reports what happened, never asserts a window in advance).
- `lib/mail/providers/LetterStreamProvider.ts:121-124` is the **only** implementation, and it is dry-run only: `if (isLive()) throw new MailProviderError("not_wired", ...)`; the dry-run branch unconditionally returns `{ canceled: true, detail: "dry-run cancel ..." }`. This is a **synthetic success for testing the pipeline shape** — it is not evidence of what LetterStream will actually do, and must never be read as such.
- `MailService.cancel()` (`lib/mail/MailService.ts:222-239`) already codes for a real refusal (`catch`-ing `MailProviderError` with `code === "rejected"` and translating it to `"provider refused cancellation (already in the mail stream)"`) — i.e., the **shape** of a vendor refusal is anticipated, but no live call has ever been made, so no actual refusal boundary has ever been observed.
- Grepped: no comment, ADR, or doc in this repository states LetterStream's real print-queue timing, payment-capture timing, or cancellation cutoff. `A-PROVIDER-ABSTRACTION.md` §3.4 marks `cancelMailJob` "no gap" only in the narrow sense that the **call sequencing** (state-machine check before provider call) is correct — it does not, and cannot, speak to the vendor's actual behavior once live.

**Ruling:** until LetterStream (and, independently, any future adapter) confirms its real cancellation semantics, this architecture assumes the **worst case**: a submitted job is irreversible at provider acceptance. This assumption governs two things, precisely:

1. **UX warnings** (W3's FINAL REVIEW copy) state the worst case as fact-until-corrected — never a soft "you may be able to cancel."
2. **Cancellation modeling** (§4.4 below) treats every post-acceptance cancel as `CANCEL_REQUESTED` — a best-effort, outcome-dependent request, never a guaranteed action — regardless of what a future vendor answer turns out to be. If LetterStream later confirms a real, longer cancellable window, this architecture loosens; it never assumes generosity in advance.

### 1.3 Why the two layers cannot be merged

Layer (a) is a promise CreditVector makes to itself and its wallet ledger (a compliance- and accounting-grade boundary). Layer (b) is a physical/contractual fact about a third party CreditVector does not control and has not yet asked. Conflating them was the root of the original package's confidence: `C-WALLET-INTEGRATION.md` §3.3 and `A-STATE-MACHINE.md` §5.1 disagreed about *when settlement happens* (docket #9) precisely because "settlement" was being asked to do financial-boundary work and operational-irreversibility work at once. This document keeps them as two independently-answerable questions with two independently-sourced answers — one settled now (§1.1), one open pending vendor confirmation (§1.2, §2).

### 1.4 Commitment Constitution Art. 1 — irreversibility is symmetric (Ruling 3)

`COMMITMENT-RESOLUTION.md` §2's Fulfillment Commitment Constitution, point 1 (quoted verbatim, not restated as new text): **"No irreversible financial settlement occurs before provider acceptance. Authorization is a hold; settlement converts a hold; nothing else converts anything."**

**Corollary, made explicit here per `REFINEMENT-2-DIRECTIVE.md` Ruling 3 (the Article already implied this; the re-gate found the implication had not been carried into this document's own mechanisms):** Art. 1 names exactly two conversions in this model — (i) authorization creates a hold, (ii) acceptance converts that hold to settlement — and states "nothing else converts anything." A settled hold therefore has no third, legal conversion. `PROVIDER_ACCEPTED → CANCELED` would be exactly such a third conversion (settlement → not-settled), and is FORBIDDEN by Art. 1's own terms, not by a new rule invented for this cycle. §4.4 below applies this explicitly, because the prior draft of §4.4 (and `RECOVERY-ENGINE.md` §4 scenario 9) modeled a `confirmed_cancelled` branch that DID drive the manifest to `CANCELED` post-acceptance — the exact conversion Art. 1 forbids. That branch is withdrawn below.

**Once `PROVIDER_ACCEPTED`: the wallet hold is settled and stays settled forever.** Any later operator action, vendor confirmation, or data correction is an **accounting question** (a named `adjust` entry, `founder_gate_pending` until reviewed) — never a state, a release, or a clawback-as-unwind that would imply the mailing did not occur. This is the Founder's own framing, verbatim (`REFINEMENT-2-DIRECTIVE.md`, "Founder authoritative decision"): *"After provider acceptance: history is immutable, fulfillment is irreversible, financial reconciliation becomes an accounting problem, and the system never pretends the mailing did not occur."*

---

## 2. VENDOR CONFIRMATION REQUIRED — the question list

Ships as its own deliverable section per Brief S5. Every question is phrased so a vendor's answer is a **fact**, never a request for a favor.

### 2.1 LetterStream — precise questions

| # | Question | Why it's load-bearing here |
|---|---|---|
| 1 | At what exact processing point does a submitted job become impossible to stop — API acceptance (job id issued), payment/billing capture on LetterStream's side, entry into the print queue, start of physical printing, or USPS handoff? | Directly determines how much of §4.4's `CANCEL_REQUESTED` window is real vs. theoretical. |
| 2 | Does `cancelMailJob` have a real, live, documented endpoint? If a piece has already passed the cancellable window, what does it return — a typed refusal (status/error shape) or a silent no-op? | `LetterStreamProvider.ts:121-124`'s dry-run `canceled:true` is a stub, not a spec. Live behavior is unknown in both the success and refusal cases. |
| 3 | If LetterStream stops a piece after accepting it but before printing, do they charge CreditVector anything (partial fee), waive fully, or something else? | Determines whether a vendor-confirmed post-acceptance cancellation (§4.4 branch A) has a *provider-cost*-side consequence distinct from CreditVector's own wallet accounting — named, not assumed, in the 17-scenario matrix (`RECOVERY-ENGINE.md` scenario 9). |
| 4 | Is cancellation available as a real-time API call, or only via manual vendor support contact? | Determines realistic resolution latency for `CANCEL_REQUESTED` (seconds vs. hours/days) — a fact W3 needs before writing "pending" copy. |
| 5 | If an API exists: synchronous response, or async callback? What is typical/max latency? | Same. |
| 6 | Does LetterStream offer ANY push/webhook notification for status changes, or is polling (`retrieveStatus`/`retrieveTracking`) the only channel? | **Directly resolves gate F12's driver gap.** `A-PROVIDER-ABSTRACTION.md` §3.5 already flags "the LetterStream integration is entirely pull-model... nothing establishes LetterStream offers webhooks." Until answered, `RECOVERY-ENGINE.md` §3's reconciliation sweep is the platform's only guaranteed driver for stages 5–10 — not a fallback, the primary mechanism. |
| 7 | If webhooks exist: what is the redelivery/retry behavior, what signs the payload (HMAC/shared secret/IP allowlist), and is there a replay-tolerance/timestamp convention? | Sizes the dedup window `A-PROVIDER-ABSTRACTION.md` §5.2 proposes and the `MAIL_TRANSITION` claim domain (§4.3 below) actually needs. |
| 8 | Is LetterStream's FULL raw status vocabulary documented anywhere? Are there statuses beyond the 11 strings `LS_STATUS` currently guesses at (`LetterStreamProvider.ts:30-42`) — e.g. "held for review," "refused by recipient," "address corrected"? | Every unmapped raw string falls through `mapLetterStreamStatus`'s fail-open default (`?? "PROVIDER_ACCEPTED"`, line 45) today. §4.2 below fixes the *mechanism*; this question bounds how often it will actually fire in production. |
| 9 | Return-receipt artifact: exact format, delivery mechanism (pull via `retrieveProof` vs. pushed), and LetterStream's own retention window before the artifact expires? | Feeds directly into `A-PROVIDER-ABSTRACTION.md` §4's pointer-vs-download FOUNDER-GATE and this document's `RECEIPT_OVERDUE` `staleAfter` tuning (§4.5) — a short vendor retention window makes prompt download-and-store closer to mandatory. |
| 10 | If CreditVector retries `createMailJob` after an ambiguous timeout, carrying the same CreditVector-side idempotency key (`CreateJobInput.metadata`, `MailProvider.ts:52`), does LetterStream dedupe (return the original job) or create a second physical piece? | Governs whether `RECOVERY-ENGINE.md` scenario 4 (provider timeout) may ever safely auto-retry. Absent confirmation, the answer is assumed "creates a second piece" — the more expensive, more conservative assumption. |
| 11 | Does LetterStream offer any batch/grouping concept for jobs submitted together, or is every job strictly independent? | Confirms (or breaks) the assumption that CreditVector's per-letter/per-job model (§3 below) has no impedance mismatch with the vendor's own unit of work. |

### 2.2 Generalized — Lob, PostGrid, Click2Mail (and any future `MailProviderId`)

**The same eleven questions apply verbatim to each future adapter, independently.** A confirmed answer from LetterStream does not transfer. `A-PROVIDER-ABSTRACTION.md`'s own law — "nothing provider-specific escapes" the adapter's own file (`MailProvider.ts:4-5`) — cuts both ways: it also means no *vendor fact* learned inside one adapter's file may be assumed true of another. Per `A-PROVIDER-ABSTRACTION.md` §8's proposed conformance battery, add: **no `MailProviderId` may be selected via `MAIL_PROVIDER` for a live (non-dry-run) job until its own eleven-question answer set exists**, alongside the existing conformance checks. This is additive to that battery, not a new gate.

---

## 3. Per-letter settlement hooks (S1/S2 grain) — SUPERSEDES: `A-STATE-MACHINE.md` §5.1 (phrasing only, not its slot reservation)

`A-STATE-MACHINE.md` §5.1 reserved a slot ("not designed further here") for the wallet's authorize→consume→settle/void detail inside the `WALLET_AUTHORIZED`→`PAID` span. The Brief's S1/S2 now fill that slot **and** change its grain from package-level to per-letter, dissolving F5.

- **Hook point: `ACCEPTED` (manifest `PROVIDER_ACCEPTED`), per letter.** Each `DisputePackageLetter`'s own manifest independently fires its own settlement the moment *that letter's* provider job is accepted — never a package-wide gate. This is the same moment `C-WALLET-INTEGRATION.md` §3.3 argued for (first externally-verifiable commitment) and `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §3.3 ratified (docket #9) — unchanged by this delta. What changes is the **subject**: settlement fires against `subjectId = mail_<letterId>` (the letter's own stable fulfillment key, Brief S2), not the package.
- **Release on rejection, per letter.** A letter whose manifest reaches `REJECTED`/`PROVIDER_ERROR` before `ACCEPTED` releases *only that letter's* hold — the other N−1 letters in the same package are untouched, each independently proceeding to their own settlement or their own release.
- **Package-level rollup is unaffected and still correct.** `DisputePackage.stage` (`A-DOMAIN-MODEL.md` §2.2) stays the least-progressed-child rollup exactly as designed — that mechanism was never the bug; the bug was a wallet ledger that could only settle or release the *whole* package atomically underneath a rollup that was always going to disagree with reality the moment letters diverged. Per-letter settlement now gives the operator/Kai surface a **second, finer-grained view** alongside the rollup: "2 of 3 accepted and mailing; 1 needs a corrected address" is now a literally true statement backed by three independent ledger states, not an inference.
- **Package-level authorization stays atomic at submission time.** Brief S1: "a package-level authorization = the SET of per-letter holds created atomically inside one anchor-locked transaction (all-or-nothing hold creation; package `authorizationGroupId` ties them)." This document adds one clarifying rule for the retry case (§5 below): a **retry re-authorizes as a group of one** — a single corrected letter's fresh authorize is its own, trivially-atomic `authorizationGroupId`, not a re-opening of the original (already-resolved) package-wide group. The original group's already-settled/released members are not touched or re-litigated by a sibling's retry.

**F5 disposition: ELIMINATED.** The structural cause (one-settle/one-void-per-package under a package-grain unique key) no longer exists once settlement is per-letter with an `attempt`-scoped key (§4.3). Partial fulfillment now has a truthful, mechanically-derived settlement path with no invented "partial" entry kind — it is simply N independent per-letter entries.

---

## 4. State machine delta

### 4.1 `attention` flag replaces the in-machine quarantine — SUPERSEDES: the `UNKNOWN_PROVIDER_STATUS` in-machine mechanism proposed in `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §3.2/§3.4 (docket #5) — resolves gate F9-i

**Why the in-machine version is structurally impossible (re-verified, not re-argued from the review alone):**

- `FORWARD` (`lib/mail/MailStatus.ts:45-62`) is a fixed `Record<MailStatus, MailStatus[]>`. Adding `UNKNOWN_PROVIDER_STATUS` as a real value reachable from *any* pipeline stage (`SUBMITTED`/`ACCEPTED`/`PRINTING`/`MAILED`/`USPS_ACCEPTED`, per the merged diagram's five inbound edges) requires `FORWARD` to hold a distinct legal transition **from every one of those stages into the same target** — already an awkward multiplication, but not fatal by itself.
- The fatal problem is exit and position. `canTransition` (`MailStatus.ts:72-74`) and `nextStatuses` (`:64-70`) are pipeline-relative and forward-only by construction — there is no "return to wherever you actually were" primitive; a manifest that entered `UNKNOWN_PROVIDER_STATUS` from `PRINTING` and one that entered it from `MAILED` are indistinguishable once inside it, so the ops-resolves exit edge (`UNKNOWN_PROVIDER_STATUS --> ACCEPTED`, the merged diagram's own choice) is only correct for the first case — for the second it is a **backward** transition from the pipeline's point of view (`MAILED` sits ahead of `ACCEPTED` in `MAIL_PIPELINE`, `MailStatus.ts:28-32`), which `canTransition`'s entire design exists to forbid.
- `pipelineIndex()` (`MailStatus.ts:82-84`, cited by the exact same line numbers `A-STATE-MACHINE.md` §8 uses) does `MAIL_PIPELINE.indexOf(status)` — a status not in that fixed array returns `-1` by construction. `MailService.syncTracking()`'s forward-walk loop (`MailService.ts:206-218`) compares `pipelineIndex(m.status) < pipelineIndex(target)` — an unrecognized status occupying a single fixed array slot cannot honestly represent "unknown, seen while we were somewhere between `PRINTING` and `DELIVERED`," and a `-1` sentinel breaks the comparison outright (every real status's index is `> -1`, so the loop's guard condition behaves incorrectly the moment `m.status` or `target` is `-1`).

**Ruling: `attention` is an off-machine flag, never a value the manifest's `status` column takes.** The manifest's real `status` **always** reflects the last actually-known-legal pipeline position — never fabricated forward, never parked in a synthetic node. Concretely:

```
// PROPOSED — additive field, NOT part of the MailStatus union, NOT governed by
// FORWARD/canTransition/pipelineIndex. Lives beside `status` on MailManifest.
attention: {
  raised: true;
  reasonCode: "unknown_provider_status" | "provider_outage" | "provider_timeout_ambiguous"
            | "fulfillment_stalled" | "receipt_overdue" | "tracking_stalled" | "ledger_drift";
  raisedAt: string;          // ISO
  detail: string;            // internal-only — e.g. the raw unrecognized provider string
  resolvedAt: string | null;
  resolvedBy: string | null; // operator id, or "system" for an auto-clearing sweep result
  resolutionNote: string | null;
} | null
```

**Storage — re-planned per `COMMITMENT-REGATE.md` B8/N5 (the prior "additive column via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`" plan is WITHDRAWN, not merely revised):** that plan was PROHIBITED, not just risky. `MailManifest` is a self-heal raw-SQL table (`MailStore.ts:73`'s `CREATE TABLE IF NOT EXISTS`, with `MailStore.ts:100-105`'s follow-on `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` block for four already-legacy columns); `CLAUDE.md` gotcha #1 (owner-ratified 2026-07-20) states plainly: **"No new feature may introduce or depend on runtime-created schema."** `attention`/`cancelRequest` are new-feature schema by any reading. The four existing self-heal `ALTER TABLE` lines predate that ratification and are grandfathered; adding a fifth and sixth line for THIS cycle's new feature is exactly the dependency the policy forbids — regardless of whether `scripts/schema-safety.test.ts`'s current pattern-match (`CREATE TABLE IF NOT EXISTS "([A-Za-z]+)"`, table-level only) happens to be blind to column-level `ALTER TABLE` additions today. The guard not yet catching it is a gap in the guard, not a license to use it.

**Decision: a separate, additive, migration-governed table — `MailManifestFlags` — NOT new columns on `MailManifest`.** Two options were weighed (`REFINEMENT-2-DIRECTIVE.md` item 5):

1. *Rejected: bring `MailManifest` itself under `schema.prisma` management* (declare the model, migrate its existing columns into Prisma's control, add `attention`/`cancelRequest` alongside). This is the heavier lift and carries the same class of risk already named elsewhere in this program's history for adopting a live, self-healed, production-data-bearing table into migration control: `scripts/schema-safety.test.ts`'s `EXPECTED_SELF_HEAL_ONLY` pins `MailManifest` as self-heal-only today (`scripts/schema-safety.test.ts:130-146`) — un-pinning it requires both a guard update AND a baseline-resolution step (the table already exists with live rows in production; a naive `migrate deploy` would attempt to `CREATE TABLE` against a table that is already there) — structurally the same precondition class as this program's own Gate D (`prisma migrate resolve --applied` before `migrate deploy`). Bundling that retirement with two unrelated new columns, under this cycle's time pressure, is not the disciplined way to retire a legacy self-heal table — gotcha #1 itself says legacy tables should "SHRINK over time... through reviewed migrations," implying a dedicated plan, not an opportunistic rider.
2. **Picked: a brand-new table, declared in `schema.prisma` from birth, shipped via a normal additive migration.** `mailId String @id` — equal to `MailManifest.mailId` (`mail_<letterId>` / `mail_<letterId>_a<n>`, §4.2) — but **no `@relation`/DB foreign key**, because `MailManifest` is not (and remains not, under this decision) a Prisma model; this is an application-level reference only, mirroring the already-accepted `AdminAuditLog.actorId` no-FK precedent (`COMMITMENT-REGATE.md` N6). `attention Json?` and `cancelRequest Json?` carry the §4.1/§4.4 nested-object shapes verbatim, unchanged — only the storage location moves, not the design. This is the smaller, more reversible, zero-baseline-risk change: it never touches `MailStore.ts`, never touches the shipped self-heal mechanism, and requires **no update to any allowlist** — `MailManifestFlags` is declared in `schema.prisma`, so it is never matched by `schema-safety.test.ts`'s `CREATE TABLE IF NOT EXISTS` scan in the first place (`healed` never contains it; `newlySelfHealed`/`selfHealOnly` are both unaffected) — the guard stays green with no edit. As a side benefit, writes to it use normal Prisma client calls (upsert), not hand-written raw-SQL JSONB merges.

```prisma
// PROPOSED — FOUNDER-GATE (Gate-D-style precondition, below). A SEPARATE,
// additive, migration-governed table — NOT new columns on MailManifest, which
// stays exactly as shipped (self-heal raw SQL, MailStore.ts:73, untouched by
// this decision). Declared in schema.prisma from birth; ships through the
// normal reviewed-migration path CLAUDE.md gotcha #1 requires for all new schema.
model MailManifestFlags {
  // = MailManifest.mailId. Application-level reference ONLY — no @relation,
  // no DB FK: MailManifest is not a Prisma model. Mirrors the AdminAuditLog
  // .actorId no-FK precedent already accepted in this program (N6).
  mailId        String    @id

  // The §4.1 `attention` object, verbatim shape, or null. Ops queue query
  // becomes: SELECT * FROM "MailManifestFlags"
  //   WHERE attention->>'raised' = 'true' AND attention->>'resolvedAt' IS NULL
  // — the identical predicate shape §4.1 always specified, now against a
  // compliant table instead of a prohibited ALTER TABLE.
  attention     Json?

  // The §4.4 `cancelRequest` object, verbatim shape, or null.
  cancelRequest Json?

  updatedAt     DateTime  @updatedAt
}
```

**FOUNDER-GATE (Gate-D-style precondition):** this table does not exist until a reviewed, additive Prisma migration creating it is authored, reviewed, and applied via `prisma migrate deploy` against the database's direct connection, as its own deliberate release step — never bundled into a routine deploy (gotcha #1's "no build step may mutate the database" law). Unlike Gate D's own migration (which adopts pre-existing production tables and therefore needs a `migrate resolve --applied` baseline step first), this is a brand-new table name with no prior existence anywhere — no baseline-adoption risk — but it still requires the same discipline: authored migration → preflight review → deliberate apply → post-apply verification (a smoke `SELECT` confirming the table exists and the JSONB predicate above returns zero rows on a clean table) → sign-off, before any code path writes to it. Until that sequence completes, `attention`/`cancelRequest` are a sound **design** with **no compliant place to live** — see the disposition update immediately below.

No change to `FORWARD`/`canTransition`/`pipelineIndex`/`MAIL_PIPELINE`/`MailStatus` — this decision is entirely about where two off-machine facts are persisted, never about the state machine itself.

**Lifecycle:**

- **Raise:** any of — (a) `mapLetterStreamStatus`-style fallback fires for a raw string with no known mapping (the actual F9-i trigger; `LetterStreamProvider.ts:45`'s `?? "PROVIDER_ACCEPTED"` default is retired in favor of raising `attention` with `reasonCode: "unknown_provider_status"` and **leaving `status` untouched** — never silently advancing it); (b) a reconciliation-sweep stall detection (`RECOVERY-ENGINE.md` §3) crosses its threshold. A raise is an **insert**, never a manifest transition — it produces no `AuditEntry` on the append-only trail (that trail is reserved for real state transitions, per `MailAudit.ts`'s own framing, "facts about what happened"); it is queryable as its own ops-facing fact.
- **Ops resolve paths (both legal, both explicit):**
  1. **Reclassify-and-advance:** ops (or a delayed correct signal) determines the true status; the *normal*, already-legal transition executes (`applyTransition` against whatever `to` is now actually justified) and `attention.resolvedAt`/`resolvedBy` are stamped in the same operator action. The manifest's `status` moves exactly once, to a real, legal value — never through a detour.
  2. **Resolve-as-transient:** the flag clears (`resolvedAt` stamped) with no manifest transition at all, because the underlying signal turned out to be a blip (e.g., a delayed webhook arrived correctly on its own). `status` never moved because it never needed to.
- **Never a backward transition, by construction:** because `attention` never touches `status`, there is no transition to police in the first place — the forward-only law is not bent, worked around, or exception-cased; it simply never applies to this mechanism.
- **Ops surface:** a manifest with `attention.raised === true` and no `resolvedAt` is the literal definition of a "needs attention" queue row — no new query shape beyond `WHERE attention->>'raised' = 'true' AND attention->>'resolvedAt' IS NULL` against the same JSONB-friendly column style `MailStore.ts` already uses for `recipient`/`cost`/`auditTrail`.

**F9-i disposition: ELIMINATED (mechanism) / CONTINGENT (storage) — not a plain ELIMINATED, per `REFINEMENT-2-DIRECTIVE.md` item 6.** The illegal in-machine mechanism is retired for good, unconditionally — it is not repaired, and nothing about that half of the finding is contingent. But the off-machine flag's STORAGE was, until this cycle, itself a second policy violation (`COMMITMENT-REGATE.md` N5 — the prior `ALTER TABLE MailManifest ADD COLUMN` plan was prohibited, corrected above). `attention` is therefore only actually storable once the `MailManifestFlags` migration (above) ships as a FOUNDER-GATE release step — until then this disposition is sound in design and unimplementable in practice, the same honesty class as F9-ii/F9-iii's own "contingent on the migration" framing below. Do not read F9-i as fully closed independent of that migration landing.

### 4.2 Retry paths made real — resolves gate F9-ii

**SUPERSEDES: `A-DOMAIN-MODEL.md` §2.6's `DisputePackageLetter` (schema delta only; the model's role is unchanged).**

**Three retry triggers, per `REFINEMENT-2-DIRECTIVE.md` Ruling 1 (not two)** — `REJECTED` (pre-`ACCEPTED` provider refusal), `RETURNED_TO_SENDER` (post-acceptance undeliverable), and **`PAYMENT_VOID` (a hold released unattempted, §5's diagram / `RECOVERY-ENGINE.md` §4 scenario 12)** — resolve IDENTICALLY: **operator (re-)action → a brand-new `MailManifest` row (a new `attempt`) → the old manifest stays, untouched, as historical evidence.** `PAYMENT_VOID` was NOT originally grouped with the other two — a prior draft of this document instead specified "same attempt reused" for it (§5's diagram, §7's interface handles, both corrected this cycle). Ruling 1 forecloses that exception: after ANY release, the released attempt is permanently terminal, and re-authorization always mints `attempt+1`, with no carve-out for the reason the release occurred. This was the exact seam `COMMITMENT-REGATE.md` found (F4/N1): W1 minted `attempt+1` unconditionally while this document carved out a same-attempt exception for `PAYMENT_VOID` alone, so the wallet no-op'd the re-authorization and certified mail shipped for zero net wallet effect. There is no such exception now.

For `REJECTED`/`RETURNED_TO_SENDER` specifically, this is not optional even mechanically: `applyTransition` (`lib/mail/MailJob.ts:46-48`) refuses any further transition once `isTerminal(m.status)` is true, and both `FAILED` and `RETURNED` are in `TERMINAL_STATUSES` (`MailStatus.ts:34-36`) — the *same* manifest row can never be walked forward again after either. `A-STATE-MACHINE.md` §6's claim that a rejected retry reuses "the same `mailId`" is corrected here: it cannot, for the reason just given; the document's own `RETURNED_TO_SENDER` handling (a fresh `mail_<letterId>_r2` id) was the structurally-necessary shape all along — this document generalizes it to all three paths. `PAYMENT_VOID` has no equivalent `MailStatus`-level terminality forcing this (the underlying `MailManifest.status` was never advanced past its pre-submission value in the first place — nothing provider-side ever happened), so its new-attempt requirement is a **wallet/attempt-layer** rule, not a `MailStatus`-machine one — but it is a rule all the same, stated once, here, and never contradicted downstream (§5, §7).

**Why the join table blocks it (F9-ii's actual finding):** `DisputePackageLetter` (`A-DOMAIN-MODEL.md` §2.6) carries `@@unique([letterId])` — at most one join row, ever, per letter. A retry needs a **second** `DisputePackageLetter` row for the same `letterId` (same package, new `mailId`) — categorically rejected by that constraint today.

**Schema delta:**

```prisma
// DELTA over A-DOMAIN-MODEL.md §2.6 — FOUNDER-GATE (schema change, additive).
model DisputePackageLetter {
  id        String         @id @default(cuid())
  package   DisputePackage @relation(fields: [packageId], references: [id], onDelete: Cascade)
  packageId String
  letter    Letter         @relation(fields: [letterId], references: [id], onDelete: Restrict)
  letterId  String
  mailId    String
  // NEW — single owner of the attempt number for this letter-fulfillment slot.
  // Read (never independently re-derived) by: the MAIL_TRANSITION claim key (§4.3),
  // the WALLET ledger's own attempt column (Brief S2), and this row itself.
  attempt   Int            @default(1)

  // @@unique([letterId])   ← DROPPED. Blocked retries at the DB level (F9-ii).
  @@unique([letterId, attempt])   // replacement integrity rule — one row per (letter, attempt)
  @@unique([mailId])               // unchanged — mailId is unique by construction (§ below)
  @@index([packageId])
}
```

**This same schema delta is also what makes Ruling 1's `PAYMENT_VOID` retry possible** — without `@@unique([letterId, attempt])`, a `PAYMENT_VOID` retry would hit the identical `@@unique([letterId])` wall F9-ii found for `REJECTED`/`RETURNED_TO_SENDER`; there is exactly one schema delta in this program serving all three retry triggers, not three separate ones. `DisputePackageLetter.attempt` (declared above) is confirmed here as the single owner of the attempt integer for every retry path, the mail-transition claim key (§4.3), and the wallet-ledger key (W1) alike.

**mailId convention per attempt:** `mail_<letterId>` for `attempt = 1` (unchanged, matches `app/api/mail/prepare/route.ts:52` today); `mail_<letterId>_a<attempt>` for `attempt > 1` — a fresh `MailManifest` primary key each time (required, since `"mailId" TEXT PRIMARY KEY`, `MailStore.ts:74`, cannot be reused for a second row). `@@unique([mailId])` is satisfied automatically by this convention without further work.

**Considered alternative, not picked:** an `active Boolean @default(true)` column plus a partial-unique index (`@@unique([letterId], where: active)`) instead of `[letterId, attempt]`. This would make "exactly one active attempt per letter" a hard DB invariant rather than an application-level "most recent attempt" read — genuinely stronger in one dimension. Not picked because it requires a partial index outside plain Prisma schema syntax (raw-SQL migration extension) for a guarantee this document does not believe is load-bearing: "which attempt is current" is already answerable as `MAX(attempt)` per `letterId`, a **derived** read consistent with `A-DOMAIN-MODEL.md` §5's single-owner/no-second-source-of-truth discipline, not a fact that needs its own stored flag. Named here so Agent E/the Founder can override this call; not silently decided.

**F9-ii disposition: ELIMINATED**, contingent on the schema delta above (FOUNDER-GATE, new migration — additive, 0 DROP, consistent with every other schema delta in this program).

### 4.3 Attempt dimension in the claim grammar — resolves gate F9-iii

**SUPERSEDES: `A-STATE-MACHINE.md` §8's claim key** (`` `${mailId}:${toStage}` ``) **and the `MAIL_TRANSITION` domain's key convention inside `ADR-0045`'s unified `Claim` table** (`CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §5.3) — same table, same domain tag, corrected key shape only.

**F9-iii's finding, restated precisely:** the original key had no attempt dimension, so a retry's `mail_abc:SUBMITTED` claim would return `completed` (already-claimed by attempt 1's identical-looking key) and be silently deduped out of existence — attempt 2 never actually executes its own transition.

**Canonical claim-key registry — per `REFINEMENT-2-DIRECTIVE.md` Ruling 2, cited verbatim here, never re-spelled.** Two distinct domains, each attempt-scoped, `Claim.key` the shared global primary key:
- **Mail-transition domain (this document's domain):** `` `mail:${subjectId}:${attempt}:${toStage}` ``, where **`subjectId` is the stable per-letter key `mail_<letterId>`** (§4.2's attempt-1 form, unchanging across attempts) and `attempt` is the same integer §4.2 defines on `DisputePackageLetter`.
- **Wallet-entry domain (W1's domain, cited here only for cross-reference, never re-derived):** `` `wallet:${subjectId}:${attempt}:${entryKind}` ``, `entryKind ∈ {fund,authorize,settle,release,clawback,adjust}`.

This is a deliberate design choice, not an accident of phrasing: it mirrors the Wallet's own subjectId treatment exactly (Brief S2 — "`subjectId` = the manifest id (`mail_<letterId>`), with `attempt Int` ... in the key") so that **one shared per-letter identity (`mail_<letterId>`) plus one shared attempt integer** feeds both claim domains and the `WALLET` domain's ledger uniqueness — a single owner (`DisputePackageLetter.attempt`), read identically by both consumers, never independently incremented in two places. **Prior variant grammar retired:** an earlier draft of this document used `` `${subjectId}:${toStage}:${attempt}` `` (attempt last, no domain tag) while `C-WALLET-INTEGRATION.md` independently used `wallet:<subjectId>:<transition>:<attempt>` — two of the "three incompatible forms" `COMMITMENT-REGATE.md`'s register-honesty verdict found. Both are superseded by the registry above; there is exactly one grammar per domain now, and it is the coordinator's (Ruling 2's), not this document's own invention.

**Why this is not the same as simply relying on the attempt-suffixed physical `mailId`:** the *manifest's own primary key* (`mail_<letterId>` vs. `mail_<letterId>_a2`, §4.2) already differs per attempt, which would incidentally also disambiguate a claim key built from it — but building the claim key from the stable `subjectId` instead keeps the claim grammar uniform and greppable by attempt number without parsing a suffix convention, and keeps it identical in shape to the Wallet's own key, which a future reader must be able to cross-reference by eye.

**F9-iii disposition: ELIMINATED**, contingent on the `Claim` table (`ADR-0045`) shipping with both registry key shapes exactly as cited above, from the start.

### 4.4 Cancellation states — CANCELLED (pre-submission) / CANCEL_REQUESTED (post-submission, best-effort)

**A note on spelling, not silently changed:** the Brief's own prose (S5) spells this `CANCELLED` (double-L); the shipped enum (`MailStatus.ts:23,43,59,67`) spells it `CANCELED` (single-L, American). This document keeps the **shipped spelling** for the real manifest value — renaming a live enum literal is a product-code change outside this program's architecture-only boundary (per the Brief's own hard boundary) — and uses `CANCELLED`/`CANCEL_REQUESTED` only when directly quoting Founder/Brief prose. Flagged once, here, rather than repeated per occurrence.

**Pre-submission (deterministic, unchanged mechanism, clarified scope):** From any of `APPROVED`, `WALLET_AUTHORIZED`(-span), or `SUBMITTED` (manifest `PAID`/`QUEUED`/`PDF_GENERATED`) — all already in `CANCELABLE` (`MailStatus.ts:43`) — cancellation is immediate and unconditional. Wallet effect, enumerated (not "depends"): if no hold exists yet (cancel fires before `WALLET_AUTHORIZED`), there is nothing to release. If a hold exists (`WALLET_AUTHORIZED` or later, pre-`ACCEPTED`), it releases synchronously in the same action. No vendor call is required to be *waited on* for this branch to complete, because nothing has been accepted yet.

**Post-acceptance (`ACCEPTED` and later) — genuinely best-effort as an OPERATIONAL request, but FINANCIALLY closed the instant acceptance occurred (§1.4, Ruling 3):**

**`PROVIDER_ACCEPTED → CANCELED` is real in the shipped code and GUARDED-FORBIDDEN in this architecture — both facts stated, neither hidden.** Honesty restored, per `REFINEMENT-2-DIRECTIVE.md` Ruling 3 (the re-gate's N2): `CANCELABLE` (`MailStatus.ts:43`) includes `PROVIDER_ACCEPTED` today, so `canTransition("PROVIDER_ACCEPTED", "CANCELED")` is `true` and `MailService.cancel()` (`MailService.ts:222-239`) would execute it without complaint — a prior draft of this section modeled post-acceptance cancellation as purely off-machine and never acknowledged this edge exists in the shipped machine at all, an omission `COMMITMENT-REGATE.md` N2 correctly named. §5's diagram and §6's mapping table below restore the edge. But restoring it to the diagram is not endorsing it: **this architecture's own rule (Commitment Constitution Art. 1, §1.4) forbids any Commitment-layer-driven caller — the Recovery Engine, an operator action, Kai — from ever invoking it.** The transition is "guarded-forbidden": legal in the raw `MailStatus` machine, prohibited by the layer this program builds on top of it — exactly the two-layer distinction §1 already draws between the financial boundary (ours to set) and vendor/operational facts. **Physically removing `PROVIDER_ACCEPTED` from `CANCELABLE`** would make the shipped machine match this rule exactly — that is a small, real product-code change, correctly flagged **FOUNDER-GATE (implementation phase)** and explicitly NOT made in this architecture-only cycle; until it ships, the guard lives at the call-site (no Commitment-layer code path may invoke `MailService.cancel()` once a manifest is `PROVIDER_ACCEPTED` or later), not in the enum.

```
// PROPOSED — additive, off-machine, same storage technique as `attention`
// (§4.1's storage decision, above). `outcome` is an EVIDENTIARY record of what
// the VENDOR reports — it NEVER drives MailManifest.status. In particular,
// "confirmed_cancelled" records a vendor-reported fact; it is NOT permission
// to transition the manifest to CANCELED (forbidden post-acceptance, §1.4).
cancelRequest: {
  requestedAt: string;
  requestedBy: string;         // operator id
  reason: string;
  statusAtRequest: MailStatus; // snapshot — never inferred after the fact
  outcome: "pending" | "confirmed_cancelled" | "proceeded";
  resolvedAt: string | null;
  providerResponseDetail: string | null; // internal-only, never raw vendor text to the consumer
} | null
```

**Why off-machine, not a real state:** identical reasoning to `attention` (§4.1) — the manifest's real `status` must keep reflecting whatever the provider actually, currently reports; a request pending an external answer must not freeze or fork that truth. `CANCEL_REQUESTED` is therefore never a value in `FORWARD`; it is a flag that sits beside `status` while the real pipeline (webhooks/sweep-driven tracking updates) continues to move normally underneath it — **and, post-acceptance, `status` may never become `CANCELED` regardless of what this flag records** (the guarded-forbidden rule above).

**Resolution — two branches, enumerated, not "depends" — NEITHER branch transitions `status` to `CANCELED`:**

- **`proceeded`** (the overwhelming default once truly past `ACCEPTED` — "the provider owns the paper," `MailStatus.ts:40`): the vendor does not confirm a stop; the manifest's real status continues advancing (`PRINTING → MAILED → ...`) exactly as if no request had been made. **Wallet effect: none** — the wallet was already settled at `ACCEPTED` (§3) and stays settled; this is a normal, uninterrupted fulfillment.
- **`confirmed_cancelled`** (rare, and only possible at all pending §2's vendor confirmation — this branch may not exist in practice for LetterStream): the vendor confirms the piece is stopped before printing. **This is recorded ONLY on `cancelRequest.outcome` — the manifest's `status` is UNCHANGED by it** (it is never driven to `CANCELED`; per §1.4, that conversion is forbidden the instant `ACCEPTED` occurred, regardless of what happens afterward). `status` continues to reflect whatever the provider actually, currently reports going forward (which may simply stall short of `PRINTED`/`MAILED` if the piece truly never enters the physical stream — an honest fact for `attention`/`TRACKING_STALLED` to surface, §4.5, not a `CANCELED` label). **Wallet effect: the wallet stays settled — permanently, no automatic release, no clawback-as-unwind (§1.4).** This produces a real tension this document does not paper over: the consumer would have paid for a certified mailing that, per the vendor's own confirmation, never physically happened. **The ONLY remediation vocabulary is `adjust`** (an owner-gated accounting compensation, `founder_gate_pending` until reviewed) — never `release`, never a status implying the letter wasn't mailed, per Ruling 3 exactly. Owner + CCO review of the specific facts is required before any `adjust` fires; it is never automatic. This fork is surfaced, not silently resolved either direction — see `RECOVERY-ENGINE.md` scenario 9 for the full routing (also corrected this cycle to remove its own prior `→ CANCELED` branch).

**Disposition:** this design directly answers two of the Founder's 17 named scenarios ("cancellation before provider acceptance" vs. "cancellation after provider acceptance") with two structurally different, deterministic outcomes rather than one mechanism awkwardly covering both — and, as of this cycle, both outcomes agree that `status` never re-enters `CANCELED` once `PROVIDER_ACCEPTED` has occurred (Ruling 3).

### 4.5 The four F10 money-touching evidence-failure states

All four are **derived `FulfillmentStage`-adjacent labels**, not new `MailManifest.status` values — same off-machine discipline as §4.1, layered on top of whichever real status the manifest currently holds (`DELIVERED` for the first three; any post-`ACCEPTED` pre-`DELIVERED` stage for the fourth's detection, though its consequence is recorded against the settled letter regardless of exact stage).

| State | Trigger | Clock / ops handling | Wallet effect |
|---|---|---|---|
| **`RECEIPT_OVERDUE`** | `DELIVERED` reached; no `RETURN_RECEIPT_ARCHIVED` after `staleAfterReceipt` (FOUNDER-GATE value, tuned partly by vendor question §2.1 #9's answer) | Raises `attention` (`reasonCode: "receipt_overdue"`). Per `A-STATE-MACHINE.md` §5.4/§7, `WAITING_PERIOD`'s entry invariant today is "`RETURN_RECEIPT_ARCHIVED` ... timestamp set" — meaning, unfixed, the §611 clock **never starts** if the receipt never arrives (F10's exact bug). This document does **not** invent the legal answer to "can `DELIVERED` alone start the clock without the receipt" — that is a CCO/counsel question (adjacent to F8's clock-anchor question), not an architecture one. It makes the *gap* visible and actionable: ops can (a) re-call `retrieveProof()` — the artifact may simply be delayed — which, once it lands, fires `RETURN_RECEIPT_ARCHIVED` normally and starts the clock exactly as designed, or (b) escalate the clock-without-receipt question to compliance for an explicit ruling, never silently assume one. | None — already settled at `ACCEPTED`; this is a post-settlement evidentiary gap, not a money event. |
| **`TRACKING_STALLED`** | No tracking movement for `staleAfterTracking` at any post-`ACCEPTED`, pre-`DELIVERED` stage | Raises `attention` (`reasonCode: "tracking_stalled"`) via the reconciliation sweep (`RECOVERY-ENGINE.md` §3) | None — settled, unaffected; operational-only. |
| **Returned after Delivered** | `DELIVERED → RETURNED` — **already legal today** (`lib/mail/MailStatus.ts:56`: `DELIVERED: ["RESPONSE_RECEIVED", "CLOSED", "RETURNED"]` — verified directly; note the shipped line is **56**, not 57 as cited in `ADVERSARIAL-REVIEW.md`'s F10 text, a trivial one-line citation variance in that document, corrected here). This document's own Mermaid diagram (§5) and mapping table (§6) **include** this edge — the specific omission F10 named ("the zero information loss mapping drops a transition the shipped machine supports") is closed here. | No new clock/ops mechanism needed — it is a normal, already-guarded manifest transition; the manifest simply reaches a real terminal `RETURNED` state later than usual. | **None automatically** — the service (print, mail, deliver) was substantively performed; settlement (§3) is not reversed by a later data correction or recipient refusal. A **FOUNDER-GATE** manual adjustment exists only for the exceptional case where the facts suggest CreditVector/provider error rather than a recipient-side event — never automatic, never assumed. |
| **Address-failure-after-settle** | An address defect surfaces after `ACCEPTED` (e.g. a live CASS check, once built per `A-PROVIDER-ABSTRACTION.md` §3.2's FOUNDER-GATE, rejects a previously-structural-only-valid address; or the piece is later returned undeliverable) | Standard retry path applies: corrected address → a new `attempt` (§4.2) → a fresh authorize+settle cycle for the retry. | **Default: none** — settlement is permanent per §1.1; the retry is a **new, separately-priced** authorization, not a free resend. A FOUNDER-GATE `adjust`/refund path exists only for the narrow case where the address defect is traceable to CreditVector's own error (not user-supplied bad data) — named, not designed, consistent with `A-DOMAIN-MODEL.md` §7 item 1's existing refusal to silently absorb a Founder-decision conflict. |

**F10 disposition: REDUCED, not ELIMINATED** (`COMMITMENT-REGATE.md`'s register-honesty verdict, carried forward per `REFINEMENT-2-DIRECTIVE.md` item 6) — all four evidence-failure states above are now deterministic, with named triggers, clocks, and wallet effects where the prior package had none; but the disposition stays REDUCED because `RECEIPT_OVERDUE`'s hardest question (can `DELIVERED` alone start the §611 clock without the receipt?) is an open CCO/counsel question this document deliberately does not resolve by architectural fiat (see the table row above), and because `staleAfterReceipt`/`staleAfterTracking` remain named-but-untuned FOUNDER-GATE values. Closing F10 fully requires both answers, neither of which is an architecture decision.

---

## 5. Revised Mermaid diagram (delta over `A-STATE-MACHINE.md` §10)

```mermaid
stateDiagram-v2
    [*] --> PREPARED
    PREPARED --> APPROVED : operator approves (user-only, never Kai)
    APPROVED --> WALLET_AUTHORIZED : policy engine prices (certified always true) + wallet AUTHORIZES a hold (per letter)
    WALLET_AUTHORIZED --> SUBMITTED : policy engine submits to provider
    SUBMITTED --> ACCEPTED : provider returns a job id — wallet SETTLES here, per letter (§3)
    ACCEPTED --> PRINTING : provider webhook / reconciliation sweep
    PRINTING --> MAILED : provider webhook / sweep
    MAILED --> USPS_ACCEPTED : provider webhook / sweep (distinct USPS scan)
    USPS_ACCEPTED --> DELIVERED : provider webhook / sweep
    DELIVERED --> RETURN_RECEIPT_ARCHIVED : evidence fetched
    DELIVERED --> RETURNED_TO_SENDER : USPS returns after delivery (MailStatus.ts:56 — honored, not omitted)
    RETURN_RECEIPT_ARCHIVED --> WAITING_PERIOD : clock starts (derive-on-read, no event written)
    WAITING_PERIOD --> READY_FOR_NEXT_REVIEW : clock elapses OR response logged

    APPROVED --> CANCELED : operator cancels — no hold yet, nothing to release
    WALLET_AUTHORIZED --> CANCELED : operator cancels — hold RELEASES (pre-submission, §4.4)
    SUBMITTED --> CANCELED : operator cancels — hold RELEASES (pre-submission, §4.4)
    SUBMITTED --> REJECTED : provider rejects synchronously — hold RELEASES, per letter
    SUBMITTED --> PROVIDER_ERROR : transport/provider failure — hold RELEASES (pre-accept)
    ACCEPTED --> PROVIDER_ERROR : rare post-accept provider failure — settled; FOUNDER-GATE refund only
    ACCEPTED --> CANCELED : shipped-legal (MailStatus.ts:43 CANCELABLE) — GUARDED-FORBIDDEN here, Commitment Constitution Art.1 (§1.4/§4.4); no Commitment-layer path ever invokes this edge (Ruling 3)
    USPS_ACCEPTED --> RETURNED_TO_SENDER : provider reports undeliverable
    WALLET_AUTHORIZED --> PAYMENT_VOID : hold expires unattempted — RELEASE, never settle-by-timeout (§6, RECOVERY-ENGINE.md §3)

    REJECTED --> PREPARED : operator corrects — NEW manifest attempt (new mailId, §4.2)
    RETURNED_TO_SENDER --> PREPARED : operator corrects address — NEW manifest attempt (new mailId, §4.2)
    PAYMENT_VOID --> PREPARED : operator retries — NEW manifest attempt (new mailId, §4.2); IDENTICAL shape to REJECTED/RETURNED_TO_SENDER retry (Ruling 1) — no "same attempt" edge exists any longer

    note right of WALLET_AUTHORIZED
      Hold placed here, per letter.
      Cancel from here or SUBMITTED
      is deterministic: CANCELED + release.
    end note
    note right of ACCEPTED
      SETTLEMENT — permanent, per letter,
      per S1/S2. Financial boundary (§1.1).
      Commitment Constitution Art.1 (§1.4):
      settled stays settled forever — no
      third conversion. The ACCEPTED-->CANCELED
      edge above is shipped-legal but
      GUARDED-FORBIDDEN from here onward
      (Ruling 3).
      A CANCEL_REQUESTED flag may be raised
      (§4.4) — off-machine, never drives
      status; resolves to "proceeded"
      (default, no wallet effect) or rare
      "confirmed_cancelled" (status UNCHANGED;
      FOUNDER-GATE adjust-only remediation,
      never a release, never CANCELED).
    end note
    note right of DELIVERED
      RECEIPT_OVERDUE (§4.5) is an off-machine
      attention flag if no return receipt
      arrives within staleAfterReceipt —
      never a status value.
    end note
    note right of PRINTING
      TRACKING_STALLED (§4.5) and any
      unmapped raw provider status
      (UNKNOWN_PROVIDER_STATUS, §4.1) are
      off-machine ATTENTION flags at any
      stage from ACCEPTED to DELIVERED —
      never in-machine nodes. status
      never fabricates forward progress.
    end note
    note right of WAITING_PERIOD
      Derived clock state — never a
      persisted MailManifest status.
    end note
```

**What this diagram deliberately omits, and why:** no `UNKNOWN_PROVIDER_STATUS` node (§4.1 — off-machine only); no `CANCEL_REQUESTED` node (§4.4 — off-machine only); no `RECEIPT_OVERDUE`/`TRACKING_STALLED` nodes (§4.5 — off-machine only). Every one of these is real, tracked, and operator-visible — none of them is a value the `status` column ever takes, and none of them required a single new entry in `FORWARD`.

**What this diagram now includes that a prior draft omitted:** the `ACCEPTED --> CANCELED` edge (Ruling 3 / N2) — restored for honesty (it is real and shipped, `MailStatus.ts:43`) but explicitly marked guarded-forbidden; no Commitment-layer path may exercise it, and doing so remains only a raw-`MailStatus`-machine possibility until a FOUNDER-GATE product change removes `PROVIDER_ACCEPTED` from `CANCELABLE`. Also corrected: `PAYMENT_VOID`'s retry edge now targets `PREPARED` (a new attempt), matching `REJECTED`/`RETURNED_TO_SENDER` exactly — the prior `PAYMENT_VOID --> WALLET_AUTHORIZED` "same attempt" edge is gone (Ruling 1).

---

## 6. Zero-information-loss mapping — delta table

Extends `A-STATE-MACHINE.md` §9 (only new/changed rows shown; every row not listed here is unchanged and still authoritative there).

| `MailManifest.status` | `FulfillmentStage` | Loss? | Delta reason |
|---|---|---|---|
| `PROVIDER_ACCEPTED` | `ACCEPTED` | none | **Now the per-letter wallet SETTLEMENT hook (§3)** — additive fact, not a mapping change. |
| `FAILED` (pre-`ACCEPTED`) | `REJECTED` | none | **Now the per-letter wallet RELEASE hook + mandatory new-attempt retry (§4.2)** — additive. |
| `RETURNED` | `RETURNED_TO_SENDER` | none | **Now the mandatory new-attempt retry path (§4.2)**, and reachable from `DELIVERED` too (next row) — additive. |
| `DELIVERED → RETURNED` | `DELIVERED → RETURNED_TO_SENDER` | **was a loss — now closed** | `MailStatus.ts:56` already permits this edge; `A-STATE-MACHINE.md` §9/§10 omitted it. This document's diagram (§5) and this row restore it. Wallet effect: none automatic (§4.5). |
| `PROVIDER_ACCEPTED → CANCELED` | `ACCEPTED → CANCELED` | **shipped-legal, GUARDED-FORBIDDEN** | Restored for honesty (`MailStatus.ts:43`'s `CANCELABLE` includes `PROVIDER_ACCEPTED`; `COMMITMENT-REGATE.md` N2) — but forbidden in the Commitment layer by Ruling 3 / Commitment Constitution Art.1 (§1.4/§4.4). No Commitment-layer path ever exercises this edge; physically removing it from `CANCELABLE` is FOUNDER-GATE (implementation phase). |
| *(no manifest value — new off-machine fact)* | `attention` flag (any stage `ACCEPTED`…`DELIVERED`) | **new fact, not a loss** | Replaces the illegal in-machine `UNKNOWN_PROVIDER_STATUS` (§4.1). |
| *(no manifest value — new off-machine fact)* | `cancelRequest` (any stage `ACCEPTED`…`USPS_ACCEPTED`) | **new fact, not a loss** | §4.4. |
| *(no manifest value — new off-machine fact)* | `RECEIPT_OVERDUE` label (post-`DELIVERED`) | **new fact, not a loss** | §4.5. |
| *(no manifest value — new off-machine fact)* | `TRACKING_STALLED` label (post-`ACCEPTED`, pre-`DELIVERED`) | **new fact, not a loss** | §4.5. |
| `WALLET_AUTHORIZED` (FulfillmentStage) | — | none | **Grain change only (S1/S2):** the hold this stage represents is now one of N independent per-letter holds inside one atomic `authorizationGroupId`, never a single package-wide hold. No manifest-status change. |

---

## 7. Interface handles exposed downstream

- **To W1 (Wallet):** `subjectId = mail_<letterId>` (stable, attempt-independent) as the wallet ledger's per-letter key; `attempt` sourced from `DisputePackageLetter.attempt` (single owner, §4.2/§4.3); settlement hook fires at manifest `PROVIDER_ACCEPTED` per letter (§3), and is **permanent — no reversal path exists in this document once it fires** (§1.4, Ruling 3); release hook fires at pre-`ACCEPTED` `FAILED`/`CANCELED` per letter. **`PAYMENT_VOID`'s retry is now IDENTICAL in shape to `REJECTED`/`RETURNED_TO_SENDER`'s retry — new-attempt, new manifest, in all three cases** (`REFINEMENT-2-DIRECTIVE.md` Ruling 1). There is no "same-attempt re-authorization" code path anywhere in this program any longer; W1's wallet-side re-authorize op always mints a fresh attempt and a fresh debit against a fresh manifest, never a no-op reuse of a released hold's attempt number. (A prior draft of this document specified same-attempt reuse for `PAYMENT_VOID` alone — that was the exact seam `COMMITMENT-REGATE.md` F4/N1 found; Ruling 1 permanently closes it.)
- **To W3 (Kai UX):** the worst-case-assumption language requirement for FINAL REVIEW copy (§1.2); the `CANCEL_REQUESTED` two-branch honesty requirement — copy must never promise the `confirmed_cancelled` outcome in advance, AND, critically, when `confirmed_cancelled` actually occurs, copy must state the settled-stays-settled truth (§1.4/§4.4, Ruling 3) — **NEVER "nothing was charged" or any phrase implying the wallet reversed** (the exact defect `COMMITMENT-REGATE.md`'s register-honesty verdict found in a prior W3 draft's `CANCELLATION_CONFIRMED` copy, re-keyed onto this document's `CANCEL_CONFIRMED_RARE`); `attention`/`cancelRequest`/`RECEIPT_OVERDUE`/`TRACKING_STALLED` as named, stable concepts W3 can hang notification moments and Kai copy classes on (full classes and copy are `RECOVERY-ENGINE.md`'s and W3's respectively — this document only names the triggers and states).
- **To the Founder/CCO:** the eleven-question vendor list (§2) as the literal artifact to put to LetterStream; the `confirmed_cancelled` accounting-`adjust` fork (§4.4, no longer a "wallet-reversal" fork — Ruling 3 forecloses reversal entirely) and the returned-after-delivered / address-failure-after-settle remedy forks (§4.5) as explicit, unresolved FOUNDER-GATE decisions — none silently defaulted. Physically removing `PROVIDER_ACCEPTED` from `CANCELABLE` (§4.4) and the `MailManifestFlags` migration (§4.1) as two additional, explicitly named FOUNDER-GATE implementation-phase actions this cycle documents but does not perform.
