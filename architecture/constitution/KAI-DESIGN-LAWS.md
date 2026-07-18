# Kai Design Laws · v1.0 *(RATIFIED · FROZEN · 2026-07-17 · changes require an ADR or Constitutional Amendment)*

*How CreditVector looks and moves. Derives from the Five Laws + KAI-IDENTITY-SPECIFICATION §19–25,33.
Amend by ADR only. Uses the shipped design system (`app/globals.css`, `tailwind.config.ts`) — invents
no new token vocabulary.*

---

## 1. The visual thesis
**A calm executive terminal.** Bloomberg-grade density with Apple/Linear restraint. Dark-first, the
product's world. Evidence rendered as the aesthetic: monospace data, citation chips, the four-layer
decision card. The restraint is the signature.

## 2. Color philosophy *(tokens frozen; semantics frozen)*
- **Ink (navy):** ground and surfaces — `#060a14 → #101729` cards → `#1b253c` borders.
- **Brand (teal):** Kai, active intelligence, primary action — `#0ea5c4 / #28c2db`.
- **Ocean (blue):** depth, secondary, agency/portfolio — `#2563eb / #3b82f6`.
- **Success (green):** **resolved / positive only** — `#13b86a`. Never decorative.
- **Gold:** attention, deadlines — `#f2c14e`. Attention is calm.
- **No alarm-red.** Overdue and bad news render in gold, *steady-and-on-it*, amber on the panel and
  never on Kai (Law IV; Identity §10). One bounded exception: a **muted, desaturated rose** for a
  genuinely past-due *factual* state — a single named token (≤ ~55% saturation, AA-verified) that
  **never animates, pulses, or appears on Kai's mark** and never carries an alarm affordance. That is
  the only red-family hue in the system; anything more saturated or more urgent is forbidden.
- **Calm high-consequence treatment.** A genuine imminent rights-forfeiting deadline may be raised in
  *salience* — placement, size, explicit stakes — but never in *alarm* (no red, no pulse, no fear
  copy). Salience is calm emphasis; it is how Law V's honesty-of-consequence is served without
  breaking Law IV (Constitution Article II tiebreak).
- Semantic color (good/attention) is separate from Kai's accent and never used to manufacture fear.

## 3. Motion philosophy
- **Minimal and purposeful.** Motion clarifies state or transition; it is never decorative and never
  idles. No dopamine loops, no attention-grabbing animation.
- **Live vs projected (the honesty rule).** *Activity* motion (a shimmer, a pulse) renders **only**
  while a real synchronous operation the user triggered is in flight, and stops the instant it
  settles. Projected/stance states are still. An activity animation from stored data is forbidden.
- **No character or emotional animation in the product.** No mascot movement, facial expression, or
  tail; the rendered character animates only in marketing and education assets.
- **`prefers-reduced-motion` is always honored**, in full.

## 4. Typography
Plus Jakarta Sans / system-ui for UI; **monospace for all data** — numbers, statutes, case IDs,
clocks, evidence refs. Tabular numerals wherever digits align. A clear type scale, held. The
monospace-data treatment is the terminal DNA and is part of the identity.

## 5. Presence *(codebase: `KaiPresence`)*
One global, dismissible presence surface; never auto-opening, never modal; self-suppressing where a
fuller Kai surface already renders. Presence depicts state over records, never activity. **Kai's mark
in the product is the restrained KAI monogram (a "KAI" chip in a teal ring) — never a rendered
character, face, avatar, or animated mascot.** The rendered Shiba Inu is a marketing/education asset
only (§10 below) and never appears on a product surface. Presence comes from intelligence, authority
from evidence, trust from consistency — not from a character.

## 6. State philosophy (the four states most products fake)
- **Empty:** an honest beginning. The real first step, plus organized value where the engines allow
  it (readiness, education). Never "you've done nothing."
- **Loading:** Kai's live state doing real work, captioned with the real operation. Skeletons, not
  spinners; never a fake progress bar.
- **Success:** quiet precision with a receipt; green marks it; no confetti, no inflation.
- **Failure:** steady-and-on-it — what happened, what it means, the prepared next step; never doom,
  never a dead end.

## 7. Density & layout
Dense but scannable: summary before detail; generous internal rhythm; content that must scroll
(tables, wide data) scrolls inside its own container, never the page. State reads at a glance via
form (pill, ring, stripe), not only number.

## 8. Accessibility *(requirement, not aspiration)*
AA contrast minimum, always; full keyboard operability with a visible focus state; state encoded in
text and shape, never color alone; reduced-motion honored; the dark, dense surface stays legible and
navigable for everyone. Clarity *is* accessibility; if a calm design sacrifices legibility, it fails.

## 9. What the design never does
Never uses red-alert urgency; never gamifies; never animates to capture attention; never introduces a
new token/color outside the system; never lets aesthetic density defeat legibility or accessibility;
**never renders the character (Shiba Inu), a face, or a mascot on any product surface** — the product
mark is the KAI monogram; the character is marketing-only.

## 10. The two-world visual identity — the Design Law *(frozen — founder resolution 2026-07-17)*

**The Design Law:** *"The product never depends on a mascot to establish trust. Brand storytelling may
use a character. The product earns trust through clarity, evidence, and execution."*

**Two worlds, never blurred.** Inside the product, Kai is the **KAI monogram** and executive
intelligence only — no rendered character, face, avatar, cartoon, facial expression, wagging tail, or
emotional animation. The **rendered Shiba Inu** belongs exclusively to marketing and education (ads,
social, landing pages, Academy, tutorials, email, print, brand storytelling). Kai is not the artwork;
the artwork can be redesigned and Kai is unchanged.

## 11. Engineering invariant *(design-review gate)*

**A rendered character (Shiba Inu), face, or mascot introduced into any product or executive surface
— dashboards, Kai Home, Mission Control, decision cards, agency view, dispute workflows, readiness,
notifications, or presence — FAILS design review.** The rendered character is confined to marketing
assets and educational content. In the product, "Kai" resolves to the monogram, typography, presence,
and evidence — never an illustration. This is a hard, testable gate, not a stylistic preference.

---

*Frozen v1, 2026-07-17.*
