# CreditVector Intelligence OS (CVIOS) — platform architecture

> ⚠️ **Platform hierarchy is frozen in [`GIOS-PLATFORM.md`](GIOS-PLATFORM.md) (v1.0) + `ADR-0033`.** Canonical:
> **GIOS (kernel) → Kai (intelligence runtime, L2) → CreditVector (this vertical) → apps → modules →
> foundation.** **Kai belongs to GIOS, not to CVIOS** — where the diagram below shows Kai as a CVIOS-level
> Master Agent, read it as *CreditVector's use of the platform Kai*, not Kai's home. CVIOS = the **CreditVector
> vertical's** architecture (L4–L6); it inherits the shared kernel (L0–L3), never forks it.

How everything fits together as ONE platform. Each subsystem is labeled **LIVE** (verified in code/prod) or **PROPOSED** (documented direction, no runtime yet). CVIOS is the **product-level** operating system; the **company-level** operating system is the Gabriel Capital Labs AIOS (`~/Documents/Gabriel-Capital-Labs-AIOS/` — charter, decision rights, backlog, `/gcl` agent fleet). Boundary: `GIOS-COMPATIBILITY.md` §CVIOS.

```
                        ┌─────────────────────────────────────────────┐
                        │        GABRIEL CAPITAL LABS AIOS            │
                        │  charter · decision rights 🟢🟡🔴 · backlog │
                        │  /gcl router + agent fleet · routines       │
                        └──────────────────┬──────────────────────────┘
                                           │ governs (people/decisions)
┌──────────────────────────────────────────▼──────────────────────────────────────────┐
│                       CVIOS — CREDITVECTOR INTELLIGENCE OS (this repo)              │
│                                                                                     │
│  EXECUTIVE INTELLIGENCE (.ai/executive/ + /admin dashboards)              LIVE docs │
│  BUSINESS INTELLIGENCE  (.ai/business-intelligence/ + admin APIs)         LIVE docs │
│  IMPROVEMENT ENGINE     (.ai/improvement/ → AIOS backlog G-NN)            LIVE docs │
│  KNOWLEDGE GRAPH        (.ai/knowledge/GRAPH.md → future Kai feed)        LIVE docs │
│  MARKETING INTELLIGENCE (.ai/marketing/ + /admin/marketing)               LIVE docs │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                              PRODUCT RUNTIME (LIVE)                                 │
│  ┌─────────────────┐  ┌────────────────┐  ┌───────────────────────────────────┐    │
│  │  CONSUMER OS     │  │  AGENCY OS     │  │  MASTER AGENT: KAI                │    │
│  │  reports·scores  │  │  client work-  │  │  community answers (fenced,      │    │
│  │  tradelines·     │  │  spaces (20-   │  │  credit-only — ADR-0005);        │    │
│  │  strategist·     │  │  client cap)·  │  │  future: platform-wide agent     │    │
│  │  letters·round2  │  │  follow-up     │  │  over the knowledge graph        │    │
│  │  identity vault  │  │  clocks        │  │  (PROPOSED, ADR required)        │    │
│  └─────────────────┘  └────────────────┘  └───────────────────────────────────┘    │
│  ┌─────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐     │
│  │ BRIEF INTELLI-   │  │ COMMUNITY      │  │ AUTOMATION     │  │ SUPPORT      │     │
│  │ GENCE: RSS+PDF   │  │ INTELLIGENCE:  │  │ CENTER: crons  │  │ tickets +    │     │
│  │ ingest→AI draft  │  │ forum+modera-  │  │ (ingest·digest)│  │ encrypted    │     │
│  │ →human publish   │  │ tion+reports   │  │ /admin/auto-   │  │ attachments  │     │
│  │ →digest          │  │ queues         │  │ mation         │  │              │     │
│  └─────────────────┘  └────────────────┘  └────────────────┘  └──────────────┘     │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│  SHARED FOUNDATION (LIVE): entitlements · Stripe billing · NextAuth · encryption    │
│  (docCrypto) · rate limiting · compliance scrubber · design tokens · self-heal DB   │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│  FUTURE MARKETPLACE (PROPOSED — Vision horizon 5): partner/data/API ecosystem       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Subsystem registry
| Subsystem | Status | Runtime today | Canonical doc |
|---|---|---|---|
| Consumer OS | **LIVE** | app core (upload→analyze→dispute→track) | `ARCHITECTURE.md`, `PRODUCT.md` |
| Agency OS | **LIVE** (v1) | `app/agency`, workspace cookie pattern, follow-up clocks | `ARCHITECTURE.md` |
| Master Agent Kai | **LIVE** (community scope) | `lib/kai.ts` — deliberately tool-less (ADR-0005). Evolution designed: AI-last intelligence engine + credit economy (`KAI-INTELLIGENCE.md`/`CREDIT-ECONOMY.md`, ADR-0006) + proactive experience layer — event engine, Kai Home, timeline, digests (`KAI-EXPERIENCE.md`, ADR-0007) — both Proposed | `SECURITY.md`, ADR-0005/0006/0007 |
| Brief Intelligence | **LIVE** | `lib/brief*.ts`, crons, admin desk | ADR-0003, `COMPLIANCE.md` |
| Community Intelligence | **LIVE** | forum, moderation queues, report→email/push alerts | `ARCHITECTURE.md` |
| Automation Center | **LIVE** (v1) | Vercel crons + `/admin/automation` (honest metrics) | `INTEGRATIONS.md` |
| Executive Intelligence | **LIVE** (docs+dashboards) | `/admin` suite + `executive/` layer | `executive/README.md` |
| Business Intelligence | **LIVE** (docs; partial instrumentation) | admin APIs, Stripe | `business-intelligence/METRICS.md` |
| Marketing Intelligence | **LIVE** (docs) + external assets | `/admin/marketing`, `.ai/marketing/`, ad kit | `marketing/README.md` |
| Creative OS | **LIVE** (docs; ADR-0008) | Kai character system + render pipeline over Higgsfield | `creative/README.md` |
| Knowledge Graph | **LIVE** (index form) | `knowledge/GRAPH.md`; Kai feed PROPOSED | `knowledge/GRAPH.md` |
| Improvement Engine | **LIVE** (process) | `improvement/ENGINE.md` → AIOS backlog | `improvement/ENGINE.md` |
| Marketplace | **PROPOSED** | — | `VISION.md` horizon 5 |

## Composition rules
1. New subsystems integrate into the shared foundation (entitlements, encryption, rate-limit, compliance scrub, tokens) — never parallel infrastructure (Constitution Art. VII).
2. Every subsystem exposes its truth to BI honestly ("not yet instrumented" over estimates).
3. Kai capability expansion is gated: ADR + `/compliance-review` + security review per step.
4. Docs here are canonical for the PRODUCT; the AIOS charter is canonical for the COMPANY. Zero duplication between them — link.

## Bounded-context reconciliation (code truth — 2026-07-20)
The DDD **engineering** view (one owner per context; complements the product Subsystem registry above). Grounded in grep, honestly labelled per Constitution truth-labels/no-false-completion — many vision-named contexts are **ABSENT** in code or **renamed**. Ownership registry authority = `GIOS-PLATFORM.md §3`; a plugin *is* a bounded context (ADR-0026).

| Bounded context | Status | Code owner | Reality / naming note |
|---|---|---|---|
| Operator Identity | SHIPPED | `lib/session.ts`, `lib/auth.ts`, `User` | see [`OPERATOR-IDENTITY.md`]; canonical principal = `currentAccount().id` |
| Organizations / Agencies | SHIPPED | `User.isAgency`/`managedByAgencyId`, `app/api/agency` | agency is a **mode**, not a role; edge keyed on id |
| Permissions / Entitlements | SHIPPED | `lib/os/kernel/pep.ts` (default-deny), `lib/entitlements.ts` | PEP live; `CAPABILITY_PLATFORM` flag OFF |
| Letters (Disputes) | SHIPPED | `lib/letter.ts`, `app/letters` | a **Dispute IS a Letter** record — no separate Dispute model (DISPUTE_CREATED is a fabric event, PARTIAL) |
| Evidence | PARTIAL | `lib/intelligence/graph.ts` (as graph nodes) | no dedicated Evidence model/dir |
| Mission Control | SHIPPED | `lib/missionControl.ts`, `app/dashboard` (titled "/ Mission Control") | one module (ADR-0032), not the OS |
| Operator Reputation (Vector XP) | PARTIAL | `lib/arena/*` (reconcile-on-read, no table) | own-XP only; refusal register binding ([`ARENA-CONTRIBUTION-POLICY.md`]); ledger/milestones/entitlements/claims PROPOSED ([`VECTOR-XP.md`], ADR-0037); "verified" tier PROPOSED |
| Performance Intelligence (SOP/KPI/Health) | PARTIAL (scattered) | seed: `AGENCY-COMMAND.md §8` health score + §4 revenue, `lib/missionControl.ts`, `lib/analytics` | SOP + KPI **engines** ABSENT; consolidated service PROPOSED ([`PERFORMANCE-INTELLIGENCE.md`], ADR-0037); business health ≠ reputation |
| Achievements / Certifications | PARTIAL | arena badges | Certifications ABSENT (no issuance record) |
| Kai (intelligence) | SHIPPED | `lib/kai.ts`, `lib/intelligence/*` | tool-less by design (ADR-0005); kernel `lib/os/kernel` dormant (`KERNEL_DURABLE` off) |
| Knowledge Graph | SHIPPED (index form) | `lib/intelligence/graph.ts` | Kai-feed PROPOSED |
| Notifications | PARTIAL | `lib/email.ts` (Resend LIVE), `lib/push.ts`, `lib/os/modules/notify` | content owned by emitting context (ADR-0036) |
| Event Fabric (Events) | PARTIAL (dormant) | `lib/eventBus/*`, `EventEnvelope` | 13 contracts; `EVENT_BUS_ENABLED` OFF; LIVE analytics stream is the separate `ProductEvent` path |
| Analytics | SHIPPED | `lib/analytics/aggregate.ts`, `lib/events.ts` (ProductEvent) | fail-open telemetry |
| Audit | SHIPPED | `AdminAuditLog` (+ `lib/admin.ts`); kernel `KernelAudit` dormant | |
| Billing | SHIPPED | `lib/stripe.ts`, `lib/billing.ts` | LIVE Stripe |
| Operator Network | PARTIAL | `lib/network/*`, `app/network` (dormant) + `/community` (LIVE forum) | two surfaces — do not conflate ([`OPERATOR-IDENTITY.md §4`]) |
| Agency Command (Center) | SHIPPED | `app/agency` (titled "/ Agency") | "Command Center" deprecated (ADR-0032) |
| Campus | ABSENT (renamed) | nearest = `lib/academy.ts` / `app/academy` | vision name "Campus" ≠ code "Academy" |
| Marketplace | ABSENT | — | PROPOSED (`VISION.md` H5) |
| Rooms | ABSENT (specimen) | `app/gxl` GXL gallery specimen (founder-only, noindex) | not a ratified context |
| Meetings / Meeting Intelligence | ABSENT | — | no route/model |
| Search | ABSENT | — | only incidental filter params |
| Scheduling | ABSENT | — | only Vercel Cron endpoints, not a context |

**Reading rule:** ABSENT/PROPOSED are aspirational — never cite them as shipped. Dormant flags (`EVENT_BUS_ENABLED`, `ARENA_ENABLED`, `OPERATOR_NETWORK_ENABLED`, `CAPABILITY_PLATFORM`) default **off**.
