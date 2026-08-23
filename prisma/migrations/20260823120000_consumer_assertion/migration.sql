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
--   • \d "ConsumerAssertion" shows columns id, userId, tradelineId, bureauScope,
--     assertionType, consumerNote, status, createdAt, withdrawnAt.
--   • `SELECT COUNT(*) FROM "ConsumerAssertion"` = 0.
--   • Indexes ConsumerAssertion_userId_tradelineId_status_idx and
--     ConsumerAssertion_tradelineId_status_idx exist.
--   • FKs ConsumerAssertion_userId_fkey and ConsumerAssertion_tradelineId_fkey
--     exist and are VALID.
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
-- item until its owner confirms a fact (app/api/letters/generate/route.ts).
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
    "tradelineId" TEXT NOT NULL,
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
-- Cascade, matching "Tradeline"'s own cascade from "User": an assertion is a
-- statement ABOUT one tradeline and is meaningless without it. This is consumer
-- content, not consent or billing evidence (contrast "TermsAcceptance", which is
-- ON DELETE RESTRICT deliberately). No application path hard-deletes a User
-- (scripts/consumer-deletion-containment.test.ts) and none deletes a Tradeline,
-- so both cascades are latent rather than routine.
ALTER TABLE "ConsumerAssertion" ADD CONSTRAINT "ConsumerAssertion_tradelineId_fkey" FOREIGN KEY ("tradelineId") REFERENCES "Tradeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
