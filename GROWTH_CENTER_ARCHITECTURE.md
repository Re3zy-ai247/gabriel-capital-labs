# CreditVector Growth Center Foundation Preview — Architecture

Status: **PROTECTED FOUNDER PREVIEW DEPLOYED · SOURCE LOCAL/UNCOMMITTED · NO LIVE DATA OR ECONOMICS**  
Date: 2026-07-31  
Governing decision: [`ADR-0041`](.ai/ADR/ADR-0041-growth-center-foundation-preview.md)  
Preview URL: `https://gabriel-capital-labs-6eb4ws7he-rey-gabriel-s-projects.vercel.app/review/growth-center`  
Deployment ID: `dpl_DDYhribJTdiNCtnadYEpbZUdhVp1`  
Validation status: `PASS for protected Founder Preview — typecheck, touched lint, 205/205 Growth Center guard plus regression guards, optimized Preview/production-identity builds, production HTTP 404, protected Preview SSO/authenticated HTTP 200, desktop/tablet/mobile/320px/200% text/Axe/reduced-motion checks, compliance GO, and architecture documentation condition closed. Repository-wide lint remains red only on four unrelated pre-existing files.`  
Evidence hash: `3fd5692270a95d7c3579d214d50e59bae02ba6aad9203c2e9353d75ebe2e8125`

> **Exact repository warning:** the implementation is local and uncommitted on shared branch `feat/cxos-phase3`. Its verified baseline SHA is `a40a41c5a76028ad5cae2ff655c5bf168fb86a4a`; the baseline commit does **not** include this Growth Center work. Other parallel streams also have local changes on the branch. Do not infer a clean release, merge authorization, or deployed code identity from either the branch name or baseline SHA.

## Executive summary

The Growth Center Foundation Preview is one isolated, effect-free room in the `/review` namespace. It renders a complete semantic experience from immutable synthetic fixtures, a pure Growth Advisor resolver, and room-owned CSS. It reuses CXOS Core Runtime only for headless presentation lifecycle. It creates no database, schema, event, API, service, model runtime, identity read, organization read, Community read, Marketplace read, economic object, or production mutation.

The key architecture choice is a two-key server gate before client code loading:

```text
request /review/growth-center
  -> reviewBuildAllowed()                     production identity always false
  -> growthCenterPreviewEnabled()             exact server value "true"
  -> dynamic import of room stage             only after both pass
  -> immutable synthetic experience contract
  -> CXOS Core Runtime presentation lifecycle
  -> semantic document + room-owned CSS
```

The route is deliberately unregistered. A reviewer must use the direct Preview URL. This keeps the Founder review independent from Mission Control, Agency Command, Arena, Community, product navigation, and all production Growth surfaces.

## Architecture laws

1. **Growth owns meaning; CXOS owns presentation lifecycle.**
2. **Facts and effects fail closed; local return navigation fails open.**
3. **A preview flag controls visibility, never program or economic authorization.**
4. **Every displayed state is fixed, synthetic, qualitative, and attributable to a fictional fixture.**
5. **The complete semantic document exists in cinematic, constrained, static, and reduced-motion modes.**
6. **No existing room, product bounded context, or canonical owner is redefined.**
7. **No live capability may be implied by a review control.**

## The exact seven districts

The list and order are immutable in `lib/growthNetwork/experience.ts`. These are presentation districts, not persistent domains.

| Order | District | Architectural plane | Review-only contract |
|---:|---|---|---|
| 1 | **Growth Center** | Protagonist | Synthetic Growth Brief; no participant profile, state, eligibility, or opportunity. |
| 2 | **Professional Development** | Professional capability | Synthetic competence roadmap; no enrollment, certification, employment state, or income outcome. |
| 3 | **Mentorship** | Professional capability | B2B operator preparation only; no match, booking, contract, payment, live mentorship, consumer-specific credit work, legal advice, representation, advance-fee guidance, or promised result. |
| 4 | **Education Center** | Professional capability | Synthetic teaching outline; no course, webinar, credential, seller access, rank, compensation, or promised result. |
| 5 | **Marketplace Preview** | Ecosystem value | Future asset quality gates only; no listing, seller, purchase, checkout, fee, commission, sale, payout, delivery, or refund workflow. |
| 6 | **Community Contribution** | Ecosystem value | Synthetic field-note pattern only; Community is not read or changed, and attention or recruiting signals create no status, reputation, eligibility, or compensation. |
| 7 | **Agency Builder** | Optional organization path | Synthetic stewardship principles only; **No live Growth Distribution**, qualification, organization read, participant count, or payment right. |

## Component and ownership map

| Surface | Canonical owner | What it owns here | Explicitly does not own |
|---|---|---|---|
| `lib/growthNetwork/experience.ts` | Growth Network experience | District registry, fixed disclosure copy, heartbeat, values, lenses, intent map, visit fixtures, deterministic Advisor projection | Identity, organizations, Community, Marketplace, reputation, analytics, eligibility, economics, Kai runtime, persistence |
| `lib/growthNetwork/previewFlags.ts` | Growth Network review boundary | One exact-string subordinate preview control | Growth activation, participant authorization, economic authorization |
| `app/review/growth-center/page.tsx` | Growth Center review route | Two-key server gate and post-gate dynamic stage import | Auth, membership, entitlement, data fetching, product navigation |
| `app/review/growth-center/stage.tsx` | Growth Center experience | Semantic composition, explicit review controls, local interaction state, unavailable-state copy | Canonical business truth, storage, effects, user/organization state |
| `growth-center.module.css` | Growth Center experience | Room-specific composition, atmosphere, reflow, focus, motion presentation | Facts, timing policy, data, cross-room visual redesign |
| `lib/cxos/runtime.ts` | CXOS Core Runtime | Pure lifecycle policy, capability fail-down, validated room contract | Growth facts, UI, data, commands, routing authority, effects |
| `useCxosRoomRuntime.ts` | CXOS Core Runtime adapter | Browser capability hydration, visibility pause, arrival/departure, one observer, focus handoff, native-scroll district movement | Fetch, storage, telemetry, models, Growth decisions, rendered UI |
| Root layout/providers | Existing application shell | Standard font/theme bootstrap, `SessionProvider`, global skip link, `TransitionShell` | Growth inputs, Growth records, Growth authorization |
| `scripts/growth-center-foundation.test.ts` | Growth Center review governance | Exact source and behavior invariants | Runtime program approval or legal approval |
| ADR-0041 | Founder/governance | Scope, ownership, authorization, rollback, evidence contract | Merge, public launch, participant program, economy |

### Protected owners remain unchanged

- **Identity** remains the identity owner. Growth reads no user or session fact.
- **Organizations** remains the organization and membership owner. Agency Builder reads none of it.
- **Community** remains the Community owner. Community Contribution creates no post, reaction, recognition, or presence state.
- **Marketplace** remains the commerce/catalog owner. Marketplace Preview creates no listing or transaction.
- **Kai** remains canonically the Credit Intelligence Officer. Growth Advisor is a route-local synthetic presentation role.
- **CXOS Core Runtime** owns presentation state only.
- **Growth Network** owns this review vocabulary, not money, billing, provider settlement, tax, or production participant records.

## Gating and deployment boundary

### Gate 1 — build identity

`reviewBuildAllowed()` returns false whenever `NEXT_PUBLIC_VERCEL_ENV === "production"`, regardless of other overrides. It permits development, Vercel Preview, or an explicitly enabled local production build used for verification.

### Gate 2 — subordinate preview flag

`growthCenterPreviewEnabled()` accepts only `GROWTH_CENTER_PREVIEW_ENABLED === "true"`. Missing values and alternate truthy spellings fail closed. The flag is server-only and independent from `GROWTH_NETWORK_ENABLED`.

### Import boundary

The page performs both checks before `await import("./stage")`. A denied request returns not-found and does not load the client room. The route inherits `/review` no-index metadata and has no registration in product navigation, the review hub, sitemap, Mission Control, Agency Command, Arena, Community, or a CXOS room registry.

### Preview isolation

Because the shared worktree contains unrelated local changes, a Vercel Preview must be produced from a curated snapshot: baseline SHA plus only the exact Growth Center, Growth foundation, required unchanged Core Runtime, documentation, and validation files. The shared branch must not be pushed merely to obtain a Preview.

## Deterministic experience contracts

### Fixed source

Every plan cites `GCF-PREVIEW-01 · fictional operator review fixture · 2026-07-31`. District evidence labels use `GCF-01` through `GCF-07` and explicitly deny live records.

### Growth Advisor resolver

Input is one of three explicit review lenses and one of six fixed questions. Output is an immutable district id, title, rationale, fictional source, and three human review steps. The function is pure and has no fallback to a model or free-text prompt.

Prohibited inputs and effects include:

- current time, random value, generated identifier, network response, cookie, local storage, session storage, indexed database, analytics, or telemetry;
- user, session, identity, organization, Community, Marketplace, customer, evidence, reputation, qualification, billing, or economic data;
- model SDK, API route, server action, form submission, task creation, schedule change, message, purchase, or persistence.

### First and return fixtures

`first` and `return` are explicit Director selections. They are never inferred. Reset restores the first fixture, building lens, and build-next question. The return fixture settles at Mentorship with copy stating that no history was read or saved.

## CXOS Core Runtime seam

The room declares:

- room id: `growth-center`;
- seven ordered districts;
- six arrival beats: orientation, contribution-principle, network-map, heartbeat, kai-recommendation, district-settlement;
- three motion channels: network-breath, contribution-flow, kai-beacon;
- bounded arrival timing for capability tiers A and B;
- local departure destination `/review` with bounded fallback.

Core Runtime returns presentation attributes and callbacks. It does not receive a participant, organization, opportunity, reputation, money, or program object. Invalid configuration, constrained capability, reduced motion, or an unavailable cinematic projection fails to the complete static document. Motion animates transform and opacity only; semantic information never depends on animation.

## Root-provider inherited session/theme caveat

The route is isolated at the Growth layer but still lives under the existing root layout. That layout:

- injects a theme bootstrap that may read the existing `theme` local-storage key;
- wraps children in NextAuth's standard `SessionProvider`, which may issue `/api/auth/session`;
- renders the existing `TransitionShell`, which is governed by its own registered-route policy.

These inherited behaviors are **not Growth inputs or Growth mutations**. Growth source does not import session/auth/theme/transition authority and does not branch on their values. Browser network evidence must distinguish the inherited session read from a Growth request. A later public or authenticated Growth route would require a separate ownership and privacy review; this preview does not authorize one.

## Data, database, and event ownership

| Concern | Foundation Preview decision |
|---|---|
| Database | None. No table, column, enum, relation, index, query, or connection. |
| Schema/migration | None. No Prisma change or migration. |
| Event production | None. The room emits no domain, integration, analytics, or audit event. |
| Event consumption | None. It subscribes to no bus, webhook, stream, queue, or source domain. |
| Browser storage | None from Growth source. Explicit fixture state lasts only for the mounted route. |
| API/server action | None. |
| Participant/organization data | None. |
| Evidence/reputation | No record, projection, score, verification, or case. |
| Economics | No amount, balance, rate, allocation, obligation, ledger, distribution, tax, settlement, payout, or provider instruction. |

Any future event or storage proposal must identify a canonical source owner, purpose, data classification, retention, access, correction, appeal where relevant, idempotency, deletion behavior, and an approved ADR before schema or runtime work.

## Security, privacy, and anti-abuse architecture

### Current controls

- Direct-route discovery is harmless because both server gates must pass and production identity is absolute-deny.
- Static fixtures prevent self-referral, duplicate-account, Sybil, collusion, contribution-gaming, and commission-fraud inputs from entering this room; there is nothing to credit, qualify, or pay.
- No free-text prompt, form, upload, URL input, or external link creates an injection or exfiltration surface.
- No model, database, network, storage, analytics, or telemetry path exists in Growth source.
- Every future capability is paired with explicit unavailable copy.
- Kai outputs are fixed, source-labelled, reversible by selection, and followed by a no-action receipt.
- The source guard allowlists imports and denies economic-shaped fields and effect-bearing APIs.

### What this preview does not prove

The preview is not an anti-fraud system. It neither detects nor adjudicates fake referrals, self-referrals, duplicate accounts, inactive organizations, collusion, Sybil attacks, or contribution gaming. Those concerns remain blocked future policy and source-domain architecture. Fixed synthetic content only ensures that none of those signals can affect this review.

### Threats and disposition

| Threat | Current disposition |
|---|---|
| Production flag misconfiguration | Production build identity still forces review off. |
| Preview mistaken for live opportunity | Persistent synthetic/no-live-program disclosure and district-specific unavailable boundaries. |
| Recruiting interpretation | First frame says recruiting is not rewarded; Agency Builder refuses headcount, purchases, popularity, XP, and Growth Reputation as future qualification inputs. |
| Kai authority inflation | Canonical identity preserved; route-local role; fixed inputs; fictional sources; no model or action. |
| Motion/accessibility failure | Complete semantic static state, reduced-motion media rule, capability fail-down, skip/escape/focus support. |
| Unrelated work leaked to Preview | Curated snapshot requirement; shared worktree is not a deploy source. |
| Future button becomes effectful | Any effect requires a new ADR, canonical owner, security/privacy/compliance review, tests, and separate Founder authorization. |

## Production safety

- Internal Founder review only; not public, participant-facing, indexed, or discoverable through normal navigation.
- No change to Mission Control, Agency Command, Arena, Community, Billing, Authentication, Organizations, Identity, or Marketplace backend.
- No Stripe, ACH, PayPal, crypto, bank, provider, tax, ledger, payment, payout, wallet, commission, referral economics, subscription, or production Growth Distribution.
- No schema, migration, API, event, model runtime, external asset, production data, or production mutation.
- No Growth Reputation or XP relationship is implemented.
- The Decision Matrix remains unratified and live economics remain NO-GO.
- Rollback is source removal only; there is no data or external-state rollback.

## Validation status

`PASS for protected Founder Preview — typecheck, touched lint, 205/205 Growth Center guard plus regression guards, optimized Preview/production-identity builds, production HTTP 404, protected Preview SSO/authenticated HTTP 200, desktop/tablet/mobile/320px/200% text/Axe/reduced-motion checks, compliance GO, and architecture documentation condition closed. Repository-wide lint remains red only on four unrelated pre-existing files.`

Required proof includes deterministic guard passes, exact import boundary, production hard-off, curated optimized build, rendered desktop/tablet/mobile/320px matrix, keyboard/focus/reflow/reduced-motion equivalence, performance, arrival/heartbeat/Kai/district/return behavior, observed network and write boundary, protected-surface diff, and secret review.

Evidence root: `GROWTH_CENTER_FOUNDATION_EVIDENCE/`  
Evidence bundle digest: `3fd5692270a95d7c3579d214d50e59bae02ba6aad9203c2e9353d75ebe2e8125`

## Founder checklist

- [ ] I approve the isolated `/review/growth-center` route and direct-link-only review model.
- [ ] I approve the exact seven districts and their ordered architectural planes.
- [ ] I confirm Growth Center—not Agency Builder or Marketplace—is the protagonist.
- [ ] I approve the two-key production-hard-off gating and post-gate dynamic import.
- [ ] I approve deterministic synthetic fixtures and the absence of live data.
- [ ] I approve Core Runtime as presentation lifecycle only, with Growth retaining experience meaning.
- [ ] I approve Kai's route-local Growth Advisor role and no-model/no-action contract.
- [ ] I accept the inherited root `SessionProvider`, theme bootstrap, and `TransitionShell` caveat for this review route.
- [ ] I confirm there is no schema, migration, event, API, model, or economic object.
- [ ] I confirm **No live Growth Distribution** and no recruiting incentive.
- [ ] I have reviewed validation and evidence identified above.
- [ ] I approve, amend, or reject the next non-economic phase.

## Next engineering phase

**Authorized next gate:** `GROWTH EXPERIENCE PHASE 1B — AUTHORIZED NON-MONETARY CONTRACT WORK`, limited to architecture, product specification, deterministic review fixtures, and protected Founder Preview work.

The phase should freeze district information architecture; define content provenance, quality, accessibility, and unavailable-state contracts; expand deterministic Advisor fixtures; model human review and appeal requirements on paper; and close the threat model for any later participant-facing experiment. It should not add identity, membership, participant data, storage, events, schema, runtime AI, Community integration, Marketplace integration, organization integration, enrollment, commerce, reputation, or economics.

`CGN ECONOMIC PHASE 1A — BLOCKED`. It requires Decision Matrix ratification, source-owner decisions, specialist review, and its own scoped Founder authorization. This architecture does not satisfy or bypass that gate.
