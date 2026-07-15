# Engineering Review Pipeline — the mandatory lifecycle for GIOS kernel work

Status: **CANONICAL & MANDATORY.** Governed by [GIOS-CONSTITUTION.md](GIOS-CONSTITUTION.md).
No stage is optional for a change that touches **kernel behavior** (a new kernel primitive/port,
a change to `dispatch`/PEP/registry/clock, or a new **capability that enters the kernel**).

> This pipeline exists to make one thing impossible: shipping architecture before it is earned and
> proven. Architecture review happens **before** code — always.

## The lifecycle
```
Recon → Architecture Review → Adversarial Review → ADR → Implementation
      → Guard Suite → Integration → Documentation → Institutional Memory → Release
```

| # | Stage | Produces | Gate (nothing advances until…) |
|---|---|---|---|
| 1 | **Recon** | An evidence-grounded map of the current state — every claim cited to `file:line`. | The real code is understood; no guessing. Consumers counted. |
| 2 | **Architecture Review** | Problem statement + proposed shape + current-state/gap/failure/recovery/security/perf analysis + promotion-gate check. | The proposal is concrete and testable, and answers Why / Why-now / Why-here / Why-not-elsewhere. |
| 3 | **Adversarial Review** | N independent refute-by-default lenses + a synthesis verdict (proceed / change / redesign / defer). | The proposal survives independent attack, or is reshaped/deferred by the evidence. |
| 4 | **ADR** | A merged Architecture Decision Record: decision, rejected alternatives, promotion criteria, consequences, what is *not* built. | Founder-approved. This is the authorization to write code. |
| 5 | **Implementation** | The minimal additive change; wrap-never-rewrite; both paths alive; no route flipped. | Matches the ADR exactly. No scope creep beyond it. |
| 6 | **Guard Suite** | Equivalence tests (byte-identical for pure capabilities) + kernel guards + plugin guards. | All green. Security invariants (default-deny, tenant isolation, idempotency) asserted. |
| 7 | **Integration** | Typecheck + `next build` clean; manifest/registration/entitlements wired. | Build green; capability resolves + PEP-gates end-to-end. |
| 8 | **Documentation** | Engineering Journal entry + Founder Dashboard update + Capability Map update. | The OS's self-description reflects the change. |
| 9 | **Institutional Memory** | ADR cross-links + cross-session memory; latent risks recorded in the register. | Nothing learned is lost. |
| 10 | **Release** | Merge → (approved) push → deploy. Live route stays un-flipped unless separately approved. | Founder approves merge/push. Behavior-neutral unless a flip is explicitly authorized. |

## Two tracks (scale the rigor to the risk)
- **Kernel-behavior track (full pipeline, stages 1–10).** New kernel primitive/port, a change to
  the dispatch/PEP/registry mechanism, or promoting a capability *into* the kernel. Requires the
  adversarial review (stage 3) + an ADR (stage 4) **before** code. *(Reference: ADR-0027 / #10.)*
- **Additive-plugin track (stages 1, 5–10).** Wrapping an existing engine as a plugin capability
  with **no** change to kernel behavior (e.g. migrations #5–#9). Still mandatory: recon, equivalence
  guard suite, typecheck/build, journal + dashboard, institutional memory, preview-before-merge. A
  full adversarial review is **not** required unless the migration turns out to touch kernel
  behavior — at which point it escalates to the kernel track (as #10 did the moment it hit the
  effect boundary).

## Non-negotiables (from `CLAUDE.md` + the constitution)
- **Preview-first.** Founder approval before merge. No live route flips without separate approval.
- **MAIL_LIVE stays OFF** and no user-facing behavior changes until explicitly authorized.
- **No fabricated metrics.** If instrumentation doesn't exist, the artifact says "Not Yet
  Instrumented" — never a guessed number.
- **Compliance gate.** Any user-facing credit-content path clears the CCO gate (`/compliance-review`)
  before it is enabled (ADR-0027 §5.5).
- **Repository is authority.** When chat and repo disagree, the repo wins; verify before asserting.
