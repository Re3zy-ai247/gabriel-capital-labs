# MIGRATION-PLAN.md — Additive Migration Order

Consolidation only. Primary source: `EXEC-SEQUENCING.md` §3 (order table, batching rationale, apply mechanics) reconciled against `EXECUTION-PLAN.md` §3's phase table and `WALLET-VC-RUNTIME-PLAN.md` §5.2 (VC ledger sub-ordering). Every row cites its source; the three not-yet-scheduled Vector Credit ledgers are listed as DEFERRED, not scheduled, per the task's own instruction and `EXECUTION-PLAN.md` P-5.

**Standing law, restated once (`EXECUTION-PLAN.md` §6):** additive-migration-first — 0 `DROP`, no new self-heal table. No build step mutates the DB. Every migration below is a reviewed, owner-approved Prisma migration applied as a deliberate release step, never at build time (`CLAUDE.md` gotcha #1).

---

## 0. Prerequisite — up front, gates everything below

**Nothing in this document exists until both of these clear, in order:**

1. **P1a — Execute Gate D's six-migration baseline.** Production has **no `_prisma_migrations` history** (the prior baseline-resolve was preview-only). `migrate resolve --applied 0_init` must run first, then the six already-committed migrations deploy. Owner-executed against `.ai/RUNBOOKS/gate-d-production-migration.md`. Exit: all six `ALL_PRESENT_AND_MATCHING`, `NO_PENDING_MIGRATIONS`, 5 platform flags still OFF (`EXEC-SEQUENCING.md` §1.1).
2. **P1b — Land the ID-B02 manifest-extension mechanism.** `scripts/gate-d-preflight.test.ts:366` and `gate-d-preflight-core.ts` today accept **exactly six** migration directories and reject a 7th (CRITICAL/CONFIRMED, `ADVERSARIAL-REVIEW.md` F1). P1b lands a versioned, owner-approved manifest mechanism proving byte-identical six-file coverage **plus** the new directory. This is shared infrastructure with the Identity Constitution program's own Implementation Slice 7 (`.ai/IDENTITY-CONSTITUTION-IMPLEMENTATION-PLAN.md`) — coordinate, don't duplicate.

**No fulfillment migration exists until P1b lands** (`EXECUTION-PLAN.md` P-1). Every row below queues behind P1a **and** P1b.

---

## 1. Order table

| Order | Directory | Table / Enum | Tier | Depends on | New FK (direction, delete rule) | Applies in phase | Note |
|---|---|---|---|---|---|---|---|
| — | (pre-existing) | the six already-committed Gate-D migrations | 0 | P0 | not this program's schema | P1a | Pre-existing debt, not authored by this program; this plan adds nothing to them (`EXEC-SEQUENCING.md` §1.1) |
| 1 | `fulfillment_domain_v1` (PROPOSED name) | `CaseState` enum | 1 | P1b | — | P5 | additive enum |
| 2 | (same dir) | `Case` | 1 | `User`, `Tradeline` (existing) | `userId→User` **Restrict** (corrected, was Cascade); `tradelineId→Tradeline` SetNull | P5 | `A-DOMAIN-MODEL.md` §1.6, corrected per `COMMITMENT-RESOLUTION.md` F14 |
| 3 | (same dir) | `PackageState` enum | 1 | P1b | — | P5 | additive enum |
| 4 | (same dir) | `DisputePackage` | 1 | `Case` (row 2), `User` | `caseId→Case` Restrict; `userId→User` **Restrict** (corrected); `campaignId` plain unenforced `String` | P5 | `Campaign` is self-heal, no FK possible |
| 5 | (same dir) | `DisputePackageLetter` | 1 | `DisputePackage` (row 4), `Letter` (existing) | `packageId→DisputePackage` Cascade; `letterId→Letter` Restrict | P5 | `@@unique([letterId, attempt])` **not** `@@unique([letterId])` — a plain unique made a `RETURNED_TO_SENDER` retry database-impossible |
| 6 | (same dir) | `ClaimDomain` enum | 1 | P1b | — | P5 | `MAIL_TRANSITION \| WALLET` today; extended later, additively, with `EARNED_VC \| BONUS_VC \| PENDING_PAYOUT_VC` only once those ledgers are scheduled (§4 below) |
| 7 | (same dir) | `Claim` | 1 | P1b | none (standalone) | P5 | generic `key` PK; every money-moving operation on every ledger is claim-before-effect against this table |
| 8 | own directory (reassigned — see §5) | `MailManifestFlags` | 1 | P1b | none (app-level reference to self-heal `MailManifest.mailId`, no DB FK) | **P4** (reconciled; see §5) | `mailId String @id`, `attention Json?`, `cancelRequest Json?` — `FULFILLMENT-COMMITMENT-BOUNDARY.md` §4.1/§4.4; own standalone table, **not** an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` self-heal (that was the original, rejected plan — a self-heal-DDL violation) |
| 9 | `wallet_purchased_vc_v1` (PROPOSED name, separate directory) | `Wallet` | 2 | P1b, P2 | `principalId→User` Restrict | P7 | anchor row, holds no balance; `@@unique([principalId])` |
| 10 | (same dir) | `WalletLedger` | 2 | `Wallet` (row 9), `User` (existing, nullable actor/onBehalfOf) | `walletId→Wallet` Restrict; `actorId→User` **nullable** Restrict (corrected from non-null); `onBehalfOfId→User` nullable Restrict | P7 | = Purchased VC ledger; `@@unique([walletId, subjectId, entryKind, attempt])` |
| 11 | **NOT SCHEDULED** | `EarnedVcLedger` | 3 | `Wallet` (by analogy) | TBD | **DEFERRED** — counsel + CCO | net-new founder decision; instrument classification unresolved (sixth instrument vs. productized promotional credit — `WALLET-VC-RUNTIME-PLAN.md` §2.4) |
| 12 | **NOT SCHEDULED** | `BonusVcLedger` | 3 | `Wallet` (by analogy) | TBD | **DEFERRED** — counsel + CCO | clean mapping onto ADR-0038's Promotional credits, but unbuilt |
| 13 | **NOT SCHEDULED** | `PendingPayoutVcLedger` | 3 | `Wallet` (by analogy) | TBD | **DEFERRED** — counsel + CCO, plus Stripe Connect must be built first (does not exist in this codebase) | affiliate/cash-adjacent — further gated than 11/12 |

---

## 2. Batching rationale

Rows 1–7 batch as **one** migration directory (mirrors the `operator_identity` precedent — 3 tables, 1 directory): minimizes how many times the post-ID-B02 extension mechanism must be exercised, one preflight-reconciliation event instead of many (`EXEC-SEQUENCING.md` §3.2). Row 8 (`MailManifestFlags`) ships in its **own** directory, applied at P4, ahead of rows 1–7's P5 deploy (see §5's reconciliation — this is a delta from `EXEC-SEQUENCING.md`'s original batching, which had folded it into the same directory as rows 1–7). Rows 9–10 ship in their own, later directory — bundling them with rows 1–8 would force the non-money tables to wait on P2's legal answer too, which the whole R3 ("non-money precedes money") ruling exists to prevent (`EXEC-SEQUENCING.md` §3.2, `EXECUTION-PLAN.md` §6).

---

## 3. Apply mechanics + FOUNDER-GATE sign-off

| Step | Mechanics | Sign-off |
|---|---|---|
| Rows 1–7 | One `prisma migrate deploy`, once P1 (P1a **and** P1b) clears, mirroring `.ai/RUNBOOKS/gate-d-production-migration.md`'s shape (preflight → reconciliation → deploy → post-deploy verification) as extended by P1b's new mechanism | Founder sign-off on this specific production migration apply (`EXECUTION-PLAN.md` §5 item 6) |
| Row 8 | Its own deploy step, once P1 clears — precedes rows 1–7 per §5's reconciliation, since P4 (which owns it) precedes P5 in the phase order and P5 depends on P4's exit | Founder sign-off, same discipline |
| Rows 9–10 | A **separate**, deliberate release step once **P1 and P2 both** clear — never bundled with rows 1–8's deploy | Founder sign-off; gated additionally on P2 (CROA §404 counsel + Founder legal) |
| Rows 11–13 | Not authored. No migration exists to apply. | N/A until counsel + CCO rule on instrument classification (row 11) and Stripe Connect is built (row 13) |

No step ever reorders (`WALLET-VC-RUNTIME-PLAN.md` §5.4): Gate D precedes the legal gate check for Tier 2, migration precedes flag flip, always.

---

## 4. Schema-safety-allowlist note

None of rows 1–13 is ever added to `LEGACY_SELF_HEAL_ALLOWLIST` (`scripts/schema-safety.test.ts:106-114`, frozen at 32 legacy tables). `scripts/schema-safety.test.ts`'s `newlySelfHealed.length === 0` check (lines 117–120) must stay green **unmodified** — proving none of these new tables self-heals (`EXEC-SEQUENCING.md` §3.3). Row 8 (`MailManifestFlags`) is declared in `schema.prisma` from birth, so it is never even matched by the `CREATE TABLE IF NOT EXISTS` self-heal scan (`FULFILLMENT-COMMITMENT-BOUNDARY.md:122`) — that guard needs no edit at all for this row. Every migration in rows 9–13 (if/when 11–13 are ever scheduled): additive only, zero `DROP`/`TRUNCATE`/`DELETE FROM`/`RENAME` (`WALLET-VC-RUNTIME-PLAN.md` §5.2).

---

## 5. Reconciliation note — `MailManifestFlags` reassigned from P5 to P4

`EXEC-SEQUENCING.md` §3.1 row 8 batches `MailManifestFlags` into the same Tier-1 directory as `Case`/`DisputePackage`/`DisputePackageLetter`/`Claim`, applying at **P5**. `EXECUTION-PLAN.md` §3's authoritative phase table instead lists `MailManifestFlags` as **P4**'s migration ("Provider abstraction — interface + Vendor Opacity DTO/guard... | `MailManifestFlags` (additive)"). This consolidation follows `EXECUTION-PLAN.md`: the fail-closed `attention` mechanism this table exists to back is P4-owned territory — `LETTERSTREAM-ADAPTER-PLAN.md` §1.3 names it directly ("the fail-closed `attention` flag this plan's error mapping... relies on for an unmapped/unknown vendor status has 'no compliant place to live' until the `MailManifestFlags` table ships"), and P4's own exit criteria (`UNKNOWN_PROVIDER_STATUS` defined, DTO strips `MailReceipt.provider`) are incomplete without it. Structural consequence (this consolidation's own inference, not stated verbatim in either source): row 8 ships as its **own** migration directory, applied at P4, ahead of rows 1–7's P5 deploy — not bundled with them as `EXEC-SEQUENCING.md` originally proposed.
