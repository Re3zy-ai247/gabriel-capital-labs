# M2 — Launch-critical extraction merge (Wave 2 / S2)

Merges `launch/extraction-wave-2` → `main`. **44 files, +2893 −95.** Merge-base is `origin/main`
(`3a99430`) — conflict-free by construction.

## Contents (reviewed surface = `6479b60` + docs-only commits)

- **Terms B-06**: `TermsAcceptance` migration 7 (additive: 1 table + 2 indexes + 1 FK RESTRICT),
  `lib/terms.ts` fail-closed gate, 428 flow on in-place upgrades, `TermsAccept.tsx` + three wired
  callers, `STRIPE_TOS_CONSENT` wiring (fail-closed absent)
- **Legal / company identity**: `lib/companyIdentity.server.ts`, `app/legal/*`
- **Brief digest fixes** (`BRIEF_DIGEST_ENABLED`, D3-gated, stays unset)
- Gate D tooling C1 (7-migration chain) + guard tests
- Launch docs (Command Center, Gate D completion report, checkpoints)

## Reviews & evidence

- CCO compliance: **GO-WITH-CHANGES — applied** · Opus integration: **READY-PENDING-GATES — Gate D
  completed 2026-08-06T11:13Z**
- CI green at tip: verify ✅ gate-d-preflight ✅ preview ✅
- §6 suite on tip: tsc 0 · build 0 · terms 78/0 · checkout-consent 12/0 · schema-safety 17/0 ·
  preflight 105/0 · runtime guards 5/0
- §1.5 lockstep: `migrate diff` schema↔migrations → no difference
- Terms migration applied + §5 forward-validated **before** this merge (runbook
  `.ai/RUNBOOKS/migration-apply-terms-acceptance.md`)

## Deploy semantics

**Merging this PR deploys production** (~2 min). It is the LAST step of the terms runbook — merge
only after §5 validation passed and AP-M2-2 is granted. Rollback: `git revert` the merge + redeploy
(§9.1); never drop the table once rows exist.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
