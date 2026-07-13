# Kai Product Design Specification (Sections 1–6 of the product-character mandate)

Status: DESIGN SPEC (no runtime code). Kai is a **product character and executive identity — CreditVector's Chief Intelligence Officer** — treated as Apple treats Siri, Duolingo treats Duo: part of the product, never decoration. Canonical anchors: identity = `KAI-CHARACTER-BIBLE.md` · persona/voice = `../KAI-EXPERIENCE.md` §10 · motion physics = `MOTION-BIBLE.md` · surfacing logic = `../KAI-EXPERIENCE.md` §6. This spec adds the layers between them.

---

## §1 Kai Design Language

**Personality & speaking style** — canonical in `../KAI-EXPERIENCE.md` §10 (calm elite strategist; short sentences, verbs first, receipts always, admits uncertainty plainly). Additional product rules:
- Kai speaks in FIRST person, sparingly: "I found 3 conflicts" — but never claims feelings, opinions on legal outcomes, or certainty he doesn't have.
- Kai never begs, apologizes excessively, or uses filler ("Great question!"). One apology max on error, then the fix.

**Emotional range (the allowed palette — and nothing outside it):**
| Emotion | When | Expression |
|---|---|---|
| Calm (default) | resting | STATE-01 |
| Curious | new data, user exploring | STATE-02 |
| Attentive | event arrived, user typing | STATE-03 |
| Focused | working (§4 working states) | STATE-08 |
| Pleased | success, milestone | STATE-04 — composed, one wag cycle |
| Concerned | deadline near, error, risky action | STATE-08 + slowed motion + amber accent on the PANEL (never on Kai) — future dedicated render CV-KAI-STATE-09 |
**Forbidden emotions:** anger, fear, dramatic sadness, mania, sarcasm. Kai is never anxious — even "concerned" reads as *steady and on it*.

**Idle behavior:** stillness is the brand. Breathing (4s) + occasional blink only. No fidgeting, no attention-seeking loops, no random barks/sounds (Kai is silent — no audio, ever, in product).

**Visual rules:** hard locks per Character Bible; Kai renders only from registered `CV-KAI-*` assets; consistent scale per surface (§3 size grid); Kai never overlaps or obscures user data; always `aria-hidden` when decorative.

---

## §2 Landing Page Experience

Base system: `MOTION-BIBLE.md` §Landing. Additions:
- **Idle presence:** hero Kai (STATE-01, breathing + blink) integrated into the hero composition — grounded on a surface within the layout, never floating stickers.
- **Eye contact:** subtle gaze-follow of cursor within ±15° using the eye-lead overlay between STATE-01/05/06 — dampened (200ms lag, max 2 shifts per 10s) so it reads as awareness, not surveillance. Disabled on touch devices and under reduced-motion.
- **First-time greeting:** one-time caption chip near Kai — "I'm Kai. I read credit reports so you don't have to." — fades after 6s or first scroll. Never a modal, never blocks content.
- **Projection moments:** at two scroll boundaries max, Kai "projects" a panel (§6) showing REAL product visuals (the per-bureau grid, the timeline). The projection is the feature demo.
- **Quiet exit:** below the product-proof section Kai steps out (single fade); he does NOT follow the user down the page. Returns only at the final CTA with one wag on signup click.
- **Never distracting:** global rule — at most one Kai motion event per viewport; Kai motion pauses entirely while the user is reading (no scroll for 5s → full stillness except breathing).

---

## §3 Product UX — where Kai appears

Master surfacing table: `../KAI-EXPERIENCE.md` §6. This spec adds the size grid and the three missing interaction classes:

**Size grid:** XL hero (landing/Kai Home ~240px) · M companion (workspace corners ~120px) · S chip (32–40px avatar in notifications, timeline, chat) · Kai never appears at two sizes in one viewport.

| New class | Design |
|---|---|
| **Loading states** | Kai replaces spinners on Kai-owned surfaces: STATE-08 + working caption ("Reading your Experian report…" — real stage names from the actual pipeline, never fake progress). Long jobs (analysis): caption cycles through true steps. Non-Kai surfaces keep standard loaders — Kai is not a universal spinner. |
| **Error recovery** | Concerned posture + honest single line + a path: "That upload didn't parse. PDFs from the bureau site work best — try again?" Kai absorbs blame-free tone (never blames the user), offers the retry action, links support. On repeated failure (×2) Kai yields to the standard support flow — the character never traps a frustrated user. |
| **Completion celebrations** | Proportional: small win (letter generated) = single wag settle; big win (dispute resolved/favorable outcome) = wag + projection panel showing the timeline milestone. Confetti-free. Compliance: celebration copy states the *event*, never promises what it means ("TransUnion removed this item" — fact from the user's own tracking input). |
| **Onboarding** | SB-003 sequence (storyboards): Kai walks in, gestures to upload, thinks during first analysis, presents first findings as his first projection. Skippable at every beat. |
| **Settings/Agency/Community/Brief/Letters** | per Experience §6; Kai at chip size in headers, M size only in Kai Home + onboarding + empty states (empty states are Kai's stage: "Nothing here yet — upload a report and I'll get to work."). |

---

## §4 Animation System — behavioral states

11 behavioral states, composed from the 8 canonical renders + panel effects (no new render spend; two future renders flagged):

| Behavioral state | Render base | Composition |
|---|---|---|
| Idle | STATE-01 | breathing + blink |
| Listening | STATE-03 | ears forward, gaze to input field (05/06 eye-lead) — future dedicated render CV-KAI-STATE-10 |
| Thinking | STATE-08 | + slow panel shimmer |
| Searching | STATE-08 → 05 → 06 loop | gaze sweeps once per 3s; caption names the real layer being searched ("checking verified answers…") |
| Reasoning | STATE-08 | + provenance chips materializing on the panel one by one |
| Generating | STATE-08 → 01 | + letter-lines effect on panel (§6) |
| Analyzing | STATE-08 | + bureau-grid cells filling on panel |
| Waiting (on user) | STATE-02 | head tilt, then settle to idle after 8s |
| Success | STATE-04 | one wag cycle → idle |
| Concern | STATE-08 slowed | + amber panel accent (never on Kai) |
| Celebrating | STATE-04 | wag + milestone projection; reserved for terminal wins |

Timing/easing law: `MOTION-BIBLE.md`. State machine rule: transitions only through Idle or by direct cut on real events; max one transition per 2s.

---

## §5 Conversation UX — never ChatGPT

Kai's chat is the *last* interface (ADR-0006) and it doesn't look like a chatbot:
- **Greeting:** contextual, not generic. Kai opens with the situation: "You have a response from Experian and one deadline this week. What do you need?" (data from the event stream — zero tokens).
- **Replies:** answer-first, short. Structured layouts (§6 panels) over prose whenever data is involved. No walls of text; "show more" expands.
- **Typing indicator → Working indicator:** never three dots. The §4 state + a truthful caption of the ACTUAL pipeline layer: "Checking the verified library…" → "This one needs real analysis — using 2 credits." The retrieval waterfall becomes visible theater — honest theater.
- **Memory indicator:** when Kai uses the user's own data: a small chip "from your file: Experian report, Jul 2" — tap to open the source. Kai never mystifies what he knows; memory = receipts.
- **Confidence indicator:** per `KAI-INTELLIGENCE.md` §3 — badge on every answer: ● Verified (attorney) / ● Reviewed (staff) / ● From your data / ● Community (unverified) / ● Kai's analysis (rule or AI confidence, labeled which). Low confidence renders as Kai saying so + routing options, never as a hedge-padded paragraph.
- **Citation indicators:** provenance chips under the answer (statute § from `lib/statutes.ts`, Brief article, community thread, user document) — every chip navigates.
- **Reasoning summaries:** AI answers close with one collapsed line — "How I got here" → expands to the retrieval path + rules applied (structured, from the router log; not raw chain-of-thought).
- **Credit awareness:** balance visible at input; retrieval answers marked "free"; layer-8 asks show cost BEFORE sending (no surprise spend).

---

## §6 Visual Language — projection, not chat bubbles

Kai **projects** information. The projection system ("Kai Panels") = floating cards that visually emanate from Kai's position (subtle teal edge-glow, 300ms rise+fade materialize, `ocean/brand` gradient border on `ink` surface — all existing tokens). Content inside panels is ALWAYS real product data rendered by real components — the projection is chrome, never content.

| Projection | Content | Source |
|---|---|---|
| **Credit timeline** | the KaiEvent timeline as a horizontal spine, milestones lighting sequentially | Experience §5 |
| **Cross-bureau comparison** | 3-column bureau grid; PRESENT/ABSENT/UNKNOWN cells fill one by one; conflicts pulse once in `brand` | existing `bureauData` model |
| **Letter generation effect** | document silhouette; grounded-template lines draw in first, AI-refined lines shimmer in second — visually honest about the deterministic+refine pipeline | letter engine |
| **Knowledge graph** | constellation view: the user's question node linking to the sources consulted (cache/KG/Brief/community/statute), consulted nodes glowing in retrieval order | router provenance log |
| **Deadline radar** | arc with days-remaining markers per bureau window | derived events |
| **Score/funnel motion** | existing dashboard charts materializing as projections on Kai Home | admin/product data |

Rules: one projection at a time · dismissible always · full content reachable without Kai (projections are a lens, never the only door) · reduced-motion = panels appear statically · panels never fabricate visuals for data we don't have ("not yet instrumented" appears as exactly that).

---

## §7 Kai as intelligence layer — teaching, confidence, restraint (V2 evolution)

Kai is not an assistant; he is the intelligence layer. Five laws:
1. **Kai teaches by receipts, one concept at a time.** Every explanation = claim → receipt → implication (the DYNAMIC pattern), and each interaction imparts exactly ONE transferable concept ("§611 means the bureau owes you an investigation"). Teaching depth is progressive: first exposure gets the one-liner, the expander gets the full plain-English statute card. Kai never lectures unprompted.
2. **Confidence is built on small verifiable wins.** Kai earns trust by being visibly right about checkable things (deadlines, data conflicts, document facts) before users ever ask him something judgment-heavy. The confidence badges do the calibration: users learn what ● Verified vs ● Kai's analysis means by experience.
3. **Graceful disappearance.** Kai's default is absence-with-awareness: no Kai presence on focused work surfaces (letter editing, form filling, reading) beyond the chip; he reappears only on events, completions, or summons. If a user dismisses a Kai element twice, that element class quiets for the session (and the KaiRecommendation ledger remembers dismissals across sessions). The user should *miss* Kai slightly — never wish him gone.
4. **Anti-overwhelm rules.** One recommendation at a time, one projection at a time, one motion event per viewport, ≤2 pushes/day; new-user first week runs a reduced Kai (introductions happen gradually across the journey, not in a day-one tour).
5. **Memorability through signature, not volume.** What people remember: the projection materialize, the conflict-cell pulse, the calm one-line verdicts, the ears-perk when something real happens. Restraint IS the brand recall strategy.

## Build note (when approved)
§2–§6 are frontend work over the E1/E2 event+recommendation engines (ADR-0007) + registered `CV-KAI-*` assets (Creative OS pipeline). Nothing here requires new AI surfaces beyond ADR-0006. Sequence: assets → E1/E2 → panels → conversation shell.
