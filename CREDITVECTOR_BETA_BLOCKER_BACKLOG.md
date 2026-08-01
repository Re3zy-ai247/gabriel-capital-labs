# CreditVector Beta Blocker Backlog

**Status:** NO-GO — Beta RC1 gates remain open

**Evidence date:** 2026-08-01

**Repository baseline:** `origin/main` at `f449c35d0eca9463c15e86f8cbd4cd7f4e948d03`

**Backlog counts:** P0 9 · P1 16 · P2 8 · P3 6

> Priority means launch consequence, not implementation order. A Preview, pushed review branch, or passing source guard does not close a blocker on production. Counsel and provider gates cannot be closed by an engineering report.

## P0 — prevents a protected external beta candidate

| ID | Blocker and evidence | Exit evidence | Owner / authority | Rollback or fail-closed rule |
|---|---|---|---|---|
| P0-01 | **Counsel and beta legal posture.** No recorded attorney approval covers the exact consumer beta, CROA/FCRA/state CSO posture, subscription/advance-fee treatment, data disclosures, or participant terms. | Written counsel decision tied to the exact beta scope, terms, privacy notice, acquisition model, claims, and cohort. | Counsel + Founder | Invite nobody; keep paid acquisition and excluded programs off. |
| P0-02 | **Legal identity and durable consent.** Exact main lacks the Founder-approved LLC/address. The isolated legal candidate exists, but registration has no durable versioned assent; Checkout consent is configuration-dependent; in-place paid upgrades bypass Checkout assent. | Founder-approved legal integration plus counsel-approved, versioned acceptance on every enabled acquisition/upgrade path. No inferred or backfilled assent. | Counsel + Founder + Engineering | Keep legal candidate isolated and charging disabled; revert only the bounded candidate if rejected. |
| P0-03 | **Supported framework/security baseline.** Exact main pins `next@14.2.18`, an unsupported major in the affected range of GHSA-wfc6-r584-vfw7. No production CDN mitigation was proved. | Dedicated supported-version candidate passes build, auth, cache, PWA, browser, accessibility, dependency, and rollback tests; production mitigation is independently verified if relied upon. | Engineering + Founder | Do not invite external users on an unsupported affected baseline; roll back exact dependency candidate if regressions appear. |
| P0-04 | **Applicable Auth.js availability advisory.** Exact main resolves vulnerable `next-auth@4.24.14` and calls `getToken()` without a catch. Source candidate `fix/beta-auth-security-nextauth-dos-rc1` at `5f2931e8…` pins 4.24.15 and adds the malformed-header regression; it is pushed, not integrated. | Independently approve and integrate the isolated candidate into the exact Beta lineage; repeat auth/session/build/browser tests and exact lock review. | Engineering | Revert the one candidate commit if auth behavior regresses; main remains blocked until integration. |
| P0-05 | **Human alert delivery.** Structured error reporting exists, but a monitored sink and successful human acknowledgement drill are unproved. | Trigger a non-customer synthetic failure; record delivery, acknowledgement time, owner, escalation, and no secret/PII leakage. | Founder + Provider + Operations | Stop invitations when material errors can be silent. |
| P0-06 | **Backup, restore, key recovery, RPO/RTO.** Provider guarantees, recoverable backup, isolated restore, encryption-key recovery, and measured RPO/RTO are unproved. | Identify provider and retention/PITR; restore into an isolated target; decrypt representative synthetic protected records; record RPO/RTO and key escrow owner. | Founder + Provider + Engineering | No beta data intake until recovery is proved; never test by mutating production. |
| P0-07 | **Legacy protected-data backfills.** Crypto is fail-closed for new data, but dual-read remains and production report/letter backfill completion is unknown. | Authorized dry-run/run evidence followed by a repeat run returning zero newly encrypted rows; exception count is zero or explicitly resolved. | Founder + Production access | Do not assume legacy plaintext is gone; do not alter schema as part of verification. |
| P0-08 | **Exact production configuration and schema truth.** Current migration relationship, hard-off flags, `SETUP_SECRET` absence, cron liveness, Stripe legal settings, webhook health, and branch protection are incomplete. | Presence/status-only signed ledger for every environment and provider; read-only migration preflight; exact SHA/check protection; no values or customer data in evidence. | Founder + Production/Provider access | Treat unknown as blocked; no environment, schema, Stripe, or alias mutation during verification. |
| P0-09 | **Authenticated release acceptance.** No exact-main, authenticated end-to-end desktop/mobile/Axe/reflow/performance matrix exists. | Controlled synthetic accounts complete signup/login/report/letter/response/support/recovery; zero Critical/High defects; accessibility, keyboard, mobile, reduced-motion, overflow, CLS, and long-task budgets pass. | Engineering + Founder | Do not substitute source inspection or anonymous probes for customer-journey evidence. |

## P1 — required before inviting external beta users

| ID | Engineering blocker | Current truth | Acceptance / tests | Branch family |
|---|---|---|---|---|
| P1-01 | Canonical registration password policy | Exact main accepts 8 characters. Source candidate `fix/beta-auth-security-password-policy-rc1` at `e1ded007…` reuses `lib/password.ts`; it is pushed, not integrated. | Independently approve/integrate into the Beta lineage; weak cases fail, valid case passes, auth/browser guards pass. | `fix/beta-auth-security-password-policy-rc1` |
| P1-02 | Session and reset hardening | Password reset/change does not revoke existing JWTs; reset-token read/consume is non-atomic; profile email password verification lacks a dedicated throttle. | Threat model, migration design if needed, concurrency test, session-revocation test, rate-limit test, rollback sequence. | `fix/beta-auth-security-*` |
| P1-03 | Registration destination and onboarding truth | Pricing supplies `next`, registration ignores it, and onboarding emits completion before the journey is complete. | Allowlisted redirect; real completion event; browser Back and malicious redirect tests. | `fix/beta-ux-*` |
| P1-04 | Upload and identity-file validation | Report and identity uploads trust incomplete MIME/extension signals; identity raw serving lacks attachment-equivalent sandbox/DENY controls. | Magic-byte validation before parsing/storage; safe disposition/headers; malformed/polyglot/oversize/ownership tests. | `fix/beta-credit-workflow-*` |
| P1-05 | Report prompt trust boundary | Raw report text lacks the repository's explicit untrusted-content fence. | Injection fixtures cannot override system instructions; structured source-only output and fallback remain. | `fix/beta-credit-workflow-*` |
| P1-06 | Response/strategist safety parity | Round-two and strategist paths lack consistent fencing and output compliance scrubbing. | Shared fence/scrubber contract; unsupported-claim fixtures; manual fallback; no data expansion. | `fix/beta-credit-workflow-*` |
| P1-07 | User-reported outcome truth | A user can set `RESOLVED`, affecting resolution views/metrics without evidence semantics. | Founder/compliance-approved label or transition/evidence rule; all derived metrics preserve “user-reported.” | `fix/beta-credit-workflow-*` |
| P1-08 | First-checkout Stripe-customer race | Concurrent customer creation can leave an unmapped Stripe customer/subscription. | Idempotent/keyed ownership strategy; concurrent integration test; repair and rollback runbook. | `fix/beta-billing-lifecycle-*` |
| P1-09 | Unknown-price fail-closed entitlement | Unknown active price can retain/receive premium via active subscription status. | Unknown price yields no paid entitlement, pages an operator, and preserves reconciliation evidence. | `fix/beta-billing-lifecycle-*` |
| P1-10 | Orphan subscription retry/repair | Missing User mapping is reported, then the webhook event can complete and stop retrying. | Event remains retryable or enters a durable repair state; test duplicate/reorder/recovery. | `fix/beta-billing-lifecycle-*` |
| P1-11 | Support attachment atomicity | Ticket/message can succeed after attachment storage fails, creating an undisclosed partial result. | All-or-explicit-partial contract; customer-visible receipt; rollback/orphan cleanup tests. | `fix/beta-support-*` |
| P1-12 | Product-health and logging honesty | Some query errors collapse to zero; centralized reporting is not universal. | Unknown/error is distinguishable from zero; material paths reach structured reporting without PII. | `fix/beta-recovery-monitoring-*` |
| P1-13 | Lifecycle notification and support SLA | No complete report/deadline/response/support lifecycle delivery exists; support response target is undefined. | Founder adopts in-app/manual beta agreement or implements bounded notifications; drill and owner rota pass. | Operations policy / `fix/beta-notifications-*` |
| P1-14 | Mobile and keyboard shell acceptance | 32 px controls and drawer Escape/focus/restoration gaps exist; authenticated device evidence is absent. | 44 px targets, deterministic drawer focus, Escape/restoration, 200% reflow, screen-reader and device matrix. | `fix/beta-mobile-accessibility-*` |
| P1-15 | Privacy rights and retention operation | Privacy points deletion requests to support, but no accepted DSAR/erasure/retention procedure is proved. | Counsel-approved procedure, identity verification, data map, exceptions, audit evidence, and response owner. | Counsel + Operations |
| P1-16 | Migration-first recovery-path drift | Vercel build is safe, but the Docker path runs `prisma db push`; governance docs retain stale no-op/self-heal statements. | Remove unsafe startup mutation; update canonical docs; container/build guards prove no DB mutation. | `fix/beta-schema-safety-*` |

## P2 — required before expanding the beta

| ID | Item | Expansion gate |
|---|---|---|
| P2-01 | Complete lifecycle notifications beyond the agreed manual/private-beta cadence | Delivery, unsubscribe, retry, privacy, and operator escalation are accepted. |
| P2-02 | Formal account/device/role policy | Concurrent-device and shared-account policy is measurable and supportable. |
| P2-03 | Product analytics and funnel instrumentation | Consent, minimization, data definitions, and error/unknown semantics are approved. |
| P2-04 | Wider noncritical route/device/accessibility regression suite | Representative authenticated coverage runs in required CI. |
| P2-05 | Application-wide CSP and formal penetration test | CSP rollout is compatible with Stripe/Next/PWA; independent findings are remediated. |
| P2-06 | MFA or equivalent step-up for privileged operators | Admin-risk model and recovery process are accepted. |
| P2-07 | Automated support tooling and measured SLA reporting | Automation cannot expose report contents or make unauthorized account changes. |
| P2-08 | Live billing lifecycle and customer communications, if charging expands | Dunning, receipts, tax/invoice identity, refunds, disputes, and notification ownership are provider-tested. |

## P3 — post-beta product expansion

| ID | Item | Boundary |
|---|---|---|
| P3-01 | External Agency onboarding and Agency Headquarters integration | Separate production-isolation and legal/authority review. |
| P3-02 | Community, Arena, and public professional identity/reputation | Separate privacy, moderation, reputation, and claims approval. |
| P3-03 | Growth Center, Growth Network, distribution, affiliates, credits, payouts | Separate economic constitution, counsel, provider, and production authorization. |
| P3-04 | Marketplace transactions | Separate seller/buyer, tax, refund, dispute, and provider architecture. |
| P3-05 | Autonomous Kai delegation or persistent external actions | Separate tool authority, confirmation, receipts, reversal, and audit architecture. |
| P3-06 | Public beta and scale expansion | Only after protected-cohort evidence, support capacity, incident history, and Founder authorization. |

## Closure rules

1. A blocker closes only on the branch or environment where its evidence applies.
2. A pushed candidate is **prepared**, not integrated; exact main and production remain blocked until separately authorized.
3. Provider, production, Founder, and counsel actions must retain their authority labels; engineering cannot mark them complete by inference.
4. Every code closure needs an exact parent/commit, bounded diff, tests, rollback note, and independent review.
5. No P0 may be waived silently. A Founder risk acceptance must be explicit, dated, bounded, and cannot substitute for counsel on a legal decision.

## Current decision

**P0 9 · P1 16 · P2 8 · P3 6. NO-GO.** The first safe source-only candidates are registration password-policy parity and the narrow Auth.js patch. Higher-risk auth, billing, schema, provider, consent, and legal closures remain separate workstreams.
