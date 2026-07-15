# Animation Architecture — cinematic homepage (Sprint XXIII foundation)

Status: **Design only.** Sprint XXIII builds the *foundation* (reusable primitives +
this plan). No cinematic animation is implemented yet — that is a future sprint,
gated on this document and a founder go.

## Principles (non-negotiable)
1. **Content-first.** The page must be fully readable and usable with zero JS and zero
   animation. Every motion is an enhancement layered on top (the `.reveal` CSS safety-
   net already guarantees this — content shows even if the observer never fires).
2. **`prefers-reduced-motion` is a hard gate, not an afterthought.** Every primitive
   checks it; anything cinematic must degrade to a static, tasteful composition.
3. **Performance budget is a launch blocker.** Targets: Lighthouse Performance ≥ 90 on
   mobile; LCP < 2.5s; CLS < 0.05; INP < 200ms; JS added for motion ≤ ~40KB gzipped on
   the landing route, all of it lazy/deferred and never blocking LCP.
4. **Compositor-only motion.** Animate `transform` and `opacity` only. Never animate
   layout properties (top/left/width/height) on scroll.

## The layer we have now (Sprint XXIII)
- **Primitives:** `components/landing/motion/` — `Reveal` (scroll entrance), `Stagger`
  (cascade), `Parallax` (scroll-linked transform), plus the CSS utilities in
  `globals.css` (`.animate-rise/-fadein`, `.aurora`, `.shine`, `.animate-float/-draw`,
  card hover elevation). All reduced-motion-safe.
- This layer is enough for "premium but restrained" motion. Cinematic work extends it;
  it does not replace it.

## Future integration plan (each item = its own gated task)

### Kai hero animation
- **Approach:** a lazy, client-only `<KaiHero>` island mounted below the fold-safe
  point, or the hero portrait with a looped, reduced-motion-aware micro-animation.
- **Tech:** start with CSS/Lottie (tiny, declarative). Escalate to WebGL only if the
  concept genuinely needs 3D/particles.
- **Guardrails:** never block LCP; static poster frame is the reduced-motion + no-JS
  fallback; the approved `/kai/kai-master-*.png` asset is the source of truth (Creative
  OS, ADR-0008 — Kai identity frozen at v1).

### Scroll storytelling
- **Approach:** section-pinned scenes driven by scroll progress (a "chapters" model),
  reusing `Reveal`/`Stagger` for entrances and a scroll-progress hook for pinned scenes.
- **Tech:** GSAP ScrollTrigger *if justified* (see decision matrix); otherwise a thin
  `IntersectionObserver` + `scroll` progress hook (what `Parallax` already models).
- **Guardrails:** reduced-motion collapses each scene to a normal stacked section.

### Cinematic transitions (route/section)
- **Approach:** shared-element and cross-fade transitions between marketing sections.
- **Tech:** **Framer Motion** (`AnimatePresence`, `layout`) is the natural fit and the
  recommended default for React transition work.
- **Guardrails:** lazy-load Framer Motion only on the landing route via `next/dynamic`;
  never ship it to the authenticated app bundle.

### WebGL (only if the story demands it)
- **When:** genuine 3D, particle fields, or shader-driven backgrounds — NOT for effects
  a gradient/Lottie can do.
- **Tech:** React Three Fiber + drei, dynamically imported, rendered into a lazy island.
- **Guardrails:** `IntersectionObserver`-gated render loop (pause off-screen), capped
  DPR, hard reduced-motion + `navigator.hardwareConcurrency`/save-data fallbacks to a
  static image, and a strict bundle/perf budget review before it ships.

## Library decision matrix
| Need | Reach for | Why |
|---|---|---|
| Entrance / stagger / hover | **CSS + our primitives** | Zero JS cost; already built |
| Subtle scroll parallax | **`Parallax` primitive** | No dependency |
| React enter/exit + shared-element | **Framer Motion** (lazy) | Ergonomic, React-native |
| Complex scroll timelines / pinning | **GSAP + ScrollTrigger** (lazy) | Best-in-class *if* the timeline is real |
| 3D / shaders / particles | **R3F/WebGL** (lazy island) | Only when nothing lighter works |

Default order: **CSS/primitives → Framer Motion → GSAP → WebGL.** Each step up must be
*justified* by a capability the layer below genuinely can't deliver — and pass the perf
budget.

## Performance safeguards (apply to every cinematic addition)
- **Lazy + code-split:** `next/dynamic({ ssr: false })` islands; motion libs never enter
  the initial or the authenticated-app bundle.
- **Off-screen pause:** IntersectionObserver gates every rAF/render loop.
- **LCP protection:** hero text/image is server-rendered and static; motion mounts after.
- **Capability gates:** reduced-motion, `navigator.connection.saveData`, low core count →
  static fallback.
- **CI budget:** a Lighthouse-CI check on the landing route (add when cinematic work
  starts) fails the build if Performance < 90 or CLS regresses.

## Explicitly out of scope for Sprint XXIII
Kai hero animation, scroll storytelling, cinematic transitions, WebGL, Framer Motion,
GSAP. Foundation and plan only.
