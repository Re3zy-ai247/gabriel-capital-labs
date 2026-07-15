# Pricing V2 — Technical Roadmap (Phase 2)

> The build plan behind the Pricing V2 page (`app/pricing/`). The page is the
> **marketing asset + product roadmap**; this doc is how each tier becomes real.
> **Governing rule (non-negotiable, from `CREDITVECTOR-OS.md` §7):** never advertise
> functionality as available before it is; a tier's "Coming soon" badge disappears and
> its checkout goes live **only** after the capability is production-ready AND passes the
> CCO gate (`/compliance-review`). No customer can be charged for a plan that isn't live.

## Current state (LIVE today)
- **Stripe plans:** `premium` ($99/mo), `agency` ($399/mo), `agency_pro` ($799/mo, legacy), one-time `letters_5` ($19). Checkout via `/api/stripe/checkout` → `lib/billing.ts`.
- **Entitlements** (`lib/entitlements.ts`): `isPremium` (premium/agency/agency_pro), `agencyClientLimit` (agency=20, agency_pro=∞), managed-client inheritance.
- **Pricing page V2 maps live checkout to:** Explorer→register (free), Professional→`premium`, Agency→`agency`. Everything else is "Coming soon" (no checkout).
- **Note:** V2 intentionally stops selling the legacy `agency_pro` ($799) on the page; the new Agency Pro ($699, with team/branding/analytics) is Coming soon. Existing `agency_pro` subscribers keep their entitlement.

## Target architecture — 7 tiers + Kai capability tiers
| Tier | Price | Status | Stripe | Kai tier |
|---|---|---|---|---|
| Explorer | Free | ✅ live | — (register) | Kai Lite |
| Professional | $99 | ✅ live | `premium` | Kai Professional |
| Professional+ | $149 | 🔜 soon | **new** | Kai Pro |
| Agency | $399 | ✅ live | `agency` | Kai Agency |
| Agency Pro | $699 | 🔜 soon | **new** (replaces legacy $799) | Kai Agency |
| Scale | $1,299 | 🔜 soon | **new** | Kai Agency |
| Enterprise | Custom | 🔜 contact | manual/quote | Kai Enterprise |

### Kai Capability Matrix (what each Kai tier unlocks)
Kai's intelligence is governed by `KAI-OS.md`; capabilities gate by tier via feature flags.
- **Kai Lite** (Explorer): deterministic report analysis + explanations + Academy education. *(live)*
- **Kai Professional** (Professional): + bureau-response intelligence, next-round/MoV recommendations, letter drafting/refinement, readiness & timeline intelligence, case memory. *(live — deterministic)*
- **Kai Pro** (Professional+): + **metered conversational Kai** (ADR-0006, PROPOSED), persistent long-term strategy memory, priority AI. *(build)*
- **Kai Agency** (Agency tiers): Kai Professional applied per-client in isolation; roster intelligence. *(Agency live; Pro-tier extras build)*
- **Kai Enterprise**: Kai Agency + private deployment, SSO-scoped, white-label. *(build)*

## Cross-cutting foundations to build first (before any new tier)
1. **Plan model expansion** — extend the `plan` enum / entitlement model to the 7 tiers + a Kai-capability field. `lib/entitlements.ts` grows a capability map (per-tier feature booleans) rather than scattered `plan ===` checks.
2. **Feature-flag layer** — a deterministic `hasFeature(user, "funding_hub" | "business_credit" | "kai_conversational" | "api" | "sso" | …)` derived from the plan/capability map. Every gated UI/route reads this; "Coming soon" states derive from the SAME flags (single source of truth → the page can never contradict entitlements).
3. **Stripe catalog** — founder creates products/prices for Professional+ ($149), Agency Pro ($699), Scale ($1,299) in the Stripe dashboard; add their price IDs to `lib/billing.ts`; the page flips each from "Coming soon" to live checkout only after its features ship + CCO gate.
4. **Waitlist capture** — a `Waitlist` self-heal table (email + tier + userId) + a `POST /api/waitlist` route; the Coming-soon CTA becomes a real "Join the waitlist" once this exists (today it's honestly "Start free").
5. **Billing logic** — extend `lib/billing.ts` + the Stripe webhook to map the new price IDs → plan/capability grants; proration/upgrade paths between tiers.

## Per-capability implementation tasks (each = a tracked sprint item)
Each unbuilt feature advertised on a Coming-soon card becomes its own build. None may be marked available before it ships + passes CCO.

- **Metered conversational Kai** (Kai Pro/Professional+) — ADR-0006 pipeline (router, `KaiAnswer`/`KnowledgePack`, confidence, credit metering per `CREDIT-ECONOMY.md`), rate limits, retrieval-first, caching, graceful downgrade. **Largest item.**
- **Persistent long-term Kai memory** (Kai Pro) — durable strategy-memory store over the user's records (extends Case Memory), tenant-isolated.
- **Funding Hub** (Professional+) — new module + route + engine; readiness already exists (`lib/intelligence` readiness) as the seed. Educational-first, never a lending decision.
- **Business Credit OS** (Professional+) — new module; the Builder currently marks business credit "future/locked." Entity/EIN/DUNS/vendor model; nothing inferred.
- **Advanced analytics / priority AI / beta gate** (Professional+) — analytics surface + a priority queue flag + a beta-features flag.
- **Consumer private community** (Professional+) — extend the existing (agency-gated) Community to a Premium tier per the founder Community policy.
- **Agency Pro** — team-members model (multi-user per agency: new `AgencyMember` table + roles/permissions), advanced reporting, bulk actions, custom branding, agency analytics; client cap 20→25.
- **Scale** — client cap →50, unlimited team, automation engine, **public API** (auth/tokens/rate-limits), **webhooks** (delivery + retries), manager dashboards, advanced permissions.
- **Enterprise** — **SSO** (SAML/OIDC), **white-label**, dedicated-AM tooling, SLA monitoring, custom integrations, private deployment; manual quote/contract billing.

## Phase 3 sequencing (one tier per sprint; ship, then flip)
Recommended order (value + dependency): **Professional+** (conversational Kai is the flagship differentiator) → **Agency Pro** (team model unlocks the agency ladder) → **Scale** (API/automation) → **Enterprise** (SSO/white-label). For each: build → CCO gate → create/confirm Stripe price → flip the page card from "Coming soon" to live checkout → verify entitlement↔page↔Stripe agree.

## Guardrails (apply to every step)
- The page, entitlements, and Stripe **must always agree** — the feature-flag layer is the single source of truth the page reads.
- No "Coming soon" → "live" flip without: production-ready feature + CCO `/compliance-review` GO + Stripe price live + a route/entitlement test.
- Every Kai capability honors `KAI-OS.md` (grounded, cited, uncertainty-disclosed, user-approval for outward actions) and the CROA bar.
- Preview-first; founder approval before merge; MAIL_LIVE unaffected.
