# SOP: Ship a feature

The standard task workflow (Constitution + the five-review gate from root CLAUDE.md).

1. **Orient** — read `CLAUDE.md` → `.ai/INDEX.md` → `.ai/CURRENT-STATE.md` → task-relevant files only.
2. **Verify** — confirm current behavior/constraints in code (search first; reuse before invention).
3. **Plan** — Goal · Files affected · Risks · Validation. For features, run the five reviews before implementation: `/plan-ceo-review` → `/plan-eng-review` → `/plan-design-review` (+`/design-review` visual QA) → `/compliance-review` → `/qa`. No feature ships until all five pass.
4. **Execute** — smallest coherent change; follow existing patterns (self-heal tables, docCrypto, rateLimit, token classes, `*Shared.ts`).
5. **Validate** — per `TESTING.md` (typecheck, guards, build; prod probes post-deploy).
6. **Update memory** — only affected canonical `.ai/` docs (always `CURRENT-STATE.md` if state changed; ADR if a decision was made).
7. **Report** — Changed · Validated · Remaining risks · Next recommended task.

Deploy per `RUNBOOKS/deploy.md` — confirm with the owner before pushing to `main`.

## Definition of done
Behavior implemented · existing functionality preserved · relevant tests pass · build passes when applicable · no secrets exposed · accessibility considered · responsive checked for UI · compliance-sensitive copy flagged or approved · `CURRENT-STATE.md` updated when materially affected · no duplicate doc source introduced · git diff reviewed · known limitations disclosed.
