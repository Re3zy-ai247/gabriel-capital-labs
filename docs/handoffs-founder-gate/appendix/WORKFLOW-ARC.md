# Appendix G — Multi-Agent Execution Workflow: Implementation Arc

The Founder's second directive this session: implement the approved Fable 5 → Sonnet 5 → Opus 5 multi-agent execution workflow as a repository artifact. Executed under its own routing rules (Sonnet implemented; Opus challenged once, narrowly; Fable reconciled).

## What shipped

| Artifact | State |
|---|---|
| `.ai/SOP/MULTI-AGENT-EXECUTION.md` (201 lines) | NEW — canonical routing law |
| `.ai/SOP/MULTI-AGENT-EXECUTION.html` (441 lines) | NEW — self-contained mobile twin, 1:1 parity verified |
| `.ai/INDEX.md` | +1 routing line in the SOP table |
| Commit | `3529271` on `feat/experience-runtime-phase-1a` — **local only, NOT pushed** |

All 10 Founder-specified elements present: role/responsibility tables (Fable Program Director · Sonnet default implementer · Opus selective reviewer), the 7-step delegation sequence, token-preservation rules, risk-based Opus escalation checklist, Standard Sub-Agent Task Packet, Standard Sub-Agent Return, Fable Reconciliation Checklist, Mobile Handoff requirements, hard safeguards + subordination clause.

## Opus narrow adversarial review — ACCEPT-WITH-CORRECTIONS

Ten findings + one ruling, every one applied verbatim in the amended commit:

| # | Severity | Finding | Correction now in the SOP |
|---|---|---|---|
| 1 | BLOCKER | Prohibitions bound only sub-agents — Fable was enumerated out and could "legally" merge/deploy | §9 now binds **ALL agents**, absent Founder authorization quoted verbatim |
| 2 | BLOCKER | `push` absent — in this repo push-to-main IS the production deploy; `prisma db push` also uncovered | Push/PR + any DB-mutating command added to §9; §6 confirmation line extended |
| 3 | BLOCKER | Unbounded packet allowlists could hand Sonnet `prisma/`, `.env*`, or governance docs — including this SOP itself | NEVER-ALLOWLISTED floor added to §5; governance-doc edits are §4 territory, never a Sonnet default |
| 4 | BLOCKER | Opus review could silently substitute for the CCO /compliance-review, five-review gate, ADR governance, Gate D/F | "ADDITIVE, never SUBSTITUTIVE" clause added to §4 + reconciliation checklist item |
| 5 | MAJOR | Sub-agents instructed to publish to an external service (gist) unconditionally | Fable-only gist push, after a secrets/PII scan; sub-agents never publish externally |
| 6 | MAJOR | No verbatim-Founder-authorization field; no path for a sub-agent that thinks Fable itself is wrong | FOUNDER AUTHORIZATION (verbatim) packet field + HALT/refuse clause: Fable must surface refusals verbatim, may not overrule |
| 7 | MAJOR | "No duplicate reports" vs "five artifacts every time" contradiction; no anti-rescan mechanism | Five renderings of ONE reconciled report; Fable inspection ledger added to §3 |
| 8 | MAJOR | "Integration checks only as needed" let mandatory gates become discretionary | Repo-mandatory gates (typecheck / build) always run |
| 9 | MINOR | Mechanical-refactor default could touch §4-listed files | §4 always wins over a §1 default |
| 10 | MINOR | Bare `TESTING.md` path | `.ai/TESTING.md` |
| R | RULING | All nine named constitutions are external to this repo; the in-repo `.ai/CONSTITUTION.md` was missing from the clause | Subordination clause rewritten: (a) in-repo Constitution + (b) nine EXTERNAL-AUTHORITY REFERENCES that no agent may delete as "unverifiable" |

## Live integrity events during this arc (disclosed)

1. **Coordinator mis-route:** Fable sent the Opus corrections to Agent A (a browser-only QA persona) instead of the workflow implementer. Agent A refused the out-of-scope instruction and flagged it — precisely the §9 refusal behavior the SOP prescribes, demonstrated before the ink dried. Corrections were re-sent to the correct agent; git log verified undamaged.
2. **Implementer judgment call:** the correction text implied demoting §9's heading; the implementer kept the existing `## 9.` structure (preserving anchors and every `§9` cross-reference) and flagged the deviation rather than silently obeying. Approved by Fable — the substantive change (ALL-agents wording) was applied.
3. **Tooling noise:** a headless-browser daemon self-registered a `.gstack/` state dir (containing a local terminal token) in the worktree twice; removed both times; the SOP's new NEVER-ALLOWLISTED rule exists for exactly this class of file.

## Validation

- `git status --porcelain` clean after amend; only the 3 intended files in the commit (643 insertions).
- MD fence balance + HTML tag-balance checks pass; MD↔HTML parity verified by full-page text extraction.
- Docs-only: `.ai/` is never bundled by the app build — zero runtime effect, verified by the diff paths alone.
- Confirmation: no push, no PR, no merge, no deploy, no database mutation in any environment, no feature-flag activation, no env-var or Vercel-project change.
