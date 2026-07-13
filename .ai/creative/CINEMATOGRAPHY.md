# Cinematography — Lighting Bible · Camera Bible · Shot Library

## Lighting Bible
Palette law: lighting may tint the ENVIRONMENT, never Kai's coat (coat truth is a Character-Bible hard lock).

| Setup | Use | Spec |
|---|---|---|
| **INK STUDIO** (default) | product UI, Kai Home, notifications, most marketing | Dark navy seamless environment (`#060a14` family — matches `theme-color`/`ink` tokens); large soft key upper-left ~45°, neutral white; **subtle cyan-teal rim light** (brand teal family) tracing ears/shoulders/tail from behind-right; gentle low fill so blacks hold detail; soft contact shadow under Kai; background clean gradient, matte-friendly |
| **PAPER STUDIO** | light-theme surfaces, docs, email | Warm off-white seamless; same key geometry; rim swapped to soft cool daylight; shadows lifted |
| **AURORA ACCENT** | hero marketing moments only | Ink Studio + faint blue→teal aurora gradient wash behind Kai (echoes `.aurora` util); rim slightly stronger; still no color cast on fur |

Consistency rules: rim always from behind-right · key always upper-left · one lighting setup per batch · no lens flares, no god rays, no neon.

## Camera Bible
- **Camera height:** locked at Kai's eye level (seated). Never hero-up or look-down angles — Kai is a peer, not a toy.
- **Lens:** 50mm-equivalent portrait rendering (35mm for full-scene storyboard shots); no wide-angle distortion, no fisheye.
- **Framing:** full body with consistent margins — Kai occupies ~70% of frame height, centered, paws never cropped; head-shot crops derive from the same camera position (punch-in, don't re-shoot).
- **Aspect:** master states rendered square 1:1 (crop-safe for UI chips, cards, hero); marketing derives 16:9 / 9:16 by extending environment, never by stretching Kai.
- **Depth:** shallow but honest — background softly defocused, ALL of Kai sharp.

## Shot Library (approved shots — compose from these only)
| Shot ID | Name | Description | Primary use |
|---|---|---|---|
| SHOT-A | Hero 3/4 seated | canonical master angle, body 15° right of front, head to camera | master render, hero surfaces |
| SHOT-B | Front seated | dead-on, symmetric | avatars, chips, notification icon crops |
| SHOT-C | Head close-up | punch-in from SHOT-A camera | small UI, favicon-scale derivations |
| SHOT-D | Profile left / right | full profile, both sides rendered (no mirroring) | timeline/edge-of-screen peeks |
| SHOT-E | Over-shoulder toward UI | Kai from behind-3/4 looking at a (blank) glowing panel area | onboarding, feature demos — UI composited in post, never rendered |
| SHOT-F | Walk-in / walk-out lateral | full body lateral stride | landing transitions, video only |

New shot types require a bible update first (this file), not an ad-hoc prompt.
