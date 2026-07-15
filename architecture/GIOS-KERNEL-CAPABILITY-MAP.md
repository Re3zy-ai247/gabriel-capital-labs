# GIOS Kernel Capability Map — the canonical blueprint

Status: **CANONICAL & LIVING.** The self-description of the operating system. Regenerated from the
repository (not from memory); every "in-kernel" claim is cited to `file:line`. Governed by
[GIOS-CONSTITUTION.md](GIOS-CONSTITUTION.md); promotion rules in
[CAPABILITY-PROMOTION.md](CAPABILITY-PROMOTION.md). Last synced: **2026-07-15** (origin/main `afa0a98`).

> **Honesty rule (charter):** this map documents what *exists*, not what is *aspired to*. A
> subsystem the founder named that has no code is marked **CONCEPT** with its earning criteria —
> never dressed up as real. No guessing. Evidence earns architecture.

## Maturity legend
| Tag | Meaning |
|---|---|
| **KERNEL** | In the kernel core (`lib/os/kernel/`), mechanism-only, guarded. Product-agnostic. |
| **REGISTERED** | A capability registered on the kernel (a plugin). Proven byte-identical; live route **not** flipped. |
| **CANDIDATE** | App-local, running in production; a promotion candidate (in-repo consumer count noted). Not yet promoted. |
| **DESIGNED** | Architecture decided in an ADR but **deliberately not built** (evidence not yet sufficient). |
| **CONCEPT** | Named in the roadmap; **no code**. Earning criteria stated. Not built speculatively. |

---

## Layer 0 — Kernel mechanism (product-agnostic; `lib/os/kernel/`)
The syscall surface. Pure library, injected ports (hexagonal), no `Date.now`, no DB. 33 guards
(`scripts/kernel.test.ts`). Owner: **platform-team**. ADRs: 0022/0024/0025/0026.

| Capability | Purpose | Inputs → Outputs | Security boundary | Maturity | Source |
|---|---|---|---|---|---|
| **Identity** | The security principal for every call. | `{id, tenantId, trust}` | `tenantId` scopes everything (#1 invariant). | KERNEL | `types.ts:11` · host `identity.ts` |
| **Registry / Plugin Loader** | The only door in: a domain is owned by exactly one module; static, no runtime mutation. | `KaiModule` → routing table | Fail-closed on domain collision (no squatting). | KERNEL | `registry.ts` |
| **Namespace** | `domain.entity.action[@major]` grammar + routing-by-domain. | raw key → `ParsedKey` \| null | Malformed key fail-closes. | KERNEL | `namespace.ts` |
| **Capability Resolver** | "What *can* this actor do?" over the preloaded snapshot. | `(key, ent)` → `available\|coming_soon\|not_entitled\|not_permitted\|unavailable` | Pure; no DB mid-flow (R3). | KERNEL | `resolve.ts` |
| **PEP (Security)** | "May this actor do this *now*?" Default deny. | `(actor,key,purpose,registry,ent)` → `{allow,reason}` | availability + permissions + permissible-purpose + PDP veto. **Payload-blind — see D-08.** | KERNEL | `pep.ts` |
| **Dispatch** | Trap every call: authorize → idempotency → `execute` → audit + emit. | `(actor,key,input,ent,purpose,idemKey?)` → `ModuleResult` | Single trust root; **effect-unsafe today — see D-07.** | KERNEL | `kernel.ts:80` |
| **Permissions / Entitlements** | The plan→capability map, preloaded once per request. | plan → `{grantedCapabilities, flags, grantedPermissions}` | Least-privilege; single-load (R3). | KERNEL | `types.ts:98` · host `entitlements.ts` |
| **Clock / Version Authority** | The single monotonic source of version + logical time. | — → `Version`, ISO `now()` | No plugin mints time (determinism). | KERNEL | `clock.ts` · `types.ts:28` |
| **Audit** | Append-only, tamper-proof record of every mediated action. | `AuditEntry` → append | No update/delete; kernel-only. In-mem port today. | KERNEL (port) | `types.ts:107` · `adapters.ts` |
| **Event Bus** | Durable-in-prod append log; at-least-once → idempotent handlers. | `KaiEvent` → append/deliver | Dedupe by id. In-mem port today. | KERNEL (port) | `types.ts:121` |
| **Memory Interface** | The Kai Memory Graph *port*; every access PEP-gated + tenant-scoped. | `read/write(node)` | Cross-tenant read denied + audited. In-mem port today. | KERNEL (port) | `types.ts:132` · `kernel.ts:66` |
| **Manifest / Marketplace metadata** | Every capability self-describes (discover/version/price/reuse). | — → `CapabilitySpec[]` | Read-only catalog. **Now multi-plugin.** | KERNEL | `kernel.ts:41` · `types.ts:62` |
| **Idempotency store** | Dedupe repeat ops / event redelivery. | key → seen/mark | **In-memory only** → no cross-invocation dedupe on serverless. | KERNEL (port) | `kernel.ts` `inMemoryIdempotency` |

---

## Layer 1/2 — Registered capabilities (plugins on the kernel)
Proven byte-identical to the production engine they wrap; **no live route flipped.**

### Credit plugin — Application #1 (`lib/os/modules/credit/`, 19 guards)
Owner: **credit-team**. Trust: first_party. ADR-0022.

| Capability | Purpose | Wraps | Layer | Maturity |
|---|---|---|---|---|
| `credit.letter.draft` | FCRA-grounded dispute letter (recipient-differentiated). | `lib/letter` | Intelligence | REGISTERED |
| `credit.response.analyze` | Analyze a bureau/furnisher response (async, generative, **premium**). | `lib/round2` | Intelligence | REGISTERED |
| `credit.obsolescence.window` | §605 obsolescence window (years). | `lib/obsolescence` | Intelligence | REGISTERED |
| `credit.tradeline.insight` | §605 fall-off analysis for a tradeline. | `lib/tradelineInsights` | Intelligence | REGISTERED |
| `credit.campaign.compose` | Sequence disputable items into a campaign (workflow). | `lib/campaign` | Intelligence | REGISTERED |

### Platform module — Notification Decision (`lib/os/modules/notify/`, 23 guards)
Owner: **platform-team**. The first **product-agnostic** capability — any GIOS app inherits it.

| Capability | Purpose | Inputs → Outputs | Security boundary | Layer | Maturity | ADR |
|---|---|---|---|---|---|---|
| `notify.plan.compose` | Deterministic notification **decision**: token-free tenant-scoped idempotency key, transactional/commercial class, CAN-SPAM header policy, **hash-only** content/recipient digests. **Sends nothing.** | `{channel,purpose,commercial,tenantId,recipientRef,event,content,headers?}` → `NotificationPlan` | Purpose-gated; hash-only (no PII in output). | Governance (2) | REGISTERED | 0027 |

---

## Layer 3 — Execution (effects) — and the boundary
| Capability | Purpose | Maturity | Why | Source / ADR |
|---|---|---|---|---|
| **Notification Execution** (email/push send) | Actually send the planned notification. | **DESIGNED** (not built) | 1 prospective consumer (GTG, other repo) + no durable idempotency store → effect-port unearned. `MAIL_LIVE` OFF. | app-local `lib/email.ts`, `lib/push.ts`; ADR-0027 |
| **Physical Mail** (certified letters) | Provider-abstracted certified/first-class mail with a `PAID`/`APPROVED` hard gate + `letterContentHash` proof-of-intent. | **CANDIDATE** (strong, self-contained) | The **in-repo reference** for wrapping an effect behind a provider port + hard gate **without** a kernel effect-port. Excluded from #10 (ADR-0027). | `lib/mail/` (MailService/MailProvider + providers) |
| **Future Effect Boundary** | The generic Layer-3 contract (per-channel provider ports + durable 3-state idempotency ledger + hash-only receipts). | **CONCEPT** | Earned only when: durable Postgres store exists (⊇ #11) + ≥2 real in-repo consumers + D-07/D-08 fixed. | ADR-0027 §5 |

---

## App-local subsystems — promotion candidates (exist in prod; NOT in the kernel)
Documented so the kernel *knows what could be promoted and why it hasn't been.* Consumer counts are
real importer counts (2026-07-15). See [CAPABILITY-PROMOTION.md](CAPABILITY-PROMOTION.md).

| Subsystem | Purpose | In-repo consumers | Layer | Maturity | Promotion note |
|---|---|---|---|---|---|
| `lib/compliance` | CROA/FCRA content scrubber (deterministic). | ~10 | Governance | CANDIDATE (**strongest**) | Would promote as `policy.content.screen` + a mandatory PDP. Needs ADR + guards. |
| `lib/mail` | Physical-mail effect pipeline. | (self-contained) | Execution | CANDIDATE | Reference effect model; promote only with the effect boundary. |
| `lib/aiMeter` | AI usage metering / budget governance. | ~9 | Governance | CANDIDATE | Cross-cutting; needs a durable-counter port. |
| `lib/knowledge` | Knowledge graph (engine/loader/types). | ~8 | Intelligence | CANDIDATE | Needs a clean tenant-scoped query contract first. |
| `lib/intelligence` | App intelligence layer (api/modules/snapshot). | ~16 | Intelligence | CANDIDATE | Large; decompose into capabilities before promoting any. |
| `lib/forecast` | Forecasting. | ~5 | Intelligence | CANDIDATE | Belongs to a future Prediction runtime; defer. |
| `lib/outcome*` (ledger/corpus/stats/consent) | Outcome/learning substrate. | ~3 | Intelligence | CANDIDATE | Seed of a future Learning runtime; defer. |
| `lib/execution` | App execution engine (queue/priority/risk/rewards/timeline). | ~2 | Execution | CANDIDATE | Promote only after the Execution runtime is earned (post-freeze). |
| `lib/kai` | AI orchestrator (Kai answers). | ~2 | Intelligence | CANDIDATE | Candidate AI-runtime seam; post-freeze. |
| `lib/roadmap`, `lib/missionEngine`, `lib/builder` | Roadmap / mission / credit-builder engines. | domain | CANDIDATE | Credit-domain; likely credit-plugin, not kernel. |
| `lib/scoring`, `lib/recommend`, `lib/classify` | Credit scoring / strategy / creditor classification. | ~4 each | credit domain | **NOT platform** — belong in the **credit plugin**. |
| `lib/decisionRegistry` | Decision registry. | 1 | — | **Fails the twice-bar** → stays local. |

---

## Named-but-not-built (CONCEPT — earning criteria, no code)
The founder's roadmap names these. They are **not** built and must not be built speculatively.

| Subsystem | Earns its way in when… | Track |
|---|---|---|
| **Durable Audit (#11)** | It's the next architecture review (this phase). Supplies the durable append-only audit + the 3-state idempotency store the effect boundary needs. | kernel |
| **Kai Memory Graph (#12)** | A durable, tenant-scoped Memory adapter replaces the in-mem port; ≥2 consumers of shared memory exist. | kernel |
| **Planning** | A real planning consumer exists; today no `lib/planning`. | Intelligence |
| **Prediction Runtime** | `lib/forecast` has ≥2 consumers + a deterministic contract. | Intelligence |
| **Learning Runtime** | The `outcome*` substrate proves a replayable learning loop with ≥2 consumers. | Intelligence |
| **AI Runtime / Agent Runtime** | Gated **behind the Sprint-3 ABI freeze** (ADR-0023); a real agent consumer exists. | post-freeze |
| **Scheduling** | Today only 2 Vercel infra crons (`vercel.json`); becomes a kernel capability only with ≥2 capability-level consumers. | infra→kernel |
| **Marketplace / SDK / Global Memory** | Third-party plugins + the ABI freeze make them necessary (ADR-0026). | post-freeze |

---

## Open kernel risks (must be resolved before their dependents ship)
| ID | Risk | Blocks | ADR |
|---|---|---|---|
| **D-07** | `dispatch` marks idempotency on failure + replays synthetic `ok:true`; in-mem store = no serverless dedupe. | any Layer-3 effect | 0027 §4 |
| **D-08** | PEP is payload-blind → effect recipient authorized by nobody. | any Layer-3 effect | 0027 §4 |
| **A-01** | ABI not frozen until Sprint 3 (by design — CreditVector must exercise it first). | Marketplace/SDK/3rd-party | 0024 |

## Product-agnostic proof (the success criterion)
The kernel imports **no** application module (dependency arrow points one way). Onboarding a new
application = register a `KaiModule` (as `notify` did, with **zero kernel edits**) + supply its
entitlement grant. Nothing in `lib/os/kernel/` mentions `credit`, `notify`, or any product. When
GTG Quant or Gabriel AI OS arrives, it registers modules the same way — that is the test this map
exists to keep honest.
