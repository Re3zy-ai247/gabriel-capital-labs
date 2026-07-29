# CXOS — The Founder Review System

**2026-07-29 · branch `feat/cxos-threshold` · commit `fc4c7e4` · Status: BUILT AND VERIFIED**
**No merge. No production deployment. Feature branch only.**

> From this phase forward, every CXOS implementation is reviewed as a **live interactive
> experience**: a protected preview URL, a Director console over every running room, per-room
> review stages, recorded video, and the standard closing block — screenshots become supporting
> evidence, not the review.

---

## 1. How a phase becomes reviewable — the pipeline

```
implement on a feature branch
        │  git push
        ▼
Vercel Preview (automatic, protected by Vercel Authentication — owner-verified)
        │  stable per-branch URL, e.g.
        │  https://gabriel-capital-labs-git-feat-cxo-069234-rey-gabriel-s-projects.vercel.app
        ▼
review instruments AUTO-ENABLE on preview builds (reviewMode policy)
        │
        ├─ /review ................. the hub: every room, one door each
        ├─ /review/<room> .......... the room's looping review stage + console
        ├─ any live surface ?director  the same console over the real page
        ▼
phase closes with the standard block: URLs · performance · video · PDF ·
storyboard · Approve / Reject / Notes
```

**No rebuild is ever needed to review:** the Founder opens the preview URL, appends `?director`
anywhere (or visits `/review`), and has scrubbing, beat-jumps, speed, density, lighting and frame
metrics live.

## 2. The gating policy — production is HARD OFF

`lib/cxos/reviewMode.ts`, in order:

1. **`NEXT_PUBLIC_VERCEL_ENV === "production"` → OFF, unconditionally.** First line of the
   policy; the manual override is checked *after* it and cannot beat it. These are build-time
   inlined values — a production bundle simply does not contain an active review path.
2. Vercel **preview** builds → ON automatically (previews are behind Vercel Authentication).
3. Local development → ON.
4. Local production builds → ON only with `NEXT_PUBLIC_CXOS_REVIEW=1` (how CI exercises it).

**Proven behaviorally, not asserted:** a production-flagged build renders `?director` completely
inert — no dialog, no console, no darkness, hero visible — and both `/review` routes as
"not enabled" (4/4 Playwright checks).

Three more review-mode invariants, each guarded:

- **Reduced motion is never overridden** — the director param bypasses *only* session memory; the
  guard pins the reduced-motion return as unconditioned, and the mutation that conditions it goes
  red. (The first version of the guard missed exactly this mutation; it was strengthened and
  re-proven — recorded honestly.)
- **Review runs never consume a visitor's first impression** — no session write in review mode.
- **The public bundle never pays** — the Director console ships only inside the lazy experience
  chunk; `/review` routes are static and tiny (178 B / 1.93 kB page payloads).

## 3. The Director console (`?director` · `?cxos` · `?review`)

| Instrument | What it does |
|---|---|
| Timeline scrubber | scrub the walk 0→1; live `p=` and camera-z readout — the camera path, in the hand |
| Beat jumps | Void · First light · Architecture · The name · CreditVector · The opening |
| Transport | Play / Pause · 0.25× / 0.5× / 1× / 2× motion speed · Replay |
| Particle density | 10–100% of the field, live (`setDrawRange`) |
| Light intensity | 20–150% emissive multiplier across core, nebula, colonnade, rails |
| Parallax toggle | isolate composition from the pointer |
| FPS + frame timings | live fps, average ms, **p95 ms** over a 120-frame window |
| Rooms | one-tap doors to every non-planned room |
| Sound | the stage's own opt-in toggle (unchanged: off by default, synthesized, never autoplay) |
| Scene selector | the `/review` hub is the environment selector across rooms |

On the review stage the walk **loops** — the Founder can watch the entry a dozen times, scrub to
a beat, thin the particles, and read the frame budget without ever rebuilding. Escape exits.

## 4. The rooms — individually reviewable

All ten mandated rooms are registered (`lib/cxos/rooms.ts`) and listed on `/review` with honest
status — **a planned room is shown as planned; nothing is faked as live**:

| Room | Status | Entry |
|---|---|---|
| The Threshold | **PROTOTYPE** | `/review/threshold` — looping stage + console |
| Hero / Arrival | **LIVE** (Phase 1) | `/?director` |
| Mission Control | PRODUCT — entry planned (Phase 4) | `/dashboard` |
| Arena | PRODUCT — entry planned (Phase 5) | `/arena` |
| Academy | PLANNED (needs D-5) | — |
| Kai | PRODUCT — rides Mission Control | `/dashboard` |
| Marketplace | PLANNED | — |
| Operator Network | PRODUCT | `/community` |
| Consumer Command | PRODUCT — entry planned (Phase 4) | `/dashboard` |
| Enterprise | PLANNED | — |

Each future phase adds its room's review stage the way the Threshold did; per-room PDFs and
storyboards ship with each phase report (Threshold's exist today: `CXOS_PHASE_2.pdf`, real-frame
storyboard in `CXOS_PHASE_2_THRESHOLD_REPORT.html`).

## 5. Verification

**Review-enabled build — 12/12:** console opens on `?director` · fps/avg/p95 reporting · beat-skip
jumps the walk (CreditVector beat verified visible) · pause freezes the timeline · session memory
untouched by review runs · hub lists all 10 rooms · hub is noindex · review stage runs with
console · **stage loops past a full walk** · full-walk **video recorded, desktop** (1520 KB webm)
· full-walk **video recorded, mobile** (1257 KB webm) · tablet 768×1024 runs with console.

**Production build — 4/4:** `?director` inert, no darkness, `/review` and `/review/threshold`
render "not enabled" and mount nothing.

**Source guard:** `scripts/cxos-review.test.ts` — 19 assertions; non-vacuity: deleting the
production hard-off → red; conditioning reduced-motion on director → red. **Full suite: 79/79.**
`tsc` clean; landing static; first-load 97.7 kB on review-enabled builds (96.8 kB without —
the review util + gate cost ~0.9 kB, all of it inert on production).

## 6. Recorded during this work — production moved

While resolving the live preview URL via Vercel, the deployment history showed the **owner merged
draft PRs #8 and #9** (in the recommended order, PR-1 then PR-2). **Production now runs both
release units**; `main` moved `dfe7a3a → f449c35`. No action was taken on this — it is recorded
because RC1 documents and future rebases must now treat `f449c35` as production truth, and the
production-verification items attached to those PRs (Stripe test-mode exercise, webhook endpoint
API version, disabled-account reconciliation) are now live tasks.

## 7. Performance metrics (this container, software GL)

Frame metrics in this environment run on SwiftShader (software rendering) — they are a **floor**,
not a ceiling; any real GPU renders this scene faster. The scene's cost model is unchanged from
Phase 2: 3 draw calls desktop, DPR-clamped, zero per-frame allocation, full disposal. The Director
console's live fps/p95 readout is how the Founder measures **real** hardware — open `?director` on
the preview from any device and read the numbers in the corner.

---

*Feature branch only. No merge, no production deployment, no schema, no production contact. The
review system itself is provably absent from production bundles.*
