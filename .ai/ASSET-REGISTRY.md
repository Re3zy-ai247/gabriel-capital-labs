# Asset Registry (canonical)

Check here BEFORE generating any visual asset (paid or free). Never regenerate an equivalent asset without explaining why reuse is insufficient.

## CV-LOGO-001 — CreditVector shield mark ⭐ THE approved logo
- **Path:** `public/logo-mark.png` (de-shadowed 2026-06-18) · rendered by `components/BrandLogo.tsx`
- **Status:** APPROVED (owner's real 3D shield)
- **Approved use:** all product + marketing surfaces, always as the raster
- **Do not use for:** vector recreations, AI redraws, generative-model reinterpretations — **owner explicitly rejected fabricated shields**. In generative video/image work, composite this raster as an overlay; never ask a model to redraw it.
- **Source:** owner-supplied render (external source files exist outside the repo — Status: NEEDS CONFIRMATION of path).

## CV-ICON-001 — Favicon / PWA icons / OG image
- **Paths:** `public/` (favicon PNGs, `og-image.png`, PWA icons)
- **Status:** APPROVED-INTERIM — still the pre-de-shadow shield render (on-brand). Follow-up: regenerate from CV-LOGO-001.

## CV-OG-BRIEF-001 — Brief branded cover/OG generator
- **Path:** `app/api/brief/cover` (edge `next/og`, stateless title+category) via `briefCoverUrl`
- **Status:** APPROVED · **Use:** Brief card/article covers AND OG images. Do not hand-generate Brief covers.

## CV-KAI-* — Kai mascot assets (governed by the Creative OS, `creative/` + ADR-0008)
ID scheme: `CV-KAI-REF-001..004` (ground-truth photos — received 2026-07-12, Higgsfield media_ids PENDING upload; never published without founder consent) · `CV-KAI-MASTER-001` (founder-approved master render — DOES NOT EXIST YET) · `CV-KAI-STATE-01..08` (canonical expression states — pending master approval).
- **Status:** production pipeline defined (`creative/README.md`); first render blocked on photo upload to Higgsfield.
- **Rules:** every render composes `creative/HIGGSFIELD-PROMPTS.md` blocks + canonical reference media; scored per `creative/CONSISTENCY-SCORING.md` (canonical bar: ≥22/25, identity axis 5) BEFORE registration; founder approves anything canonical or public; each accepted entry here records job_id, score, and credits spent. AI renders are drafts until individually approved — never ship an unapproved stand-in to prod.

## Rules for paid generation (Higgsfield/Abacus/etc.)
1. Check this registry + `PROMPT-REGISTRY.md` first.
2. Real logos composited as overlays — never redrawn by a model; never let a model render brand marks or UI text.
3. Use real CreditVector UI captures for product shots.
4. One test clip before any full production batch; owner approval before high-cost batches; record credits/cost here when known.

*(No Gabriel Capital Labs corporate assets, video assets, or approved marketing renders are tracked in this repo yet — add entries as they are produced/approved.)*
