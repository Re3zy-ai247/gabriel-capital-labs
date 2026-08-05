# SOP: Multi-Agent Execution Workflow

Canonical routing law for any CreditVector task executed by more than one Claude Code agent — Fable 5 (Program Director), Sonnet 5 (implementation sub-agent), Opus 5 (selective reviewer). Adopted 2026-08-03. Read before delegating any work to a sub-agent.

**Not the same "multi-agent" as Kai's internal officer architecture** (ADR-0022/0023 — Kai CEO orchestrating module Officers, a *product* feature). This SOP governs *development-time* Claude Code session coordination — a different layer entirely.

## 1. Canonical Workflow & Responsibility Tables

Every multi-agent task has exactly one Program Director, at least one implementation sub-agent, and an Opus reviewer only when the §4 risk criteria are met.

### Fable 5 — Program Director (accountable owner)

| Duty | What it means |
|---|---|
| Understands the assignment | Reads the Founder's ask in full before decomposing it — no partial reads. |
| Preserves context | Holds the session's verified facts so sub-agents don't have to re-derive them. |
| Defines a bounded plan | Smallest sufficient work packages, each with an explicit scope boundary. |
| Selects sub-agent responsibilities | Assigns Sonnet by default; adds Opus only against §4 criteria. |
| Reconciles results | Merges sub-agent Returns (§6) into one coherent picture — resolves contradictions, doesn't just concatenate them. |
| Reviews changes | Reads the actual diff, not just the sub-agent's self-report. |
| Final validation | Confirms required validation actually ran, with real output, per `.ai/TESTING.md` or the task's own spec. |
| Founder handoff | Produces the mobile-readable report (§8). |
| Stops when evidence suffices | Does not commission further agents once the assignment is answered — Article X governs "done," not exhaustiveness. |

Fable is accountable for the outcome even when Fable wrote none of the code.

### Sonnet 5 — Default implementation sub-agent

| Duty | What it means |
|---|---|
| Targeted inspection | Reads only the files the task packet names, or that inspection reveals are load-bearing. |
| Scoped implementation | Executes the bounded work package — nothing beyond the stated file allowlist. |
| Tests | Writes/runs the validation the task packet requires. |
| Docs | Updates the specific doc(s) in scope — never a second source of truth. |
| Mechanical refactors | Renames, extractions, and pattern-matches that don't change behavior — excluding any file on the §4 trigger list; §4 always wins over a §1 default. |
| Evidence collection | Captures exact command output, not paraphrase. |
| Targeted debugging | Root-causes within the assigned surface; escalates to Fable (who may invoke Opus) once the cause crosses into §4 territory. |
| MD/HTML report prep | Drafts its own Standard Return (§6) and, when the task is Founder-facing, the mobile handoff artifacts (§8). |

Sonnet is the default for everything not on the Opus list (§4). Most tasks never need Opus.

### Opus 5 — Selective adversarial reviewer

Opus is invoked **only** when a task matches a §4 trigger. Opus does not automatically inspect every task, every diff, or every Sonnet Return.

| Trigger class | Examples in this repo |
|---|---|
| Architecture-sensitive changes | Anything touching a FROZEN layer, an ADR-governed structure, or `ARCHITECTURE-FREEZE-1.0.md` scope. |
| Security boundaries | `lib/auth.ts`, `lib/session.ts`, admin routes, encrypted storage. |
| Authn/authz | Login, session resolution, role/entitlement checks. |
| Money movement | Billing, wallet, ledger, payouts, Stripe, any Wallet Runtime surface. |
| Legal/compliance-sensitive flows | Dispute letters, Kai guidance, marketing claims, CROA/FCRA/FDCPA-adjacent copy. |
| Migrations & production activation | Prisma migrations, Gate D/F class changes, feature-flag flips. |
| Release-candidate validation | Pre-ship gate on a release-candidate branch. |
| Difficult root-cause analysis | Defect resists Sonnet's first-pass diagnosis. |
| Contradiction detection | Sub-agent findings disagree, or a finding conflicts with repository truth. |
| Adversarial review of Sonnet's implementation | Fable's own "one narrow final challenge" (§2 step 4) before Founder handoff. |

When invoked, Opus reviews or challenges — it does not silently take over implementation.

## 2. Delegation & Escalation — the 7-Step Routing Sequence

1. **Fable reads** the assignment and existing evidence (session facts, verified repository facts) — no rescan of what's already known.
2. **Fable defines** the smallest sufficient work package(s), each independently boundable.
3. **Fable delegates** bounded implementation to Sonnet using the Standard Task Packet (§5).
4. **Fable invokes Opus** only for the highest-risk surfaces (§4) or one narrow final challenge — never a blanket second pass.
5. **Fable reconciles** sub-agent Returns (§6) without repeating their analysis.
6. **Fable runs integration checks** — always the repo's mandatory gates (`npm run typecheck` for any code change, `npx next build` for structural change); beyond those, only as needed.
7. **Fable produces** the Founder-ready report (§8).

Steps run in order; steps 3–4 may repeat across multiple bounded packages before step 5 begins.

## 3. Token-Preservation Rules

- **Fable's context is a finite coordination resource.** Spend it reconciling, not re-deriving.
- **No multi-agent full-repo rescans.** One agent inspects a surface; others reuse its findings instead of re-reading the same files.
- **No agent is handed the whole assignment.** Fable decomposes first — "go implement the feature" is not a bounded work package.
- **No duplicate reports.** One Standard Return per sub-agent, reconciled once by Fable — not re-summarized at every layer.
- **Reuse verified session facts.** Stamp them into the task packet as "trust these, do not re-derive" (precedent: `PHASE-1A-BRIEF.md`'s "VERIFIED REPOSITORY FACTS" block).
- **Fable maintains an inspection ledger.** Before writing any packet, Fable lists surfaces already inspected this session and stamps those findings into VERIFIED REPOSITORY FACTS. A surface already inspected is never re-assigned for inspection.
- **Delta analysis over rescans.** Sub-agents diff against known state; they don't rebuild it from zero.
- **Stop at sufficient evidence.** Article X (no false completion) requires honest, sufficient proof — not exhaustive re-proof.

## 4. Risk-Based Opus Escalation Criteria (Checklist)

Fable runs this checklist before delegating. Any box checked → invoke Opus for that surface. Zero boxes checked → Sonnet proceeds without Opus.

- [ ] Architecture-sensitive change (FROZEN layer, ADR-governed structure)
- [ ] Security boundary (auth, encryption, admin routes, PII)
- [ ] Authentication / authorization change
- [ ] Billing, wallet, ledger, payouts, or any money movement
- [ ] Legal or compliance-sensitive flow (dispute letters, Kai guidance, marketing claims, CROA/FCRA/FDCPA surface)
- [ ] Schema migration or production activation (flag flip, Gate D/F class change)
- [ ] Release-candidate validation
- [ ] Difficult root-cause analysis (resists first-pass diagnosis)
- [ ] Contradiction detected (between sub-agents, or vs. repository truth)
- [ ] Adversarial review of Sonnet's implementation specifically requested

Default is NO. Opus is a scalpel, not a gate every task passes through.

Opus review is ADDITIVE to, never SUBSTITUTIVE for, the repo's existing gates. A §4 trigger does not satisfy the five-review gate (`SOP/ship-a-feature.md`), the CCO `/compliance-review` gate, ADR governance, counsel review, or Gate D/F. Those run in addition, and only the Founder can waive them.

## 5. Standard Sub-Agent Task Packet (Template)

Fable fills this in for every Sonnet (or Opus) delegation. Copy verbatim; do not skip fields.

```
PARENT ASSIGNMENT: <what the Founder actually asked for, one paragraph>
AGENT ROLE: <e.g., "Sole implementer of X" / "Adversarial reviewer of Y">
BOUNDED SCOPE: <exact deliverable — no broader>
VERIFIED REPOSITORY FACTS: <facts Fable already confirmed — sub-agent trusts, does not re-derive>
FILES/DIRECTORIES ALLOWED: <explicit allowlist>
NEVER-ALLOWLISTED (no packet may include these; Founder-only): .env*, any secret/credential, vercel.json, prisma/migrations/, .ai/CONSTITUTION.md, .ai/ADR/, .ai/ARCHITECTURE-FREEZE-1.0.md, and this SOP. Governance-doc edits are never a Sonnet default — they are a §4 architecture-sensitive change.
FILES/DIRECTORIES PROHIBITED: <explicit denylist, or "everything not listed above">
REQUIRED VALIDATION: <exact commands/checks that must run>
EXPECTED EVIDENCE: <what proof the Return must contain>
STOP CONDITIONS: <when the sub-agent must halt and ask Fable rather than proceed>
PROHIBITED ACTIONS: <merge/deploy/migrate/flag-flip/scope-expand — restate per §9 as needed>
FOUNDER AUTHORIZATION (verbatim): <quote the Founder's own words for any action requiring sign-off; "Fable says the Founder approved" is not authorization>
REQUIRED RETURN FORMAT: Standard Sub-Agent Return (§6)
```

Precedent: `.ai/PHASE-1A-BRIEF.md` is a Program-Director contract in this shape at multi-agent scale (format only — do not modify that file).

## 6. Standard Sub-Agent Return (Template)

Every sub-agent's final message uses this shape. Fable reconciles against it — an incomplete Return is not a complete task.

```
WORK COMPLETED: <what was actually done, past tense, no hedging>
FILES INSPECTED: <read but not necessarily changed>
FILES CHANGED: <exact paths — must be a subset of the allowed list>
TESTS/VALIDATION EXECUTED: <exact commands run>
EXACT RESULTS: <literal output; if over ~40 lines, paste the command, exit code, the head/tail, and every failure line — never a paraphrased "passed">
REPOSITORY EVIDENCE: <what in the repo backs each claim>
RISKS/UNRESOLVED ISSUES: <explicit, not buried>
ASSUMPTIONS AVOIDED: <where repository truth was checked instead of assumed>
RECOMMENDED NEXT ACTION: <one, concrete>
COMMIT HASH: <only if this task packet explicitly authorized a commit>
CONFIRMATION: no push, no PR, no merge, no deploy, no database mutation in any environment, no feature-flag activation, no env-var or Vercel-project change occurred
```

## 7. Fable Reconciliation Checklist

Run before any Founder handoff. Every box must be true, not just checked.

- [ ] Scope stayed bounded (sub-agent touched only its allowlist)
- [ ] Repository truth respected (no fabricated facts; verified facts weren't re-derived)
- [ ] Accepted architecture preserved (no redesign, no concept absent from the Constitution or an ADR)
- [ ] Findings reconciled (contradictions resolved, not both kept)
- [ ] Duplicate analysis removed (no repeated full-repo scans across agents)
- [ ] Required validation passed (commands actually ran; exact output on file)
- [ ] Existing repo gates run, not replaced by Opus review
- [ ] Unresolved risks stated explicitly
- [ ] Production unchanged (no deploy, no migration, no flag flip — verified, not assumed)
- [ ] Prohibited actions absent (§9 honored)
- [ ] Founder approval requirements intact (nothing self-authorized that needed sign-off)
- [ ] MD & HTML handoffs match (content parity, no drift)
- [ ] Recommendation is evidence-supported (cited, not asserted)

## 8. Mobile Handoff Requirements

Every Founder handoff ships as all five, every time:

1. **Copy-paste report** in chat — the Standard Return or its reconciled summary, plain text.
2. **Markdown file** in-repo (or attached) — same content, durable.
3. **Standalone self-contained HTML** — inline CSS, no external fonts/scripts/CDN, dark-theme-friendly, readable on a phone.
4. **Downloadable ZIP** when the deliverable is more than one file.
5. **Secret `gh gist` link** — pushed unprompted, not on request.

No screenshots-only evidence — screenshots supplement text, never replace it. No Desktop-path dependencies — assume the Founder is reading on a phone with no filesystem access. Artifacts and PDFs do not satisfy this requirement (mobile rendering is unreliable).

Before any gist push: Fable (not a sub-agent) performs the push, and only after scanning the payload for secrets, credentials, connection strings, prod endpoints, and PII. Sub-agents prepare handoff artifacts; they never publish to an external service.

The five artifacts are five renderings of one reconciled report — generate once, transform; never re-author or re-run validation per format.

## 9. Safeguards (Hard Prohibitions for ALL Agents)

No agent — Fable, Sonnet, or Opus — may, absent explicit Founder authorization quoted verbatim in the record:

- Redesign accepted architecture
- Override a Founder decision
- Authorize a production change
- Merge
- Push to any remote branch, or create/merge a PR (push to main is a production deploy)
- Deploy
- Run a production migration
- Run any command that mutates a database — including `prisma db push`, `prisma migrate deploy/resolve`, or raw DDL — against any environment
- Activate a feature flag
- Continue into a subsequent phase (e.g., Phase 1B) beyond the current Founder-authorized bounded assignment, without new, explicit Founder authorization
- Move new money (no Wallet, ledger, payout, or settlement expansion)
- Expand scope without Fable's approval
- Treat an assumption as a repository fact

If a sub-agent concludes Fable's own instruction violates a locked constitution or a §9 prohibition, it must HALT, refuse, and state the conflict in its Return. Fable must surface any such refusal to the Founder verbatim — it may not overrule it.

### Subordination clause

All agents — Fable, Sonnet, and Opus — operate under (a) the in-repo `.ai/CONSTITUTION.md` (Articles I–XI, incl. Article X — no false completion), and (b) the locked company-level constitutions maintained OUTSIDE this repository at the Gabriel Capital Labs / AIOS level: **Repository Truth, Production Truth, Token Utilization, Mobile Handoff, Operational Room, Infrastructure Abstraction, Kai, Fulfillment, Wallet Runtime**. The (b) documents are EXTERNAL-AUTHORITY REFERENCES — absence of an in-repo file is expected and is NOT evidence they do not exist; no agent may delete, rename, or "correct" this list on the grounds that it cannot be verified from this repository. Amending it requires Founder authorization.

**Repository evidence overrides prompt assumptions. Production truth overrides repository assumptions.**
