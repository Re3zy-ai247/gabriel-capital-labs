# Motion Bible · Animation Bible · Landing Page Motion System

## Motion principles (Kai moves like he thinks — calm, deliberate, economical)
1. **Calm physics.** Slow-in/slow-out everything; no overshoot, no squash-and-stretch, no bouncy cartoon energy. Kai is an elite strategist, not a sidekick.
2. **Economy.** One motion at a time; stillness is the default state. Kai never fidgets, never loops attention-seeking animations.
3. **Motivated motion only.** Kai moves in response to something real (an event, a hover, a success) — mirroring the product principle that Kai only speaks when he has something useful (KAI-EXPERIENCE §7).
4. **Reduced-motion is law.** Every Kai animation respects `prefers-reduced-motion` (existing design-system rule): fallback = static CV-KAI-STATE-01.

## Animation Bible (in-app: layered stills + CSS/Lottie — NOT rendered video)
The 8 states are stills; life is added in the app. This is the cost model (zero render credits for motion) and the consistency model (identity can't drift in CSS).

| Behavior | Implementation | Timing |
|---|---|---|
| Breathing | 1.5% scaleY loop on body layer | 4s cycle, ease-in-out |
| Blink | eyelid overlay sprite (2 frames) | every 6–9s (randomized), 120ms |
| State transitions | cross-fade between state stills | 250–350ms, ease-out |
| Attention (ears perk) | cut to STATE-03 + single 2° head micro-rotate | 300ms |
| Success wag | STATE-04 + tail-layer 6° rotate loop ×3 then settle | 1.8s total |
| Look at UI | STATE-05/06 + 200ms eye-lead fade | 300ms |
| Idle return | any state → STATE-01 after 8s inactivity | 400ms |

Rendered VIDEO of Kai is reserved for marketing hero moments (storyboards), never for in-app idle states — enforced by the credit reality (README §Current state) and the pipeline's preflight step.

## Landing Page Motion System
- **Hero:** Kai STATE-01 with breathing+blink, INK STUDIO backdrop blending into the existing hero gradient; entrance = single 500ms fade+rise (reuses `.reveal` timing).
- **Scroll reveals:** existing `.reveal` system stays canonical; Kai augments at most TWO section boundaries per page (e.g. gazes toward the feature panel via STATE-05/06). More is noise.
- **Success moments** (signup complete, letter generated): one wag cycle (STATE-04), then settle. Never loops.
- **Performance budget:** each state still ≤150KB (WebP/AVIF, transparent), lazy-loaded below the fold, explicit dimensions (zero CLS), eyelid/tail overlay sprites ≤20KB. Total Kai payload per page ≤450KB.
- **Accessibility:** decorative Kai = `aria-hidden`; informative Kai states carry alt text describing the message, not the dog.
