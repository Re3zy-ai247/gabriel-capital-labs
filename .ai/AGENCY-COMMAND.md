# Agency Command™ — pillar architecture

> The operating layer for credit-repair agencies. **Not a dashboard** — the authorization + navigation +
> intelligence shell beneath which every agency-facing capability eventually lives. Authority:
> [`ADR-0031`](ADR/ADR-0031-agency-command-packaging-revenue.md). This doc is the durable **structure**;
> the ADR is the **decision**. Governing discipline: reuse-before-build, server-side authority, fail-closed,
> deterministic, no duplicate systems. **Status: architecture only — nothing here is implemented.**

## 1. Thesis & layering (canonical — [`ADR-0032`](ADR/ADR-0032-platform-layering-kai-kernel.md))
CreditVector is evolving from a dispute generator into the **operating system for credit businesses**. The
canonical layering is **Kai → Agency Command → Mission Control → modules**:

- **Kai is the intelligence kernel of the whole platform** (governed by `KAI-OS.md`), **not a module inside
  Agency Command.** Kai reads every subsystem's deterministic truth and produces the executive read; Agency
  Command is **one of Kai's surfaces** (Consumer OS is another).
- **Agency Command owns ORCHESTRATION, not data** — queues, routing, assignment, priority, deadlines. Data /
  CRM / storage / billing live in the Record + Foundation layers; Agency Command coordinates, it stores
  nothing of its own.
- **Mission Control is one operational module** inside Agency Command — a state roll-up, **not** the homepage
  or the OS. The first screen is the **Executive Morning Brief** (§7), which is Kai's read *rendered in*
  Agency Command.

Its modules are **compositions of engines that already exist** — the work is orchestration, authorization, and
agency-level aggregation, not new intelligence. One intelligence (`lib/intelligence/`, `lib/missionControl.ts`,
`lib/campaign/`, `lib/responseIntel.ts`, `lib/outcomeLedger.ts`, `lib/analytics/`) runs every desk; Agency
Command decides who sees which client and mediates the queues; **Kai reads them all**.

## 2. Entitlement & capacity model (the spine)
Three axes, all **server-authoritative** and resolved in `lib/entitlements.ts` (live) mirrored into
`config/capabilityMatrix.ts` (dormant, lockstep, `CAPABILITY_PLATFORM` OFF). See ADR-0031 §2 for values.

```
Effective client-workspace cap  = baseCap(tier, createdAt) + addonPacks(user) * 10     (Enterprise: null)
Staff-seat cap                  = STAFF_USER_LIMIT(tier)                                (1 / 3 / 5 / custom)
Capability set                  = grantForTier(tier, CAPABILITY_MATRIX)                 (unchanged mechanism)
```

- **`baseCap`** applies packaging-v3 (15 / 30 / 50 / null) **behind `PACKAGING_V3_EFFECTIVE`** with the
  existing grandfather clause — a sold cap never shrinks retroactively (ADR-0031 §2.4). Reductions
  (Pro 40→30, Scale 100→50) reach only accounts created on/after the v3 date; F-A verifies the pre-existing
  set is empty.
- **`addonPacks`** — the **Additional Client Workspace Pack** (+10 / $100). Pure additive capacity; grants no
  capability and no seat. Nullable, default 0; populated by the add-on billing slice (Stripe quantity line).
- **`STAFF_USER_LIMIT`** — a **new dimension = team seats**, governed by the Team foundation
  (`lib/os/platform/teams.ts`, `TEAM_FOUNDATION` OFF). **Distinct from `CONCURRENT_SESSION_LIMIT`** (a
  per-user device cap). Declared now; enforced when Team/CSAP-1 activates.
- **Enforcement point:** workspace creation-gating stays where it is (`app/api/agency/clients` POST) but reads
  `resolveWorkspaceCap` instead of the bare `agencyClientLimit`. Existing clients above a lowered cap are
  never locked — the cap gates NEW creation only (existing behavior, preserved).

## 3. The ten sub-modules → existing systems (reuse map + authorization)

| # | Module | Reuses (existing) | New work |
|---|---|---|---|
| 1 | **Mission Control** (one module, not the OS) | `lib/missionControl.ts` (per client) | agency-level roll-up of "next action across all clients" |
| 2 | **Executive Morning Brief** (Kai's *surface*, not a module Agency Command owns — §7) | `lib/intelligence/portfolio.ts`, `explain`, `lib/kaiHome.ts`, `proactive.ts` | render Kai's platform-kernel read as the agency's first screen |
| 3 | **Client Pipeline** | managed-client roster (`/api/agency/clients`), `clientStatus` (§4) | pipeline stages prospect→active→paused→churned |
| 4 | **Campaign Queue** | `lib/campaign/` compose/queue (per client) | cross-client campaign board |
| 5 | **Response Queue** | **`lib/responseIntel.ts` (Sprint XV)** + response-received letters | cross-client "which responses need a follow-up decision now" |
| 6 | **Revenue Intelligence** | `lib/analytics/aggregate.ts` discipline | §4 read-models over optional fields |
| 7 | **Team Performance** | Team foundation seats, `assignedSpecialist` (§4), `lib/outcomeLedger.ts` own-track | per-specialist outcomes/latency roll-up |
| 8 | **Business Analytics** | `lib/analytics/aggregate.ts` (funnel/adoption) | scope to agency + its clients |
| 9 | **Automation** | Phase-4 Automation, `lib/intelligence/proactive.ts` (receipt-carrying signals, `notify.plan` decision layer, ADR-0027) | agency-scoped signal routing |
| 10 | **Settings** | agency profile/branding, Team seats, billing | add-on management + Revenue-field config |

**Authorization (server-side, fail-closed).** Agency Command is reachable only when `isPremium` resolves an
agency plan (`agency`/`agency_pro`/`scale`/`enterprise`). Within it, each module maps to a **capability**
(`workspace.client.manage`, `ANALYTICS`, `TEAM`, `AUTOMATION`, …) AND a **team role** (owner / operator /
specialist) via the PEP / `config/rolePermissions.ts`. A **specialist** seat sees only clients where
`assignedSpecialist == self` (row-level scope); an **owner/operator** sees the whole book. No client data
crosses agencies (every read is `managedByAgencyId`-scoped, the existing isolation boundary).

## 4. Revenue Intelligence — optional metrics, derived, never accounting software

**Six optional, self-reported, per-client fields** (new `AgencyClientProfile`, keyed by managed-client user id
+ agencyId; self-heal DDL per ADR-0001; every field nullable):

| Field | Type | Used for |
|---|---|---|
| `monthlyServiceFee` | int cents, nullable | MRR/ARR/ARPC |
| `billingFrequency` | `monthly`\|`quarterly`\|`annual`\|`one_time`\|`none` | normalize fee → monthly |
| `signupDate` | date, nullable | lifetime, growth, cohort |
| `consultationSource` | string, nullable | source mix (analytics, not revenue) |
| `assignedSpecialist` | staff-seat id, nullable | Team Performance scoping |
| `clientStatus` | `prospect`\|`active`\|`paused`\|`churned` | active set, churn, pipeline |

**Normalization (pure):** `monthlyValue = monthly→fee · quarterly→fee/3 · annual→fee/12 · one_time|none→0`
(one-time/none are excluded from *recurring* revenue).

**Derived read-models (deterministic, no estimation):**
- **MRR** = Σ `monthlyValue` over clients with `clientStatus = active` **and** a fee set.
- **ARR** = MRR × 12.
- **ARPC** = MRR ÷ count(active clients with a fee set).
- **Client Lifetime** = mean(`churnDate − signupDate`) over churned clients with both dates; when that sample
  is thin, the platform proxy `1 / monthlyChurnRate` (months) is shown **and labeled as a proxy**.
- **Churn (period)** = churned-in-period ÷ active-at-period-start.
- **Growth (period)** = (active-end − active-start) ÷ active-start (net-new active also shown as a count).

**Why this is not accounting software:** no invoices, no payment capture, no reconciliation, no tax, no
double-entry, no Stripe coupling — these are the **agency's own** self-reported numbers about **their** clients.
Every field is optional; every metric **discloses coverage** ("based on N of M clients you've filled in") and is
**suppressed below a small N** to avoid a misleading single-client "MRR". Missing data is **excluded, never
estimated or guessed** (fail-closed) — mirrors `lib/analytics/aggregate.ts`' `instrumented`/coverage honesty
and the outcome-ledger thin-data discipline. CreditVector makes **no representation** that these figures are
accurate (F-C).

## 5. Build sequence (each a small, reviewable, founder-gated slice)
1. **Capacity & packaging resolver** (ADR-0031 §4) — caps 15/30/50 + add-on additivity + staff declaration;
   pure, guarded, no UI/billing. *(smallest first slice)*
2. **Add-on billing** — Stripe quantity line + webhook → `addonPacks`.
3. **Pricing-page copy** — 40→30, 100→50, staff rows, add-on line (`app/pricing/PricingTiers.tsx`).
4. **Revenue Intelligence** — `AgencyClientProfile` fields + pure read-model module + coverage-honest surface.
5. **Staff seats** — Team-foundation activation + `STAFF_USER_LIMIT` enforcement (CSAP-1 dependent).
6. **Agency Command shell** — authorization + navigation composing modules 1–10 (UI slice, per-module).

## 6. Non-goals (this pillar)
No consumer-tier change (Explorer lifetime-3 / Professional — the consumer allowance, out of scope here); no Marketplace; no automated mail; no accounting/payments; no
cross-agency data; no GIOS migration. Concurrent-session enforcement stays CSAP-1's problem, separate from
staff seats.

## 7. Executive Morning Brief — the first screen (Kai's surface, not a module)
The agency owner's first screen every morning. **Operational awareness, not charts** (Bloomberg Terminal /
Stripe dashboard / Linear inbox). It answers four questions — *What happened? What needs attention? What
should happen next? How healthy is my business?* — and is **Kai's read rendered here**, not a thing Agency
Command owns. Every number is **deterministic + auditable from an existing engine**; Kai's LLM writes only the
narrative wrapper (ADR-0006 gated, untrusted-fenced).

| Brief section | Answers | Deterministic source |
|---|---|---|
| **Agency Health** (single score, §8) | how healthy? | §8 composite |
| Risk Summary | what needs attention | SLA breaches (`forecast`), stalled clients (events), cap pressure, automation failures, compliance flags |
| Today's Priorities (ranked, reasons shown) | what next | queues + `responseIntel` + `forecast` |
| Upcoming Deadlines | what next | `forecast` §611 clocks across clients |
| Response / Campaign / Mail / Task queues (counts + oldest-waiting) | what happened / next | the queues |
| Client Pipeline (stage counts + movement) | what happened | `clientStatus` (§4) |
| Revenue Changes | how healthy | BI deltas (§4) — coverage-honest |
| Operational Bottlenecks | attention | where work piles (queue depth × age) |
| Automation Status | happened | proactive runs/failures (`proactive.ts`) |
| Compliance Alerts | attention | letter `complianceFlags`, CROA guardrails |
| Staff Load | attention | per-seat load (Team foundation) |
| Capacity | how healthy | active ÷ `resolveWorkspaceCap` + add-on headroom |
| Growth / Notifications / Kai Recommendations | happened / next | BI net-new; ranked next actions with receipts |

## 8. Agency Health Score — one executive number (deterministic, transparent)
A single 0–100 executive index, built with the **same discipline as `lib/intelligence/portfolio.ts`'s
documented 0–100 risk** (reuse, don't invent). Each input is normalized 0–100 and weighted; the score
**publishes its formula and its drivers** ("Watch, because 4 SLA breaches + a mail backlog of 12"), never a
black box. **Fail-closed & coverage-honest:** a missing signal is *excluded and disclosed* ("based on N of M
signals"), never guessed. Bands: Healthy / Watch / At-risk.

| Signal | Source (existing) |
|---|---|
| Capacity utilization | `resolveWorkspaceCap` (ADR-0031) |
| Open/unactioned responses | Response Q (`responseIntel` + letters) |
| SLA breaches (past §611 window) | `lib/forecast.ts` |
| Overdue tasks | Task Q |
| Client inactivity (stalled) | event stream |
| Mail backlog | Mail Q (`lib/mailCenter.ts`) |
| Automation failures | `lib/intelligence/proactive.ts` |
| Revenue trend | BI deltas (§4) |
| Pipeline health | stage conversion (`clientStatus`) |
| Case throughput | letters/responses per period |
| Team workload | per-seat load (Team foundation) |
| Kai confidence | `lib/intelligence/reasoning.ts` `scoreConfidence` + coverage |

The health read-model is a natural **extension of `portfolio.ts`** (agency-operations sibling of its
per-case risk), not a new engine — build sequence §5 Phase A/C.
