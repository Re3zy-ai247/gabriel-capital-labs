# ADR-0021: Sprint XXI — Founder Polish & Intelligence

Status: Accepted (orchestration/education + copy only; deterministic; MAIL_LIVE stays off; PREVIEW-ONLY, unmerged)
Date: 2026-07-15
Decision owners: Founder directive (Sprint XXI)

## Context
Production (Sprints XII–XX) is live. This sprint elevates CreditVector from a great
SaaS into "the operating system for consumer credit" — not a rewrite, not a new
engine. It sharpens the dispute letters, restores modules that had no navigation,
and turns readiness + learning into first-class parts of the operating system.

## Decision
- **Phase 1 — Letter Intelligence** (`lib/letter.ts`): the deterministic template is
  now RECIPIENT-DIFFERENTIATED (fixing a bug where every letter demanded a bureau
  §611 reinvestigation). Bureau → §611 reinvestigation + §611(a)(7) method of
  verification + account-level verification (Cushman/Hinkle). Furnisher →
  §1681s-2(b) own investigation against original agreement/ledger/payment history.
  Collector → §1692g validation (amount, original creditor, chain of title) + cease
  collection *to the extent timely* (hedged). goodwill / cease-&-desist /
  pay-for-delete → purpose-built openings + closings, no accuracy findings, no
  admission of the debt. LLM system prompt gains a recipient-specific-demands rule.
- **Phase 2 — Credit Builder OS** (`/builder`, `lib/builder/education.ts`): a
  dedicated page reusing ReadinessStrip + the 11-module BuilderView + an educational
  planner layer (utilization, payment timing, aging, mix, inquiry aging,
  revolving-vs-installment, authorized users, statement dates). Every card is badged
  **Educational** vs **Data-driven**; numbers appear ONLY from the file — utilization
  stays educational (no limits on file, never estimated). Auto-upgrades to
  data-driven when the data exists.
- **Phase 3 — CreditVector Academy** (`/academy`, `lib/academy.ts`): the elevated
  Knowledge Journey — a deterministic 8-level progression (report → collections →
  late payments → charge-offs → dispute strategy → method of verification → CFPB →
  business credit). Each lesson connects to the user's real file when the data
  exists (never invented); Mission Control surfaces the next recommended lesson. The
  Knowledge Graph is retained on the page as "your connected journey."
- **Phase 4 — Readiness** (`lib/execution/ExecutionEngine.ts`): promoted to a
  first-class signal FEEDING the Executive Queue (NOT a new engine) — reuses CVI
  readiness + `estimatedReadinessBand` to surface the nearest goal + its blocker.
- **Module restoration**: sidebar nav restored for **Credit Builder** and
  **Academy**; Readiness leads the Credit Builder page and is a queue signal.

## Governance / guardrails honored
No AI in these surfaces, no fabricated data (utilization/scores never estimated),
no duplicate orchestration (Readiness feeds the existing Execution Engine; Academy
is pure over the snapshot), CROA-safe (process not outcome, disclaimers present),
reuse-only (no new DB query/loader). Every letter still routes through the
`lib/compliance.ts` scrubber.

## Reviews (per-phase, all pass)
Architecture (reuse-only; grep-verified no new prisma/fetch) · Legal/CCO **GO**
(letter changes fully gated; 3 MEDIUM coherence/accuracy findings fixed; educational
content process-not-outcome) · Privacy (no external calls/PII/logging) ·
Accessibility (native `<details>`, aria, sr-only, semantic lists) · Determinism
(pure; no Date.now/Math.random; academy reproducibility guard).

## Validation
`tsc` clean · `next build` clean (`/academy`, `/builder` built) · full guard suite
**28/28** incl. new `scripts/letter.test.ts` (24) + `scripts/academy.test.ts` +
execution readiness assertion.

## Consequences
- Preview-only on `sprint-xxi-founder-polish`; not merged, MAIL_LIVE OFF.
- Deferred to Sprint XXII (logged in TASKS): comprehensive every-page copy/CTA polish
  + landing/pricing/onboarding audit + IA regrouping; dashboard density (Builder /
  Knowledge now have dedicated pages, so the dashboard could slim to overview cards);
  Kai platform-wide positioning + pricing/entitlement matrix.
