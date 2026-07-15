# .ai Knowledge Index — read THIS to decide what else to read

Default context budget per task: root `CLAUDE.md` + this file + `CURRENT-STATE.md` + task files. Everything below is read **only when the task matches**. All docs canonical unless marked otherwise. Last verified: 2026-07-15.

> **`CREDITVECTOR-OS.md` is the apex constitution — the philosophy every other doc derives from.** Skim it before implementing anything non-trivial (mission, product/design/Kai/copy/compliance philosophy, engineering + founder principles, the North Star). It states *why*; the docs below own the *how* (tokens, statutes, prompts). Where a detailed doc conflicts with the OS, the OS wins.

| Doc | Read when… |
|---|---|
| `CREDITVECTOR-OS.md` | **The constitution.** Before any feature, design, Kai, copy, or compliance decision — it sets the principles the rest of `.ai/` implements. Amend only with founder approval + an ADR. |
| `CONSTITUTION.md` | Once per unfamiliar session, or when unsure how to operate (labels, token rules, stop conditions). Binding. |
| `CURRENT-STATE.md` | **Every session.** Live snapshot, pending owner actions, next tasks. |
| `TASKS.md` | Picking up work / adding follow-ups. Company backlog is external (`/gcl`). |
| `PRODUCT.md` | Changing product behavior, plans/entitlements, positioning, or marketing surfaces. |
| `ARCHITECTURE.md` | Changing app structure, services, routing, data flow, schema, or infra. Contains the file map. |
| `SECURITY.md` | Touching auth, files/uploads, encryption, AI prompts, rate limits, admin routes, or anything PII. |
| `COMPLIANCE.md` | Changing dispute generation, Kai, Brief, marketing claims, pricing/subscriptions, agency behavior, disclosures, emails, or consumer guidance. Pair with `/compliance-review`. |
| `DESIGN-SYSTEM.md` | Any UI work — tokens, classes, logo rules, motion, accessibility. |
| `TESTING.md` | Before claiming anything validated; lists commands + guard scripts + prod probes. |
| `INTEGRATIONS.md` | Touching Stripe, Anthropic, Resend, Push, crons, env vars, or Vercel config. |
| `ROADMAP.md` | Planning what to build next (repo-level). |
| `DECISIONS.md` → `ADR/` | Before changing anything architectural — check if a decision already governs it; add an ADR when you make one. |
| `ASSET-REGISTRY.md` | Before generating/using ANY visual asset (logo rules live here). |
| `PROMPT-REGISTRY.md` | Before writing/editing ANY AI prompt or doing paid media generation. |
| `GIOS-COMPATIBILITY.md` | Cross-project governance questions; the CVIOS↔AIOS↔GIOS layer map. |
| `VISION.md` | Questioning long-term direction or sequencing new modules (5-year horizons — NOT a roadmap). |
| `CVIOS.md` | Understanding how all platform subsystems fit together (Consumer OS, Agency OS, Kai, Brief, BI, marketplace…). |
| `executive/` | Acting in/for a specific executive lens (CEO…CAIO). Start at `executive/README.md` (role↔charter↔skill↔dashboard map). |
| `business-intelligence/` | Defining, citing, or instrumenting ANY metric — `METRICS.md` is the only place metrics are defined (BI-XXX-NN). |
| `marketing/` | Any marketing work: `README.md` (channels/SOPs) · `BRAND-VOICE.md` (voice+language rules) · `CAMPAIGN-LIBRARY.md` (check before creating assets). |
| `knowledge/GRAPH.md` | Finding the canonical source for any node type (features, APIs, prompts, campaigns…); Kai-consumption constraints. |
| `improvement/ENGINE.md` | Monthly improvement sweeps; proposing evidence-based improvements. |
| `KAI-INTELLIGENCE.md` | Any Kai/AI-surface architecture work — the AI-last 8-layer pipeline, confidence scoring, attorney verification, cost tracking, multi-model routing. PROPOSED (ADR-0006). |
| `CREDIT-ECONOMY.md` | AI credit system, plan entitlements for Kai, add-on packs, margin guardrails. PROPOSED — pricing is 🟡 + compliance-review. |
| `KAI-EXPERIENCE.md` | Any Kai-facing UX/product work — passive vs active modes, event engine, Kai Home/Timeline/Digest, notifications, screen-by-screen surfacing, Kai brand/personality. PROPOSED (ADR-0007). |
| `creative/` (Creative OS) | ANY visual/video asset generation — Kai Character Bible, cinematography/motion bibles, Higgsfield prompt blocks, storyboards, consistency scoring gate. Read `creative/README.md` before any render (ADR-0008). Company-level Brand Universe layer lives here too (`creative/BRAND-UNIVERSE.md` + dynamic/cinematic/media/hologram/founder-story/pipeline docs). |
| `PRODUCT-VISION-V2.md` | The V2 experience vision — ideal journey, three-question rule, customer-love principles. Read before designing any user-facing flow. |
| `DELIGHT-SYSTEM.md` | The 100 delight micro-moments (D1–D100) + WOW-50 (W1–W50) registries — ship delight WITH features. |
| `FOUNDER-STANDARD.md` | **BINDING pre-ship quality gate** (gate 6) + the Trust-First Rule (Constitution Art. XI). Run on every feature at design sign-off and pre-ship. |
| `MOAT.md` | The 12 compounding assets — every feature names its moat (Founder's Standard Q10). |
| `ROADMAP-V2.md` | THE ranked Top-100 roadmap (supersedes ROADMAP.md for sequencing). First build sprint: #4 metering + #5 event engine. |
| `platform/` (Gabriel Intelligence) | Company platform blueprint — JARVIS runtime, Product SDK, Founder Intelligence layer, 3-year architecture roadmap, Rule of Two extraction law. Read when scoping product #2 or any extraction. |
| `CX-REVIEW.md` | Screen-by-screen product audit (2026-07-12): verdicts per screen, journey friction fixes, conversational-workflow pattern, Agency Command Center, community-Premium economics, retention engine. New items = CX-IDs in ROADMAP-V2 Amendment 1. |
| `RUNBOOKS/` | `deploy.md` (ship/env vars/preview) · `schema-change.md` (ADR-0001 procedure) · `admin-actions.md` (one-time owner actions). |
| `SOP/ship-a-feature.md` | Shipping any feature — the 7-step workflow + five-review gate + definition of done. |
| `ARCHIVE/` | Historical only — never load by default. Original pre-governance CLAUDE.md + 2026-06 QA traceability table live here. |
