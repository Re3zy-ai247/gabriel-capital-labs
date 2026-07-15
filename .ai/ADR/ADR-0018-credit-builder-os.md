# ADR-0018: Credit Builder Operating System — repair to build

Status: Accepted (orchestration only; deterministic; MAIL_LIVE stays off)
Date: 2026-07-14
Decision owners: Founder directive (Sprint XVIII)

## Context
CreditVector no longer ends when negatives are removed — it now guides the
customer toward EXCELLENT credit. Every builder recommendation must be
deterministic, explainable, and cite the data that produced it; when the data to
evaluate a factor isn't on file, it must say "Not enough information to evaluate."
Pure orchestration; no new intelligence, no AI, no fabricated recommendations.

## Decision
`lib/builder/` — pure orchestration over the CVI snapshot + readiness:
- **`engine.ts`** — `buildBuilder(snap, intel)` is PURE. It produces 11 builder
  recommendations (utilization · builder loans · secured cards · CLI · tradeline
  growth · age of accounts · payment history · business credit · funding prep ·
  mortgage prep · long-term maintenance). Each carries Kai's WHY + the cited fields
  the directive requires: **current profile · observed · expected improvement ·
  dependencies · estimated timing · evidence**.
- **`types.ts`** — statuses (recommended/in_progress/on_track/unavailable/locked)
  + the `NOT_ENOUGH_INFO` literal + `BuilderOS`.
- **`api.ts`** — `builderOS(userId)`; `/api/builder` (userId-scoped).
- The dashboard now loads the CVI snapshot **once** (`loadSnapshot` →
  `assembleIntelligence`) and feeds it to CVI + Mission Engine + Roadmap +
  Builder — eliminating the prior double-load (Sprint-XV follow-up). Mission
  Control CONSUMES the Builder via `BuilderView`.

## Consequences
- The platform's arc completes: repair → build. Recommendations are educational,
  deterministic, and cited — a credit-builder loan/secured card is recommended
  from the observed thin-file signal, never invented.
- **Honesty:** utilization + CLI = "Not enough information to evaluate." (no credit
  limits in the parsed report); positives aren't imported (disclosed); business
  credit = locked; funding/mortgage prep reuse CVI readiness and state **"not a
  lending decision."** Expected-improvement describes what an action DOES (adds
  installment/revolving/payment history, diversifies mix) — never a promised score.
- A determinism + CROA/FTC guard (`scripts/builder.test.ts`) enforces it.
- Future-ready: Funding Hub / Business Credit / Monitoring / Mobile / API consume
  `builderOS`. Preview only; no merge; MAIL_LIVE off.
