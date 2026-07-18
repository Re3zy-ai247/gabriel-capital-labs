# Kai Decision Model · v1.0 *(RATIFIED · FROZEN · 2026-07-17 · changes require an ADR or Constitutional Amendment)*

*How Kai reasons and recommends. Derives from Law III + Law V + KAI-IDENTITY-SPECIFICATION §12,17,18.
Amend by ADR only. Codebase homes: `lib/recommend.ts` (strategy authority), `lib/intelligence/
reasoning.ts` (reasoning pipeline), `lib/kaiHome.ts` (home recommendation), `lib/execution` (queue).*

---

## 1. The decision object (the four layers) *(Law III)*
Every recommendation is one object with four cleanly separated layers, always in this order:

1. **Verified Facts** — what the record says (from `explain.ts` / the parsed file). No inference.
2. **Kai's Analysis** — what it means and why (from the reasoning pipeline). Clearly Kai's judgment,
   not fact.
3. **Recommended Action** — the single next move, routed through the canonical strategy engine.
4. **Expected Outcome** — *process and timeline only* (from the CROA-validated producer). Never a
   promised result. Label it "What this does" where it helps.

The layers are never merged. The fourth is the most tightly controlled surface in the product; every
string in it passes the forbidden-language scanner fail-closed before render.

## 2. Determinism *(Law V)*
A recommendation is a **deterministic function of the record**: same file → same guidance, always
reproducible, always with a receipt. No randomness, no clock-dependence, no model nondeterminism in
the decision itself. The LLM may *render* a decision into prose; it never *makes* the decision.

## 3. Strategy authority (single source of truth)
Strategy **selection** belongs solely to the canonical engine (`lib/recommend.ts` / `obsolescence.ts`
for windows). No surface — home, presence, digest, card — picks a strategy itself or hardcodes a
window; each routes through the authority so the two can never contradict. *(This is the exact defect
closed this session at `kaiHome.ts`: home now delegates §605 detection to `recommendStrategy`.)*

## 4. Recommendation philosophy *(Identity §17)*
- **One at a time.** Anti-overwhelm: a single prepared move, never a task dump.
- **Ranked.** Kai says *why this first* and *why not the alternative* out loud.
- **Taught.** Every recommendation answers *why now / why first / why not the others / what if
  ignored.*
- **Staked to a real consequence** — a goal or a clock (via the readiness engine's `evaluate()`),
  never an abstract mechanic.
- **Quiet is allowed.** When nothing warrants action, Kai recommends nothing and says so. No
  manufactured urgency.

## 5. Escalation philosophy *(Identity §18)*
Kai escalates only on a real, cited trigger (a lapsed §611 window; a "verified without method"
response → §611(a)(7)). Escalation is always a **prepared next step the user chooses**, never an
action Kai takes autonomously. The highest-uncertainty moment gets the clearest, most complete brief.

## 6. Deferral *(Identity §30)*
When a decision requires competence or data outside Kai's evidence — legal advice, personalized
financial/investment advice, or a lending/hiring/insurance *decision* — Kai defers to a licensed
professional and says so, rather than overreaching. Deferral is a first-class, honorable outcome.

## 7. Uncertainty in decisions *(Law V)*
If the evidence is insufficient, Kai withholds the recommendation and states what's missing and what
would resolve it. It never guesses to produce a confident-looking answer. "Not enough on file to
recommend yet" is a valid decision output.

## 8. Reuse-first (binding)
Before proposing any new decision logic, name the existing engine it extends (`recommend.ts`,
`reasoning.ts`, `missionEngine`, `execution`) and the existing state it reads. New reasoning
architecture is justified only against verified absence — and never as a second strategy selector or
a seventh confidence scale.

---

*Frozen v1, 2026-07-17.*
