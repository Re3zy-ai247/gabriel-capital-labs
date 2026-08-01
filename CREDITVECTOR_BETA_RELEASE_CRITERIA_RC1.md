# CreditVector Beta Release Criteria RC1

**Status:** NO-GO — protected Beta RC1 is not yet authorized

**Evidence date:** 2026-08-01

**Repository:** `gabriel-capital-labs`

**Authoritative source baseline:** `origin/main` at `f449c35d0eca9463c15e86f8cbd4cd7f4e948d03`

**Production release observed:** `f449c35d0eca` at `https://www.creditvector.app`

**Readiness branch:** `review/creditvector-beta-readiness-rc1`

> This is an engineering and operational readiness record, not legal advice, counsel approval, merge approval, production-deployment approval, payment activation, or beta-launch authorization.

## Executive verdict

CreditVector has a substantial, working consumer-credit product and strong deterministic controls, but exact-main evidence does not support inviting external beta users yet. The blocking gaps are concentrated in legal/consent coverage, supported-framework security, recoverability, human alert delivery, protected-data backfill proof, exact production configuration/schema proof, and authenticated end-to-end acceptance.

The correct target is a narrow, invite-only, self-service consumer beta. Agency, Community, Arena, Growth, Marketplace, physical mail, autonomous Kai actions, and economic programs do not become Beta Required merely because source or Preview work exists. An internal engineering Preview with synthetic data is not a beta launch and does not close participant-facing gates.

## Repository and deployment identity

| Item | Verified truth |
|---|---|
| Production branch baseline | `origin/main` = `f449c35d0eca9463c15e86f8cbd4cd7f4e948d03`; no drift after fresh fetch |
| Production alias | `https://www.creditvector.app`; HTTP 200; `x-cv-release: f449c35d0eca` observed before and after review-branch activity |
| Legal identity candidate | `fix/company-legal-identity-isolated-rc1` at `73483c9db40031f39023320bd4f6bef61c6e00eb`; exact parent is production baseline |
| Legal protected Preview | `https://gabriel-capital-labs-5drkr6w93-rey-gabriel-s-projects.vercel.app`; GitHub deployment `5707811905`; Preview paths redirect anonymously to Vercel SSO with `noindex` |
| Password-policy candidate | `fix/beta-auth-security-password-policy-rc1` at `e1ded00768ea483afe1f8447fa647fe1a5640773`; exact main parent; pushed, not integrated; GitHub CI passes; protected Preview `https://gabriel-capital-labs-gpph0y5lt-rey-gabriel-s-projects.vercel.app` |
| Auth.js patch candidate | `fix/beta-auth-security-nextauth-dos-rc1` at `5f2931e81810c5078cd894d8ec9a90c66d47bac4`; exact main parent; pushed, not integrated; patches 4.24.14 to 4.24.15; protected Preview `https://gabriel-capital-labs-4kov4ploi-rey-gabriel-s-projects.vercel.app` |
| Growth remediation evidence | `review/growth-experience-phase-1b-remediation-rc1` at `b913e50f3f2f4c5268c878505aaa31c1882cf92a`; protected Preview exists |
| Growth lineage warning | Growth branch is 67 commits ahead of main and spans 199 cumulative files; it is review evidence only and must not be merged wholesale |
| Dirty historical source | `feat/cxos-phase3` remains a multi-stream dirty worktree and is not a release candidate |

## Strict Beta RC1 scope

### Beta Required

1. Invite-only account creation, secure login, password recovery, account disablement, and support escalation.
2. A Founder-approved beta entitlement path that does not accidentally create or replace a paid subscription.
3. Own-data-only report intake with server-side file validation, encryption, parsing, honest failure recovery, and verified legacy backfill completion.
4. Bureau/tradeline display that distinguishes source facts, unknowns, recommendations, and user-entered status.
5. User-controlled dispute preparation, recipient review, letter generation, download/print, and no outcome guarantee.
6. Response upload/entry, analysis, follow-up, and task status with explicit truth labels.
7. Kai assistance only where deterministic or safely model-backed; no autonomous customer, calendar, task, billing, mail, or legal action.
8. Terms/Privacy/legal identity and durable acceptance coverage for every enabled acquisition or paid-upgrade path.
9. Production-realistic monitoring, human alert delivery, backup/restore, key recovery, incident response, and rollback proof.
10. Authenticated desktop/mobile/keyboard/reflow/reduced-motion/accessibility/performance acceptance.
11. A named beta support owner, response target, incident channel, participant notice process, and data-reset policy.
12. Exact production identity, environment-presence, schema/migration, Stripe/webhook, cron, and hard-off feature verification before invitations.

### Beta Allowed Dormant

- Agency Headquarters/CXOS review rooms and historical feature branches.
- Operator Identity, Membership, Organization, and Reputation contracts that are not production-integrated.
- Community, Arena, Growth Center, Growth Network, Marketplace, and advanced meetings unless separately gated away from beta participants.
- Physical mail provider execution (`MAIL_LIVE` remains hard-off).
- Event Fabric, Growth economics, payouts, credits, affiliate/referral money movement, and distribution programs.
- Advanced lifecycle notifications beyond an explicit in-app/manual beta-support agreement.

### Post-Beta

- Public beta, self-serve external Agency onboarding, Marketplace transactions, public professional profiles, economic activation, autonomous Kai delegation, full analytics instrumentation, formal certification programs, and scale expansion.

## Blocking gates

| Gate | Current evidence | Exit criterion | Authority |
|---|---|---|---|
| BETA-G01 Legal and counsel | No counsel approval is recorded; legal identity is isolated but unmerged | Counsel signs off on CROA/FCRA/subscription/state-CSO/news posture and beta participant terms; legal candidate separately approved for integration | Counsel + Founder |
| BETA-G02 Terms/consent | New Checkout consent is opt-in; in-place upgrade bypass is source-recorded | Durable versioned acceptance covers registration/paid acquisition and every paid upgrade, including in-place replacement; no acceptance backfill without policy | Counsel + Founder + Engineering |
| BETA-G03 Framework security | `next@14.2.18` is unsupported and inside the affected range of GHSA-wfc6-r584-vfw7 | Dedicated supported-version migration passes full guards, build, browser, cache, auth, PWA, and rollback tests | Engineering |
| BETA-G04 Auth.js request hardening | Lock resolves `next-auth@4.24.14`; unwrapped `getToken()` use meets GHSA-xmf8-cvqr-rfgj applicability conditions | Patched `4.24.15` candidate or fail-closed workaround passes malformed-header, auth, session, build, and browser regressions | Engineering |
| BETA-G05 Human alerting | `reportError` exists, but delivery is recorded unproved | A monitored sink is configured and a real test alert is received, acknowledged, and documented | Founder + Provider |
| BETA-G06 Backup/restore | Origin provider, RPO/RTO, key escrow, and restore drill are unproved | Provider identified; backups/PITR verified; isolated restore succeeds; representative encrypted data decrypts; measured RPO/RTO recorded | Founder + Provider + Engineering |
| BETA-G07 Encryption completion | Dual-read supports legacy plaintext; backfill run status is unknown | Report and Letter backfills return zero newly encrypted rows on a repeated run; key recovery location is confirmed outside the deployment provider | Founder + Production access |
| BETA-G08 Production truth | Schema history, hard-off flags, `SETUP_SECRET` absence, cron liveness, Stripe settings, and webhook health are incomplete | Signed evidence ledger captures presence/status only, never values; no shared Preview/Production mutation during verification | Founder + Production access |
| BETA-G09 End-to-end acceptance | No exact-baseline authenticated browser/Axe/device/performance matrix exists | Two controlled accounts complete the required journey across desktop/mobile; zero Critical/High functional, security, a11y, or payment defects | Engineering + Founder |

## Required test accounts

| Account | Purpose | Data rule |
|---|---|---|
| Consumer A — clean start | signup, onboarding, report intake, first letter, response, support | synthetic identity/report only; reset by documented deletion procedure |
| Consumer B — returning | login, persisted data, cancellation/recovery, second session/device | synthetic data; no shared credentials |
| Admin/support | invitation, diagnostics, support response, suspension, audit evidence | named operator; no impersonation used as proof of customer behavior |
| Stripe test-mode customer | checkout/upgrade/cancel/failure/webhook matrix | test mode only until separate live-billing authorization |

## Data-reset policy

- Beta fixtures and uploads must be synthetic unless the participant gives documented, purpose-specific consent.
- Never reset or delete production customer data as part of a test.
- Every destructive beta reset needs an exact subject, preview/dry-run where available, audit evidence, and rollback or retained export.
- A test account reset cannot be used as proof that DSAR, retention, or production erasure is complete.

## Support and incident plan

- Name one accountable support owner and one backup before invitations.
- Publish an in-beta response target and escalation path; do not imply 24/7 coverage unless staffed.
- Route security, billing, data-loss, and legal reports into a monitored human channel.
- Capture `x-cv-release`, request ID, affected account ID, route, time, and safe reproduction steps; never capture report contents or secrets in chat/tickets.
- Severity 0/1 events stop invitations and trigger rollback/disablement assessment.
- Participant notices require Founder/compliance approval and must state known facts only.

## Rollback plan

1. Stop new invitations and disable the beta entry path without changing historical customer data.
2. Roll back only the exact candidate deployment to the last verified production deployment.
3. Do not roll back schema independently of code; follow migration forward/rollback sequencing.
4. Keep billing, mail, Growth economics, and provider actions hard-off unless the incident owner explicitly authorizes an action.
5. Verify public alias release SHA, auth gates, health/readiness, protected APIs, Stripe webhook response shape, and data integrity after rollback.
6. Preserve incident evidence and document customer impact before resuming.

## Acceptance checklist

- [ ] All nine blocking gates are closed with dated evidence.
- [ ] P0 count is zero; no open Critical or High finding is waived by an engineering report.
- [ ] Legal identity candidate has separate Founder integration approval.
- [ ] Counsel decisions are attached or referenced without exposing privileged material.
- [ ] Supported Next.js version and exact lockfile have a clean security review.
- [ ] Auth.js is patched or explicitly fail-closed against malformed Bearer values.
- [ ] Required CI checks are branch-protected and passing on the exact candidate SHA.
- [ ] Production build contains no database mutation.
- [ ] Migration manifest and production schema relationship are verified without applying a migration.
- [ ] `SETUP_SECRET` is absent from every relevant environment.
- [ ] Legacy encryption backfills and key recovery are proven.
- [ ] Alert delivery and cron liveness are proven separately.
- [ ] Restore drill and measured RPO/RTO are complete.
- [ ] New account, login, report, letter, response, support, and recovery journeys pass.
- [ ] Paid paths are test-mode-only or separately authorized and consent-complete.
- [ ] Unknown Stripe price/customer mapping fails closed.
- [ ] Zero cross-tenant disclosure or mutation is observed.
- [ ] Zero automated Axe Critical/Serious violations in sampled states.
- [ ] Keyboard, focus, 200% reflow, reduced motion, and screen-reader landmarks pass.
- [ ] Zero horizontal overflow; measured CLS/long-task results are recorded.
- [ ] Founder signs the exact candidate, cohort size, support plan, and invitation date.

## Launch-day checklist

- Confirm exact candidate SHA and production alias SHA.
- Confirm required checks, deployment protection, hard-off flags, environment presence, and no secret values in evidence.
- Confirm monitored support/incident staff and rollback operator are available.
- Confirm first cohort and synthetic-data guidance.
- Run public/auth/admin/webhook no-effect probes.
- Invite only the approved count; observe the first full journey before the next invitation.

## Post-launch observation plan

- First 2 hours: release skew, auth failures, report ingestion, encryption errors, support queue, Stripe/webhook anomalies, and human alert delivery.
- First 24 hours: journey completion, error rate, support themes, accessibility failures, email delivery, cron results, and data-integrity exceptions.
- First 7 days: retention and abandonment using measured events only; no fabricated success metrics.
- Any Critical/High security, legal, money, authorization, or data-loss event pauses invitations.

## Decision

**NO-GO for Beta RC1 today.** A Conditional Go becomes possible only after all P0 gates close and the exact candidate completes authenticated acceptance. Beta readiness is not beta-launch authorization, Preview approval is not production integration approval, and no historical feature branch may be merged wholesale.

## External primary references

- Next.js support policy: https://nextjs.org/support-policy
- Next.js advisory GHSA-wfc6-r584-vfw7: https://github.com/vercel/next.js/security/advisories/GHSA-wfc6-r584-vfw7
- Auth.js advisory GHSA-xmf8-cvqr-rfgj: https://github.com/advisories/GHSA-xmf8-cvqr-rfgj
