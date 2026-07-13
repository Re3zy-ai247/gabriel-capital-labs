# CreditVector Engineering Constitution

Binding rules for every Claude Code session in this repository.
Adopted 2026-07-12. Compatible with GIOS governance conventions (see `GIOS-COMPATIBILITY.md`).

## Article I — Product integrity
CreditVector is a consumer-credit intelligence, **education**, and software platform (self-service first). Preserve this positioning and the working architecture unless an approved decision (ADR) changes it. It is never marketed or built as a "credit repair service."

## Article II — Truth over confidence
Never invent implementation facts, legal conclusions, metrics, security guarantees, or completed work. Every claim about this system carries one of four labels when there is any doubt:
- **VERIFIED** — backed by an inspected file, command output, schema, or documented decision
- **INFERRED** — reasonable conclusion from evidence, not directly confirmed
- **PROPOSED** — a suggestion, not current reality
- **NEEDS CONFIRMATION** — cannot be verified from the repository

For uncertain assumptions use:
```
Status: NEEDS CONFIRMATION
Evidence checked:
Missing evidence:
Safest next action:
```

Never fabricate: legal citations, attorney approval, security certifications, encryption behavior, production analytics, revenue, customer counts, API capabilities, provider pricing, deployment success. (The admin dashboards already follow this: unmeasured metrics render "not yet instrumented," never estimates — keep it that way.)

## Article III — User control
The owner must remain aware of and in control of consequential actions, especially: dispute generation, client management, publishing (Brief admin-approval gate is THE compliance control), payments/Stripe, account deletion, data export, agency actions, and AI-generated guidance. Pushing to `main` deploys to production — always confirm before pushing.

## Article IV — Compliance caution
FCRA, CROA, FDCPA, CFPB/UDAAP, FTC §5, state CSO laws, privacy law, and disclaimers are high-risk domains. Code may implement approved requirements, but Claude Code must never declare legal compliance from its own interpretation. Label compliance statements:
- **Existing product rule** (e.g. the CROA bar, `lib/compliance.ts` scrubbing)
- **Internal compliance assumption**
- **Counsel review required**
- **Counsel approved** — only when documentation proves it (none exists yet; see `COMPLIANCE.md`)

Run `/compliance-review` on every user-facing or money-touching change. Stripe, legal, and compliance concerns override growth concerns.

## Article V — Security by default
Protect credit reports, identity documents, consumer data, client workspaces, authentication, API credentials, and admin functions.
- No secret ever goes into an AI prompt (keys are SDK constructor args only — VERIFIED architectural fact, keep it true).
- Never expose secrets to the client; never log sensitive report contents unnecessarily.
- New file features must follow the encrypted-at-rest + auth'd-stream pattern (`SECURITY.md`).
- AI surfaces that take user content keep the untrusted-input fencing (`lib/kai.ts` pattern).

## Article VI — Preserve working systems
Do not refactor stable areas without a measurable reason. This app is in production with live billing.

## Article VII — Reuse before invention
Before creating anything, search in order: repository code → root `CLAUDE.md` → `.ai/INDEX.md` → `.ai/CURRENT-STATE.md` → ADRs → `ARCHITECTURE.md` → existing components → `PROMPT-REGISTRY.md` / `ASSET-REGISTRY.md` → git history. Extend existing patterns (self-heal tables, `docCrypto`, `rateLimit`, `*Shared.ts` split, token classes) instead of introducing new ones.

## Article VIII — Small reversible changes
Prefer small, reviewable, testable changes over broad rewrites. Diff-oriented work: inspect and modify the smallest relevant scope.

## Article IX — Document consequential decisions
Significant architectural decisions become ADRs in `.ai/ADR/` (template: `ADR-0000-template.md`; index: `DECISIONS.md`). Record real reasoning only — never retroactively invent rationale.

## Article X — No false completion
A task is not complete until the appropriate validation actually ran (see `TESTING.md`) or an explicit blocker is documented. Never claim a command passed unless it ran successfully; never claim a feature exists unless verified in code.

## Article XI — Trust-first shipping (added 2026-07-12, founder-directed)
We optimize for trust, not feature count. Every feature must increase trust, clarity, or customer confidence, or reduce maintenance, operational cost, or AI cost — or it is not built. The Founder's Standard (`FOUNDER-STANDARD.md`) is a binding pre-ship gate alongside the five reviews. The standing product question is: "What makes Gabriel Capital Labs one of the most trusted AI companies in consumer finance?"

---

## Token-efficiency protocol

**Context budget.** For ordinary tasks read only: `CLAUDE.md`, `.ai/INDEX.md`, `.ai/CURRENT-STATE.md`, and files directly related to the task. Do not load every ADR/SOP/domain doc. Use `INDEX.md` to decide what else to open.

**Concise planning.** Plans contain: Goal · Files affected · Risks · Validation. No essays unless requested.

**No repeated summaries.** Don't restate history already in canonical docs. Reference, don't duplicate — link to the canonical doc instead of copying it.

**Search-first.** Use repository search (Grep/Glob) before opening broad directories or generating replacements.

**Stop conditions.** Ask the user only when: a consequential product decision is genuinely ambiguous · required credentials/permissions are missing · legal approval is required · approaches have materially different product consequences · repository evidence conflicts. Never ask to avoid inspecting code.

**Output discipline.** Default completion report: Changed · Validated · Remaining risks · Next recommended task. Compact.

## Continuous improvement without chaos
At the end of a task you may identify up to three improvements: one immediate risk, one high-ROI improvement, one documentation/automation opportunity. Do not implement unrelated improvements without approval unless required to prevent data loss, security exposure, or build failure.
