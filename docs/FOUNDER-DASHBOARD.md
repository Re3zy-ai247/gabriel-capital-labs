# GIOS — Gabriel Intelligence Operating System — Founder Dashboard

> Single source of truth for the platform. **GIOS** = the operating system every future Gabriel
> product runs on (same Kai Kernel; broader mission). **CreditVector is Plugin #1 — the proof,
> not the destination.** Updated after every migration. **Honesty rule:** metrics not yet
> instrumented are marked *"Not Yet Instrumented"* — no number is ever fabricated.
>
> *Layer discipline (ADR-0022/0024): Layer 2 platform services — Agent Runtime, SDK, global
> Memory Graph, Marketplace UI, Observability — are built AS the migration reaches them (or when
> a plugin needs them), never speculatively ("no speculative abstraction").*

---

## PLATFORM STATUS
| | |
|---|---|
| **GIOS progress** | ~36% (Kernel done + Marketplace metadata; Credit plugin — 5 capabilities; **first PLATFORM capability** `notify.plan` — a second module on the kernel with zero kernel edits) |
| **Current sprint** | Sprint 2 — CreditVector becomes Plugin #1 |
| **Current increment** | Increment 6 — Notification DECISION `notify.plan` (#10); effect **designed-not-built** (ADR-0027) |
| **Current phase** | **GIOS Kernel Maturity** — governance artifacts + #11 pre-implementation architecture review |
| **Current commit** | `afa0a98` (Inc 1–6 **merged + pushed to origin/main**; live in prod) |
| **Build** | ✅ `next build` clean |
| **Tests** | ✅ green — kernel: 33 · credit plugin: 19 · **platform notify: 23** (byte-identical/idempotency/CAN-SPAM/hash-only/PEP) |
| **Platform infra added** | self-describing capabilities (`Kernel.manifest()` — now **multi-plugin**) · **first platform module** (`notify`) proving another module registers with zero kernel change · **`/architecture/` governance corpus** (Constitution, Capability Map, Promotion rules, Review Pipeline) |
| **Deployment** | Inc 1–6 **live on origin/main `afa0a98`** · no live route flipped · **MAIL_LIVE OFF** (stays off until durable IdempotencyStore + retries + replay done) |

---

## GIOS KERNEL MATURITY — *the operating system itself* (not CreditVector)
> Maturity is a **defined rubric**, never a vibe metric. Each axis is a real count; the composite is
> a stated formula, not a measured performance number.

| Axis | State | Basis |
|---|---|---|
| **Kernel mechanism** | ✅ **13/13 primitives built + guarded** | Identity, Registry, Namespace, Resolver, PEP, Dispatch, Permissions, Clock, Audit, Event Bus, Memory, Manifest, Idempotency ([Capability Map](../architecture/GIOS-KERNEL-CAPABILITY-MAP.md)) |
| **Durable adapters** | ⏳ **0/4 durable** (all in-memory) | Audit · Event · Memory · Idempotency are reference in-mem ports; durable Postgres = #11/#12 |
| **Effect-safety** | ⚠️ **not effect-ready** | D-07 (dispatch mark-on-failure/synthetic replay) + D-08 (payload-blind PEP) open; no effect crosses dispatch yet |
| **ABI** | 🔒 **unfrozen by design** | frozen at Sprint 3 after CreditVector exercises it (ADR-0024) |
| **Composite kernel maturity** | **Mechanism complete · Durability + Effect-safety not started (gated to #11)** | = (mechanism 100%) + (durability 0%) + (effect-safety 0%); *rubric, not performance* |

| | |
|---|---|
| **Capability maturity** | KERNEL 13 · REGISTERED 6 (5 credit + 1 platform) · DESIGNED 1 (notification effect) · CANDIDATE ~12 app-local · CONCEPT ~10 roadmap |
| **Registered capabilities** | `credit.letter.draft` · `credit.response.analyze` · `credit.obsolescence.window` · `credit.tradeline.insight` · `credit.campaign.compose` · `notify.plan.compose` |
| **Capabilities awaiting promotion** | **`lib/compliance`** (~10 consumers — strongest) · `lib/aiMeter` (~9) · `lib/knowledge` (~8) · `lib/intelligence` (~16, decompose first) · `lib/forecast` (~5). `scoring`/`recommend`/`classify` → credit **plugin**, not kernel. `decisionRegistry` (1) fails the twice-bar. |
| **Kernel health** | mechanism-only held (no app import in `lib/os/kernel/`) · 75 guards green · typecheck + build clean · product-agnostic (2nd module registered w/ zero kernel edits) |
| **Security posture** | **tested invariants:** tenant isolation · default-deny PEP · append-only audit · idempotency mechanism · permissible-purpose · hash-only receipts. **known gaps:** effect-safety (D-07/D-08) · in-mem persistence (no cross-invocation dedupe) |
| **Architecture debt** | D-07, D-08 (kernel effect-safety) · D-03 durable audit · D-04 durable memory · A-01 ABI unfrozen (by design) |
| **Open architectural risks** | R-05, R-06 (kernel defects, harmless until an effect ships) · R-02 (no durable audit/version) · R-03 (permissible-purpose is placeholder vs counsel model) · R-04 (no perf/coverage instrumentation) |
| **ADR count** | **28** (ADR-0000 … ADR-0027); `/architecture/` corpus: 4 canonical docs |
| **Production readiness (kernel path)** | additive · un-flipped · behavior-neutral · deployed (`afa0a98`). No user-facing change shipped. |
| **Future roadmap** | #11 Durable Audit → #12 Kai Memory Graph → **Sprint 3 ABI freeze** → (post-freeze, evidence-gated) Agent/AI Runtime · Prediction · Learning · Marketplace · SDK · Global Memory |
| **Product-agnostic proof** | onboarding GTG Quant / Gabriel AI OS = register a `KaiModule` + entitlement grant; **zero kernel change** (as `notify` demonstrated) |

---

## PLATFORM ROADMAP
```
Kai Platform
██████████  Kai Kernel                 done (mechanism-only, tested) + Marketplace metadata + manifest()
█████░░░░░  Credit Plugin              in migration — 5 capabilities wrapped (letter.draft, response.analyze, obsolescence.window, tradeline.insight, campaign.compose)
██████░░░░  Platform: notify.plan      GIOS-generic notification DECISION (Layer 2) — first non-credit module; zero kernel edits
██████████  Response Intelligence      wrapped + kernel-routed + byte-equivalent (route not flipped)
██████████  Investigation / §605       wrapped + kernel-routed + byte-identical (route not flipped)
██████████  Document / §605 fall-off   wrapped + kernel-routed + byte-identical (route not flipped)
██████████  Workflow / campaign        wrapped + kernel-routed + byte-identical (route not flipped)
██████░░░░  Notification (#10)         DECISION shipped (platform notify.plan, byte-identical); EFFECT designed-not-built (ADR-0027)
░░░░░░░░░░  Durable Audit (Postgres)   pending (adapter — supplies the durable IdempotencyStore the notification EFFECT needs)
░░░░░░░░░░  Kai Memory Graph           pending (adapter — in-memory reference today)
░░░░░░░░░░  Intelligence Layer         pending (ADR-0023, after ABI freeze)
```

---

## MIGRATION STATUS
| Subsystem | Wrapped | Kernel-routed | Live route | Flag | Equivalence | Regression | Kernel guards | Latency | Memory | Rollback | Risk | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Letter Engine** (`credit.letter.draft`) | ✅ | ✅ | Direct (not flipped) | ready | **byte-identical** ✅ | suite green | 12 | not instrumented | not instrumented | flag/branch | LOW | routed, proven |
| **Response Intelligence** (`credit.response.analyze`) | ✅ | ✅ | Direct (not flipped) | ready | delegation-equal ✅ (AI-gated) | suite green | 15 | not instrumented | not instrumented | flag/branch | LOW | routed, proven |
| **Investigation / §605** (`credit.obsolescence.window`) | ✅ | ✅ | Direct (not flipped) | ready | **byte-identical** ✅ | suite green | 17 | not instrumented | not instrumented | flag/branch | LOW | routed, proven |
| **Document / §605 fall-off** (`credit.tradeline.insight`) | ✅ | ✅ | Direct (not flipped) | ready | **byte-identical** ✅ | suite green | 19 | not instrumented | not instrumented | flag/branch | LOW | routed, proven |
| **Workflow / campaign** (`credit.campaign.compose`) | ✅ | ✅ | Direct (not flipped) | ready | **byte-identical** ✅ | suite green | 19 | not instrumented | not instrumented | flag/branch | LOW | routed, proven |
| **Notification DECISION** (`notify.plan.compose`, *platform*) | ✅ (new pure decision) | ✅ | n/a — decision only | on | **byte-identical** ✅ (frozen snapshot) | notify 23 green | 23 | not instrumented | not instrumented | flag/branch | LOW | shipped (decision) |
| **Notification EFFECT** (email/push send) | — | — | app-local (unchanged) | **OFF** | n/a (effect) | — | — | — | — | app senders | see R-05/R-06 | **designed-not-built** (ADR-0027) |
| Durable Audit · Kai Memory Graph | ⏳ (in-mem ref) | — | — | — | — | — | — | — | — | — | MED | pending |

*Live routes are intentionally NOT flipped yet — the kernel path is built + proven equivalent first; each route flips behind a flag with the old path as fallback (zero-risk). The notification **effect** is not merely un-flipped but **un-built** — it awaits a durable IdempotencyStore (#11) + a real second consumer (ADR-0027).*

---

## ENGINEERING HEALTH
| | |
|---|---|
| Typecheck | ✅ clean |
| Build | ✅ clean |
| Guard suite | ✅ kernel 33 + credit plugin 19 + platform notify 23 checks, all green |
| Security invariants (tested) | tenant isolation · default-deny PEP · append-only audit · idempotency · permissible-purpose |
| Test coverage % | **not instrumented** (tracked debt D-01) |
| Performance / memory | **not instrumented** (tracked debt D-02) |
| Lint | not run this increment |
| Regression count | 0 |
| Production readiness (kernel path) | proven-equivalent, unmerged |

---

## PERFORMANCE DASHBOARD
**Not yet instrumented.** No latency/CPU/memory/bundle/query numbers are recorded because we have not built the measurement harness — and we do not fabricate them. Instrumenting kernel-dispatch / capability-resolution / PEP / audit cost is tracked debt **D-02** and should land before the first live-route flip (so old-vs-kernel latency is measured, not guessed). Kernel primitives are pure in-memory computations over a single preloaded context (designed to be sub-millisecond), but that is a *design intent*, not a *measurement*.

---

## RISK REGISTER
| ID | Description | Impact | Likelihood | Mitigation | Owner | Sprint | Status |
|---|---|---|---|---|---|---|---|
| R-01 | Live-route flip could regress behavior | High | Low | equivalence proof + flag + old-path fallback per capability | Eng | S2 | mitigated (not yet flipped) |
| R-02 | Durable audit/version not yet backed (in-mem) → no cross-invocation ordering | Med | — | Subsystem #11 supplies DB-sequence + Postgres audit | Eng | S2 | open (planned) |
| R-03 | Permissible-purpose is a placeholder mechanism, not the counsel-designed legal model | High (legal) | Low (FCRA-scoped) | graph stays FCRA-scoped; counsel designs the model before multi-regime | Founder+CCO | S3+ | open |
| R-04 | No perf/coverage instrumentation | Med | — | build the harness before route flips | Eng | S2/S3 | open |
| R-05 | Kernel `dispatch` not effect-safe: marks idempotency key on failure + replays synthetic `ok:true` → a side effect could be silently non-delivered yet reported success | High (only IF an effect ships) | — | fix D-07 (three-state ledger, mark-on-success-only, replay-returns-original) BEFORE any effect crosses dispatch; no effect rides dispatch today | Eng | S3/#11 | open (harmless now) |
| R-06 | PEP is payload-blind — recipient (`to`) authorized by nobody; a cross-tenant `to` would pass | High (only IF an effect ships) | — | fix D-08 (recipient-ownership guard + tenant-scoped idempotency namespace) BEFORE any effect crosses dispatch | Eng | S3/#11 | open (harmless now) |

---

## TECHNICAL DEBT REGISTER
| ID | Description | Reason deferred | Severity | Owner | Expected sprint | Dependencies |
|---|---|---|---|---|---|---|
| D-01 | Test coverage % not instrumented | no coverage tool wired | Low | Eng | S3 | — |
| D-02 | Perf/memory harness not built | R8 — measure before flip, not speculatively | Med | Eng | S2/S3 | — |
| D-03 | Durable Postgres audit + monotonic version (DB sequence) | subsystem #11 (priority order) | Med | Eng | S2 | self-heal table |
| D-04 | Kai Memory Graph durable adapter (over `lib/knowledge`) | subsystem #12 | Med | Eng | S2 | — |
| D-05 | Free-letter monthly limit should become a PEP policy provider | keep behavior identical first | Low | Eng | S2 | letter route flip |
| D-06 | Agency "acting as client" tenant mapping | wire when agency flows migrate | Low | Eng | S2 | — |
| D-07 | `dispatch` idempotency is effect-unsafe (mark-on-failure + synthetic-`ok:true` replay); in-memory store = no cross-invocation dedupe | surfaced by #10 review; no effect crosses dispatch yet (harmless) | High (blocks effect) | Eng | #11/S3 | durable Postgres 3-state IdempotencyStore |
| D-08 | PEP payload-blind → no recipient-ownership guard on the effect path | surfaced by #10 review; decision-only today | High (blocks effect) | Eng | #11/S3 | — |

---

## SPRINT SCORECARD — Sprint 2 (in progress)
| Dimension | Grade | Note |
|---|---|---|
| Architecture | A | mechanism-only kernel held; one clean ABI refinement (async) driven by implementation |
| Security | A | tenant isolation + default-deny + append-only audit are *tested* invariants |
| Performance | — | not instrumented (D-02) — grade withheld honestly |
| Maintainability | A | wrap-not-rewrite; existing engines untouched |
| Regression risk | A | byte-identical proof; routes not flipped |
| Code quality | A | pure, typed, small kernel |
| Technical debt | B | 6 tracked items, all intentional/deferred (durable adapters, instrumentation) |
| Documentation | A | Engineering Journal + this Dashboard + Founder Journal maintained |
| **Overall** | **A / ~9.2** | grade excludes performance (uninstrumented) — restored once measured |
