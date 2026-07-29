# CXOS — Implementation Phase 1 Report

**Grammar codification + Scene 1 Arrival · 2026-07-29 · implementation commit `6eb72f9`**
**Status: COMPLETE in repository source. Not merged, not deployed. RC1's NO-GO is untouched.**

> Phase 1 of the ratified roadmap (`CXOS_FOUNDATION.md` §15) is implemented: the Experience
> Grammar's motion system is now **governed tokens in code**, and the landing hero plays the
> screenplay's **Scene 1 Arrival** (motion board M1–M3) — at a cost of **zero JavaScript**, with
> the landing **still statically rendered**, first-load JS **byte-unchanged at 96.2 kB**, an
> untouched page proven **pixel-identical**, and reduced-motion proven identical to the
> pre-CXOS render at **0 differing pixels**.

---

## 1. What was implemented — and what deliberately was not

**Implemented (the ratified Phase 1 scope):**

1. **The CXOS token layer** in `app/globals.css` — `--ease-vector` (the house
   `cubic-bezier(0.16, 1, 0.3, 1)`), `--dur-settle/reveal/focus/crossfade/draw`, and the two
   aurora amplitudes `--aurora-marketing` (0.5) / `--aurora-app` (0.15). Values are byte-for-byte
   what the shipped utilities already used: **codification, not redesign**.
2. **The shipped primitives now resolve through the tokens** — Settle (`.animate-rise`), Reveal
   (`.reveal`), Draw (`.animate-draw`), Drift (`.aurora`) — so experience timing is governed in
   exactly one place.
3. **Two new primitives:** Focus (`.cx-focus-out`, rack-focus M8) and the application-amplitude
   aurora (`.aurora-app`, dimmer + half drift speed) — shipped now, first *used* in the Mission
   Control phase, so this phase stays zero-risk to product surfaces.
4. **Scene 1 — the Arrival**, on the existing landing hero: the aurora *breathes in* (0 → 0.5
   over 1.2s, M1) while content settles on the 80/160/240/400 ms ladder (M2) — eyebrow →
   headline → lede → CTA → proof lines/Kai/product frame — and a single Shine pass crosses the
   product frame at 1.4s (M3), in a self-clipping overlay that cannot clip the card's shadow.
   Total choreography: **2.0s over already-painted content**, exactly per the screenplay.
5. **A guard with a future-proof invariant:** `scripts/cxos-grammar.test.ts` (41 assertions)
   enforces reduced-motion coverage **by enumeration** — every `cx-` class declared anywhere in
   the stylesheet must be addressed inside a `prefers-reduced-motion` block, so a future utility
   without a reduced-motion story fails CI by construction.

**Deliberately not implemented (honoring the roadmap's sequencing):**

- Scenes 2–10 (the full public arrival rebuild) — next phase, after the §2.6 reference captures.
- The Threshold (Scene 12), Mission Control arrival, Arena, Academy — later phases.
- Session memory for the arrival ("returning visits get the settled frame") — that mechanism
  belongs to the full 8–12s intro of Phase 3; today's 2.0s arrival replays per visit exactly as
  the pre-CXOS `animate-rise` did, so nothing regressed.
- OG/favicon regeneration — brand-asset taste is Founder territory; flagged as a Phase 2
  follow-up rather than swapped silently.
- "Mission Control" naming (D-3) — a product rename, not a CSS phase.

---

## 2. Repository evidence — files changed

| File | Change | Nature |
|---|---|---|
| `app/globals.css` | +79 / −4 | Token layer · primitives retrofitted to tokens · Focus + aurora-app · Scene 1 choreography · reduced-motion coverage |
| `app/page.tsx` | +17 / −11 | **Class-only** hero staggering + sheen overlay + one explanatory comment. Copy byte-identical → **zero new compliance surface** |
| `scripts/cxos-grammar.test.ts` | new | 41-assertion source-level guard (labelled source-level; never quoted as runtime proof) |
| `.ai/DESIGN-SYSTEM.md` | +1 sentence | Canonical doc now names the token layer and the enumeration rule |
| `.ai/CURRENT-STATE.md` | +1 entry | Dated status block |

No dependency was added. No schema, route, or product surface was touched. `lib/compliance.ts`
and every marketing copy string are byte-identical — the CROA surface did not move.

## 3. Performance impact — measured, not asserted

| Metric | Before | After | Verdict |
|---|---|---|---|
| Landing rendering mode | `○ /` static | `○ /` static | **PRESERVED** — the CXOS acceptance criterion |
| Landing first-load JS | 96.2 kB | **96.2 kB** | **BYTE-UNCHANGED** — the choreography is pure CSS |
| Landing page payload | 2.18 kB | 2.18 kB | unchanged |
| `/pricing` render | — | **0 differing bytes** vs before (1440×900 pixel-diff) | **PIXEL-IDENTICAL** — token retrofit proven zero-regression |
| `/login` render | — | 0.0118% differing | aurora drift phase between captures; layout identical |
| Reduced-motion landing | — | **0 differing bytes** vs before | **the parity proof** (§5) |
| CLS risk | — | none added | all new motion is transform/opacity; layout never animates |
| LCP element | hero `h1` (real copy) | hero `h1`, settle delay 80ms | within budget; never an intro asset |

Full-suite verification on the working branch: `tsc --noEmit` clean · `next build` clean ·
**77/77 guards** + runtime suite green · guard non-vacuity proven by four mutations
(9 / 1 / 1 / 1 failures respectively, each restored byte-identical).

## 4. Screenshots — before / after

Real Chromium captures of the locally served production build (desktop 1440×900, mobile 390×844).
Embedded in the HTML projection of this report; PNG originals delivered alongside.

| Capture | What it proves |
|---|---|
| `before-landing-desktop` | The baseline: complete hero, settled state |
| `after-landing-mid` (~450ms) | **The Arrival, mid-flight**: darkness → light breathing in, eyebrow settled, headline mid-settle, everything else yet to arrive — the screenplay's opening beat, live |
| `after-landing-desktop` (settled) | The final frame: composition identical to baseline; the aurora at full amplitude |
| `after-landing-reduced` | Reduced motion: **pixel-identical to the pre-CXOS reduced render** — the same narrative with the motion removed |
| `after-landing-mobile` | Single column, full-width thumb-reach CTA, hierarchy intact |
| `before/after-pricing` | Untouched page, **0 differing bytes** — the no-regression control |

Capture note, recorded honestly: the settled desktop before/after pixel-diff reads ~5.9% —
attributable to the *drifting aurora's phase* at capture time (two 460px blurred light fields over
dark ground), not to layout: the pricing control is 0.0000% and the reduced-motion comparison
(where the aurora is static) is 0 bytes.

## 5. The reduced-motion proof

The grammar's §5.16 rule — *reduced motion receives the same narrative with the motion removed* —
is now **measured**: a `prefers-reduced-motion` render of the post-CXOS landing is
**byte-for-byte identical** (0 of 3,888,900 pixel-bytes differing) to the pre-CXOS reduced
render. The arrival lands its final frame instantly: aurora at full amplitude as a static
gradient, every settle delay zeroed, the sheen removed entirely.

And the guard makes the property durable: the enumeration invariant means the *next* engineer's
`cx-` utility fails CI unless the reduced-motion block addresses it.

## 6. Governance notes

- **Five-review gate:** the gstack skills that operate it are absent from this environment. In
  their place: compliance surface verifiably unchanged (copy byte-identical), design executed
  1:1 from the ratified boards, QA above; the formal gate should run where gstack exists before
  this merges.
- **Orchestration:** implemented solo — workflow sub-agents hard-failed twice in this
  environment (the permission layer strips every tool input); a third attempt was not a
  responsible use of the token budget.
- **Branch reality:** implemented on the designated working branch, which also carries the RC1
  and Founder Library workstreams. Extraction discipline from the RC1 program applies if this
  ships independently: cherry-pick `6eb72f9` (+ report commit) onto a clean branch from
  `origin/main`; the commits are deliberately self-contained for exactly that.

## 7. Remaining roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Baseline captures + Lighthouse + §2.6 reference captures | Local baseline **done this phase**; reference captures still need a network-capable session (**D-8**) |
| 1 | **Grammar codification + Scene 1** | ✅ **THIS REPORT** |
| 3 | Public arrival: Scenes 2–10 (evidence triptych, Kai, Mission Control marketing view, Arena monument, pricing) | next — the largest visible phase |
| 4 | The Threshold (Scene 12) + Mission Control arrival | after 3 |
| 5 | Arena entry + agency/consumer differentiation | after 4 |
| 6 | Academy destination | needs product definition (**D-5**) first |

## 8. Next recommended phase

**Phase 3, Scene 2 + Scene 3 first** (the Credit Problem triptych and the Evidence frame): they
are the emotional spine of the arrival ("this understands me" → "this is real"), they exercise
the Draw primitive that is already tokenized, and they are the first scroll-choreographed rooms —
which will establish the scroll grammar every later room reuses. Before starting it: run the
§2.6 reference captures (Founder decision D-8) so the principles are validated against real
artifacts, and A/B-gate any full intro per D-4.

---

*No merge, no deploy, no schema, no migration, no production contact, no dependency added, no
compliance copy touched. The landing is static, the budgets held, and reduced motion is provably
the same site.*
