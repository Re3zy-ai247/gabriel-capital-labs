# FOUNDER-CONTEXT — GIOS canonical current truth

**This is the single source of current truth for GIOS.** Read this instead of the sprawling
corpus. Current state only — no history, no storytelling. For the 5-minute version read
[BOOTSTRAP.md](BOOTSTRAP.md). Concepts live in exactly one place — see §12 Canonical Source Map.
*Last synced: 2026-07-15 · origin/main `afa0a98`.*

---

## 1. What GIOS is
GIOS (Gabriel Intelligence Operating System) is a **deterministic operating system for
intelligence**. Applications *inherit* intelligence; they don't re-implement it. **CreditVector is
Application #1** — the proof, not the destination. **The dependency arrow points one way:
`lib/os/kernel/` imports no application module.** Onboarding a new app = register a `KaiModule` +
its entitlement grant, **zero kernel change** (the `notify` module proved this).

## 2. Repo / deploy / branch strategy
- **Repo:** `~/Documents/gabriel-capital-labs-to-upload`, remote `origin` (SSH, `Re3zy-ai247`).
  Prod: **https://www.creditvector.app** (Vercel auto-deploys `main`).
- **Branch strategy:** one branch per increment (`sprint2-incN-*`) or concern (`arch/*`); commit
  preview-first; **founder approves before merge**; merge = fast-forward into `main`; **push =
  prod deploy** (confirm before pushing). No live route flips without separate approval.
- **⚠️ Accelerate gotcha:** DB is Prisma over **Accelerate**; `prisma db push` **silently no-ops**
  → new tables/columns MUST self-heal at runtime (`CREATE TABLE IF NOT EXISTS` in an `ensureXTable`
  gate; see `lib/push.ts`, `lib/rateLimit.ts`, `lib/billing.ts`). Detail: `CLAUDE.md` + ADR-0001.
- **Validation:** `npm run typecheck` · `npx next build` · `npx tsx scripts/<g>.test.ts`. No local
  DB/AI keys — validate statically.
- **MAIL_LIVE = OFF** and stays off until the durable IdempotencyStore + retries + replay exist.

## 3. The kernel (Layer 0 — `lib/os/kernel/`, mechanism-only, 33 guards)
Pure library, injected ports (hexagonal), no `Date.now`/DB in core. 13 primitives, all built +
guarded. Detail: [GIOS-KERNEL-CAPABILITY-MAP.md](GIOS-KERNEL-CAPABILITY-MAP.md) + ADR-0024.

| Primitive | One-line | File |
|---|---|---|
| Identity | `{id,tenantId,trust}`; tenantId scopes everything (#1 invariant) | `types.ts:11` |
| Registry/Loader | one domain = one module; fail-closed on collision | `registry.ts` |
| Namespace | `domain.entity.action[@major]` grammar | `namespace.ts` |
| Resolver | "what CAN this actor do?" (pure, preloaded) | `resolve.ts` |
| PEP (Security) | "may it *now*?" default-deny; **payload-blind (D-08)** | `pep.ts` |
| Dispatch | authorize→idempotency→execute→audit+emit; **effect-unsafe (D-07)** | `kernel.ts:80` |
| Permissions/Entitlements | plan→capability map, single-load | `types.ts:98` |
| Clock/Version Authority | monotonic version + logical time; **in-mem only** | `clock.ts` |
| Audit | append-only port; **in-mem only** | `types.ts:107` |
| Event Bus | at-least-once append log; **in-mem only** | `types.ts:121` |
| Memory Interface | PEP-gated, tenant-scoped port; **in-mem only** | `types.ts:132` |
| Manifest/Marketplace | self-describing capability catalog (multi-plugin) | `kernel.ts:41` |
| Idempotency store | dedupe; **in-mem Set → no serverless dedupe (D-07)** | `kernel.ts:106` |

## 4. Registered capabilities (proven byte-identical; NO live route flipped)
| Key | Wraps | Plugin | Layer | Notes |
|---|---|---|---|---|
| `credit.letter.draft` | `lib/letter` | credit | Intelligence | free |
| `credit.response.analyze` | `lib/round2` | credit | Intelligence | async/generative, **premium** |
| `credit.obsolescence.window` | `lib/obsolescence` | credit | Intelligence | free |
| `credit.tradeline.insight` | `lib/tradelineInsights` | credit | Intelligence | free |
| `credit.campaign.compose` | `lib/campaign` | credit | Intelligence | first workflow |
| `notify.plan.compose` | (new pure decision) | **notify (platform)** | Governance | 1st platform cap; token-free idem key, CAN-SPAM policy, hash-only digests; **sends nothing** |

Guards: kernel 33 · credit 19 · notify 23 (all byte-identical/equivalence/PEP green).

## 5. The three-runtime model (ADR-0023) + the effect rule (ADR-0027)
1. **Intelligence** (Observe·Remember·Reason·Plan·Predict·Simulate) — pure, replayable.
2. **Governance** (Policy·Approval·Risk·Security·Permission·Capability·Audit·Decision) — pure;
   **nothing executes.**
3. **Execution** (email·browser·fs·trading·DB·mail·MCP·APIs) — the only layer with side effects.
   Every effect requires **permission·audit·receipt·idempotency·rollback·replaceable provider.**

**Intelligence never executes directly — everything passes through Governance.** A capability that
*decides* and one that *acts* promote **separately** (ADR-0027): `notify.plan` (decide) shipped;
its email/push **effect** is **designed-not-built** (1 prospective consumer + no durable store).

## 6. The rules (constitution — terse; full: [GIOS-CONSTITUTION.md](GIOS-CONSTITUTION.md))
Evidence earns architecture · no speculative abstractions · **wrap, never rewrite** · every
migration additive/reversible/byte-identical/deterministic · kernel stays deterministic ·
execution permissioned (default deny) · effects stay app-local until earned · reasoning ≠
execution · providers replaceable · composition > inheritance, manifests > prompts, receipts >
claims · architecture reviewed before implementation · apps consume the kernel, not vice-versa ·
tenant isolation is #1 · don't break userspace · no fabricated metrics.

## 7. Promotion gate (full: [CAPABILITY-PROMOTION.md](CAPABILITY-PROMOTION.md))
A capability enters the kernel only with ALL: **≥2 real in-repo consumers** · security boundaries
understood · ADR approved · deterministic where possible · testable · replaceable · backward
compatible · not speculative · production-proven. Else it stays app-local. A **different repo**
(GTG Quant) is not an in-repo consumer. **Effects** add: durable guarantee-infra exists +
recipient/authorization in the mechanism.

## 8. Roadmap + current priorities
**Done:** Sprint 1 kernel · Sprint 2 migrations #5–#10 (all preview-first, live on `afa0a98`, no
route flipped). **Next (Sprint 3), ranked in §11.**
```
#11 Durable Audit  →  #12 Kai Memory Graph  →  ABI FREEZE (Sprint 3)
      →  (evidence-gated, post-freeze) Agent/AI Runtime · Prediction · Learning · Marketplace · SDK
```
**Current priority:** #11 Durable Audit — architecture review DONE, **awaiting founder approval to
write ADR-0028**; do NOT implement before the ADR.

## 9. Open reviews / decisions
| Item | State |
|---|---|
| ADR-0027 (Notification decision-vs-effect) | **ACCEPTED** — implemented as `notify.plan` |
| **#11 Durable Audit review** | **DONE** (verdict: proceed-with-required-changes) → **ADR-0028 pending founder approval** |
| `arch/kernel-maturity-governance` branch (docs-only) | **committed, pending merge approval** |
| Live route flips (the 6 proven capabilities) | **not started** — need D-02 perf harness first |
| notify **effect** boundary | **deferred** — blocked on #11 + a real 2nd consumer |

## 10. Known risks / debt (canonical register — dashboard mirrors this)
| ID | What | Blocks | Status |
|---|---|---|---|
| **D-07** | dispatch marks idempotency on failure + synthetic `ok:true` replay; in-mem = no serverless dedupe | any effect | fix inside #11 (claim/settle) |
| **D-08** | PEP payload-blind → effect recipient authorized by nobody | any effect | fix with effect (own change) |
| D-02 | no perf/coverage harness | live route flips | open |
| D-03/D-04 | no durable audit/memory adapters | #11/#12 | in progress (#11) |
| R-03 | permissible-purpose is placeholder vs counsel legal model | multi-regime | open (FCRA-scoped) |
| A-01 | ABI unfrozen (by design until Sprint 3) | Marketplace/SDK/3rd-party | intended |
| — | append-only audit + PII collides w/ GLBA/CCPA erasure | #11 | hash-only + crypto-shred (ADR-0028) |

## 11. Sprint 3 — ranked plan (Phase 7 output)
Ranked by composite of ROI · risk · dependencies · token-cost · value · time. Lower rank = do first.

| # | Task | ROI | Risk | Depends on | Token cost | Eng value | Est | Why this rank |
|---|---|---|---|---|---|---|---|---|
| 1 | **ADR-0028 + #11 Durable Audit** (KernelPorts durability via awaited `flush()`, `{claim,settle}` 3-state ledger, version SEQUENCE, structural hash-only, `KERNEL_DURABLE` flag OFF) | **High** | High | ADR approval | High | Unblocks effects; fixes D-07 + version authority; supplies durable store | L | Everything downstream (effects, #12, route flips) needs durable persistence + the D-07 fix. Highest leverage. |
| 2 | **D-02 perf harness** (instrument `latencyMs` via `aiMeter` bracket; p95 budget) | High | Low | — | Low | Gates every route flip honestly; small, reusable | S | Cheap, unblocks flips + gives #11 its cost proof. Do alongside #11. |
| 3 | **Live route flips** (route the 6 proven capabilities behind flags, old path fallback) | **High** (first user-facing payoff) | Med | #2 | Med | Turns 6 proven-but-dormant migrations into real usage | M | The migrations only pay off once flipped; safe once perf-measured. |
| 4 | **Promote `lib/compliance` → `policy.content.screen` PDP** | High | Med | ADR | Med | ~10 real consumers; strongest platform promotion | M | Best-evidenced next promotion; a mandatory PDP hardens every credit surface. |
| 5 | **#12 Kai Memory Graph** (durable tenant-scoped Memory adapter) | Med | High | #11 patterns | High | Enables shared memory / learning substrate | L | Reuses #11 persistence; defer until #11 lands + a 2nd memory consumer exists. |
| 6 | **Sprint 3 ABI freeze** | Med | Med | #11, #12, route flips | Low | Unlocks Marketplace/SDK/3rd-party | S | Freeze only after CreditVector fully exercises the ABI (the whole point of not freezing early). |
| 7 | **Notification effect boundary** (per-channel ports + provider idempotency) | Med | High | #11 + real 2nd consumer | High | First real send through GIOS | L | **Deferred** — ADR-0027: no 2nd in-repo consumer yet. Do NOT pull forward. |
| 8 | **D-08 PEP recipient guard** | Med | Med | — | Low | Required before any effect ships | S | Pair with #7, not before (no effect crosses dispatch today). |

## 12. Canonical source map (Phase 1 — ONE home per concept)
| Concept | Canonical home | Do NOT re-explain in |
|---|---|---|
| Current state / priorities / roadmap / risks | **this file** | dashboard, journal, CURRENT-STATE |
| Kernel mechanism / primitives | ADR-0024 + [Capability Map](GIOS-KERNEL-CAPABILITY-MAP.md) | dashboard, journal |
| Three-runtime + decision-vs-effect | ADR-0027 | this file (summary only) |
| Constitution / axioms | [GIOS-CONSTITUTION.md](GIOS-CONSTITUTION.md) | dashboard, memory |
| Promotion rules | [CAPABILITY-PROMOTION.md](CAPABILITY-PROMOTION.md) | — |
| Review lifecycle | [ENGINEERING-REVIEW-PIPELINE.md](ENGINEERING-REVIEW-PIPELINE.md) | — |
| Per-migration rationale (why) | `.ai/KAI-ENGINEERING-JOURNAL.md` | this file, dashboard |
| Founder metrics/scorecard | `docs/FOUNDER-DASHBOARD.md` | this file |
| CreditVector app repo/deploy/gotchas | `CLAUDE.md` + `.ai/` | this file (pointer only) |

## 13. Memory hierarchy (Phase 5)
| Layer | Definition | Where it lives | Compaction rule |
|---|---|---|---|
| **Permanent** | Laws that outlive any sprint | Constitution, ADRs (decisions), Capability Map, Promotion rules | Never delete; supersede via new ADR |
| **Long-term** | Durable-but-evolving truth | **this file**, BOOTSTRAP, Engineering Journal | Update in place; keep current-only |
| **Sprint** | This sprint's plan/scorecard | §11 here, Dashboard | Roll forward each sprint |
| **Session** | In-flight work, open reviews | §9 here, task chips, branch state | Clear when merged/closed |
| **Disposable** | Scratch, workflow transcripts, review journals | `scratchpad/`, `subagents/workflows/` | Delete freely; never a source of truth |

## 14. Engineering health scorecard (Phase 6 — measurable evidence only)
| Dimension | Grade | Evidence (no fabricated metrics) |
|---|---|---|
| Architecture | A | mechanism-only kernel held; 2nd module registered w/ zero kernel edits; one clean ABI refinement (async) |
| Documentation | A | canonical corpus + this single-truth file; one-home-per-concept map |
| Maintainability | A | wrap-not-rewrite; existing engines untouched; 6 capabilities routed |
| Governance | A | Constitution + Promotion gate + Review pipeline codified; 2 adversarial reviews before code |
| Security | A− | tested: tenant isolation, default-deny PEP, append-only audit, idempotency, hash-only. Gaps: D-07/D-08 (effect-safety), in-mem persistence |
| Compliance | B+ | CROA scrubber live; hash-only receipts by design; CCO gate mandated. Open: R-03 legal purpose model |
| Developer velocity | A− | 75 guards + typecheck + build gate; preview-first; fast increments |
| Token efficiency | B→A (this blitz) | startup was ~19.5k tok (CLAUDE+INDEX+CURRENT-STATE); this file targets replacing most of it |
| Future-AI onboarding | A (post-blitz) | BOOTSTRAP.md <5 min; this file = one read |
| **Performance** | — | **Not Yet Instrumented (D-02)** — grade honestly withheld |
