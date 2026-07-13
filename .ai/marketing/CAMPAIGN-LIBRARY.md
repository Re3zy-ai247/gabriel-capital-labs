# Campaign Library (registry)

Check here BEFORE creating any campaign asset (reuse-first). Entry format: ID · asset · location · status · approved use · cost. Numbers/spend recorded when known; never invented.

## CAMP-001 — Launch ad, 60s hero ("Shield intro" hybrid)
- **Assets:** `CreditVector-Ad-60s-16x9-DRAFT.mp4` (63.0s, 1080p30, 9 scenes, QC-verified) + `ai-clips/creditvector-shield-intro.mp4` (Kling Pro 8s — **in hand, NEVER regenerate**) + 6 real UI captures. Home: `~/Documents/CreditVector-Ad-Assets/` (timeline/captions/VO in `AD-BUILD-KIT.md`; reproducible via `render.sh`).
- **Status:** DRAFT — remaining: licensed music bed (owner, CapCut cue in kit) · 9:16 vertical re-render · founder approval → publish (🟡).
- **Cost record:** 2,764 Kling credits used; ~16–19k avoided via hybrid (real-UI) approach.
- **Approved use:** launch hero across YouTube/social once approved. **Do not:** re-render AI segments without checking the kit; never let a model redraw the logo/UI text.

## CAMP-002 — Brief weekly digest (owned email)
- **Assets:** digest template in `lib/briefDigest.ts` (code-canonical), branded covers via `app/api/brief/cover`.
- **Status:** BUILT, gated on `COMPANY_POSTAL_ADDRESS` (G-01). CAN-SPAM: postal footer + one-click unsubscribe; add `List-Unsubscribe` header at go-live.
- **Approved use:** weekly, opted-in subscribers only.

## CAMP-003+ — (open)
Social launch series, SEO/blog program, lead magnets, case studies — register here as they're actually created. No entry = doesn't exist; don't reference unbuilt campaigns as live.
