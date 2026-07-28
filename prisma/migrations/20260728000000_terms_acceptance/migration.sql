-- Terms-of-Service acceptance (B-06). ADDITIVE ONLY: 1 new table + 2 indexes +
-- 1 FK onto User. 0 DROP, 0 ALTER of an existing table, 0 data mutation.
--
-- PREFLIGHT (must all hold before this is applied):
--   • `SELECT to_regclass('"TermsAcceptance"')` returns NULL (table absent).
--   • `SELECT to_regclass('"User"')` is NOT NULL (FK target exists).
--   • The migration chain through 20260721160000_operator_reputation is applied.
--   • No build step runs migrations (scripts/schema-safety.test.ts pins this).
--
-- EXPECTED SQL EFFECT: one empty table appears. No existing row is read, written,
-- locked for write, or deleted. Old application code is unaffected by it.
--
-- FORWARD VALIDATION (after apply, read-only):
--   • \d "TermsAcceptance" shows columns id, userId, version, context, acceptedAt.
--   • `SELECT COUNT(*) FROM "TermsAcceptance"` = 0.
--   • Indexes TermsAcceptance_userId_version_key (UNIQUE) and
--     TermsAcceptance_userId_acceptedAt_idx exist.
--   • The FK TermsAcceptance_userId_fkey exists and is VALID.
--
-- ROLLBACK: `DROP TABLE "TermsAcceptance";` — safe ONLY while the table is empty
-- and the application code that writes it is not yet deployed. Once it holds
-- rows it holds consent evidence: do not drop it; roll back the APPLICATION
-- instead and leave the table in place.
--
-- DATA RISK: none at apply time. There is deliberately NO backfill statement in
-- this file. Existing paid subscribers never agreed to these terms, and writing a
-- row for them would manufacture a legal consent that did not happen.
--
-- APPLY: owner-gated release step (`prisma migrate deploy`), BEFORE the deploy of
-- the application code that reads this table. Never at build time.

-- CreateTable
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TermsAcceptance_userId_version_key" ON "TermsAcceptance"("userId", "version");

-- CreateIndex
CREATE INDEX "TermsAcceptance_userId_acceptedAt_idx" ON "TermsAcceptance"("userId", "acceptedAt");

-- AddForeignKey
-- ON DELETE RESTRICT, not CASCADE: Identity Constitution §12.3, §16 item 6 and the §18
-- Authority Matrix forbid erasure by foreign-key cascade. This refuses a raw User delete
-- (P2003) rather than silently destroying
-- consent evidence; it decides no retention period (§12.4 reserves those to counsel).
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
