# CreditVector — RC1 Execution Plan (master roadmap until launch)

**Companion to** [CREDITVECTOR_RC1.md](CREDITVECTOR_RC1.md) (the readiness assessment — rationale +
scores live there; not repeated here). **This doc = the execution sequence.** No new scope, no code
in this doc. Every task passes the filter **"Does this help us launch?"** — if not, it is P3/deferred.

**RC1 launch scope (locked):** self-mail consumer product. **Deferred out of RC1:** physical-mail-as-
a-service (MAIL_LIVE/LetterStream/CSO), SOC2, public API, GIOS route flips (dormant infra — not
customer-facing). **The binding constraint to launch is COUNSEL sign-off (external, 1–3 wk), not
engineering.** All engineering P0/P1 fits *inside* that window if started in parallel today.

**Owners:** `Founder` (decisions/purchases/env/DNS/Stripe/counsel) · `Eng` (Claude, under direction,
flag-safe changes) · `Counsel` (external) · `CCO` (`/compliance-review` gate). *Efforts are
estimates.* *Parallelizable = can run concurrently with other tasks without a blocking dependency.*

---

## Release Program

### P0 — Launch Blocking (nothing ships until all clear)
| # | Task | Owner | Effort | Dependencies | Risk | Business impact | Customer impact | Parallel |
|---|---|---|---|---|---|---|---|:--:|
| P0-1 | **Engage counsel + obtain sign-off** — CROA/FCRA posture, news/defamation, ToS/Privacy/refund | Founder + Counsel | 1–3 wk (external) | engage today | Critical (legal) | Enables commercial launch | Trust/legitimacy | **Yes** |
| P0-2 | **Production observability** — error tracking + alerting (e.g. Sentry free tier) | Eng | 1–2 d | Founder adds DSN env | High | Safe operation; catch failures | Fewer silent breakages | **Yes** |
| P0-3 | **CI gate** — GitHub Actions runs guards + typecheck + build on push; block merge on red | Eng | 1 d | none (guards exist) | High | Prevents bad-push outage | Uptime | **Yes** |
| P0-4 | **Vercel Pro + Skew Protection** on | Founder (buy) + Eng (enable) | 0.5 d | owner $20/mo | Med | Deploy-skew safety | No stale-deploy errors | **Yes** |
| P0-5 | **Backup verify + restore drill + DR runbook** (confirm provider, restore once, doc RPO/RTO) | Eng + Founder | 1–2 d | **confirm DB provider** | Critical (data loss) | Provable recoverability | Data safety | Partial (after confirm) |
| P0-6 | **Owner verification/actions** — G-01 legal identity **RESOLVED BY FOUNDER**; authorize integration and inspect received digest; run encrypt backfills; enable Stripe customer receipts | Founder | <1 d | deployment authority | Med | Verifies digest + receipts | Comms/receipts | **Yes** |

### P1 — Launch Critical (before commercial scale; strongly recommended in the counsel window)
| # | Task | Owner | Effort | Dependencies | Risk | Business impact | Customer impact | Parallel |
|---|---|---|---|---|---|---|---|:--:|
| P1-1 | **Structured logging + core dashboards** (error rate, payment failures, uptime) | Eng | 1–2 d | P0-2 | High | Debuggability | Faster fixes | After P0-2 |
| P1-2 | **Auth hardening** — account lockout, session revocation (MFA optional) | Eng | 2–3 d | none | High | Credential-attack resistance | Account safety | **Yes** |
| P1-3 | **Security pass** — `npm audit`/deps, secrets rotation, auth+billing review | Eng + Founder | 3–5 d | none | High | Reduce breach risk | Data safety | **Yes** |
| P1-4 | **Email deliverability** — DMARC record + bounce/complaint handling | Eng + Founder (DNS) | 1–2 d | DNS access | High | Reach inbox at volume | Reliable email | **Yes** |
| P1-5 | **Rate-limit sweep** — extend to all mutating/AI/auth routes (now 13/108) | Eng | 1–2 d | none | Med | Abuse/cost control | Stability | **Yes** |
| P1-6 | **Billing edge cases** — dunning, failed-payment recovery, refund policy | Eng + Founder (Stripe) | 2–3 d | Stripe config | Med | Reduce revenue leakage/involuntary churn | Fair billing | **Yes** |
| P1-7 | **Privacy program** — retention policy, DSAR flow, cookie consent | Founder + Counsel + Eng | 3–5 d | P0-1 (counsel) | High | CCPA/CPRA compliance | Data rights | **Yes** |
| P1-8 | **E2E smoke tests in CI** — signup / upload / letter / checkout | Eng | 3–5 d | P0-3 | High | Regression safety | Working core flows | After P0-3 |
| P1-9 | **DB migration discipline** — own the schema path off silent `db push` | Eng | 2–3 d | none | High | Prevent schema drift | Data integrity | **Yes** |

### P2 — Important (post-launch fast-follow; does NOT block launch)
| Task | Owner | Effort | Parallel |
|---|---|---|:--:|
| Product analytics (funnel/retention/activation) | Eng + Founder | 2 d | Yes |
| Load / scale smoke test of critical paths | Eng | 2–3 d | Yes |
| Accessibility audit (WCAG certification pass) | Eng | 2–3 d | Yes |
| AI eval suite + output monitoring + cost caps | Eng | 3–5 d | Yes |
| Comprehensive/tamper-evident audit trail | Eng | 2–3 d | Yes |
| Hard-inquiry engine (dedicated) | Eng | 3–5 d | Yes |
| Mobile device-matrix test | Eng | 1–2 d | Yes |

### P3 — Post-Launch (explicitly deferred out of RC1)
Physical-mail-as-a-service (MAIL_LIVE/LetterStream/CSO+CCO) · SOC2 program · public API · GIOS
route flips + `KERNEL_DURABLE` enable · subscription self-serve up/downgrade automation.

---

## Critical Path (optimized: min engineering time · max launch readiness · min risk)

**Key insight:** the critical path is **counsel (P0-1), not code.** Engineering P0+P1 is
**~8–12 working days, fully parallelizable**, and fits inside the 1–3 week counsel window. So the
single highest-leverage action **today** is Founder-side: **engage counsel now** + purchase Vercel
Pro + set the env vars + confirm the DB provider. Those unblock everything.

```
DAY 0  (Founder, today — starts the long pole + unblocks Eng)
  └─ P0-1 engage counsel ─────────────────────────────────────────┐ (1–3 wk, external, runs in parallel)
  └─ P0-4 buy Vercel Pro · P0-6 env vars/backfills · confirm DB provider (P0-5 dep)

DAYS 1–2  (Eng — fastest, highest risk-reduction first)
  ├─ P0-2 observability ‖ P0-3 CI gate ‖ P0-4 enable skew protection

DAYS 2–4  (Eng)
  ├─ P0-5 backup/restore drill + DR runbook   (after DB provider confirmed)
  └─ P1-1 structured logging + dashboards      (after P0-2)

DAYS 3–8  (Eng — parallel hardening batch)
  ├─ P1-2 auth hardening ‖ P1-3 security pass ‖ P1-5 rate-limit sweep
  ├─ P1-4 email deliverability ‖ P1-6 billing edge cases ‖ P1-9 DB migration discipline
  └─ P1-8 E2E smoke in CI                       (after P0-3)

COUNSEL RETURNS (wk 1–3)
  └─ apply required copy/flow changes ▶ CCO gate (/compliance-review) ▶ P1-7 privacy program

LAUNCH GATE  ▶  ship RC1
```

**Launch exit criteria (all true):** P0-1…P0-6 done · CCO gate GREEN on final copy/flows · P0-2/P0-3
proven (an alert fired in a drill; CI blocked a red push) · P0-5 restore drill succeeded · core-flow
E2E smoke green in CI · no open Critical/High compliance finding.

---

## Immediate next moves
- **Founder (today, the real critical path):** engage counsel (P0-1); buy Vercel Pro (P0-4); separately
  authorize legal-identity integration/delivery testing + run encrypt backfills + enable Stripe receipts (P0-6); tell me the **DB
  provider** so P0-5 can start.
- **Eng (Claude) — ready on your go, in ROI order, all flag-safe and non-behavioral:** **P0-3 CI
  gate** first (1 day, zero external deps, stops bad pushes immediately), then **P0-2 observability**,
  then the P1 hardening batch. Say the word and I start P0-3.

*Every item above directly increases RC1 readiness. Anything that didn't is in P3 or absent.*
