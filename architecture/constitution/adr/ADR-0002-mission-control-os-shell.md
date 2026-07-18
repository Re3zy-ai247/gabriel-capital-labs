# ADR-0002 — Mission Control as the Operating System Shell

- **Status:** PROPOSED (2026-07-18; **not merged** — awaiting founder approval)
- **Track:** Architecture (Stage 4 of ADR-0001 — Engineering Lifecycle, this constitution-track
  `architecture/constitution/adr/` series) — the authority Stage-7 production code for Mission
  Control must reference.
- **Authorizes:** Mission Control as the formal OS shell, and five new sub-surfaces it owns.
- **Compiles against:** Constitution v1.0 (Five Laws, two-world visual identity), KAI-UX-PRINCIPLES,
  KAI-DESIGN-LAWS, KAI-NOTIFICATION-STANDARD, KAI-DECISION-MODEL.

---

## Context

Implementation of "build Mission Control" began, and the reuse ledger (below) shows **Mission Control
substantially already exists** — the `/dashboard` route, titled "Mission Control," is a server-first
shell composing the existing deterministic engines. However, five requested surfaces —
**command palette, global search, notifications center, system health, and quick actions** — do
**not** exist anywhere in the codebase (verified) and are **not** named in Constitution v1.0 or any
approved ADR.

Per Constitution Art. VI and ADR-0001, *no production code may introduce a concept that does not
already exist inside the Constitution, an approved ADR, or ratified architecture; on discovering such
a gap, implementation STOPS and proposes an ADR — never silently invents.* This ADR is that stop.

## Reuse ledger *(what already exists — reuse-first, Art. VI.3)*

| Mission Control responsibility | Exists today | Engine / component / state |
|---|---|---|
| Global navigation | ✅ | `components/Sidebar.tsx`, `MobileNav`, `components/AppShell.tsx` |
| Active missions | ✅ | `components/mission/{MissionQueue,ExecutiveQueue}.tsx` over `lib/{missionEngine,execution}` |
| Recent activity | ✅ (partial) | `KaiEvent` stream (`lib/kaiEvents.ts`), `components/mission/CommandCenter.tsx` |
| Kai executive briefing | ✅ | `components/mission/MissionControl.tsx` over `lib/missionControl.ts` |
| System health (data) | ✅ (data only) | `HealthSignal` / `caseHealth` in `lib/missionControl.ts` — **no surface** |
| Quick actions | ⚠️ (one button) | AppShell "+ New Dispute" — **no first-class surface** |
| Notifications | ⚠️ (decide-only) | `KaiPresence` + `AnnouncementBanner`; `notify.plan` (`.ai/ADR/`-series ADR-0027) — **no center** |
| Command palette | ❌ | **new concept — no authority** |
| Global search | ❌ | **new concept — no authority** |

The shell itself (`AppShell` + `/dashboard`) is already the surface everything mounts inside; it is
monogram-only (audited across the executive shell and these five sub-surfaces — no rendered
character). **One pre-existing exception is recorded, not silently passed:** the community zone
renders the Shiba inline (`components/community/KaiAvatar.tsx`, via `KaiBadge` on `app/community/*`).
Community is a *distinct product zone* (Art. VIII), not an Art. III marketing/education surface, so
whether that render is permitted is an **OPEN founder two-world ruling** — the guard flags it as a
documented WARNING pending that decision (see Consequences / Open items).

## Decision

1. **Mission Control is ratified as the Operating System Shell.** All authenticated product surfaces
   mount inside it (`AppShell`); nothing bypasses it. This formalizes existing behavior — no new
   concept, extension-first.

2. **Authorize five new sub-surfaces, each bound by the Constitution.** They may be designed and built
   (Stages 5–7) once this ADR is approved:
   - **Command palette** — keyboard-invoked action/navigation launcher over *existing* routes and
     actions. **Not a chat route** (KAI-UX §4): it executes known commands, never free-form prompts.
   - **Global search** — retrieval over the user's own persisted records (accounts, letters, events).
     Evidence-first; returns records with provenance; never a question box for Kai. **Server-
     authorized and tenant-scoped:** results are filtered server-side to the authenticated session
     principal (never a broad query filtered client-side), never cross-tenant, and record identifiers
     or record content never appear in URLs or query strings.
   - **Notifications center** — an in-app, read-time surface over `KaiEvent` + `notify.plan`
     *decisions*. **Decision-only** (`.ai/ADR/`-series ADR-0027): no send path; calm cadence; no
     manufactured urgency (Law IV; KAI-NOTIFICATION-STANDARD).
   - **System health** — renders the existing `HealthSignal`/`caseHealth` data as calm status (gold
     for attention, never alarm-red; Law IV). Measured vs. assessed labeled honestly (Law II/V).
   - **Quick actions** — a small set of authorized, evidence-relevant actions (e.g., start a dispute,
     mail a prepared letter). Each is a *prepared* action the user commits (Identity §34 agency);
     never a sell/upsell (Art. VIII non-Kai commerce). **Server-authorized and gated:** *authorized*
     means the action is on the constitution/ADR-approved list **and** permission-checked at request
     time for the session principal; every action is entitlement-gated and dispatches only through the
     existing gated effect paths (the letters/mail routes under their current MAIL_LIVE / entitlement
     / proof-of-intent gates) — never a new, ungated effect handler.

3. **Constitutional bindings on all Mission Control surfaces** (non-negotiable): monogram-only, never
   the rendered character (Design Laws §11); possession-not-labor voice (Law I); evidence-strength not
   confidence (Law II); four-layer decisions where a recommendation appears (Law III); calm over
   urgency (Law IV); deterministic, fail-closed, receipts-only (Law V); Kai never introduces itself
   ("Hi, I'm Kai" is forbidden — Voice §9).

## Consequences

- The five sub-surfaces become authorized architecture; their Product Design (Stage 5) and
  Implementation Plan (Stage 6) follow, then code (Stage 7).
- Everything reuses existing engines/state; new code is confined to *surfaces* over existing data,
  plus the palette/search interaction layer. No new intelligence engine, no second event store.
- The two-world engineering invariant (Design Laws §11) is enforced by a guard shipped with this
  ADR (`scripts/two-world.test.ts`): it scans every `components/` + `app/` surface and fails on the
  character vectors it can see — the `/kai/states` asset path, the `kaiStateSrc` resolver, a product
  import of the marketing `kaiStates` catalog, and an inline-SVG character by its Shiba `aria-label`.
  It therefore blocks a **new** rendered character on any Mission Control surface. It does **not** by
  itself resolve the one pre-existing community render (above), which the guard exempts as a
  documented WARNING pending the founder's ruling; and it is a heuristic, not a proof — a render via
  an unforeseen vector would need the patterns extended.

## Open items (founder-gated — not resolved by this ADR)

1. **Community two-world ruling.** `components/community/KaiAvatar.tsx` renders the Shiba on the
   community product routes. Community is a *distinct product zone* (Art. VIII), not an Art. III
   marketing/education surface — so this render is either a two-world violation to remove, or a
   deliberately-permitted community exception to codify. The guard exempts it as a WARNING today; the
   founder resolves which. This item predates and is independent of the five sub-surfaces above.
2. **ADR namespace hygiene.** Two ADR registries coexist — this constitution-track
   `architecture/constitution/adr/` series (ADR-0001, ADR-0002) and the legacy `.ai/ADR/` series
   (ADR-0001…ADR-0027+). Cross-series citations here are now namespaced explicitly; a future pass
   should reconcile or clearly separate the two registries.

## Status / next step

Drafted, not merged. On founder approval this becomes the authority for Mission Control Stage-5→7
work. Until then, production code for the five new sub-surfaces is **blocked** by the discipline; the
existing Mission Control shell may be extended and brought to constitutional compliance under existing
authority.
