# Capability Promotion — the rules for entering the GIOS kernel

Status: **CANONICAL.** Formalizes the promotion discipline already emerging in GIOS (ADR-0027 is
the first case decided under it). Governed by [GIOS-CONSTITUTION.md](GIOS-CONSTITUTION.md).

> Default: a capability lives **inside the application** that needs it. Promotion into GIOS is the
> exception, and it must be **earned by evidence** — never granted because it "feels platform-y."
> The burden of proof is on the abstraction, not on keeping it local.

## The promotion gate — ALL nine must hold
A capability (or a provider port) may enter the kernel only if:

1. **≥2 real, in-repo consumers.** Two *applications in this repository* (or two independent
   surfaces) actually call it. A consumer in a **different repository** (e.g. GTG Quant) is a
   *prospective* consumer, not a real one — it does **not** satisfy this bar. (ADR-0027 §3.1.)
2. **Security boundaries understood.** Its tenant-scope, permission set, permissible purposes, and
   (for effects) recipient/authorization model are specified — not "TBD".
3. **ADR approved.** A merged ADR records why it belongs in the kernel and what it does *not* own.
4. **Deterministic where possible.** Pure decisions are deterministic + replayable; only genuine
   effects are non-deterministic, and they are isolated behind a provider port.
5. **Testable.** A guard suite proves equivalence (byte-identical for pure capabilities) and the
   security invariants (default-deny, tenant isolation, idempotency).
6. **Replaceable.** Any concrete vendor sits behind an injected provider port; the kernel binds
   the interface, never the implementation.
7. **Backward compatible.** It fits the ABI (or, pre-freeze, refines it cleanly and documented);
   post-freeze it versions via `@major` and never silently breaks a consumer.
8. **Not speculative.** If it can be removed without affecting correctness *today*, it is premature.
9. **Proven through production usage.** The behavior it wraps is already running in production, so
   promotion changes routing, not behavior.

**If any of the nine fails → the capability stays application-local.** Re-evaluate when the missing
evidence appears (a second consumer ships, the durable infra lands, the security model is designed).

## The promotion ladder
```
application-local            wrapped + kernel-routed              kernel capability
(exists, 1 consumer)   →     (delegates to the engine,       →    (registered, resolved, PEP-gated,
 no kernel surface           byte-identical proven,               audited; part of the manifest;
                             route NOT flipped)                   product-agnostic)
```
A capability climbs the ladder one rung at a time, and never skips the equivalence proof. Reversal
(demotion) is always available: because the old path stays alive until a flag flip, any rung can be
walked back with zero behavior change.

## Decision vs. effect — they promote separately (ADR-0027)
A capability that **decides** (Layer 1/2 — pure, replayable) and one that **acts** (Layer 3 — a side
effect) are *different capabilities with different bars*. The decision can clear the gate long before
the effect does. **Effects carry two extra requirements** beyond the nine:
- **E1 — durable guarantee infrastructure exists.** An effect may not advertise a guarantee
  (exactly-once, ordered, replayable) whose backing infrastructure is not built and tested. An
  in-memory guarantee on serverless is *no* guarantee. (ADR-0027 §3.2.)
- **E2 — recipient/authorization model in the mechanism.** The PEP must authorize *what* the effect
  acts on (recipient/target), not only *whether* the actor may call it. (ADR-0027 §4, defect D-08.)

## Worked example — Notification (ADR-0027)
| | Consumers (in-repo) | Determinism | Infra ready | Verdict |
|---|---|---|---|---|
| **Decision** (`notify.plan.compose`) | ✅ 11 call sites | ✅ pure | n/a | **PROMOTED** to kernel |
| **Effect** (email/push send) | ❌ 1 prospective (GTG, other repo) | ❌ side effect | ❌ no durable idempotency store | **STAYS local** (designed-not-built) |

## Current promotion candidates (evidence as of 2026-07-15 — informational, not yet approved)
| Capability | In-repo consumers | Layer | Read |
|---|---|---|---|
| **`lib/compliance` (CROA scrubber)** | ~10 (letters, kai, brief, identity) | Governance (2) | **Strongest candidate.** Deterministic content-policy with many real consumers. Would promote as a platform `policy.content.screen` decision + a mandatory PDP. Needs an ADR + guard suite. |
| `lib/knowledge` (knowledge graph) | ~8 | Intelligence (1) | Candidate, but needs a clean read/query contract + tenant-scope design before an ADR. |
| `lib/intelligence` | ~16 | Intelligence (1) | Large; likely decomposes into several capabilities — map each before promoting any. |
| `lib/aiMeter` (AI usage metering) | ~9 | Governance (2) | Candidate — a cross-cutting governance concern (budget/limit). Deterministic accounting; needs a port for the durable counter. |
| `lib/forecast` | ~5 | Intelligence (1) | Candidate for the future Prediction runtime; defer until that layer is earned. |
| `lib/scoring`, `lib/recommend`, `lib/classify` | ~4 each | credit domain | **NOT platform** — credit-specific. Belong in the **credit plugin**, not the kernel. |
| `lib/execution`, `lib/kai` | ~2 | mixed | Candidates only after the AI/Execution runtimes are earned (post ABI-freeze). |
| `lib/decisionRegistry` | 1 | — | **Fails the twice-bar.** Stays local. |

*This table is regenerated from real importer counts; it records candidacy, never a decision. A
candidate is promoted only through the full pipeline + an ADR.*
