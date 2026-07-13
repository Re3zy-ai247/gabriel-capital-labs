# CreditVector Intelligence OS (CVIOS) — platform architecture

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
