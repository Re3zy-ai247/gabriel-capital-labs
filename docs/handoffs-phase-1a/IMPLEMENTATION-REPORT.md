# CreditVector — Phase 1A Implementation Report

**Experience Runtime — per-agent detail: files, mechanisms, guard counts.**

Date: 2026-08-03 · Branch `feat/experience-runtime-phase-1a` @ `486925e` · Base `origin/main` @ `f449c35`
Governing brief: `.ai/PHASE-1A-BRIEF.md` (Program Director contract; hard constraints: zero schema, zero money/provider/CROA expansion, compliance bar on every copy change, reuse-first, validation before every commit).

Five serial agents (A→B→C→D→E), each committing its own bounded work, followed by one bounded fix pass closing the acceptance gate's blockers. **39 files changed, +3,690 / -391 lines** across the range, confirmed via `git diff f449c35..HEAD --stat`.

---

## Commit map

| # | Commit | Type | Files | Lines |
|---|---|---|---|---|
| 1 | `6e4b9d4a` | docs | 1 | +27 |
| 2 | `add8cd44` | feat(session) — Agent A | 2 | +701 |
| 3 | `11b6b9bc` | feat(mission-control) — Agent B | 6 | +388 / -149 |
| 4 | `f9fa4792` | feat(journey) — Agent C | 5 | +367 / -37 |
| 5 | `9843abac` | feat(mail) — Agent D | 12 | +1,162 / -116 |
| 6 | `42a97800` | feat(kai) — Agent E | 18 | +765 / -101 |
| 7 | `486925e` | fix(experience) — gate blockers | 14 | +362 / -70 |

(Per-commit file counts overlap — several files are touched by more than one agent. Net unique files touched across the whole range: 39.)

---

## Agent A — Session Runtime

**Commit `add8cd44`. New files only: `lib/operatorSession.ts` (411 lines), `scripts/operator-session.test.ts` (290 lines). Not wired into any page yet — B and E consume it next.**

A pure, fully-typed derived read-model. Zero AI, zero network, zero persistence, zero schema.

- **`buildOperatorSession(user)` / `assembleOperatorSession(inputs)`** produces:
  - `identity: OperatorIdentity` — `{ greetingName, altitude, onBehalfOf? }`. `altitude` is `"consumer" | "agency-owner" | "workspace"`, resolved from `account.isAgency` plus whether a client workspace cookie is present. `onBehalfOf` is populated only at `workspace` altitude (`{ clientName }`) — the "in Elena's workspace" register consumed by Mission Control and Kai.
  - `yesterdayCompleted[]` / `todayCompleted[]` — typed, capped accomplishment lists derived from the `KaiEvent` stream via `dayWindow(now, offset)`, mapped through `accomplishmentOf()` (one case per real event kind: `letter.generated`, `letter.mailed`, `response.received`, `mail.queued`, etc. — never a synthetic event).
  - `interruptedWork[]` — resumable states derived from live server data: unmailed letters and in-flight mail manifests, each carrying a `resumeHref`.
  - `todaysPriorities[]` — **composes existing engines, forks neither**: `pickRecommendation` / `getKaiHomeData` for consumer/workspace altitude, the agency roster ladder for agency-owner altitude.
  - `sessionClose: { doneToday, remaining }` — an honest rollup (see Fix Pass F3 below for the correction that landed after the acceptance gate).
- Guard: `scripts/operator-session.test.ts`, static + logic checks. Started at 290 lines; **currently 82/82 passing** (extended twice — once implicitly by later agents' own additions, once explicitly by the fix pass, +73 lines — see Validation).

---

## Agent B — Mission Control

**Commit `11b6b9bc`. `app/dashboard/page.tsx`, `lib/agencyRoster.ts` (new), `components/mission/{SessionBlocks.tsx (new), CommandCenter.tsx, MissionControl.tsx}`, `app/api/agency/clients/route.ts`.**

- **`lib/agencyRoster.ts`** (new, 98 lines) — extracts the agency needs-attention-first ladder computation out of `app/api/agency/clients/route.ts` (which shrank by 76 lines as a result) so **the dashboard and the API read one shared ladder**, not two independently maintained sorts.
- **`app/dashboard/page.tsx`** resolves altitude before rendering: `isAgency && no open workspace` → the Executive-Queue idiom over the roster ladder (basis-carrying rows, not a bare sort) instead of the consumer's own "upload your report" prompts — the exact confusion the brief named ("zero `isAgency` in the room today").
- **`components/mission/SessionBlocks.tsx`** (new, 152 lines) — the session-aware header consuming Agent A's `operatorSession`: greeting block, yesterday/today completed, "continue where you left off" (resuming `interruptedWork`), today's priorities, session-close block. Consumer and workspace altitudes keep the existing case room, framed by these new blocks.
- **`components/mission/CommandCenter.tsx`** — stat grid demoted to a compact context strip per the Operational Room Constitution proposal (metrics stay visible, stop being the headline).
- No new recommendation/priority engine anywhere in this slice — everything composes `kaiHome` / `ExecutionEngine` / the new roster module.

---

## Agent C — Case Journey

**Commit `f9fa4792`. `lib/kaiHome.ts`, `lib/mailCenter.ts`, `app/journey/page.tsx`, plus guard extensions to `scripts/kai-recommendation.test.ts` (+128 lines / 33 new checks) and `scripts/mailCenter.test.ts` (+17 lines).**

Fixes two live defects the original adversarial (Opus) simulation review found (SIM-REVIEW.md findings 3 and 5) and adds the Case Journey progression panel.

- **Branch-5 ranking** (`lib/kaiHome.ts`) — undisputed-tradeline candidate selection now ranks by `score`/`probability` with a deterministic tie-break (oldest `createdAt`, then `id`) instead of raw DB/array order.
- **Storage-free starvation guard** — branches 1 and 2 (verified-no-follow-up; lapsed window) track how long they've sat un-actioned. Once either has sat a full extra §611 window (the `REINVESTIGATION_DAYS` constant — 30 days), the primary recommendation slot yields to the §605 branch for that cycle, while the absorbed item demotes to a new optional secondary field instead of silently disappearing. No new table, no new column — computed on read.
- **`WATCHING_CLOCK_LINE`** exported from `lib/mailCenter.ts` and rendered in any mailed/unanswered row whose health is `WAITING_NORMALLY` — the same reassurance Mission Control already showed, reused verbatim rather than re-typed, now also reaching Mail Center rows and (via C's journey work) the Timeline.
- **`app/journey/page.tsx`** — new Case Progression panel: current step → next step → Kai's recommendation (plus its starvation secondary, if any) → timeline → evidence → waiting period → next review. Composed entirely from data already loaded on the page plus one reused `getKaiHomeData()` call — no new engine. The existing "Coming up" list also gained the watching-the-clock line.

---

## Agent D — Mail Center: Download Workflow + §611 Honesty

**Commit `9843abac`, the largest single slice: 12 files, +1,162/-116. `app/letters/page.tsx`, `app/letters/print/[id]/page.tsx`, `app/mail/page.tsx`, `app/mail/send/[letterId]/page.tsx` (+7 lines only), `app/mail/download/[packageId]/page.tsx` (new), `app/mail/download/[packageId]/DownloadApproval.tsx` (new), `lib/mailCenter.ts`, `lib/forecast.ts`, plus guards.**

### Derived Dispute Packages
Letters group by `tl:{tradelineId}:{strategy}:{round}` — the exact unit one generate call produces (`packageKeyFor`, `lib/mailCenter.ts`); a single ungrouped letter falls back to `solo:{letterId}`. Per-package rollup health is the **least-progressed member**, never the best-looking sibling, plus an honest "N of M mailed" fraction (`mailedFraction`) when a package's letters diverge (SIM-REVIEW finding 10).

### One recommended-action band
`pickMailBand` defers entirely to `getKaiHomeData`'s own recommendation, falling back to kaiHome's secondary note or its own sorted deadlines when the top pick isn't mail-scoped — never a second, independently-ranked ladder (finding 13).

### Evidence drawer
Real letters, self-attested mailing records, and responses render; send-only artifacts (certified-mail receipt, tracking) always render as labeled-unavailable, never faked.

### Download Package review flow (`app/mail/download/[packageId]/`)
New route: letters list + PDF preview links → Kai Summary panel slot (filled by Agent E, below) → an Approve control rendered **outside** any Kai-labeled panel (`DownloadApproval.tsx`) → per-letter download checklist reusing the existing print route verbatim (no new PDF dependency). Approve is a local, non-persisted confirmation — this fixes, for the Download context, the conflation the brief flagged at `app/mail/send/[letterId]/page.tsx:165-205` (an Approve control that read as coming from Kai).

### The §611 honesty triple
1. **Receipt-anchored math, not mailing-anchored.** `lib/forecast.ts` adds `MAIL_TRANSIT_DAYS = 5` (a documented USPS-upper-bound transit allowance) and `daysElapsedSinceEstimatedReceipt(mailedAtMs, now)`, which returns `max(0, floor((now - mailedAtMs) / DAY) - MAIL_TRANSIT_DAYS)`. Applied consistently in `lib/forecast.ts`, `lib/mailCenter.ts`, and `app/letters/page.tsx`'s storyline/progress bar; fixes the print page's "mark it mailed so I can track the window" instruction (`app/letters/print/[id]/page.tsx:153-154` in the pre-Phase-1A version) to state the estimate honestly: *"the window starts when the bureau receives it — typically N days after mailing."*
2. **Evidence-asymmetry disclosure** at every Download/Send fork: *"Evidence differs by path: self-mail leaves your own mailing record as proof. CreditVector Fulfillment (soon) adds a certified-mail receipt and tracking evidence once it's live."* — appears at 4 render sites (`app/letters/page.tsx` ×2, `app/mail/send/[letterId]/page.tsx`, `app/mail/download/[packageId]/page.tsx`), confirmed by direct source search. Flagged in `FOUNDER-SUMMARY.md` §7 for a CCO ruling on the "(soon)" framing.
3. **Real mailing-date capture.** Marking a letter mailed now prompts for the actual date (defaulting to today, not silently assumed), validated server-side via `lib/mailCenter.ts`'s `validateMailedAtInput` (rejects future dates and dates before the letter's own generation date).

### Guards
`scripts/mailCenter.test.ts` +19 checks this commit (extended again in the fix pass; **62 checks currently pass**, all green — see Validation). New `scripts/mail-download.test.ts`, 188 lines / 41 checks this commit (pickMailBand ladder, `validateMailedAtInput`, static one-ladder law, static Approve-outside-Kai, static §611 no-mailing-anchor checks; **currently 50/50** after the fix pass added 23 more lines). `scripts/forecast.test.ts` +8 checks this commit (**19 checks currently pass**).

---

## Agent E — Kai Experience

**Commit `42a97800`. 18 files, +765/-101 — the widest-reaching single commit (touches admin, agency, onboarding, register, sidebar, and Kai components).**

1. **KaiPresence cache fix** (SIM-REVIEW finding 4, a live defect). `sessionStorage` key `kai-presence-ctx-v1` carried no user/workspace scope, and the fetch-before-guard ordering let a visit to an excluded route (`/dashboard`, `/journey`) fetch and populate the cache *before* the render guard hid it — the exact "open a client's workspace, land on `/dashboard`, and see the wrong cached presence" mechanism the finding named. Fixed at the root (`components/kai/KaiPresence.tsx:18`): the excluded-route check now runs first, inside the fetch effect itself — no fetch, no cache write, full stop, on those routes. Additionally, every workspace/account transition clears the cache explicitly (the workspace cookie is `httpOnly` and unreadable client-side, so the cache can't self-correct): `app/agency/page.tsx`'s `openClient()`, `components/AgencyBar.tsx`'s `exit()`, and both sign-out paths in `components/Sidebar.tsx`. (A fourth switch point — admin impersonate — was still open at gate time; closed in the fix pass as F8, below.)
2. **Emoji / range-law fix.** `app/api/letters/[id]/round2/route.ts:40` — the party emoji is gone from the deleted-item response; it now states the fact, then the guidance, factually (finding 14).
3. **Onboarding truth.** New `lib/onboarding.ts` (80 lines, pure derivation + thin loader, mirrors `kaiHome`'s own split) — each of the 5 onboarding steps now derives from the **same real signal its own target page already uses** (profile mail-ready fields, Report/Tradeline/Letter counts, any letter mailed), replacing "visited the page" as the definition of "complete." Wired the front door: `app/register/page.tsx` now redirects brand-new accounts to `/onboarding` (was `/dashboard`); a `components/Sidebar.tsx` nav entry appears only while onboarding is genuinely incomplete, gated so an agency owner with no workspace open is never nagged to upload "their" report. Supporting: `app/api/onboarding/status/route.ts`, `components/onboarding/useOnboardingStatus.ts`, `app/onboarding/OnboardingSteps.tsx`, `app/onboarding/page.tsx` (rewritten, 124 lines net).
4. **Everyday on-behalf-of + greeting register** (SIM-REVIEW minimum-set item 3). `SessionHeader` originally greeted by UTC time-bucket ("Good morning/afternoon/evening") with a workspace variant reading naturally ("you're in Elena's workspace"); the time-bucket half was later found wrong ~8h/day and removed in the fix pass (F7, below) — the on-behalf-of half is unchanged and shipped as designed. The session-close block moved into Kai's own register ("Still open" / "Quiet is allowed — nothing needed you today").
5. **Kai Package Summary.** Fills the Download page's reserved slot with a deterministic digest (`lib/mailCenter.ts`'s `buildPackageSummary`): what the package contains, the strategy basis (`lib/strategies.ts`'s own table, reused verbatim), the receipt-anchored window rule after mailing (reuses this file's own `windowText()`), and the canonical self-mail evidence line (`pkg.evidence.selfMailNote`, reused, not re-drafted). Zero AI. The Approve control stays outside the panel (per D's design).
6. **Receipt-anchor reconcile.** `app/journey/page.tsx` and `lib/intelligence/snapshot.ts`'s day-math now call `lib/forecast.ts`'s `daysElapsedSinceEstimatedReceipt` instead of a bare `mailedAt` diff, so the §611 estimate agrees with the Mail Center's everywhere on these two surfaces. `lib/missionEngine/engine.ts` was checked and verified already clean (no local `mailedAt` math needing reconciliation).

Guard: new `scripts/kai-experience.test.ts`, 255 lines / 80 checks this commit (**currently 78/78** — the fix pass both extended and adjusted this file, net -2 from the F7 greeting-copy change removing what it tested).

---

## Fix Pass — Closing the Acceptance Gate

**Commit `486925e`, `fix(experience): gate blockers — download reachability, §611 anchor, honest quiet state (phase 1a)`. 14 files, +362/-70.** Closes blockers F1/F2/F3 (see `VALIDATION.md` for the gate's full verdict) plus riders F6/F7/F8. Every fix below was read from the actual diff while building this package, not taken on faith from the commit message (which carries no body beyond its subject line).

| Fix | Files | Mechanism |
|---|---|---|
| **F1** — Download unreachable before mailing | `lib/mailCenter.ts`, `app/mail/page.tsx`, `app/letters/page.tsx`, `app/mail/download/[packageId]/page.tsx`, `app/api/letters/route.ts` | New `MailHealth` value `READY_TO_PREPARE` for a package whose members are *all* still un-mailed (`groupIntoPackages` previously `continue`d past — silently dropped — any package with zero in-mail members, `HEALTH_PROGRESS_RANK.READY_TO_PREPARE = -1`, documented as never actually compared). `app/mail/page.tsx` now renders two honestly-separated groups, "Ready to prepare" and "In the mail," so a not-yet-mailed package is never mistaken for a live §611 signal. `app/letters/page.tsx` adds a direct "Review & download package" link computing the *same* derived package id client-side via a small duplicated `packageIdFor()` (not imported — `lib/mailCenter.ts` pulls in `@/lib/mail` → `prisma`, and this is a `"use client"` page; CLAUDE.md gotcha 2). `app/api/letters/route.ts` newly exposes `tradelineId` on the letters payload (existing field, no schema change) to make that client-side computation possible. |
| **F2** — §611 split-brain in `deadlinesFrom` | `lib/kaiHome.ts` | `deadlinesFrom()` now calls `daysElapsedSinceEstimatedReceipt()` (imported from `lib/forecast.ts`) instead of a bare `Math.floor((now - mailedAt) / DAY)`. `pickRecommendation`'s lapsed-window branch copy reworded from "Day N since Round X was mailed" to "Estimating from receipt, day N of the ~30-day window" so the copy matches what the number now actually means. |
| **F3** — Dishonest quiet state | `lib/operatorSession.ts` | `consumerPriorities()` gained an `interruptedWork` parameter: when `kai.recommendation` is null but real interrupted work exists, its first entry is promoted to the top priority (new `RESUME_BASIS` map, one honest phrase per interrupted-work kind, paraphrasing — never inventing — `interruptedWorkOf`'s own label). `sessionCloseOf()` gained the same parameter: "remaining" now also counts interrupted-work items not already promoted to a priority (deduped by `href` via a `Set`, so nothing is ever double-counted). |
| **F6** (rider) — receipt-anchor language, distributed further | `lib/operatorSession.ts` | `accomplishmentOf`'s `letter.mailed` label changed from "the §611 clock started" to "the §611 clock starts once the bureau receives it"; `agencyPriorities`' needs-attention basis reworded from "Day N since the last round" to name explicitly that the window "begins when the bureau receives it." |
| **F7** (rider) — wrong-8-hours-a-day greeting | `lib/operatorSession.ts`, `components/mission/SessionBlocks.tsx` | `greetingPeriod()` / `GreetingPeriod` / `OperatorIdentity.timeOfDay` **removed entirely** (not merely unused) — CreditVector collects no per-user timezone, so a UTC-bucketed "Good morning" read wrong for roughly 8 hours of any US user's day. `SessionHeader` now reads the neutral, timezone-independent "Welcome back, {name}." |
| **F8** (rider) — 4th cache-bleed switch point | `app/admin/users/page.tsx` | The admin "impersonate user" action now calls `clearKaiPresenceCache()` and `clearOnboardingStatusCache()` before navigating to `/dashboard` as the impersonated user — closing the same class of bug Agent E fixed at three other switch points (open/exit a client workspace, sign out), which the gate found still open here. |

### Guard deltas in the fix pass
`scripts/operator-session.test.ts` +73 lines (72 → 82 passing), `scripts/kai-experience.test.ts` +46 lines net (→ 78 passing), `scripts/kai-recommendation.test.ts` +23 lines (→ 45 passing), `scripts/mail-download.test.ts` +23 lines (→ 50 passing), `scripts/mailCenter.test.ts` +27 lines (→ 62 passing). `scripts/schema-safety.test.ts` untouched, re-run green (17/17).

---

## Files touched, full list (39)

```
.ai/PHASE-1A-BRIEF.md
app/admin/users/page.tsx
app/agency/page.tsx
app/api/agency/clients/route.ts
app/api/letters/[id]/round2/route.ts
app/api/letters/[id]/route.ts
app/api/letters/route.ts
app/api/onboarding/status/route.ts
app/dashboard/page.tsx
app/journey/page.tsx
app/letters/page.tsx
app/letters/print/[id]/page.tsx
app/mail/download/[packageId]/DownloadApproval.tsx
app/mail/download/[packageId]/page.tsx
app/mail/page.tsx
app/mail/send/[letterId]/page.tsx
app/onboarding/OnboardingSteps.tsx
app/onboarding/page.tsx
app/register/page.tsx
components/AgencyBar.tsx
components/Sidebar.tsx
components/kai/KaiPresence.tsx
components/mission/CommandCenter.tsx
components/mission/MissionControl.tsx
components/mission/SessionBlocks.tsx
components/onboarding/useOnboardingStatus.ts
lib/agencyRoster.ts
lib/forecast.ts
lib/intelligence/snapshot.ts
lib/kaiHome.ts
lib/mailCenter.ts
lib/onboarding.ts
lib/operatorSession.ts
scripts/forecast.test.ts
scripts/kai-experience.test.ts
scripts/kai-recommendation.test.ts
scripts/mail-download.test.ts
scripts/mailCenter.test.ts
scripts/operator-session.test.ts
```

Zero files under `prisma/` appear in this list — confirmed by `git diff f449c35..HEAD -- prisma/` returning no output. No file under any money/billing/provider path (`stripe`, `wallet`, `billing`, `letterstream`, `provider`) appears in this list except `app/mail/send/[letterId]/page.tsx`, whose entire change is the 7-line evidence-asymmetry disclosure described under Agent D above — no functional change to the send/pay path itself.
