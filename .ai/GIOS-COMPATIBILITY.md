# GIOS Compatibility Contract

> ⚠️ **DIRECTION superseded by [`ADR-0033`](ADR/ADR-0033-platform-constitution-gios-kai-creditvector.md)
> (2026-07-19).** The canonical target hierarchy is now **GIOS → Kai → CreditVector**: GIOS is the intelligence
> runtime, Kai is the platform intelligence runtime that belongs to GIOS, and CreditVector is the first vertical
> application on it. The "unrelated runtime" framing below describes the **prior** relationship. **The
> ENGINEERING non-goals in this doc REMAIN in force** — today there is still no runtime coupling (separate
> repos, no shared secrets/DB, no importing GIOS code); convergence is structural, not live. This contract now
> governs only the *engineering conventions + non-goals*; the *hierarchy* lives in ADR-0033.

Standards alignment with Gabriel Intelligence OS (GIOS) — **conventions only, not a runtime integration** *(today; the target relationship is ADR-0033)*. CreditVector and GIOS are separate products in separate repositories.

## CVIOS ↔ GIOS ↔ AIOS (the three-layer map, added Phase 2, 2026-07-12)
- **GIOS** (`~/Documents/Projects/Gabriel-AI-OS/gabriel-os`) — a separate PRODUCT whose governance conventions both systems share (this contract).
- **Gabriel Capital Labs AIOS** (`~/Documents/Gabriel-Capital-Labs-AIOS/`) — the COMPANY operating layer: org charter, decision rights 🟢🟡🔴, risk-office vetoes, G-NN backlog, `/gcl` agent fleet, routines, company dashboard.
- **CVIOS** (this repo's `.ai/`) — the PRODUCT intelligence layer: constitution, domain docs, executive lenses (`executive/`), metric catalog (`business-intelligence/`), marketing OS (`marketing/`), knowledge graph (`knowledge/`), improvement engine (`improvement/`), vision (`VISION.md`), platform architecture (`CVIOS.md`).
**Shared philosophy across all three:** progressive-disclosure entry point → index → current state; one canonical source per subject; verification labels; ADR discipline; reuse-first; honest metrics; secrets never in prompts; draft-autonomously/ship-deliberately. **Division of labor:** AIOS decides WHO and WHETHER; CVIOS defines WHAT and HOW for the product; GIOS is unrelated runtime. Executive charters live ONCE in the AIOS charter — `executive/` docs inherit and add product scope only.

## Shared conventions (adopted here 2026-07-12)
- Root `CLAUDE.md` = compact session entry point; `.ai/` = governance hub.
- `.ai/CURRENT-STATE.md` snapshot separate from historical memory (`ARCHIVE/`).
- ADRs in `.ai/ADR/`, numbered `ADR-XXXX`, same section format (Context/Decision/Alternatives/Consequences/Security/Compliance/Migration/Evidence).
- Verification labels: VERIFIED / INFERRED / PROPOSED / NEEDS CONFIRMATION.
- Token-efficient progressive disclosure: index-routed reading, never bulk-ingest `.ai/`.
- Reuse-first, one-canonical-source-per-subject, evidence-based execution, no false completion.
- Provider independence: AI/external services behind `lib/` service boundaries.
- Completion report format: Changed · Validated · Remaining risks · Next task.

## CreditVector-specific differences
- **Compliance layer is unique here** (`COMPLIANCE.md`, `/compliance-review` CCO gate, CROA bar) — GIOS has no consumer-finance-law analog.
- **Five-review ship gate** (CEO/Eng/Design/Compliance/QA via gstack + skills) governs features here.
- Deploy model: Vercel auto-deploy on `main` push (GIOS commit laws like one-milestone-one-commit are NOT adopted here; this repo confirms-before-push instead).
- Schema strategy: self-heal tables (ADR-0001) — an Accelerate-specific constraint.
- Company-level governance lives OUTSIDE this repo: `~/Documents/Gabriel-Capital-Labs-AIOS/` (`/gcl`).

## Explicit non-goals
No coupling to the GIOS repository · no shared secrets or database · no importing GIOS code without license/fit review · never assume GIOS files are accessible from here. A shared governance package, if ever desired, is a separate proposal requiring explicit approval.
