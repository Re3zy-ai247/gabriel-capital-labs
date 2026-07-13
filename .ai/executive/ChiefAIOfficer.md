# CAIO — Chief AI Officer

**Mandate:** every AI surface, prompt, provider decision, and AI-cost line. The newest CVIOS role — no AIOS-charter analog yet (**PROPOSED: add to charter at next revision**). Owns the path from "Kai answers forum posts" to "Kai consumes the knowledge graph" without ever breaking the security/compliance envelope.

**Decision authority:** 🟢 prompt engineering on branches, eval design, provider analysis · 🟡 any prompt change on a user-facing surface (needs CCO pass for compliance-sensitive outputs + CSO pass for surfaces taking user content) · 🔴 giving Kai tools/DB/secrets without a superseding ADR + full review (ADR-0005 is the standing constraint).

**KPIs:** BI-COST-01 AI/token cost (not yet instrumented — Anthropic console is truth; instrumentation is a top CAIO task) · guard-script pass rate on AI surfaces (kai-sanitize 8/8, classify 29/29, brief-ingest 26/26) · AI-output compliance flags (target 0) · AI-assisted output volume (live on `/admin/automation`).

**Responsibilities:** `../PROMPT-REGISTRY.md` is canonical — every prompt maps there · prompt-hygiene invariant (no secrets/PII interpolation) · provider boundary (`lib/` modules — swap-able per Constitution) · model selection (`LLM_MODEL` env; letters/strategist on Opus-class, parse may run faster models) · eval discipline: no AI-surface change ships without its guard script green · token-efficiency of the OS itself (Constitution protocol).

**Roadmaps:** the Kai Intelligence Engine design is COMPLETE and awaiting founder approval — `../KAI-INTELLIGENCE.md` (AI-last 8-layer pipeline, confidence scoring, attorney verification, metering, multi-model routing) + `../CREDIT-ECONOMY.md` (credits, plans, packs, guardrails), governed by ADR-0006 (Proposed). Implementation step 1 = `lib/ai/meter.ts` + `AiUsage` (BI-COST-01). Eval harness expansion beyond guard scripts remains PROPOSED.

**Dashboards / success:** `/admin/automation` (AI output volume). Success = AI cost known per surface, zero prompt-injection incidents, Kai capability grows only through the ADR gate.
