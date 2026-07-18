# Kai UX Principles · v1.0 *(RATIFIED · FROZEN · 2026-07-17 · changes require an ADR or Constitutional Amendment)*

*How the experience behaves. Derives from Constitution Article IV. Amend by ADR only. Every screen
and flow compiles against this.*

---

## 1. The one question every screen answers
**"What has Kai already figured out for me?"** — never "What should I ask Kai?" If a screen makes the
user interpret raw data, decide what to look at, or phrase a question, Kai has failed to do its job.

## 2. The five experience laws

**UX-1 · Kai does the triage.** The product surfaces the *one* thing that matters with its reasoning,
not an undifferentiated list. The user never has to rank, compare, or search to find what needs them.

**UX-2 · Preparedness, shown as possession.** Every surface demonstrates Kai already possesses and
organized the file — what changed, where it stands, the next move — each line stapled to a record.
Never a claim of background work (Law I).

**UX-3 · Remove load, never add it.** No prompt engineering, no configuration to get value, no blank
canvas. Defaults are prepared; the user edits or decides, they don't assemble.

**UX-4 · Agency is preserved.** Kai prepares; the user commits. Every recommendation is a *prepared
option the user chooses*, with manual override always available and Kai's cited recommendation kept
visible beside it. Kai never acts irreversibly on its own (Identity §34).

**UX-5 · Calm density.** Bloomberg-grade information density delivered with Linear/Apple restraint.
Dense but scannable; summary before detail; state encoded in form (a chip, a ring, a stripe) so what
needs attention reads at a glance. No urgency, no dopamine loops (Law IV).

## 3. Screen-level rules
- **Lead with the conclusion.** The executive answer first; the supporting data below it, for those
  who want it.
- **One next move, exactly.** Anti-overwhelm: a single prepared action, ranked against the
  alternative, with quiet allowed when nothing warrants action.
- **Every recommendation teaches why.** Why now, why first, why not the others, what if ignored —
  and stakes it to a real consequence (a goal, a clock), never a mechanic.
- **Every number names its source.** No metric without provenance; a value the user can't trace
  doesn't render.
- **Quiet is a valid screen.** "Nothing needs you until Friday" is a complete, honest state.

## 4. The three homes *(codebase: `dashboard/page.tsx`, `journey`, `KaiPresence`)*
Presence is a treatment on surfaces that exist, not a new destination:
1. **Kai Home (`/dashboard`)** — the executive brief; the primary "already figured out" surface.
2. **Timeline (`/journey`)** — the operational history and forward roadmap.
3. **The floating presence** — global elsewhere, self-suppressing where a fuller Kai surface already
   is. Never doubled.

No general `/kai` chat route: Kai is not a destination you go to *ask*; Kai is the intelligence that
already organized the screen you're on. A **scoped, context-bound clarification** — attached to a
specific record (e.g. "explain this tradeline") — is permitted; an open-ended chat destination is
not. This is what "a user should rarely need to type a question" means: the rare question is a
bounded clarification, never prompt engineering.

## 5. Reuse-first (binding on every UX proposal)
Before proposing any new surface, name the **existing engine** (`missionControl` / `execution` /
`readiness()` / `roadmap` / `portfolio`), the **existing component** (`MissionControl` /
`ExecutiveQueue` / `ReadinessStrip` / `RoadmapView` / `KaiPresence`), and the **existing state**
(`KaiEvent` / `KaiSeen` / snapshot) it renders. Phase D's own lesson: the operating-system surface
was *already built and left off the desk* — render before you build.

## 6. The marketing → product transition *(a defining experience)*
By the time a customer enters CreditVector, they already know Kai from marketing (the rendered Shiba
Inu, World 2). **The product therefore never re-introduces Kai as a character.** The character recedes
and the Chief Intelligence Officer takes over: the product opens as an executive who *already knows
the file*, not a mascot saying hello. The customer should subconsciously feel *"I'm no longer watching
the commercial — I'm inside the operating system."* That transition is intentional (Brand Architecture
§7).

## 7. What the experience never does
Never manufactures a task to create engagement; never gamifies (streaks, badges, points); never uses
a red-alert to drive a click; never requires the user to configure Kai to be useful; never hides the
evidence behind the recommendation; never renders an outage as an empty file; **never renders the
marketing character (Shiba Inu) on any product surface, and never re-introduces Kai as a character**
(no "Hi, I'm Kai!").

---

*Frozen v1, 2026-07-17.*
