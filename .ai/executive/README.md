# Executive Intelligence Layer

Product-scope charters for the CVIOS executive roles. **The company org, decision-rights framework (🟢 autonomous · 🟡 draft→founder approves · 🔴 human-only), and veto powers are defined ONCE in the AIOS charter** (`~/Documents/Gabriel-Capital-Labs-AIOS/ARCHITECTURE.md` §2, §6–7) — these files inherit them and add only what is product/repo-specific. Zero duplication: KPI definitions live in `../business-intelligence/METRICS.md`; these docs reference metric IDs.

| CVIOS role | AIOS charter role | Operational arm (skill) | Primary dashboard |
|---|---|---|---|
| [CEO](CEO.md) | CEO | `/gcl` (Chief of Staff) | `/admin` overview |
| [COO](COO.md) | COO | `/gcl-automation` | `/admin/automation` |
| [CTO](CTO.md) | CTO | (engineering sessions, this repo) | `/admin/product` |
| [CPO](ChiefProductOfficer.md) | CPO | (product sessions) | `/admin/product` |
| [CMO](ChiefMarketingOfficer.md) | CMO | `/gcl-content` + `/gcl-research` | `/admin/marketing` |
| [CRO](ChiefRevenueOfficer.md) | CRO | `/gcl-leadgen` + `/gcl-analytics` | `/admin` overview |
| [CCO](ChiefComplianceOfficer.md) | Chief Compliance Officer (risk office, VETO) | `/compliance-review` | `/admin/compliance` |
| [CSO](ChiefSecurityOfficer.md) | Data Privacy Officer (risk office, VETO) | `/security-review` + gstack `/cso` | — (posture in `../SECURITY.md`) |
| [CLO](ChiefLegalOfficer.md) | General Counsel (risk office, VETO) | (counsel routing — human) | — (`../COMPLIANCE.md` counsel list) |
| [CAIO](ChiefAIOfficer.md) | *(new role — no charter analog yet; propose at next charter rev)* | (AI-surface sessions) | `/admin/automation` |

**Rules for this layer:**
1. An executive doc is a *lens*, not a silo — one canonical fact base (`../` docs + METRICS.md), ten viewpoints over it.
2. Risk office (CCO/CSO/CLO) vetoes cannot be overruled except by the founder in writing (charter §7).
3. Update an exec doc only when ownership, KPIs, or authority actually change — not per task.
