# M2 Plan — Adversarial Review Findings Register

**Date:** 2026-08-06 · **Verdict on the plan: ❌ NOT EXECUTION-READY — revise before any Founder session**
**Panel:** 3 independent Opus lenses (migration-order · billing-safety · process-security) → per-finding
adversarial verification. **33 findings raised · 10 adjudicated (3 CONFIRMED, 7 REFUTED) ·
23 unadjudicated** — verification stopped mid-flight by the safe-pause directive.
Raw output (full claims + fixes + verdict reasoning): `Gabriel-Capital-Labs-AIOS/gate-d-backups/20260806T012051Z/m2-plan-review-raw.json`

The review target was `.ai/M2-EXECUTION-PLAN-2026-08-06.md` as first drafted. This register mirrors the
project's standing pattern: blinded adversarial review keeps finding what self-review misses.

## CONFIRMED (fold into the revision — mandatory)

| # | Sev | Finding | Required fix |
|---|---|---|---|
| C1 | BLOCKER | **F5 (`STRIPE_TOS_CONSENT=1`) scheduled in the same 24h window as the merge.** The flag drives Stripe `consent_collection` in checkout/webhook — unrelated to the terms gate. Flipping it same-day confounds §10 monitoring, whose primary failure signal is 500s on the checkout route. | F5 moves OUT of the merge+monitoring window: earliest **+24h after a clean §10 window**, with its own Dashboard-URL verification first. Never same-day. |
| C2 | HIGH | **D2 (test account) resolved after the point of no return.** AP-M2-1/2 gate before Group G; if no test account exists post-merge, smoke 8.2–8.5 can't run and the revenue path ships unverified. | D2 becomes a **pre-session prerequisite**: the session does not start until the Founder names the account. |
| C3 | HIGH | *(verified against `git diff`)* — see raw JSON, verdict 3: the migration/diff citation drift class — plan §2 numbers must be regenerated from the tip actually merged, at session time, not quoted from an earlier state. | Re-derive all diff/coverage numbers on the exact merge candidate SHA in the session itself. |

## BLOCKER-severity, unadjudicated — treat as ACCEPTED pending re-verification (conservative)

| # | Sev | Finding | Provisional fix for the revision |
|---|---|---|---|
| B1 | BLOCKER | **Apply runs with zero database-identity evidence** (raised independently by two lenses): plan replaced Gate D's §5 fingerprint + §6 exhaustive preflight with grammar-only URL validation + `migrate status`. Every downstream check is target-blind. | Group B becomes: `--observe-fingerprint` → programmatic compare vs the Gate D-approved value (from `fingerprint-observation-2.json`, never transcribed) → seal → **full 7-chain preflight** (C1 tooling is on the branch) expecting `pendingDeployList == ["20260728000000_terms_acceptance"]` exactly → then `migrate status` cross-check. |
| B2 | HIGH | **The Gate D dump predates the Gate D migrations** (10:01Z dump vs 11:06–11:13Z resolve+deploy). It contains neither the operator tables nor `_prisma_migrations`. As an M2 recovery position it is invalid — restoring it would erase Gate D. | D1 is no longer a choice: **a fresh dump at session time is MANDATORY** (proven procedure, ~2 min). The Gate D dump is retained as the pre-Gate-D archive only. |

## Other unadjudicated findings worth carrying into the revision (selection)

- Validated-commit ≠ deployed-commit: the merge commit must be what §6 validation ran on (fast-forward
  merge, or re-run validation on the merge SHA before deploy).
- §9.1 revert nuance: reverting the merge also removes migration 7 from the repo while it stays applied
  in the DB — document the expected post-revert `migrate status` so drift isn't misread as an incident.
- Group A ordering must be written explicitly as **read → export → validate → seal** (I-3 class).
- Groups B/E/G need the `DATABASE_URL="$GATE_D_DATABASE_URL"` prefix + `npx --no-install` pin spelled
  per-command, and §5 forward validation needs its execution mechanism named (psql via the pinned
  `postgres:17` image, same as Gate D probes).
- Smoke 8.3 mutates a real Stripe subscription — give it its own mini approval inside Group G.
- AP-M2-1 must be granted **before** the credential is pasted (precondition 1.1 ordering).

Full text of all 33 (claims, fixes, refutation reasoning) is in the raw JSON. The 7 refuted findings
are recorded there too — do not re-raise them without new evidence.

## Disposition

The plan file `.ai/M2-EXECUTION-PLAN-2026-08-06.md` is stamped **BLOCKED — REVISION REQUIRED**.
Next session's first step: fold C1–C3 + B1–B2 + the carry-ins into a v2 plan, adjudicate the remaining
23 findings (or accept conservatively where cheap), THEN schedule the Founder session.
