# ADR-0031: Agency Command™, Agency packaging v3, capacity add-on & Revenue Intelligence

Status: **PROPOSED (2026-07-18 — architecture only; not implemented, not merged; awaiting founder approval).**
Date: 2026-07-18
Decision owners: Founder directive (packaging + pillar) · Chief Architect (mechanisms)
Scope: **Documentation only.** No code, no UI, no billing, no schema in this change. This ADR records the
decision + the exact repository deltas + the smallest safe implementation slice. Detailed structure lives in
[`.ai/AGENCY-COMMAND.md`](../AGENCY-COMMAND.md) (one home per concept). Supersedes the packaging rows of
[`.ai/PRICING-V2-ROADMAP.md`](../PRICING-V2-ROADMAP.md) (which is stale — still shows Agency Pro $799).

---

## 1. Context — repository truth (Phase-0 verified 2026-07-18)

| Concern | Source of truth | Current value |
|---|---|---|
| Prices | `lib/stripe.ts` (`*_PRICE_CENTS`, `PLAN_CATALOG`) | Agency **$399** · Agency Pro **$699** (legacy $799) · Scale **$1,299** · Premium $99 |
| Live workspace cap (enforced) | `lib/entitlements.ts` `agencyClientLimit()` | Agency **15** · Agency Pro **40** · Scale **100** · Enterprise null |
| Grandfather guard | `lib/entitlements.ts` `NEW_PACKAGING_EFFECTIVE` = 2026-07-17 | pre-cutover accounts keep sold caps (Agency 20, Pro ∞) |
| Dormant matrix (Phase B) | `config/capabilityMatrix.ts` `CLIENT_WORKSPACE_LIMIT`/`CONCURRENT_SESSION_LIMIT` | 15/1 · 40/3 · 100/5 · null/10 — lockstep, `CAPABILITY_PLATFORM` OFF |
| Marketing/display | `app/pricing/PricingTiers.tsx` (TIERS + MATRIX) | "up to 15", "40", "100"; Pro/Scale = "Coming soon" |
| Team seats (dormant) | `lib/os/platform/teams.ts` + `TEAM` cap + `TEAM_FOUNDATION` (OFF) | roles/invitations only — **no seat count** |
| Managed clients | `User.managedByAgencyId`; creation-gated in `app/api/agency/clients` POST | roster inherits agency entitlement |

**Prices already match the founder decision.** Only three things change or are new (below).

## 2. Decision

### 2.1 Agency packaging v3 (cap deltas — prices unchanged)

| Tier | Price (unchanged) | Client Workspaces | Staff Users (NEW) | Delta vs code |
|---|---|---|---|---|
| Agency | $399/mo | **15** | **1** | caps ✓; +staff |
| Agency Pro | $699/mo | **30** | **3** | **40 → 30**; +staff |
| Scale | $1,299/mo | **50** | **5** | **100 → 50**; +staff |
| Enterprise | Custom | Custom | Custom | none |

### 2.2 Capacity add-on — **Additional Client Workspace Pack** (NEW primitive, NOT a tier)
- **+10 Active Client Workspaces for $100/mo.** Stackable. Pure capacity expansion — it grants **no**
  capability, **no** staff seat, **no** tier change.
- Effective workspace cap becomes a **resolver**, not a constant:
  `resolveWorkspaceCap(user) = baseCap(tier) + addonPacks(user) * 10` (Enterprise: `null` = negotiated,
  unaffected). This is the one new mechanism the add-on needs.

### 2.3 Staff Users — **NEW entitlement dimension** (seats, not sessions)
- A **Staff User = a team seat/identity** under the agency, governed by the dormant **Team foundation**
  (`lib/os/platform/teams.ts`, roles owner/operator/…). It is **distinct** from
  `CONCURRENT_SESSION_LIMIT` (a per-user *device* cap, declared-not-enforced, CSAP-1). New dimension
  `STAFF_USER_LIMIT` (1/3/5/custom). *(The numbers coincidentally equal today's session limits for
  agency/pro/scale — coincidence, not the same axis; keep them separate.)*

### 2.4 No-retroactive-reduction law (fail-closed migration)
- The reductions (Pro 40→30, Scale 100→50) apply via a **second packaging-effective date**
  (`PACKAGING_V3_EFFECTIVE`), using the **same grandfather mechanism** already in `agencyClientLimit`. A
  sold cap is **never** reduced retroactively: an account created before the v3 date keeps 40/100.
- **Safe because** Agency Pro & Scale are `status: "soon"` (Pro removed from checkout whitelist; Scale
  never live) ⇒ the post-2026-07-17 Pro/Scale subscriber set should be **empty**. **Gate F-A:** founder/
  Stripe must **verify zero active Agency Pro/Scale subscriptions** before the reduction ships (mirrors the
  ADR "verify zero agency_pro subs" precedent). If any exist, they grandfather at 40/100 automatically.

### 2.5 Agency Command™ — NEW product pillar (operating layer, not a dashboard)
- The unifying operating layer for agencies; the 10 sub-modules are **compositions of existing engines**,
  not new systems (reuse-before-build). Full map + authorization model in `.ai/AGENCY-COMMAND.md §3`.

### 2.6 Revenue Intelligence — optional, derived, **never accounting software**
- Six **optional, self-reported** per-client fields → deterministic read-models (MRR/ARR/ARPC/lifetime/
  churn/growth). No invoices, no payments, no ledger, no Stripe coupling. Design in `.ai/AGENCY-COMMAND.md §4`.

## 3. Where each change lands (implementation map — for the later build, not now)
- **Caps + staff + add-on resolver:** `lib/entitlements.ts` (live authority) + `config/capabilityMatrix.ts`
  (dormant, lockstep) + their guard `scripts/capability-matrix.test.ts` (extend the 38/38 lockstep laws).
- **Prices:** none (already correct); the **add-on** needs one new Stripe product/price + `PLAN_CATALOG` entry.
- **Display:** `app/pricing/PricingTiers.tsx` (numbers 40→30, 100→50; add staff rows; add add-on line).
- **Staff seats:** Team foundation (`lib/os/platform/teams.ts`, `TEAM_FOUNDATION`) — enforcement is a later slice.
- **Revenue Intelligence:** new optional client-profile fields (self-heal DDL, ADR-0001) + a pure read-model
  module; no billing surface.

## 4. Smallest implementation slice (recommended FIRST — server authority only, no UI/billing)
**Capacity & packaging resolver.** A single pure, server-authoritative extension that makes repository truth
match this ADR and establishes the add-on primitive:
1. `resolveWorkspaceCap(user)` = `baseCap(tier, createdAt)` + `addonPacks*10`, where `baseCap` applies the v3
   caps (15/30/50) behind `PACKAGING_V3_EFFECTIVE` with grandfather; `addonPacks` reads a nullable field
   (defaults 0 until billing is wired).
2. `agencyStaffLimit(user)` = 1/3/5/custom (declared; enforcement later, like `CONCURRENT_SESSION_LIMIT`).
3. Mirror both into `config/capabilityMatrix.ts`; extend `scripts/capability-matrix.test.ts` lockstep laws
   (v3 caps, grandfather, add-on additivity, staff declaration).
- **Why first:** it is the entitlement truth every other slice (Agency Command gating, add-on billing,
  Revenue Intelligence, staff seats) depends on. Data+logic only, deterministic, fail-closed, **zero UI, zero
  Stripe, zero schema-for-billing** (addonPacks is a nullable read, default 0). No caps shrink retroactively.
- **Explicitly deferred to later slices:** Stripe add-on product + webhook→`addonPacks`; pricing-page copy;
  staff-seat enforcement; Agency Command routes/UI; Revenue Intelligence fields + read-models.

## 5. Roadmap impact
- Supersedes the Agency Pro/Scale rows of `.ai/PRICING-V2-ROADMAP.md` (cap numbers + staff + add-on); that
  doc's $799 is stale (code is $699).
- Adds a new pillar track to `.ai/ROADMAP.md`: **Agency Command** (Slice 1 resolver → add-on billing →
  pricing copy → Revenue Intelligence → staff seats → Command shell → per-module surfacing).
- No change to consumer tiers (Explorer lifetime-3 / Professional unlimited — the consumer allowance is tracked separately and is out of scope here).

## 6. Protected state (unchanged by this ADR)
No merge/deploy; no billing-timing change; `MAIL_LIVE`/`KERNEL_DURABLE`/`CAPABILITY_PLATFORM`/`TEAM_FOUNDATION`
remain **OFF**; no production data. This ADR is documentation; implementation is founder-gated per slice.

## 7. Open founder/counsel decisions
- **F-A:** verify zero active Agency Pro/Scale subs before shipping the 40→30 / 100→50 reduction (else they
  grandfather).
- **F-B:** add-on billing model — separate Stripe subscription **item with quantity** vs N discrete
  subscriptions (recommend: one metered/quantity line item on the agency subscription).
- **F-C:** Revenue Intelligence disclosure — self-reported business metrics are the agency's own data;
  confirm CreditVector makes **no** representation of their accuracy (display "based on N of M clients you've
  filled in"). CCO glance, low risk (no consumer-credit claim).
- **F-D:** staff-seat enforcement depends on CSAP-1 / Team foundation activation (separately gated).
