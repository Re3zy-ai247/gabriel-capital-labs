-- Consumer Fact Confirmation (RC1-S4, Founder decision D-7). ADDITIVE ONLY:
-- 1 new table + 2 indexes + 2 FKs (onto User and Tradeline). 0 DROP, 0 ALTER of
-- an existing table, 0 data mutation, 0 backfill.
--
-- PREFLIGHT (must all hold before this is applied):
--   • `SELECT to_regclass('"ConsumerAssertion"')` returns NULL (table absent).
--   • `SELECT to_regclass('"User"')` and `SELECT to_regclass('"Tradeline"')` are
--     both NOT NULL (both FK targets exist).
--   • The migration chain through 20260721160000_operator_reputation is applied.
--   • The enum type "Bureau" exists (`SELECT to_regtype('"Bureau"')` NOT NULL) —
--     it is referenced by the nullable "bureauScope" column and is NOT created,
--     altered, or extended here.
--   • No build step runs migrations (scripts/schema-safety.test.ts pins this).
--
-- EXPECTED SQL EFFECT: one empty table appears. No existing row is read, written,
-- locked for write, or deleted. Old application code is unaffected by it.
--
-- FORWARD VALIDATION (after apply, read-only):
--   • \d "ConsumerAssertion" shows columns id, userId, tradelineId (NULLABLE),
--     tradelineCreditorName, tradelineAccountMask, tradelineAccountType,
--     bureauScope, assertionType, consumerNote, status, createdAt, withdrawnAt.
--   • `SELECT COUNT(*) FROM "ConsumerAssertion"` = 0.
--   • Indexes ConsumerAssertion_userId_tradelineId_status_idx and
--     ConsumerAssertion_tradelineId_status_idx exist.
--   • FKs ConsumerAssertion_userId_fkey (CASCADE) and
--     ConsumerAssertion_tradelineId_fkey (SET NULL) exist and are VALID:
--     `SELECT confdeltype FROM pg_constraint
--        WHERE conname = 'ConsumerAssertion_tradelineId_fkey'` returns 'n'.
--
-- LIFECYCLE (corrected, review H-2). "Tradeline" rows ARE deleted on ordinary
-- paths — `lib/analyze.ts:168` (`tx.tradeline.deleteMany({ where: { reportId } })`
-- inside the re-analysis transaction, which replaces the whole tradeline set on
-- every re-upload) and `app/api/reports/[id]/route.ts:17` (`report.delete`,
-- cascading to Tradeline). An earlier draft of this file claimed the opposite.
-- "ConsumerAssertion"."tradelineId" is therefore NULLABLE with ON DELETE SET
-- NULL, exactly as "Letter"."tradelineId" already is, and the immutable
-- "tradelineCreditorName"/"tradelineAccountMask"/"tradelineAccountType" snapshot
-- columns keep an orphaned row meaningful: it remains the evidence that the
-- consumer authorized the first-person sentences in a letter already mailed.
--
-- ROLLBACK: `DROP TABLE "ConsumerAssertion";` — safe ONLY while the table is
-- empty and the application code that writes it is not yet deployed. Once it
-- holds rows it holds the consumer's own confirmed statements of fact, from
-- which letters signed in their name were composed: do not drop it; roll back
-- the APPLICATION instead and leave the table in place.
--
-- DATA RISK: none at apply time. There is deliberately NO backfill statement in
-- this file. Every tradeline that exists today has NEVER been confirmed by its
-- consumer — writing an assertion row for any of them would manufacture exactly
-- the consumer statement this table exists to stop the product from inventing.
-- The intended consequence is that letter generation refuses on every existing
-- item until its owner confirms a fact (app/api/letters/generate/route.ts) — and
-- the same is true, deliberately, for the freshly parsed tradelines a
-- re-analysis creates.
--
-- ORDERING NOTE: this migration is INERT for the currently deployed application —
-- nothing reads or writes the table. It may therefore be applied before the
-- application deploy; the application deploy is what turns the refusal on.
--
-- APPLY: owner-gated release step (`prisma migrate deploy`), BEFORE the deploy of
-- the application code that reads this table. Never at build time.

-- CreateTable
CREATE TABLE "ConsumerAssertion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    -- NULLABLE by design: ON DELETE SET NULL below. See the LIFECYCLE note.
    "tradelineId" TEXT,
    -- Immutable snapshot, written once at creation, never updated.
    "tradelineCreditorName" TEXT NOT NULL,
    "tradelineAccountMask" TEXT,
    "tradelineAccountType" TEXT,
    "bureauScope" "Bureau",
    "assertionType" TEXT NOT NULL,
    "consumerNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "ConsumerAssertion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The composition read path: "the ACTIVE assertions this user made about this
-- tradeline" (letter generation, the Tradelines page).
CREATE INDEX "ConsumerAssertion_userId_tradelineId_status_idx" ON "ConsumerAssertion"("userId", "tradelineId", "status");

-- CreateIndex
CREATE INDEX "ConsumerAssertion_tradelineId_status_idx" ON "ConsumerAssertion"("tradelineId", "status");

-- NOTE: deliberately NO unique constraint. A consumer may confirm SEVERAL facts
-- about one item (wrong balance AND wrong dates), may withdraw one and confirm
-- it again later, and may scope the same type to different bureaus. Uniqueness
-- on (userId, tradelineId, assertionType) would silently forbid the re-confirm
-- and turn an append-only history into an upsert.

-- AddForeignKey
ALTER TABLE "ConsumerAssertion" ADD CONSTRAINT "ConsumerAssertion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL, mirroring "Letter"_tradelineId_fkey, which survives the same delete
-- for the same reason. A CASCADE here would destroy — on the routine
-- re-analysis path — the only record that the consumer authorized the
-- first-person statements in letters they have already signed and mailed.
-- RESTRICT is not an option either: it would make re-analysis and report
-- deletion fail outright (P2003). The snapshot columns are what keep the
-- orphaned row meaningful.
ALTER TABLE "ConsumerAssertion" ADD CONSTRAINT "ConsumerAssertion_tradelineId_fkey" FOREIGN KEY ("tradelineId") REFERENCES "Tradeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
