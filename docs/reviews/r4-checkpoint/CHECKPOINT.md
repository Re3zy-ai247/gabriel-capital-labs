# R4 CHECKPOINT — paused mid-R4.2, 2026-08-06 (usage limit)

**STATUS: NOT SHIPPABLE YET. Do not merge. Do not treat this commit as founder-ready.**

## Where things stand

- Base: `0c7f515` (R3 accepted, READY_WITH_DISCLOSURES).
- This commit contains: **R4 prologue + R4.1 remediation (both fully gate-measured) + a PARTIAL
  R4.2 polish pass** — the R4.2 fixer workflow was stopped mid-flight when usage ran out, so some
  of the six R4.2 rulings may be half-applied. Treat every R4.2 marker as unverified.
- Both max-effort gates on the R4.1 state agreed: **exceedsR3 = TRUE** (quality bar met, founder's
  STOP condition not triggered), both original BLOCKERs dead (hydration dead-man verified at
  18.2–18.4s incl. pure-CSS path with setTimeout neutered; 1024px crossing abort 55–131ms), LCP
  252–352ms vs control 1248–1272ms, axe 0, Mission pin 210%/126% at approved density, Gateway G
  chain clean through the full sequence.

## What R4.2 was fixing (14 residual findings, all in `R4-FINAL-FINDINGS.json` here)

Six binding rulings (full text in `r4.2-polish-workflow.js` here):
R-1 Replay = true sequence (lock scroll like first visit; hide REPLAY chip during; kills the
inert-but-scrollable dead-page state) · R-2 single source of truth = `html.gcl-prologue` class at
mount (kills watchdog/inert desync + /index.html desync); watchdogs 18s→22s · R-3 crossing exit
zero residue (104% mark scale; breathe scoped `(min-width:1024px) and (prefers-reduced-motion:
no-preference)`) · R-4 tagline balanced at ALL 320–430 widths · R-5 skip chip below gold-signal
luminance; "Skip to content" functional during prologue; Enter focus→h1 · R-6 measure slow-device
overrun at 6× throttle for the disclosure list.

## How to resume (next session)

1. Clone/fetch this branch; verify `git log` shows this checkpoint on top of `0c7f515`.
2. Diff for `R4.2` markers vs the six rulings; finish incomplete ones.
3. Re-run ONE confirmation gate (Opus, max effort) per the prompt in `r4.2-polish-workflow.js` —
   it must confirm all 14 findings closed + no new regressions + standing invariants
   (Gateway G chain, mobile pins 0/2 + pixel parity, deep links, seen-path, R3 pull-back parity,
   axe, LCP element+ms).
4. Ship sequence: fill `R4-REPORT-DRAFT.md` placeholders («GATE_VERDICT», «GATE_DISCLOSURES») →
   fold into `docs/reviews/GCL-CINEMATIC-WEBSITE-v1.{md,html}` as §R4 → commit → push → verify
   deployed preview live (Playwright, BOTH reducedMotion contexts — the reviewing Mac forces
   reduce) → secret gist → founder report.

Verification environment: Playwright `/Users/re3zy/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`,
Chrome `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, control builds via
`git archive` (never stash). Vercel share links via the Vercel MCP `get_access_to_vercel_url`
(rate-limits; back off ~20s).
