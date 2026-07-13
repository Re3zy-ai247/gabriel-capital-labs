# ADR-0009: Product first, OS later — the extraction law (resolves G-PLAT-1)

Status: **Accepted** (founder directive, 2026-07-12)
Date: 2026-07-12
Decision owners: Founder (Executive Product Directive)

## Context
The platform blueprint (`platform/GABRIEL-INTELLIGENCE.md`) designed the future Gabriel Intelligence OS and flagged G-PLAT-1: the relationship between that platform and any pre-existing "GIOS." Ambiguity risked two failure modes: building OS abstractions speculatively inside CreditVector, or treating an external OS as a production dependency.

## Decision (founder's ruling, verbatim intent)
1. **Gabriel Intelligence OS does not exist in production.** Today CreditVector runs as a standalone application on Claude Opus 4.8 — intentionally.
2. **GIOS will be extracted FROM CreditVector, not invented first.** CreditVector becomes the first native GIOS application only after the OS emerges from its proven production code.
3. **Engineering law:** every subsystem gets clean boundaries so later extraction requires no CreditVector rewrite — but no abstraction is built merely because GIOS is coming. Build the best CreditVector → observe what becomes reusable → extract only proven systems.
4. **Architecture is frozen.** No new OS abstractions, no speculative infrastructure, no duplicate governance. Every engineering decision must improve customer experience: simpler, faster, more trustworthy, more proactive, more delightful, more intelligent, more premium.
5. **Positioning:** CreditVector is an **AI-powered Financial Reputation Platform** (not a credit-repair app) — mission: reduce uncertainty, educate, enable better financial decisions. Kai is the primary customer-experience layer; Claude Opus 4.8 is the current intelligence runtime.
6. G-PLAT-1 is **RESOLVED** by this ruling. (The founder's separate GIOS standards/workspace project remains a conventions reference per `GIOS-COMPATIBILITY.md`; it is not a production dependency of CreditVector.)

## Consequences
The platform docs stand as a **harvest map, not a build plan** — their Rule of Two already encodes this law; their GIOS-relationship framing is corrected to cite this ADR. Every reusable component earns its place in GIOS by first succeeding inside CreditVector. Extraction candidates get tagged in ADRs as they stabilize; extraction itself waits for the platform roadmap's Year-1.5 gate (committed product #2).

## Alternatives considered
Platform-first development — rejected by directive (speculation risk); permanent monolith with no boundaries — rejected (would force a rewrite at extraction time; clean boundaries are nearly free now, per existing codebase discipline).

## Security / Compliance implications
None new; standalone posture unchanged.

## Migration or rollback plan
Docs-only ruling. Reversal = a future founder ADR.

## Evidence
Founder directive 2026-07-12 (this conversation). Existing boundary discipline VERIFIED in code: provider config via env (`LLM_MODEL`), service modules in `lib/`, `*Shared.ts` client/server splits, self-heal store gates.
