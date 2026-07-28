# RUNBOOK — Database restore drill (B-09)

> **Status of the capability this runbook tests: NOT PROVEN.** No restore has ever been executed
> for CreditVector. This document is the procedure to *prove* it, not evidence that it works.
> **RC1 blocker B-09 stays OPEN until §6 is filled in with measured numbers.**
>
> **Two things are unknown and are NOT guessed anywhere below:**
> 1. **The origin Postgres provider.** `DATABASE_URL` is a Prisma Accelerate proxy
>    (`prisma+postgres://`), which hides it. Backup existence, retention, PITR granularity, and the
>    restore mechanism are all properties of that origin provider. §1 identifies it.
> 2. **Whether the post-restore migration repair works.** Production has no `_prisma_migrations`
>    history, so `prisma migrate deploy` alone is expected to fail on `0_init`. The repair path in §5
>    has never been executed against a real restore. Proving and timing it is a deliverable of this
>    drill, not an assumption of it.
>
> Anything this repository cannot assert is marked **VERIFICATION REQUIRED — PRODUCTION**.
> Where a provider-specific command would have to be invented, the runbook says so instead of
> printing a plausible-looking command. **A fabricated command in a recovery runbook is worse than
> a blank, because it will be trusted during an incident.**

Related: `OPERATIONS.md` → "Backup & Disaster Recovery" (scope + escrow checklist, V-03, V-10) ·
`.ai/RUNBOOKS/gate-d-production-migration.md` (§6 preflight, §8 baseline reconcile, §9 deploy) ·
`.ai/RUNBOOKS/schema-change.md` · `CLAUDE.md` gotcha 1 (MIGRATION-FIRST).

---

## 0. Preconditions

| # | Precondition | How to satisfy |
|---|---|---|
| P-1 | Owner (or a delegate with provider console access) is running the drill | Nobody else has the credentials |
| P-2 | A workstation with `node_modules` installed (`npm ci`) | `prisma db pull` / `migrate status` / `decryptText` all need it |
| P-3 | `DOCUMENT_ENCRYPTION_KEY` available to the drill shell | §4 is meaningless without it. Never paste it into a file that gets committed |
| P-4 | A scratch directory **outside the repo** for `.env` and evidence | e.g. `~/cv-restore-drill-<date>/`. Nothing from the drill enters git |
| P-5 | ~90 minutes uninterrupted, and a window where nobody is deploying | The drill must not race a release |

**Time budget is deliberately generous.** The first run is a discovery exercise. Do not compress it —
a rushed first drill produces an RTO number that is wrong in the optimistic direction, which is the
worst kind of wrong for a recovery target.

---

## 1. Provider identification (do this first — everything else branches on it)

**VERIFICATION REQUIRED — PRODUCTION.** This is blocker V-03 in `OPERATIONS.md`. Until it is
answered, §3 cannot start.

Look in these places, in this order, and stop at the first that gives a definite answer:

1. **Prisma Data Platform** (`console.prisma.io`) → the CreditVector project → **Accelerate** →
   the connection's **origin / underlying database**. If Prisma Postgres is the origin itself, the
   provider *is* Prisma and there is no third party — record that explicitly, it is a valid answer.
2. **Vercel** → Project → **Storage** and **Integrations**. A Neon / Supabase / Upstash / Vercel
   Postgres integration appears here with the store name and a link to its console.
3. **The provider consoles directly**, if the owner remembers signing up: Neon
   (`console.neon.tech`), Supabase (`supabase.com/dashboard`), Vercel Postgres, AWS RDS console.
   Presence of a project matching this database's size/age is corroborating, not conclusive.
4. **Billing evidence** — the owner's email/card statements for a database vendor charge. Weakest
   signal; use only to decide which console to open, never as the recorded answer.

**Record all of the following before continuing.** "I think it's Neon" is not a recorded answer.

```
Provider name (exact):                         ______________________
Console URL:                                   ______________________
Region:                                        ______________________
Plan / tier:                                   ______________________
Automated backups enabled?      YES / NO / UNKNOWN
Backup frequency (as the console states it):   ______________________
Retention window (days):                       ______________________
PITR available?                 YES / NO / UNKNOWN   granularity: ____
Direct (non-Accelerate) connection string available?  YES / NO
Who can create a restore/branch/fork? (roles)  ______________________
Recorded by / date:                            ______________________
```

> **If "Automated backups enabled" comes back NO or UNKNOWN, stop.** There is nothing to drill and
> the finding is more urgent than the drill: escalate to the owner as *"the system of record may have
> no backups"* and do not proceed until backups are confirmed on and have produced at least one
> snapshot. Do not substitute a manual `pg_dump` and call the capability proven — a one-off dump is
> not a backup regime, and recording it as one would be a false completion.

---

## 2. Pre-drill safety checklist — what must NOT be touched

Tick every box **out loud** before touching a console. This drill runs entirely against disposable
infrastructure; the production database is read-about, never written to.

- [ ] **NEVER drill against production.** No restore, no PITR "restore in place", no branch
      *promotion*, no schema command, no `migrate`, no `db push`, no `resolve` against the live
      database. If a provider's restore UI offers "restore into this database" and "restore into a
      new database", the only acceptable choice is **a new database**. If a provider offers *only*
      restore-in-place, **stop and escalate** — that is a finding to document, not a step to improvise.
- [ ] **Do not point the drill's `.env` at production.** The drill `DATABASE_URL` is the throwaway
      copy's direct URL and nothing else. Keep it in the scratch directory from P-4, never in the repo.
- [ ] **Do not change any Vercel env var.** The drill reads key material; it sets nothing.
- [ ] **Do not deploy, push, or merge during the drill.** A deploy mid-drill contaminates the RTO
      measurement and adds a second variable to any failure.
- [ ] **Do not run `prisma migrate` / `db push` / `resolve` in any shell whose `DATABASE_URL` you
      have not just re-read.** Print the *host* only to confirm — `node -e "console.log(new URL(process.env.DATABASE_URL).host)"` —
      never the whole string, which contains credentials.
- [ ] **No production PII leaves the drill.** §4 verifies decryption **without printing plaintext**.
      Record lengths and booleans, never contents.
- [ ] **No secret values in evidence.** Screenshots must not capture connection strings, keys, or
      `.env` contents. Redact before saving (§8).
- [ ] **Confirm the throwaway's identity before every destructive-sounding command** by re-reading
      the host, not by trusting shell history.
- [ ] **Tear-down is planned before start** (§7 / §3 step 8): know how you will delete the copy, and
      that deleting it costs nothing you need.

---

## 3. The drill

Start a wall clock at step 2 and do not stop it until step 6 completes — **that interval is the RTO
measurement**, and it must include the migration repair, because a database you cannot migrate is
not a recovered database.

**Step 1 — record the target.** In the provider console, find the most recent automated backup or
choose a PITR timestamp. Record the **snapshot timestamp (UTC)** and the **current UTC time**. Their
difference is the **RPO measurement** (§6) — it is a property of the backup regime, not of your speed.

**Step 2 — start the clock. Create a throwaway copy.**
**VERIFICATION REQUIRED — PRODUCTION.** The mechanism is provider-specific. The branch below is
unavoidable; each entry names *what to do in the console*, not a command this repo can guarantee:

| Provider family | Restore mechanism (confirm the exact wording in the console) | Produces |
|---|---|---|
| Neon | Create a **branch** from a timestamp / from the restore point | A new branch with its own connection string |
| Supabase | **Restore** a backup / PITR **into a new project** | A new project + connection string |
| Vercel Postgres | Restore/point-in-time into a **new store** | A new store + connection string |
| AWS RDS / Aurora | **Restore to point in time** → new instance/cluster | A new endpoint |
| Prisma Postgres | Whatever recovery/restore surface the console exposes — **record it verbatim** | — |
| Anything else | **Do not improvise.** Record the exact console flow as you discover it and add it to this table afterwards | — |

Whatever the flow, the invariants are: (a) the output is a **separate, new database**, (b) you can
obtain a **direct** Postgres connection string for it (not an Accelerate proxy URL), (c) production
was not modified. If any invariant fails, stop and escalate.

Record the **direct connection string's host only** in the evidence log. Never the full string.

**Step 3 — point a local shell at the copy.**

```bash
# In the scratch dir from P-4 — NOT in the repo.
cd ~/cv-restore-drill-<date>
printf 'DATABASE_URL=' > .env && cat >> .env    # paste the direct URL, then Ctrl-D. Never echo it.
chmod 600 .env
node -e 'console.log("host:", new URL(process.env.DATABASE_URL).host)'   # confirm it is the COPY
```

Prisma CLI commands below are run from the repo with this `.env` supplied explicitly
(`DATABASE_URL=... npx prisma ...` via the scratch env file), so the repo's own environment is never
edited. **Re-confirm the host before each Prisma command.**

**Step 4 — prove the schema arrived.**

```bash
npx prisma db pull --print > ~/cv-restore-drill-<date>/restored-schema.prisma
```

Compare against `prisma/schema.prisma`: every model in the repo schema should be present. Differences
are expected and informative — record them; they tell you what the snapshot predates. An **empty or
erroring** pull means the restore did not produce a usable database: stop, record, go to §7.

**Step 5 — prove the data arrived.** Row counts on the tables that matter, compared against
production's counts (read production counts from `/admin/overview` or the provider console **before**
the drill — never by connecting a drill shell to production).

```
User:                 restored ______  vs prod ______
Subscription/billing: restored ______  vs prod ______
Report:               restored ______  vs prod ______
Letter:               restored ______  vs prod ______
Document/Attachment:  restored ______  vs prod ______
StripeWebhookEvent:   restored ______  vs prod ______
```

A restored count slightly below prod is normal (snapshot age). A count of **zero** on a table prod
has rows in is a **failure**, not a rounding error.

> **HANDOFF — scripts owner (Agent 4 / `scripts/`).** This runbook deliberately writes no script.
> A `scripts/restore-verify.ts` would help here if it: (1) reads `DATABASE_URL` from the environment
> and prints the **host only**; (2) prints row counts for the tables listed above; (3) fetches exactly
> one `Report` with a `rawText` starting `cv1:` and reports `isEncryptedText === true`, decryption
> `ok/fail`, and the **plaintext length only**; (4) never prints plaintext, key material, or a
> connection string; (5) exits non-zero on any failure. Until such a script exists, run the steps by
> hand as written — do not invent one inside this runbook.

---

## 4. Post-restore integrity verification (this is the step that proves a real recovery)

Row counts prove bytes came back. They do **not** prove the data is *usable*. Every
`Report.rawText`, `Document`, and `Attachment` is AES-256-GCM ciphertext under
`DOCUMENT_ENCRYPTION_KEY` (`lib/docCrypto.ts`; encrypted values carry the `cv1:` prefix). If the key
is lost, the restore returns unreadable ciphertext and the data is gone anyway — **the restore
succeeds and the loss is total.** This step is the only one that proves **data and key were recovered
together.**

1. Select **one** `Report` from the restored copy whose `rawText` starts with `cv1:`.
   - If **no** row has the prefix, that is itself a finding: either the at-rest backfill (V-02) had
     not run at snapshot time, or the snapshot predates encryption. Record it and continue.
2. With `DOCUMENT_ENCRYPTION_KEY` present in the drill shell only, call `decryptText` from
   `lib/docCrypto.ts` on that value.
3. **Record only:** `decrypt ok? YES / NO`, plaintext **length**, and whether the first bytes look
   like credit-report text (a yes/no judgement made on screen, never written down).
   **Never print, paste, log, screenshot, or save the plaintext.** It is consumer credit PII. The
   drill's success criterion is "GCM auth tag verified and produced non-empty text", nothing more.
4. Repeat once for a `Document`/`Attachment` blob (`decryptDocument`), recording only `ok` + byte length.
5. Clear the key from the shell (`unset DOCUMENT_ENCRYPTION_KEY`) and close the session when done.

**A GCM authentication failure here is the loudest possible signal:** it means the key in hand is not
the key the data was written with. Stop the drill and escalate — that is a live, standing data-loss
exposure in production, independent of any restore.

Also verify, on the restored copy:

- [ ] A `User` row for the owner account exists with its `role`/entitlement intact.
- [ ] Stripe linkage columns are populated (customer/subscription ids present where expected) — a
      restore that loses billing linkage silently un-entitles paying customers.
- [ ] `StripeWebhookEvent` has rows (the idempotency ledger). Empty means replayed webhooks would be
      double-processed after a real recovery — record it as a recovery-time hazard.

---

## 5. Migration-history repair / baseline (unproven — this is the point of the drill)

**Why this is mandatory, not optional.** Schema is **MIGRATION-FIRST** (owner-ratified 2026-07-20,
`CLAUDE.md` gotcha 1). Runtime self-heal is legacy-only, guard-enforced by
`scripts/schema-safety.test.ts`, so **a restored database does not heal itself forward.** And no
deploy applies migrations — `vercel.json`'s build command is `prisma generate && next build`.
Production carries **no `_prisma_migrations` history** (the `resolve --applied 0_init` baseline was
applied to **preview only**), so a copy taken from production inherits that absence and
`prisma migrate deploy` is expected to **fail on `0_init`** because `0_init` would try to create
tables that already exist.

**Run every command below against the throwaway copy only. Re-confirm the host first.**

1. **Probe (read-only).** Record the exact output verbatim — this is evidence:
   ```bash
   npx --no-install prisma migrate status
   ```
   Expected on a prod-derived copy: no `_prisma_migrations` table, or all migrations reported as
   not-yet-applied. **Record what actually happens, including if it contradicts this expectation.**
2. **Decide the baseline set.** Every migration whose changes are *already physically present* in the
   restored database must be marked applied, not re-run. Determine this from step 4's schema diff —
   not from the migration directory listing, which says nothing about what the snapshot contains.
   Record the exact list before running anything.
3. **Baseline.** For each already-present migration, in chronological order:
   ```bash
   npx --no-install prisma migrate resolve --applied <exact-migration-directory-name>
   ```
   Follow `.ai/RUNBOOKS/gate-d-production-migration.md` §8 (schema-only reconciliation). Record each
   command and its output.
4. **Deploy the remainder.**
   ```bash
   npx --no-install prisma migrate deploy
   npx --no-install prisma migrate status     # must end: no pending migrations
   ```
5. **Re-run §4's spot checks** after the repair — a migration that rewrites a column can invalidate
   what you verified before it ran.

**If the repair fails**, that is the single most valuable output this drill can produce: it means a
real recovery would have stalled here at the worst possible moment. Capture the full error, stop the
clock, record the elapsed time as *"RTO not achieved — migration repair failed"*, and go to §7. **Do
not iterate blindly against the copy and then report the drill as passed** — record the number of
attempts and what finally worked, because that is the real RTO.

> **The corrected baseline procedure is a production change and is out of scope here.** Applying a
> `_prisma_migrations` baseline to *production* is a Gate D operation requiring owner approval per
> `.ai/RUNBOOKS/gate-d-production-migration.md`. This drill only learns whether the path works.

---

## 6. RPO / RTO measurement worksheet

Fill this in **from this drill's own measurements**. No example numbers appear here on purpose —
a placeholder number in a DR document becomes a quoted commitment.

```
DRILL RECORD
  Drill date (UTC):                        ____________________
  Run by:                                  ____________________
  Provider (from §1):                      ____________________
  Restore mechanism used:                  ____________________

RPO (data loss exposure)
  Snapshot / PITR timestamp (UTC):         ____________________
  Wall-clock at restore start (UTC):       ____________________
  Snapshot age = MEASURED RPO:             ____________________
  Provider's stated PITR granularity:      ____________________
  Worst-case RPO (= granularity, or backup interval if no PITR): ______

RTO (time to a usable system)
  T0  clock start (§3 step 2):             ____________________
  T1  copy provisioned / restore finished: ____________________
  T2  schema pull + row counts done:       ____________________
  T3  decrypt verification done:           ____________________
  T4  migration repair complete (§5):      ____________________
  MEASURED RTO = T4 − T0:                  ____________________
  Attempts needed for §5:                  ____________________
  Manual steps that blocked on a human:    ____________________

REAL-INCIDENT ADJUSTMENT (the drill is the optimistic case — say so)
  + detection time (how long before anyone notices):   ____________________
  + decision/authorization time:                       ____________________
  + cutover: repoint DATABASE_URL / Accelerate + redeploy: ____________________
  + post-cutover verification (prod-health, probes):   ____________________
  REALISTIC RTO:                                       ____________________

RESULT
  Drill outcome:   PASS / FAIL / PARTIAL
  Blocking findings:                       ____________________
  B-09 status after this drill:  OPEN (unmeasured) / CLOSED (measured above)
```

**Only after this worksheet is filled in** may `OPERATIONS.md` carry RPO/RTO numbers, and they must
be quoted as *measured on <date>*, never as targets someone chose.

---

## 7. Failed-drill and rollback procedure

The drill touches nothing in production, so "rollback" means *stop cleanly, lose nothing, and record
the failure honestly*.

1. **Stop the clock and record the failing step and its verbatim error.** Do not retry before
   recording — the first failure is the finding.
2. **Verify production is untouched:** `bash scripts/prod-health.sh` → all checks pass;
   `curl -sI https://www.creditvector.app/ | grep x-cv-release` unchanged. Confirm no Vercel env var
   changed and no deploy happened during the window.
3. **Delete the throwaway copy** in the provider console (branch/project/instance). Confirm it is
   gone — an orphaned copy of production is a standing PII exposure and a bill.
4. **Destroy the drill scratch material:** `shred -u ~/cv-restore-drill-<date>/.env` (or delete),
   remove `restored-schema.prisma` if it captured anything sensitive, clear shell history entries
   containing connection strings, `unset DOCUMENT_ENCRYPTION_KEY`.
5. **Record the failure class** and route it:
   | Failure | Means | Route to |
   |---|---|---|
   | No backups exist / retention shorter than believed | The system of record is unprotected | **Owner, immediately** — outranks the drill |
   | Restore produced no usable database | The backup regime is unproven in practice | Owner + provider support |
   | Row counts far below prod | Snapshot is stale or partial | Owner; re-check backup schedule |
   | Decrypt failed (§4) | Key/data mismatch — **live standing exposure** | **Owner, immediately** |
   | Migration repair failed (§5) | Recovery would stall; needs a worked-out baseline procedure | Engineering; ADR if the procedure must change |
   | Only restore-in-place available | Cannot drill safely at all | Owner — this is a provider-choice decision |
6. **B-09 remains OPEN.** A failed drill does not close the blocker; it sharpens it. Update
   `OPERATIONS.md` only with what was observed.

---

## 8. Incident evidence capture (what makes the drill auditable)

Save into the scratch directory, then move to the owner's password manager / private drive — **never
into this repository**, which is where a redaction slip becomes permanent.

- [ ] `§1` provider identification block, filled in, with the date and who recorded it.
- [ ] Screenshot: the provider's **backup/PITR settings page** showing retention and that backups are on.
- [ ] Screenshot: the **restore operation** (target selected + confirmation that a *new* database was created).
- [ ] Terminal transcript of §3–§5 — **redact connection strings and key material before saving.**
      Easiest safe habit: never print them; then there is nothing to redact.
- [ ] Verbatim output of both `prisma migrate status` runs (before and after repair).
- [ ] The row-count table (§3 step 5) with prod comparison figures.
- [ ] The §4 verification record: `decrypt ok?` + lengths only. **No plaintext, no ciphertext, no key.**
- [ ] The completed §6 worksheet.
- [ ] Screenshot: provider console **after tear-down**, showing the throwaway copy is deleted.
- [ ] `bash scripts/prod-health.sh` output from after the drill, proving production was unaffected.
- [ ] A one-paragraph plain-English narrative: what was learned, what surprised you, what would be
      slower or scarier at 3am during a real incident.

**Retention:** keep every drill record. The second drill's value is mostly in the diff against the
first — whether the repair path got faster, and whether anything silently changed under the product.
