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

## CV-KAI-* — Kai character assets (governed by the Creative OS, `creative/` + ADR-0008)

### CV-KAI-REF-001..003 — ground-truth photographs (ULTIMATE source of truth)
Real Kai: 3/4 standing (QR bone tag) · front close-up (ring tag) · seated open-mouth smile (bed). In founder custody; provided in-chat 2026-07-12. NEVER published without explicit founder consent (real pet/home). Every future render is judged against THESE, not against prior renders.

### CV-KAI-MASTER-001 — ✅ THE canonical production render (Kai v1)
- **Founder-approved 2026-07-12** ("This render becomes Kai v1"). Higgsfield render, 16:9: Kai seated, front-facing, open-mouth smile, dark-navy INK-studio environment, soft key + cool rim.
- **Consistency score:** 23/25 (A4·B5·C5·D4·E5). **Accepted deltas, recorded:** eye shade renders amber-brown vs Kai's near-black; coat slightly golden; forepaws crop at frame edge (head-crop derivations only).
- **Approved use:** visual baseline for landing, onboarding, dashboard/Kai Home, community, product screenshots, tutorials, marketing, animation planning, and as REFERENCE MEDIA in every future Higgsfield prompt (with the real photos). **Do not:** redesign, reinterpret, restyle, or regenerate from scratch.
- **File custody:** founder's Higgsfield library + local. **Product drop path when wired: `public/kai/kai-master.png`** (16:9 master) + `public/kai/kai-master-sq.png` (1:1 crop) — components will reference these paths.

### CV-KAI-SCENE-001 — hologram paw-raise scene render
- Higgsfield 16:9: Kai raising a paw to a teal holographic panel, dark sci-fi room. Founder-provided same date. Face slightly more stylized than MASTER-001 (use for scene/marketing contexts, not identity reference); projection grammar matches `creative/KAI-HOLOGRAM-SYSTEM.md` strikingly well — the visual proof of the hologram language.
- **Approved use:** marketing/landing hologram moments, hologram-system art direction reference. Identity reference stays MASTER-001 + photos.

### CV-KAI-STATE-01..08 — expression states (NEXT to generate)
Unblocked: generate via `creative/HIGGSFIELD-PROMPTS.md` KAI-P-002..008 with MASTER-001 + photos as reference media; bias eye color DARKER toward photo truth (the recorded delta); score each ≥22/25 with identity 5 before registration.

**Rules (unchanged):** compose prompt blocks + canonical reference media · score before registration (`creative/CONSISTENCY-SCORING.md`) · founder approves canonical/public · record job_id, score, credits per entry.

## Rules for paid generation (Higgsfield/Abacus/etc.)
1. Check this registry + `PROMPT-REGISTRY.md` first.
2. Real logos composited as overlays — never redrawn by a model; never let a model render brand marks or UI text.
3. Use real CreditVector UI captures for product shots.
4. One test clip before any full production batch; owner approval before high-cost batches; record credits/cost here when known.

*(No Gabriel Capital Labs corporate assets, video assets, or approved marketing renders are tracked in this repo yet — add entries as they are produced/approved.)*
