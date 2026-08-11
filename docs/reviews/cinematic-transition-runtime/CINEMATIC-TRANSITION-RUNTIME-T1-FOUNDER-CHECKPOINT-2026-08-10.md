# Cinematic Transition Runtime — T1 Founder Checkpoint

**Date:** 2026-08-10/11 · **Author:** Fable 5 (coordinator/design authority; Sonnet implementation, Opus adversarial gate)
**Branch:** `feat/cinematic-transition-runtime-t1` from `origin/main` @ `a72a47c` · worktree `~/Documents/worktrees/cinematic-transition-runtime-t1`
**Companion:** `CINEMATIC-TRANSITION-RUNTIME-AUDIT-2026-08-10.md` (the repository audit this wave rests on), `T1-SPEC.md` (binding spec, amendments T1.1/T1.2 recorded).

## 1 · What T1 is

The reusable **journey state machine** the whole cinematic program will build on — the
Founder's grammar (MOVE → DISCOVER → TRAVEL → ARRIVE → OPERATE) as an engineered,
tested runtime, not choreography. Phases `settled → intent → departing → traveling →
arriving → settled` (+ `recovering`), synthesizing the three proven in-house grammars:
CXOS sequence-cancellation and tier ladder, HELIOS journey laws (route-commit
discipline, governed Esc, separate clocks, RM full citizenship), and the production
`TransitionShell` fail-open ethic. No product room was modified; nothing global was
mounted; the demo lives behind the existing `/review` production 404 hard-off.

## 2 · What was built (17 new files, 0 modified)

| Layer | Files |
|---|---|
| Pure machine | `lib/transition-runtime/{types,machine,pacing}.ts` — zero React/DOM, injectable clock, 8 laws |
| React adapter | `components/transition-runtime/{TransitionRuntimeProvider,TravelLayer,RoomReady}.tsx` |
| Demo (review-gated) | `app/review/transition-runtime/{page,layout,[room]/page,[room]/DemoRoom,[room]/roomsShared}` |
| Guards | `scripts/transition-runtime.test.ts` — **153/153**, deterministic manual clock |
| Docs | `docs/reviews/cinematic-transition-runtime/` — spec + audit + this checkpoint (+ HTML twins) |

Machine laws (each guard-pinned): monotonic **sequence** cancellation (input never
blocked); **route commits exactly once** at departing→traveling; retarget **supersedes
pre-commit / ignored post-commit**; **governed Escape cancel** pre-commit; named
per-phase timers with deterministic destroy; **fail-open clocks** (readiness timeout
1000 ms, journey hard cap 1800 ms; worst-case cinematic chain 1640 ms < hard cap,
pinned as a static inequality guard); **immediate mode** for reduced-motion/tier C-D/
hidden documents — deterministic INTENT → DESTINATION → ACTIVE with zero veil.

## 3 · Validation (all executed, all green)

- `npm run typecheck` clean · `NEXT_PUBLIC_CXOS_REVIEW=1 npx next build` clean (70/70 pages; also clean without the flag).
- Guard suite **153/153**: 16 spec scenarios + T1.2 regressions (seeding/recovery, pacing inequality, readiness predicate) + machine-purity greps + the **isolation gate** (diff vs `a72a47c` must touch only T1-allowlisted paths — this gate caught and forced repair of a transient `.claude/launch.json` overwrite during the session; the tracked file is byte-identical to `a72a47c`).
- **Live browser evidence, reduced-motion path** (this Mac forces reduce in every Chromium): journey resolves `settled / seq 1 / immediate / D`, real route swap, zero veil — the deterministic reduced path, verified in the pane.
- **Live browser evidence, cinematic path** (Playwright `reducedMotion: 'no-preference'` per-context emulation — the CXOS-proven override): full grammar across a **real router.push**: departing (veil fade-in over origin) → traveling (veil opaque, pointer-intercepting, `<main>` ownership-marked `inert`, destination mounts beneath, RoomReady fires) → arriving (veil release) → settled with **focus handed to the destination H1**. Zero inert residue after settle.
- **Regression drive for the adversarial fixes:** browser-back after a journey then 2.4 s wait — location never hijacked (the pre-fix stale verify-timer bug, live-reproduced before, gone after). Self-navigation click starts no journey. Escape mid-departing recovers to origin with no commit.

## 4 · Adversarial gate (Opus, three lenses) and disposition

**0 Critical · 5 High (deduped) · 8 Medium · 7 Low.** All Highs and all actionable
Mediums FIXED in the T1.2 pass and re-verified live:

| # | Finding (sev) | Disposition |
|---|---|---|
| 1 | Stale router-verify timer hijacks back-navigation (High, live-reproduced) | **Fixed** — timer cleared on popstate + cancelled/failed/recovered + sequence-scoped callback; regression-driven |
| 2 | Self-navigation blackout; readiness bound to component MOUNT (High — foundation defect) | **Fixed** — RoomReady is subscription-based (`roomId` predicate), self-nav guarded in portal + adapter |
| 3 | Keyboard reaches content behind the opaque veil (High) | **Fixed** — ownership-marked `inert` on `<main>` during traveling (GCL law); disclosed residual: destination `<main>` mounting mid-traveling is unmarked, bounded by 1000 ms |
| 4 | Pacing inconsistency: hard cap truncated fail-open arrival (Med) | **Fixed** — readyTimeoutMs 1400→1000; inequality guard-pinned |
| 5 | False "ready" announcement + focus steal on cancel/recovery/hard-cap (Med) | **Fixed** — announce policy keyed on previous phase; hard-cap settle silent |
| 6 | popstate ignored pre-commit (Med) | **Fixed** — pre-commit back = governed cancel |
| 7 | Post-commit clicks preventDefault'ed then dropped (Med) | **Fixed** — rejected requests fall through to the real link |
| 8 | Machine never seeded with starting room (Med) | **Fixed** — `initial` option; layout seeds from `useParams()` |
| 9 | Spec/audit claimed the machine itself calls `location.assign` (Low, doc honesty) | **Fixed** — law 6 reworded; adapter's router-verify is the only assign, only for a genuinely failed push |

**Accepted with disclosure (design policy, not defects):** click-through during the
280 ms departing fade is the deliberate retarget window (spec law 3) · the Escape
window equals departingMs (≤280 ms) in T1's skeleton — T2's real departure choreography
widens it · consecutive identical announcements coalesce (aria-live) · `tabindex="-1"`
left on the focused H1 · guard suite has no automated a11y assertions yet (T2 adds
axe coverage when there is real choreography to test).

**Independently verified sound by the gate:** isolation (tracked diff vs `a72a47c`
empty pre-commit; only T1 paths untracked) · frozen-surface law (zero changes under
`lib/cxos/`, `components/cxos/`, `app/review/agency-command/`) · production hard-off
(`/review*` 404 by construction; no T1 module imported by any production chunk) ·
machine deadlock-freedom (every non-settled state is timer- or signal-covered) ·
reduced-motion double-lock (tier D at detectTier AND forced-immediate at the machine
boundary — no bypass found).

## 5 · Environment law re-proven this session

This Mac forces `prefers-reduced-motion: reduce` in every Chromium: every pane
screenshot shows only the immediate path. Cinematic-path claims in this program are
valid **only** from per-context emulation (Playwright/CDP) or the deterministic guard
suite — both were used here. The demo's `t1-demo` launch entry (session launch.json)
serves the flagged build at `localhost:3041/review/transition-runtime` for desk review.

## 6 · Status against the brief

| Checkpoint item | Status |
|---|---|
| Frontend Design skill | LOADED (official repo; mapping in audit §5) |
| Repository / lineage | Monorepo `gabriel-capital-labs`, `origin/main` @ `a72a47c`; unambiguous |
| Target surface | CreditVector product app (root `app/`); GCL site out of scope for rooms; HELIOS separation preserved |
| T1 implementation | **COMPLETE** (T1.1 + T1.2 amendments recorded in spec) |
| Tests | 153/153 deterministic guards; typecheck + build clean |
| Visual review | **PASS** — desktop cinematic (emulated no-preference) + reduced path (native); mobile visual pass deferred to T2 (demo is skeletal; machine's tier-B band guard-tested) |
| Adversarial findings | 0 Critical / 5 High / 8 Med / 7 Low — all High+actionable-Med fixed & re-verified |
| P0 / M2 isolation | **PASS** (guard-enforced allowlist; M2 clone untouched) |
| Production mutations | **NONE** (no push, no merge, no deploy, no flags; demo 404s in production) |
| Background readability | **PARTIAL** (audit §4: RC1 correction regressed by RC2 0.30→0.42/0.72, prod-inert; Ecosystem wing 0.5 AA fail live on the GCL site; treatment: preserve Codex approach, harden in T2, no darkening pass now) |

## 7 · Recommended next wave — T2

**Persistent Shell + Departure/Arrival Grammar** (audit §7): route-group layout
hosting one AppShell (44 pages de-duplicated — the structural root cause), journey
runtime wired for dashboard ↔ agency ↔ arena with skeletal departure/arrival, the
readability hardening via state-aware environmental recede, and the re-entry veil
policy decision applied.

## 8 · Founder decisions queued (none block review of T1)

1. Authorize T2 (the persistent-shell migration is the one structural change).
2. Registry/`CRITICAL_NEVER` policy for which room pairs may animate (T3 gate; guard-pinned law).
3. Re-entry veil policy for MissionEntry/ArenaEntry once the shell persists (current replay is pinned design).
4. CXOS readability values: re-assert RC1's 0.30/0.46 recede or ratify RC2's 0.42/0.72 before any CXOS promotion.
5. Ecosystem-wing full-motion 0.5 contrast fix on the live GCL site (small, separate surface).

**STOPPED per the brief.** No T2 work begun. No push. Awaiting Founder review.
