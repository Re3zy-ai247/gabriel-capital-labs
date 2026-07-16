# CreditVector — Release Candidate 1 (RC1) Executive Readiness Plan

**Prepared by:** CTO review · **Date:** 2026-07-15 · **Scope:** commercial launch of the existing
CreditVector consumer app (LIVE at creditvector.app, live Stripe). **No code written.**

> **The one question this answers:** *"If we wanted to launch CreditVector commercially, what still
> stands in our way?"*
>
> **Answer — four hard gates, in order:** (1) **outside-counsel sign-off** on CROA/FCRA positioning
> (owner action, no code); (2) **production observability** (error tracking + alerting — today we
> operate blind); (3) a **CI safety gate + Vercel Pro** (a bad push currently auto-deploys to prod);
> (4) a **verified backup + tested restore + DR runbook**. Everything else is polish or post-launch.
>
> **Honesty rules:** conservative, no optimism. No fabricated metrics — where ground truth is
> unknown it is marked **NEEDS CONFIRMATION**, not guessed. The GIOS kernel work is **dormant
> (flag-off, no route flipped)** and is **NOT on the launch path** — it neither helps nor blocks RC1.

---

## CreditVector Production Readiness Score: **57 / 100** — *"functionally live, not launch-hardened"*

**Build-readiness 57/100** (weighted mean below). **Launch-readiness = BLOCKED** until the 4 P0
gates clear — a numeric average cannot override a single unresolved *legal* blocker + operating in
prod without observability. The product is strong; the *operations, legal, and safety-net* around it
are not yet at commercial-launch standard.

**Method (transparent, not fabricated):** each category scored 0–100% on evidence in the repo;
weighted 3 (launch-critical) / 2 (important) / 1 (standard); score = Σ(weight×%)/Σweight = 4582/81 =
**56.6 → 57**. Percentages are conservative; ops/DR/monitoring reflect *confirmed absence*, not pessimism.

---

## Category assessment (Current Status · % · Prod Risk · Severity · Dependencies · Eng Time · Priority)

| Category | Current status (evidence) | % | Prod risk | Sev | Dependencies | Eng time | Priority |
|---|---|--:|---|---|---|---|---|
| **Legal (counsel sign-off)** | ToS/Privacy pages live; **CROA/FCRA/news positioning NOT counsel-signed** (owner action open). | 30 | Launching a credit product without counsel = existential | **P0** | outside counsel | 0 eng (external) | **P0** |
| **Compliance (controls in code)** | `lib/compliance` CROA scrubber on letters/Kai/Brief; educational posture; CCO gate exists. | 65 | Copy/AI could drift out of posture | High | Legal sign-off | 1–2 d | P0 |
| **CROA** | Bar enforced (no guarantees/§609 myths); scrubber + copy. Sign-off pending. | 60 | CROA is the top consumer-credit legal risk | **P0** | counsel | — | P0 |
| **FCRA** | Dispute/accuracy framing careful; §605/§611 handled. Counsel review pending. | 65 | Misstatement of dispute mechanics | High | counsel | — | P1 |
| **GLBA** | PII encrypted (AES-256-GCM, 20 sites); access-controlled. **No formal Safeguards program / secure-disposal policy.** | 55 | Safeguards Rule gap | High | policy + review | 3–5 d | P1 |
| **Security** | PII encryption, tenant isolation, prompt-injection hardened, rate-limit **13/108 routes** (fail-open). **No pen test, no security monitoring, secrets in env (28).** | 68 | Unaudited attack surface | High | pen test, secrets mgmt | 3–5 d | P1 |
| **Authentication** | NextAuth JWT (email/username), password reset live, rate-limited. **No MFA, no account lockout, no session revocation.** | 72 | Credential attacks; no MFA | High | — | 2–3 d | P1 |
| **Billing** | Stripe **LIVE**, webhooks verified, idempotent credits, real MRR. **Only 3/7 tiers have live checkout; dunning/failed-payment partial.** | 80 | Revenue leakage on edge cases | Med | Stripe dunning config | 2–3 d | P1 |
| **Subscription management** | Checkout/portal/cancel, agency tiers. **Self-serve up/downgrade + refund automation partial.** | 70 | Support load; involuntary churn | Med | Billing | 2–3 d | P2 |
| **Email deliverability** | Resend, domain verified, sends live. **"Warming"; no DMARC/bounce/complaint loop; `COMPANY_POSTAL_ADDRESS` unset (digest blocked).** | 55 | Deliverability collapse at volume | High | DNS (DMARC), owner env | 1–2 d | P1 |
| **Physical mail** | `lib/mail/` pipeline built, **dry-run only, MAIL_LIVE OFF, LetterStream not wired, no CSO/CCO sign-off.** | 25 | N/A if RC1 = self-mail | Low | **defer post-launch** | — | P3 |
| **Audit trail** | Admin `AdminAuditLog` + `KaiEvents`; GIOS durable audit **dormant**. **Not comprehensive/tamper-proof.** | 60 | Forensic/compliance gaps | Med | — | 2–3 d | P2 |
| **AI engine** | Opus 4.8, cost metering (`aiMeter`), injection-hardened, fail-open. **No eval suite, no output monitoring, cost caps partial.** | 72 | Bad output / runaway cost | Med | eval harness | 3–5 d | P2 |
| **Dispute engine** | Mature, case-law grounded, byte-identical kernel-wrapped. | 85 | Low | Low | — | — | P3 |
| **Investigation engine (§605)** | Deterministic obsolescence, guard-tested. | 80 | Low | Low | — | — | P3 |
| **Hard inquiry engine** | Inquiry disputes woven into parse/letter flow; **no dedicated engine/validation.** | 40 | Feature gap, not a blocker | Low | — | 3–5 d | P2 |
| **Letter generation** | Mature, compliance-scrubbed, recipient-differentiated. | 85 | Low | Low | counsel (content) | — | P3 |
| **Consumer portal** | Extensive, multiple UX/a11y passes. | 82 | Low | Low | — | — | P3 |
| **Admin portal** | Users/billing/compliance/audit/analytics. | 80 | Low | Low | — | — | P3 |
| **Analytics** | Admin overview/MRR/churn/product-health. **No product funnel/retention analytics.** | 55 | Blind to conversion/retention | Med | analytics tool | 2 d | P2 |
| **Monitoring** | **NONE.** No APM/error-tracking (no Sentry/etc.); only `console` + `x-cv-release` header. | 15 | **Operate blind; silent failures** | **P0** | Sentry/APM wiring | 1–2 d | **P0** |
| **Logging** | `console.error` + Vercel logs. **No structured logging/aggregation/retention.** | 35 | Cannot debug prod incidents | High | log pipeline | 1–2 d | P1 |
| **Disaster recovery** | **No owned RPO/RTO, no tested restore, no runbook.** DB backup depends on managed provider (**NEEDS CONFIRMATION**). | 20 | Unquantified data-loss risk | **P0** | DB provider, restore test | 1–2 d | **P0** |
| **Backup strategy** | Managed provider *likely* auto-backs-up; **not owned/verified; no restore drill.** | 25 | Cannot prove recoverability | **P0** | DB provider | 1 d | **P0** |
| **Performance** | GIOS kernel measured (dormant). **App not load-tested; no APM/p95 SLO.** Static/CDN good. | 45 | Unknown behavior under load | Med | monitoring, load test | 2–3 d | P2 |
| **Testing** | **32 guard scripts** (logic). **No unit framework, no coverage %, no E2E/integration, not CI-enforced.** | 45 | Regressions reach prod | High | CI, E2E | 3–5 d | P1 |
| **CI/CD** | Vercel auto-deploy (CD ok). **NO CI — no automated gate before deploy; skew protection blocked (Hobby).** | 35 | **Bad push → prod** | **P0** | GitHub Actions, Vercel Pro | 1 d | **P0** |
| **Documentation** | Exceptional — `.ai/` + `architecture/` + 28 ADRs + runbooks. | 90 | Low (strength) | Low | — | — | P3 |
| **Developer experience** | Good docs, typed, guard scripts. No local DB; manual test runs. | 80 | Low | Low | — | — | P3 |
| **Accessibility** | Multiple WCAG passes (contrast/focus/targets). **Not audited/certified.** | 65 | ADA exposure | Med | a11y audit | 2–3 d | P2 |
| **Mobile** | PWA, responsive, mobile nav. **No device-matrix test.** | 70 | Med | Low | — | 1–2 d | P2 |
| **Scalability** | Serverless auto-scale + Accelerate pooling. **Risks: self-heal DDL on hot paths, per-query Accelerate cost, no load test.** | 62 | Cost/latency spikes at scale | Med | load test | 2–3 d | P2 |
| **API** | Internal routes 401-gated. **No public API/versioning; rate-limit 12%.** | 55 | Abuse on unguarded routes | Med | rate-limit sweep | 1–2 d | P1 |
| **Database** | Postgres/Accelerate, PII encrypted. **Schema via runtime self-heal (db push silently fails) — migration risk; no owned backup.** | 60 | Silent schema drift; data loss | High | backup, migration discipline | 2–3 d | P1 |
| **Privacy** | PII encrypted, tenant-scoped, SSN never stored. **No retention policy, DSAR process, DPA, cookie-consent audit.** | 60 | CCPA/CPRA exposure | High | policy + counsel | 3–5 d | P1 |
| **Infrastructure** | Vercel serverless (solid). **Hobby plan (skew protection blocked); no IaC.** | 70 | Deploy skew; plan limits | Med | Vercel Pro | 0.5 d | P1 |
| **SOC2 readiness** | **Not started** — no controls program/auditor/evidence. | 5 | Blocks enterprise, **not** consumer launch | Low | **defer** | months | P3 |
| **Incident response** | `OPERATIONS.md` triage + rollback documented. **Not drilled; no on-call/alerting.** | 45 | Slow/again-blind response | High | monitoring, alerting | 1–2 d | P1 |

---

## Release Critical Path — shortest path from today to ship

**RC1 scope decision (CTO recommendation):** launch as a **self-mail consumer product**. Defer
*physical-mail-as-a-service* (MAIL_LIVE + LetterStream + CSO/CCO) and *enterprise/SOC2* to post-RC1.
This removes ~2 heavy categories from the launch path.

### P0 — Launch blockers (must clear; ranked)
| # | Task | Biz value | Eng cost | Risk↓ | Launch impact | Rev impact | Cust impact | Duration | Depends on |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Outside-counsel sign-off** (CROA/FCRA posture, news/defamation, ToS/Privacy/refund) | Critical | 0 (external) | Very high | **Gate** | Enables | Trust | 1–3 wk (external) | counsel engaged |
| 2 | **Production monitoring + error tracking + alerting** (APM/Sentry-class) | High | Low | Very high | Enables safe ops | Indirect | Fewer silent failures | 1–2 d | infra |
| 3 | **CI gate** (guards+typecheck+build on push) **+ Vercel Pro** (skew protection) | High | Low | High | Prevents bad-push outage | Indirect | Uptime | 1 d + owner $20/mo | GitHub Actions |
| 4 | **Verified backup + tested restore + DR runbook** (confirm provider, do a restore drill, document RPO/RTO) | High | Low | Very high | Prevents catastrophic loss | Protects | Data safety | 1–2 d | **confirm DB provider** |
| 5 | **Owner actions**: `COMPANY_POSTAL_ADDRESS`, run encrypt backfills, enable Stripe customer receipts | Med | ~0 | Med | Unblocks digest + receipts | Small | Comms | <1 d | owner |

### P1 — Launch-hardening (strongly recommended before commercial scale)
| Task | Duration | Why |
|---|--:|---|
| Structured logging + core dashboards (error rate, payment failures, uptime) | 1–2 d | Debuggability + incident response |
| Auth hardening (MFA option, account lockout, session revocation) | 2–3 d | Credential-attack resistance |
| Security pass (dependency audit, secrets rotation, auth/billing pen test) | 3–5 d | Unaudited surface |
| Email deliverability (DMARC, bounce/complaint handling) | 1–2 d | Deliverability at volume |
| Rate-limit sweep to all mutating/AI/auth routes (currently 12%) | 1–2 d | Abuse/cost control |
| Billing edge cases (dunning, failed-payment recovery, refund policy) | 2–3 d | Revenue leakage |
| Privacy program (retention policy, DSAR flow, cookie consent, DPA) | 3–5 d | CCPA/CPRA |
| CI-enforced test expansion (a few E2E smoke tests on signup/upload/letter/checkout) | 3–5 d | Regression safety |
| Database migration discipline (own the schema path off silent `db push`) | 2–3 d | Schema-drift risk |

### P2 — Post-launch fast-follow · P3 — Deferred
- **P2:** product analytics (funnel/retention) · load/scale test · a11y audit · AI eval + output monitoring · comprehensive audit trail · hard-inquiry engine · mobile device-matrix.
- **P3:** physical-mail-as-a-service (MAIL_LIVE/LetterStream/CSO) · SOC2 program · public API · GIOS route flips (dormant infra — not customer-facing).

---

## The bottom line (CTO summary)
CreditVector is a **feature-rich, live product with real billing** — the *build* is ~80% where it
counts for customers. What stands between today and a responsible commercial launch is **not more
features** — it is **legal sign-off** and the **operational safety net every paid product needs**:
observability, a deploy safety gate, and proven recoverability. The **P0 list is ~1 external
dependency (counsel) + ~4–6 engineering days.** Clear those five P0 items and CreditVector is
launch-ready as a self-mail consumer product; everything else is hardening and post-launch scope.

*Assumptions flagged NEEDS CONFIRMATION: the managed DB provider + its backup guarantees; whether
counsel engagement has begun; exact Stripe dunning configuration. Confirm these to firm up P0 #1 and #4.*
