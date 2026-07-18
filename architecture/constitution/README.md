# CreditVector Product Constitution — v1.0 *(canonical, in-repo)*

> **Constitution Version: v1.0 · Status: RATIFIED · State: FROZEN · 2026-07-17.**
> Future changes require an **ADR** or a **Constitutional Amendment — never a silent edit.**
> Engineering lifecycle: superseded by [ADR-0001 (Engineering Lifecycle)](adr/ADR-0001-engineering-lifecycle.md).

The frozen product-and-identity foundation for CreditVector and Kai. This directory is the canonical,
version-controlled home of the constitution. Every future feature, screen, API, prompt, animation,
notification, and AI behavior must trace back to these documents.

**Apex document:** [PRODUCT-CONSTITUTION-v1.md](PRODUCT-CONSTITUTION-v1.md) — read it first.

---

## The frozen hierarchy

> **Gabriel Capital Labs → CreditVector → The Credit Operating System → powered by Kai → Kai, Chief
> Intelligence Officer.**

- **Gabriel Capital Labs** — the company.
- **CreditVector** — the product, shipped as *The Credit Operating System*.
- **GIOS** — the invisible kernel beneath (never named to users).
- **Kai** — the intelligence layer inside the OS; the **Chief Intelligence Officer**.

## Kai is not the Operating System

**Kai is the operating intelligence *inside* the Credit Operating System — never the OS itself.** The
OS is the place (surfaces, records, engines, kernel — these render even with Kai's reasoning stripped
away); Kai is the officer who reasons over them and speaks. What disappears when Kai is removed is
Kai; what remains is the OS. "Powered by Kai" is the only correct connector; we never equate the two.

## Two-world visual identity *(founder resolution, 2026-07-17)*

- **In the product:** Kai is the **KAI monogram** and executive intelligence only — never a rendered
  character, face, avatar, cartoon, facial expression, or emotional animation. Presence comes from
  intelligence; authority from evidence; trust from consistency.
- **In marketing & education only:** the **rendered Shiba Inu** builds familiarity (ads, social,
  landing pages, Academy, tutorials, storytelling), so the product never has to introduce Kai again.
- **Kai is not the artwork.** The Shiba is one marketing rendering; Kai's identity is reasoning,
  evidence, and judgment, and is unchanged if the character is redesigned.
- **Engineering invariant:** a rendered character in any product/executive surface (dashboards, Kai
  Home, Mission Control, decision cards, agency view, dispute workflows, presence) **fails design
  review.**

## The Five Laws *(every feature compiles against these)*

1. **Possession, not labor** — Kai possesses an organized file; it never narrates a system process as
   its own effort.
2. **Evidence, not confidence** — evidence strength (completeness of the record), never machine
   confidence or outcome probability.
3. **Four layers, always separated** — Verified Facts → Analysis → Recommended Action → Expected
   Outcome (process only, never a promise).
4. **Calm over urgency** — no manufactured urgency, dopamine loops, or fear; honest severe
   consequences may raise *salience*, never *alarm*.
5. **Deterministic, fail-closed honesty** — same file → same guidance, always a receipt; withhold
   over guess; an outage is never rendered as an empty file.

## Canonical document index

| Document | Owns |
|---|---|
| [PRODUCT-CONSTITUTION-v1.md](PRODUCT-CONSTITUTION-v1.md) | apex — hierarchy, Five Laws, engineering rules, non-Kai zones |
| [KAI-IDENTITY-SPECIFICATION.md](KAI-IDENTITY-SPECIFICATION.md) | Kai's permanent identity (35 sections) |
| [CREDITVECTOR-BRAND-ARCHITECTURE.md](CREDITVECTOR-BRAND-ARCHITECTURE.md) | hierarchy, Kai≠OS, positioning, two-world visual identity |
| [KAI-VOICE-GUIDE.md](KAI-VOICE-GUIDE.md) | how Kai writes and speaks |
| [KAI-UX-PRINCIPLES.md](KAI-UX-PRINCIPLES.md) | how the experience behaves |
| [KAI-DESIGN-LAWS.md](KAI-DESIGN-LAWS.md) | how it looks and moves; the Design Law + engineering invariant |
| [KAI-DECISION-MODEL.md](KAI-DECISION-MODEL.md) | how Kai reasons and recommends |
| [KAI-TRUST-MODEL.md](KAI-TRUST-MODEL.md) | how Kai earns and protects trust |
| [KAI-NOTIFICATION-STANDARD.md](KAI-NOTIFICATION-STANDARD.md) | when Kai speaks, waits, defers, is silent |
| [KAI-EXPANSION-ROADMAP.md](KAI-EXPANSION-ROADMAP.md) | how the domain expands without changing Kai |
| [KAI-PRODUCT-MANIFESTO.md](KAI-PRODUCT-MANIFESTO.md) | the narrative charter (the *why*, in prose) |
| [CONSTITUTION-FREEZE-REVIEW.md](CONSTITUTION-FREEZE-REVIEW.md) | the four-lens freeze review docket + fixes |

## Ratification status

- **RATIFIED & FROZEN — Constitution v1.0, 2026-07-17.** The hierarchy, the Kai≠OS distinction, Kai's
  identity, the Five Laws, and the two-world visual identity are ratified and frozen; a final
  ratification pass verified them consistent (no contradictory hierarchy; Kai, CreditVector, "The
  Credit Operating System," and Gabriel Capital Labs defined consistently; the two-world rule enforced
  everywhere; all cross-references, links, and README pointers resolve; no deprecated document is
  referenced).
- **Two counsel-gated sub-items remain open** (below); they gate only their own sections, not the
  identity/architecture, and are resolved by future ADRs.

## Remaining counsel-gated items *(open — do not treat as frozen)*

1. **CROA posture classification** — classify which shipped behaviors are education vs.
   Credit-Services-Organization conduct (strategy selection + statute-cited letters for a fee), and
   name the compliant posture. Flagged in [CREDITVECTOR-BRAND-ARCHITECTURE.md](CREDITVECTOR-BRAND-ARCHITECTURE.md) §4.
2. **Commerce / third-party offers boundary** — Kai never sells and commerce is a non-Kai zone
   ([PRODUCT-CONSTITUTION-v1.md](PRODUCT-CONSTITUTION-v1.md) Article VIII); still to decide whether
   lender/offer/marketplace surfaces are permitted-with-constraints or prohibited, and whether
   in-product referrals are allowed. Set by ADR.

## Change control

This set is frozen. It changes **only by a formal ADR** that (a) names the Article or section
amended, (b) states the reason, (c) shows the change does not weaken Law I–V, and (d) is approved by
the founder. Engineering order is absolute: **Product Constitution → Architecture → Implementation
Plan → Production Code** (Constitution Article IX). The repository is authoritative over these
documents only on non-constitutional implementation detail; a HEAD that violates a Law is a code
defect, never a correction to the constitution (Constitution Article VI.2).

## Provenance

- **Authored:** 2026-07-17 across the constitution-freeze working sessions.
- **Source of this in-repo copy:** the founder's local AIOS working folder
  (`~/Documents/Gabriel-Capital-Labs-AIOS/`).
- **Migrated into the repository:** 2026-07-17, on branch `docs/constitution-freeze-v1`, as a
  documentation-only change (copied, not moved; the AIOS originals remain the working drafts).
- **Not migrated (out of scope for the canonical set):** Phase-D strategy/architecture packages and
  the pre-existing AIOS working documents (platform, beta-launch, backlog, etc.) — supporting, not
  constitutional.
