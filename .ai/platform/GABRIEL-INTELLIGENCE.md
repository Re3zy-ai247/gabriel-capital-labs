# Gabriel Intelligence Platform — architectural blueprint ("Project JARVIS")

Status: **BLUEPRINT** (no runtime; no extraction yet). CreditVector is no longer the destination — it is **Application #1 and the proving ground**. This document defines the platform that will power every GCL product, and the discipline for building it without killing the company that funds it.

**Naming & scope — RULED (ADR-0009):** Gabriel Intelligence OS **does not exist in production**. CreditVector runs standalone on Claude Opus 4.8, intentionally. GIOS will be **extracted from CreditVector** — this blueprint is a *harvest map, not a build plan*. Clean boundaries now; no abstractions built merely because GIOS is coming; every component earns its place by first succeeding inside CreditVector. (The founder's separate GIOS standards project remains a conventions reference via `GIOS-COMPATIBILITY.md`, not a production dependency.)

## The prime architectural law: harvest, don't build
Platforms built before their second customer are speculation (Constitution Art. VIII at company scale). Therefore:
- **Rule of Two:** nothing is extracted into the platform until a committed second product needs it. Until then, capabilities live in CreditVector, built cleanly enough to extract (service boundaries, provider adapters, `*Shared` splits — disciplines already in the codebase).
- **CreditVector never pauses for the platform.** Extraction happens alongside product #2's build, funded by its need.
- **The `.ai/` governance system IS the first platform component** — already proven, already portable (it's how this blueprint exists).

## 1 · JARVIS Runtime (Gabriel Intelligence Runtime)
The generalization of engines CreditVector has already designed/proven. Seven subsystems, each with a named CreditVector ancestor:

| Subsystem | Contract | Ancestor (proof) |
|---|---|---|
| **Event Bus** | Append-only, per-tenant product event streams + derived (computed-on-read) events; producers fail-open; consumers render, never invent | `KaiEvent` design (ADR-0007) |
| **Retrieval Kernel** | The AI-last waterfall as a configurable pipeline: products register their layer bindings (own-data → cached → knowledge → community → feeds → templates → docs → AI); confidence thresholds + provenance contracts standard | ADR-0006 8-layer router |
| **Memory Orchestration** | Structured-data-first: product DB rows ARE memory; event stream = episodic; recommendation ledger = advice memory; NO freeform AI memory stores; per-product, privacy-walled | KAI-EXPERIENCE §9 |
| **Knowledge Graph** | Two tiers: per-product knowledge packs (domain truth, human-gated) + the **GCL Verified Corpus** (attorney/expert-verified answers — the crown-jewel moat #1) with provenance + verification status on every node | KaiAnswer/KnowledgePack + verification pipeline |
| **Cross-Product Intelligence** | THE IRON WALL: **user data never crosses products** — no shared user DB, ever. What crosses: verified knowledge (with domain tags), anonymized aggregate patterns (DPO-gated), the character, the governance. Cross-product user features require explicit per-user consent, designed per-case | Art. V + MOAT rule 2 |
| **AI Router** | Provider-adapter interface; task classes → model tiers; per-surface budgets; provider swaps are config | `lib/ai/provider.ts` design (ADR-0006 §7) |
| **Cost Governor** | Metering on every call (the AiUsage pattern), per-tenant credit ledgers, org circuit breakers, retrieval-deflection KPIs; cost falls as corpora grow — the structural advantage (Moat #12) | BI-COST-01 + CREDIT-ECONOMY |

## 2 · Kai as cross-company executive intelligence (License #1: CreditVector)
The separation that makes one character serve many products without drift:
| Layer | Scope | Canon |
|---|---|---|
| **Identity** (personality, emotional range, visual spec, hard locks) | ONE, company-wide, versioned | `creative/KAI-CHARACTER-BIBLE.md` — immutable per its permanence clause |
| **Knowledge** | Per-product knowledge packs; Kai in product #2 knows different things, IS the same executive | Retrieval Kernel bindings |
| **Memory** | Per-product, privacy-walled (the iron wall); Kai never gossips between rooms | Memory Orchestration |
| **Surfaces** | SDK components (Kai Home, timeline, panels, conversation shell) themed per product | `PRODUCT-SDK.md` |
| **Renders** | One asset registry, one consistency gate — all products draw from the same scored `CV-KAI-*` pool (re-lit per product world if worlds diverge, by bible amendment) | Creative OS |
New license checklist: founder approval → domain knowledge pack built + gated → SDK surfaces themed → Creative-OS assets confirmed sufficient → compliance review for the new domain → launch. Kai's title in every product: Chief Intelligence Officer of the room he's standing in (`creative/BRAND-UNIVERSE.md`).

## 3 · Three-year architecture roadmap
**Year 1 — Prove & harden (now).** Ship CreditVector V2 per `ROADMAP-V2.md` (meter + event engine first). Platform work = ZERO extraction; instead: keep boundaries clean, mark extraction candidates in ADRs as they stabilize (`extraction-candidate: yes` tag), grow the Verified Corpus, run the Founder Intelligence layer on the existing AIOS fleet. Exit criteria: CreditVector default-alive (real MRR), corpus >100 verified answers, event engine live.
**Year 1.5–2 — Second product & first extraction.** Founder selects product #2 (VISION h5 scoping: business credit / funding readiness are the natural adjacencies — same trust engine, same Kai). Rule of Two activates: extract in dependency order — (1) governance template (`.ai/` starter kit), (2) Trust Engine + auth/billing patterns, (3) Retrieval Kernel + Cost Governor, (4) Kai SDK surfaces. Platform repo born ONLY now; GIOS convergence decision made BEFORE it (founder + ADR). Exit: product #2 live on shared components, CreditVector migrated component-by-component only where net-positive.
**Year 2–3 — Platform consolidation.** Verified Corpus becomes multi-domain with partitioned licensing; Event Bus + Router as shared services; Founder Intelligence matured (below); possibly the partner/API surface (VISION marketplace horizon) exposing *capabilities, never user data*. Exit: adding product #3 is measured in weeks of product work, not months of infrastructure.
**Standing anti-goals:** no shared user database, ever · no platform team before product #2 commits · no external API before internal SDK is proven by a real second product · no rewrite of CreditVector "onto the platform" for purity — migration only where it pays.

## 4 · Decision gates (each is a founder ADR, not a drift)
~~G-PLAT-1~~ **RESOLVED by ADR-0009** (product first, OS later; GIOS extracted from CreditVector) · G-PLAT-2: product #2 selection (opens Year-1.5) · G-PLAT-3: platform repo creation + `BRAND-UNIVERSE`/bible relocation (`creative/BRAND-UNIVERSE.md` §home) · G-PLAT-4: external API exposure (Year 2–3, security + legal heavy).
