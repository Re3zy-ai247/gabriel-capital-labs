# Metric Catalog (canonical definitions)

Status legend: ✅ live (computed from real data now) · ⚠️ estimate (labeled, replace) · ❌ not yet instrumented (never fake it).

## Revenue & billing
| ID | Metric | Definition | Source | Status |
|---|---|---|---|---|
| BI-REV-01 | MRR / ARR | Real recurring revenue | **Stripe dashboard = truth** (0 subs, pre-launch as of 2026-07-01). Admin `/api/admin/overview` = counts×price | ⚠️ estimate in-app (G-14) |
| BI-REV-02 | Free→paid conversion | signups → first successful subscription | needs conversion events | ❌ |
| BI-REV-03 | Letter-pack sales | one-time `letters_5` purchases | Stripe + webhook credits ledger | ✅ (Stripe) |
| BI-USER-03 | Churn / at-risk | `subscriptionStatus` canceled/unpaid · past-due | `/admin` overview | ✅ |

## Users & product
| ID | Metric | Definition | Source | Status |
|---|---|---|---|---|
| BI-USER-01 | Total / active users | registered accounts; "active" undefined until events exist | DB count | ✅ count / ❌ active |
| BI-USER-02 | Retention | return usage over time | needs events | ❌ |
| BI-ACT-01 | Activation | reports uploaded → analyzed rate (+ stale >1h unparsed) | `/admin/product` | ✅ |
| BI-FUNNEL-01 | Dispute funnel | generated→mailed→responded→resolved; outcome split; favorable rate | `/admin/product` | ✅ |
| BI-FEAT-01 | Feature usage | per-module usage | needs events | ❌ (top candidate) |
| BI-AGY-01 | Agency growth | agency/agency_pro accounts + managed clients | DB count | ✅ |
| BI-ENG-01 | Report-pipeline health | stale/unparsed reports | `/admin/product` | ✅ |

## Marketing & community
| ID | Metric | Definition | Source | Status |
|---|---|---|---|---|
| BI-MKT-01 | Newsletter subscribers | `User.briefDigest` opt-ins | `/admin/marketing` | ✅ |
| BI-MKT-02 | Push subscribers | `PushSubscription` rows | `/admin/marketing` | ✅ |
| BI-MKT-03 | Brief performance | published/drafts/views/likes/comments | `/admin/marketing` | ✅ |
| BI-MKT-04 | Traffic / SEO / social | external channels | needs integrations | ❌ (honestly labeled in-app) |
| BI-COM-01 | Community health | threads/replies/open reports/flagged comments | admin APIs | ✅ |

## Operations & cost
| ID | Metric | Definition | Source | Status |
|---|---|---|---|---|
| BI-SUP-01 | Support queue | open/responded/closed tickets | `/admin/product` | ✅ |
| BI-MOD-01 | Moderation queue | open community reports + flagged Brief comments | `/api/admin/context` | ✅ |
| BI-AUTO-01 | Automation coverage | live crons + AI-assisted output volume | `/admin/automation` | ✅ |
| BI-COST-01 | AI / token cost | spend per AI surface | Anthropic console (manual); per-surface instrumentation | ❌ (CAIO top task) |
| BI-COST-02 | Infra cost | Vercel + DB + Resend spend | provider consoles (manual) | ❌ |
| BI-LAUNCH-01 | Launch readiness | founder-gate checklist (G-01, G-02, backfill) | AIOS `DASHBOARD.md` | ✅ (manual) |

## Instrumentation backlog (priority order)
1. **BI-COST-01** AI cost per surface — protects margin before scale (CAIO).
2. **BI-FEAT-01/BI-USER-02** usage events → retention/activation depth (CPO; privacy-reviewed, no PII).
3. **BI-REV-01** real Stripe MRR in admin (G-14, CRO/CTO).
4. **BI-REV-02** conversion events (CRO).
5. **BI-MKT-04** traffic/SEO (CMO; start with a privacy-respecting analytics option — needs CSO/CCO pass).
