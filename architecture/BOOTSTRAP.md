# BOOTSTRAP — GIOS in 5 minutes

Any AI: read this, then [FOUNDER-CONTEXT.md](FOUNDER-CONTEXT.md) for depth. Nothing else needed to
start. *Synced 2026-07-15 · origin/main `afa0a98`.*

## What this is
**GIOS** = a deterministic OS for intelligence. Apps *inherit* intelligence via kernel
capabilities; they don't rebuild it. **CreditVector = Application #1** (the proof). The kernel is
**product-agnostic**: `lib/os/kernel/` imports no app code. New app = register a `KaiModule` +
entitlement grant, zero kernel change.

## Architecture (3 runtimes)
1. **Intelligence** (observe/remember/reason/plan/predict/simulate) — pure, replayable.
2. **Governance** (policy/permission/audit/decision) — pure; **nothing executes**.
3. **Execution** (email/DB/mail/APIs) — the only side effects; each needs permission·audit·
   receipt·idempotency·rollback·replaceable-provider. **Intelligence never executes directly.**

## Kernel (`lib/os/kernel/`, mechanism-only, 33 guards)
13 pure primitives, injected ports, no `Date.now`/DB in core: Identity · Registry · Namespace
(`domain.entity.action[@major]`) · Resolver · PEP (default-deny) · Dispatch · Entitlements ·
Clock/Version · Audit · Event Bus · Memory · Manifest · Idempotency. Ports are **in-memory today**;
durable adapters are #11/#12. Map: [GIOS-KERNEL-CAPABILITY-MAP.md](GIOS-KERNEL-CAPABILITY-MAP.md).

## Capabilities (registered; byte-identical proven; NO route flipped)
`credit.letter.draft` · `credit.response.analyze` (premium) · `credit.obsolescence.window` ·
`credit.tradeline.insight` · `credit.campaign.compose` · **`notify.plan.compose`** (platform;
decision-only, sends nothing). Host wiring: `lib/os/host/` (`appKernel` registers modules).

## Rules (never violate)
Evidence earns architecture · no speculative abstractions · **wrap never rewrite** · additive +
reversible + byte-identical + deterministic · kernel stays deterministic · execution permissioned ·
effects app-local until earned (≥2 real in-repo consumers + durable infra) · architecture reviewed
**before** code · no fabricated metrics · **MAIL_LIVE OFF** · preview-first, founder approves merges.
Full: [GIOS-CONSTITUTION.md](GIOS-CONSTITUTION.md) · promotion: [CAPABILITY-PROMOTION.md](CAPABILITY-PROMOTION.md).

## Roadmap
#11 Durable Audit → #12 Memory Graph → **ABI freeze (Sprint 3)** → (post-freeze, evidence-gated)
Agent/AI Runtime · Prediction · Learning · Marketplace · SDK.

## Current priorities
1. **Set the D-02 p95 budget + validate `KERNEL_DURABLE` against a prod DB** (#11 is implemented +
flag-off; ADR-0028 §5). 2. Flip the 6 proven routes (behind flags). 3. Promote `lib/compliance`
(≈10 consumers). 4. #12 Memory Graph → ABI freeze. Ranked plan: FOUNDER-CONTEXT §11.

## Open reviews
- ADR-0027 (notification decision-vs-effect) — **ACCEPTED** (`notify.plan` shipped).
- ADR-0028 (Durable Audit) — **ACCEPTED**; **#11 implemented, flag-off**.

## Known risks
**D-07** (dispatch effect-unsafe) — **FIXED** (claim/settle, #11, guarded). **D-08** (PEP
payload-blind → effect recipient unauthorized) — open; ships with the effect. D-02 — **done**
(harness); set the p95 budget. `KERNEL_DURABLE` durable path pending prod-DB validation. R-03 (legal
purpose model placeholder). ABI unfrozen by design.

## Branch strategy
One branch per increment (`sprint2-incN-*`) or concern (`arch/*`). Commit preview-first → founder
approves → fast-forward merge into `main` → **push = prod deploy (confirm first)**. No route flips
without separate approval. ⚠️ Accelerate: `prisma db push` silently no-ops → new tables self-heal
at runtime (`CREATE TABLE IF NOT EXISTS`). Validate: `typecheck` + `next build` + `tsx scripts/*.test.ts`.

## Where truth lives
Current state/roadmap/risks → **FOUNDER-CONTEXT.md**. Kernel → ADR-0024 + Capability Map. Why-each-
migration → `.ai/KAI-ENGINEERING-JOURNAL.md`. Metrics → `docs/FOUNDER-DASHBOARD.md`. App
repo/deploy → `CLAUDE.md`. **One concept, one home** (FOUNDER-CONTEXT §12).
