# CXOS Phase 4 — Authenticated Entry & Mission Control · Report

**2026-07-29 · branch `feat/cxos-phase3` · Status: BUILT, VALIDATED AGAINST A REAL AUTH STACK, DELIVERED FOR FOUNDER REVIEW**
**No merge. No production deployment. Production authentication untouched. No login bypass exists.**

> Successful authentication → clearance → systems waking → evidence online → Kai's executive
> brief → command transferred. The entry plays over the **real** dashboard on **real resolved
> state only**, and the room beneath it is the product that already runs — audited, preserved,
> and given its Command Header. The Founder-access blocker is diagnosed from evidence, the safe
> access mechanism is built and proven inert until one owner action, and everything is
> reviewable today through the Founder Review System.

---

## 1. Diagnosis — why the Founder cannot log in to the protected Preview

**Proven from repository truth** (each item is evidence, not guess):

1. **The Preview shares the Production database.** CLAUDE.md's owner-corrected note
   (2026-07-20, from the `db push` incident investigation) records `DATABASE_URL` as **one
   shared value across Production+Preview** — the incident's build logs showed preview builds
   pushing DDL to the production endpoint. Therefore "preview database has no account" is NOT
   the cause: whatever database the preview points at contains the production accounts.
2. **Demo access is OFF on previews.** `currentUserOrDemo()` and `/api/demo/seed` are gated by
   `NODE_ENV === "production"` — and Vercel preview builds run with `NODE_ENV=production`. The
   app is not explorable on a preview without a real sign-in. No preview seed exists.
3. **The login flow itself is same-origin.** `signIn("credentials", { redirect: false })` +
   client-side `router.push` — the credentials POST goes to the preview's own `/api/auth`,
   so a NEXTAUTH_URL pointed at production does not break the sign-in POST itself.
4. **NextAuth v4 derives its origin from env** (`NEXTAUTH_URL`, falling back to `VERCEL_URL`),
   and `authOptions` reads `NEXTAUTH_SECRET` with no fallback. In a production-mode build,
   NextAuth **fails all of `/api/auth/*` when NEXTAUTH_SECRET is absent** — and the login page
   surfaces that as the same generic "We couldn't sign you in." as a wrong password.
   **This class of failure was reproduced live during validation**: running the stack without
   a correct URL/secret env produced exactly the broken-flow symptoms (the sign-out redirect
   bounced to a dead origin until `NEXTAUTH_URL` was scoped correctly).

**Classification (mandate taxonomy):** most probable — **environment-variable mismatch:
`NEXTAUTH_SECRET` (and/or `NEXTAUTH_URL`) not scoped to Vercel's Preview environment**, i.e.
values exist for Production only. Secondary — Vercel Authentication interaction (the SSO wall
must be passed in the same browser first; it does not block the same-origin POST afterward).
Ruled out by evidence: missing preview account (shared DB), account disabled (owner signs into
production), missing seed (none exists by design), cookie mechanics (host-scoped, same origin).

**Decisive check the Founder can run in 10 seconds (no secrets involved):** open
`https://<preview-url>/api/auth/providers` in the browser (after passing Vercel SSO).
- **JSON with a `credentials` entry** → NextAuth is alive; the env is fine; retest login and
  watch the network tab's `/api/auth/callback/credentials` status.
- **500 / error page** → `NEXTAUTH_SECRET` is not scoped to Preview. Fix in Vercel → Settings →
  Environment Variables: edit `NEXTAUTH_SECRET`, tick **Preview** (use a DIFFERENT value than
  Production), and **remove `NEXTAUTH_URL` from Preview scope** (NextAuth v4 then derives the
  per-deployment URL from `VERCEL_URL`). Redeploy the branch.

**⚠️ THE STOP (mandate-required):** even with login fixed, signing into a preview today would
authenticate **branch code against the PRODUCTION database**. Phase 4 therefore did **not**
create any account anywhere real, and the bootstrap below **refuses to run** until the owner
attests database isolation. Signing into previews with production credentials is also
explicitly out (mandate: no production credentials).

## 2. The safe Founder access method (built, proven, inert until one owner action)

Option B of the mandate's preference order — an explicit, idempotent, Preview-only founder
bootstrap: **`POST /api/cxos/founder-bootstrap`** (`app/api/cxos/founder-bootstrap/route.ts`).

Gate order (each proven live, three of them by mutation):
1. `VERCEL_ENV === "production"` → **404, first line, unconditional** — proven against a
   running production-env server presenting every secret: 404.
2. Not preview and not local dev → 404.
3. **`CXOS_PREVIEW_DB_ISOLATED !== "1"` → 409 with the explicit shared-database refusal** —
   the stop is enforced in code, not in documentation. Proven live: 409.
4. `CXOS_FOUNDER_BOOTSTRAP_SECRET` unset → 404 (the route does not exist without it); header
   `x-cxos-bootstrap` compared timing-safe; wrong secret → 404. Proven live.
5. Rate limited (5/hour — it engaged by itself during validation and was recorded).

What it creates (idempotently, upsert by unique email; re-runs report `created:false`):

| Account | Login identifier | Projection | Role |
|---|---|---|---|
| `CXOS Review — Synthetic Consumer` | `cxos.review.consumer@preview.creditvector.app` (or `cxreview-consumer`) | consumer | USER (minimum) |
| `CXOS Review — Synthetic Agency` | `cxos.review.agency@preview.creditvector.app` (or `cxreview-agency`) | agency | USER + `isAgency` |

The password is **whatever the owner sets in `CXOS_FOUNDER_REVIEW_PASSWORD`** — no static
credential exists in the repository (mutation-proven), none is echoed by the route
(response carries identifiers only, checked), none appears in this report, the recordings, or
the screenshots (the local validation used throwaway values that never leave the container).

### 2.1 Vercel setup steps (owner; no secret values appear here)

1. **Provision a separate Preview database** (e.g. a second Prisma Postgres/Neon database).
   In Vercel → Settings → Environment Variables: edit `DATABASE_URL`, **un-tick Preview from
   the production value**, and add a Preview-scoped `DATABASE_URL` pointing at the new
   database. *(This also permanently ends the preview-build-touches-production-data class of
   risk the db-push incident exposed.)*
2. Scope `NEXTAUTH_SECRET` to **Preview** with a fresh value (generate per `.env.example`);
   **remove `NEXTAUTH_URL` from Preview scope**.
3. Add, **Preview scope only**: `CXOS_PREVIEW_DB_ISOLATED=1`,
   `CXOS_FOUNDER_BOOTSTRAP_SECRET=<fresh random>`, `CXOS_FOUNDER_REVIEW_PASSWORD=<your review password>`.
4. Redeploy the branch. Run the Preview schema setup once (`prisma db push` against the NEW
   isolated preview database only — never production; MIGRATION-FIRST governs production, and
   this database is a disposable review fixture).
5. From a terminal:
   `curl -X POST -H "x-cxos-bootstrap: $SECRET" https://<preview-url>/api/cxos/founder-bootstrap`
   → `{"ok":true,...}`. Sign in on the preview with the synthetic identifier + your password.

### 2.2 Revocation and cleanup

- **Revoke:** same call with `?revoke=1` → both accounts `disabled=true`. Disabled accounts are
  refused at sign-in AND evicted from live sessions (`lib/auth.ts` + `lib/session.ts`, both
  pre-existing and guard-pinned). Proven in validation.
- **Disarm:** delete `CXOS_FOUNDER_BOOTSTRAP_SECRET` (route ceases to exist → 404) and/or
  `CXOS_PREVIEW_DB_ISOLATED` (hard 409).
- **Cleanup:** the synthetic rows live only in the disposable preview database; drop that
  database to remove every trace. Row deletion is deliberately not offered — user hard-deletes
  are constitutionally contained (Implementation Slice 0).

## 3. Repository state

| Item | Value |
|---|---|
| Branch | `feat/cxos-phase3` (continues the CXOS line; production truth `f449c35` already merged in Phase 3) |
| Phase 4 commit | `81c39e3` (implementation + guards) |
| Preceding | `3848fde` Phase 3 delivery · `691ea7a`/`00ffc2c` Phase 3 slice · `7b1d2fd`+`0e3957e` production-truth merge |
| Live preview (protected by Vercel Authentication) | `https://gabriel-capital-labs-git-feat-cxo-06bc43-rey-gabriel-s-projects.vercel.app` |
| Login URL | `<preview>/login` (works after the owner actions in §2.1; today it is blocked by the diagnosed env scoping + the DB stop) |
| Mission Control live-review URL | `<preview>/dashboard` (after §2.1) — first entry plays on sign-in |
| Review stage | `<preview>/review/mission-control` — **works TODAY, no auth, synthetic data** |
| Consumer / agency review | the stage's projection selector; live: the two synthetic accounts after §2.1 |

## 4. What was built

- **`MissionEntry`** — the authenticated entry. Five beats on real state: IDENTITY (name +
  handle) → CLEARANCE (role + plan) → SYSTEMS (the dashboard's own deterministic
  `HealthSignal[]`) → EVIDENCE (`tasks`/`waiting` counts, or the staged first mission) →
  **KAI executive brief** (the engine's actual `nextAction` — Kai's real computed
  recommendation with the repo's receipts model; monogram identity, no mascot, no avatar) →
  "Command is yours" → dissolve, focus on the room's heading. First ≈7.3 s (≤9 law), returning
  ≈1.1 s (≤1.5 law), tier C short, tier D nothing. Skip: Escape / button (first focus) / click
  anywhere. 12 s pure-CSS safety fade. Auth errors are structurally unmaskable: the overlay is
  rendered ONLY by the authenticated server branch — the signed-out page renders with no
  overlay at all (proven).
- **`CommandHeader`** — zone 1 as a status band: operator identity, clearance chip, plan,
  agency workspace capacity (`CapacityInfo`), and an ALL-SYSTEMS rollup of the real health
  signals with an urgent-count link. Sign-out/settings/billing stay where they already live
  (Sidebar). Presentation-only — mutation-guarded against invented data sources.
- **The room audit finding:** the existing dashboard **already is Mission Control** — the
  deterministic engines (Mission/Executive/Roadmap/Builder/Knowledge/Command/Readiness over
  one snapshot load, "zero AI, zero fabricated data" by design) cover mandate zones 3–8.
  Phase 4 wraps it (entry + header), preserves every engine call (guard-pinned list), and
  invents nothing. Consumer vs agency projections come from the same primitives with
  role-resolved data (`currentUser()`'s existing workspace model).
- **`/review/mission-control`** — the synthetic stage: entry replay (first/returning), consumer
  ↔ agency projection selector, and seven truth-labeled states (populated · empty · loading ·
  error · disabled · billing-restricted · permission-denied), each stating the REAL behavior it
  represents. Unconditional SYNTHETIC banner; no prisma/session/fetch can reach it
  (mutation-proven). Room registry: Mission Control is the third PROTOTYPE.

## 5. Validation

**Real-stack battery — 41/41.** Built a REAL local auth stack (embedded Postgres with the full
repo schema, real NextAuth, real login form; **no auth bypass anywhere**), seeded via the repo's
own demo seed plus the ACTUAL bootstrap route:

- *Authentication:* invalid credentials (truthful generic error) · valid consumer login by
  email · agency login by USERNAME · logout immediate · signed-out deep link → "Please sign
  in." with no overlay · cleared-session (expiry model) → truthful signed-out state ·
  bootstrap 404/404/idempotent/no-credential-echo.
- *Authorization:* consumer refused by the agency surface AND the agency API · admin surface
  refused · agency room shows its own projection. Synthetic accounts hold USER role
  (escalation is a red mutation).
- *Experience:* first entry (all five beats verified textually — real identity, real health
  signals, real Kai brief) · completes inside 9 s · returning ≤1.5 s · Escape instant · triple
  rapid clicks → one clean dissolve · refresh mid-entry restarts cleanly · focus handoff ·
  reduced motion → NO veil ever · effects-off toggle → no veil · JS-off → complete server room,
  no veil · mobile 390px + tablet 768px play and stay overflow-free.
- *Product:* every dashboard engine preserved (guard) · billing immediate (no veil, in
  `CRITICAL_NEVER`) · logout immediate · the room beneath is the real Mission Control.
- *Rate limiters:* the product's own login and bootstrap throttles ENGAGED during battery
  repetition and were recorded — the fixtures reset them; the product kept them.

**Hard-off proofs:** production-env RUNTIME server, all secrets presented → bootstrap 404;
un-attested preview → 409 with the shared-DB refusal; production-flagged BUILD →
`/review/mission-control` renders "not enabled", the entry carries zero director controls
(and remains the product experience, as designed).

**Guards:** `scripts/cxos-mission.test.ts` — 27 checks, **6/6 mutations RED** (production
hard-off removal · shared-DB-stop removal · static password introduction · review session
write · stage prisma import · role escalation), all restored byte-identical. Full suite:
**84 source guard files + 5 runtime guards green; `tsc` clean.**

**Fixture notes (honesty):** the local throwaway DB self-healed legacy indexes on its very
first authenticated render (a race the long-lived production DB settled long ago) — absorbed by
a prewarm, not a product defect; two legacy tables outside `schema.prisma` log raw-query
errors locally until their self-heal paths run (the documented legacy mechanism).

## 6. Performance

| Metric | Value |
|---|---|
| `/dashboard` first-load JS | 124 kB (entry + header add ≈2 kB to the page chunk; the heavy weight is the pre-existing room) |
| Landing `/` | 98.9–99 kB — **unchanged by Phase 4** |
| `/review/mission-control` | static, 101 kB |
| Entry runtime | DOM/CSS only — no WebGL, no new dependency, no lazy chunk, no continuous rendering (the overlay unmounts at dissolve) |
| CLS | 0 from the entry (fixed overlay; transform/opacity) |
| Frame cost after settle | zero added — nothing of Phase 4 keeps running |

## 7. Accessibility

Entry is a labeled dialog naming its escape hatch; skip button takes first focus; `aria-live`
beats; Escape/click/button all skip; reduced motion mounts nothing (absolute, mutation-guarded
via the tier system); effects-off persists; JS-off leaves the full server-rendered room; focus
lands on the room heading after dissolve; decorative layers `aria-hidden`; no sound; no
flashes (single opacity ramps in the house ease); keyboard and reader flows unchanged in the
room itself (untouched product markup).

## 8. Before / after

Before: login → the dashboard appears. After: login → identity → clearance → systems →
evidence → Kai's brief → the same dashboard, now with its Command Header — 7 s once, ~1 s
thereafter, 0 s under reduced motion, and never in the way of an urgent workflow (skip is
instant and three-way). Gallery embedded in the HTML projection.

## 9. Known limitations

- **Live preview sign-in still requires the §2.1 owner actions** — by design: the shared-DB
  stop is enforced in code and this phase will not weaken it. Until then, the Founder reviews
  via `/review/mission-control` (synthetic, live today) and the recordings.
- The returning-entry variant is session-scoped (sessionStorage), not cross-device.
- Agency review account starts with an empty roster (capacity band shows only once real
  `CapacityInfo` resolves); populated-agency recordings used the seeded demo consumer for the
  rich room instead.
- Slow-network and INP field metrics belong to the real preview (container numbers are
  software floors); the entry adds no long tasks (timeout-driven beats).
- `?director` on the live `/dashboard` adds entry replay controls only — fuller room
  instrumentation (lighting, settled/active) is deferred until the Founder approves the room's
  direction.

## 10. Rollback

Revert `81c39e3`: the dashboard returns to its exact pre-Phase-4 render, the bootstrap route
ceases to exist, the review stage disappears, rooms registry returns to two prototypes. No
schema, no dependency, no data was touched anywhere real. (Any bootstrap-created accounts live
only in a disposable preview database the owner can drop.)

## 11. Founder decision block

```
[ ] Approve the diagnosis + §2.1 owner actions (isolated Preview DB + env scoping)
[ ] Approve the bootstrap access mechanism   (gates, accounts, revocation)
[ ] Approve the authenticated entry          (beats, durations, skip, truth-binding)
[ ] Approve the Command Header               (zone 1 as built)
[ ] Approve Kai's executive-brief presence   (monogram + real nextAction, no mascot)
[ ] Approve the Mission Control direction    (shell around the real room; zones audit)
[ ] Approve performance                      (no new deps/chunks; landing untouched)
[ ] Approve accessibility                    (tier D absolute; three-way skip; focus)
[ ] Reject
[ ] Request changes
```

---

*No merge. No production deployment. Production authentication untouched — no bypass exists,
and every review instrument is provably absent from production builds. No production database
contact occurred: all validation ran against a local throwaway stack.*
