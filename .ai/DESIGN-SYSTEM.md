# Design System (canonical)

Redesigned 2026-06-18 — premium navy/blue/teal fintech system. Tokens live in `tailwind.config.ts` + `app/globals.css` (CSS-var-backed, dark/light theme-aware).

## Palette rule
**Navy/blue/teal; green ONLY for success.** Token families:
- `ink-*` — navy surfaces · `brand-*` — blue→teal primary (CTA/active/accent) · `ocean-*` — blue depth · `success-*` — the original CreditVector green, positive/resolved states ONLY · `brand-ink` — fixed dark text for AA contrast on the teal button.
**Never hardcode hex or `emerald`/`indigo`/`violet` per page** — use token classes so theming and the cascade work. In-app pages inherit the look via the token cascade; stray legacy colors get swapped to `success`/`brand`/`ocean`.

## Typography & components
Font: **Plus Jakarta Sans** (`--font-sans`). Reusable classes (`globals.css` `@layer components`): `.card .btn-primary .btn-ghost .btn-lg .input .label .nav-item(-active)` + marketing utils `.container-x .section .eyebrow .h-display .lede .text-gradient .tnum`.

Marketing components (`components/marketing/`): `SiteNav`, `SiteFooter`, `Showcase` (FeatureSplit zig-zag + FaqList + TrustBar), `DashboardPreview`, `AuthLayout` (split-screen auth), `LegalShell`. Landing `app/page.tsx`; legal `app/legal/{privacy,terms}`; custom 404 `app/not-found.tsx`.

## Motion & accessibility
Motion utils (`.reveal .aurora .shine .animate-*`) all respect `prefers-reduced-motion`. AA contrast is a requirement (that's why `brand-ink` exists). `theme-color` = `#060a14`. UI work must check responsive behavior (Definition of done).

## Logo (hard rule)
`components/BrandLogo.tsx` renders the owner's **real 3D shield raster** `public/logo-mark.png` (de-shadowed 2026-06-18). **Never substitute a vector recreation — the owner rejected those.** See `ASSET-REGISTRY.md`. Known follow-up: favicon/OG PNGs are still the older (pre-de-shadow) render.
