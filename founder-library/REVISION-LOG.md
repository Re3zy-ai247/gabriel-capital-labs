# Founder Library — Revision Log

The Founder Library is versioned documentation. Volumes evolve through revisions, never replacement. This log records what changed, what is pending, and what requires the founder's decision.

Rules:
- A published volume is never overwritten to fix a downstream inconsistency. The inconsistency is logged here and resolved in a numbered revision.
- A revision increments the volume's version (v1.0 → v1.1) and states what changed.
- Open items requiring the founder's ratification are listed separately from editorial items, because they are decisions rather than edits.

---

## Volume status

| Volume | Title | Version | Status | Last change |
|---|---|---|---|---|
| 1 | Executive Summary (CreditVector) | 1.0 | Draft | 2026-07-27 — created |
| 2 | Gabriel Capital Labs | 1.0 | Draft | 2026-07-27 — created |

---

## Pending revisions

### Volume 1 → v1.1 (editorial, non-blocking)

Logged 2026-07-27 while authoring Volume 2. Neither item requires a rewrite.

1. **Cite the canonical definition of financial trust.** Volume 1 uses "financial trust" in its ordinary sense throughout. Volume 2 establishes the canonical definition. A future revision should reference it rather than relying on the reader's interpretation.
2. **Attribute the founding conviction to Volume 2.** Volume 1 §3 states the company-level conviction ("the most valuable software of the next decade will be systems that make better decisions credible") inside a product document. Volume 2 is now its home. A future revision should cite rather than assert it, so the company's core claim has one source.

---

## Open items requiring the founder's decision

### 1. Top-line product positioning — unratified

**Raised:** 2026-07-27 (during Volume 1 authoring; restated in Volume 2).

Two descriptions of the same product are in circulation:

- **Founder Library (Volume 1):** "a constitutional operating platform for financial trust"
- **Internal positioning record (ADR-0009, `.ai/PRODUCT.md`, `.ai/marketing/BRAND-VOICE.md`):** "AI-Powered Financial Reputation Platform" / "AI-powered credit intelligence platform"

These are compatible but distinct, and they are aimed at different readers. This needs ratification — a decision about which is canonical, and whether the other is retired or retained as a secondary register — **before Volume 4 (The CreditVector Solution) or Volume 9 (Go-To-Market Strategy)**, where positioning becomes load-bearing and a split would propagate.

This is a decision, not an edit. Whichever way it resolves, the losing document gets a logged revision rather than a silent overwrite.

---

## Observations carried forward

Durable notes that should shape future volumes. Recorded when identified; not all require action.

**From Volume 1 (2026-07-27):**

- **Volume 1 borrowed terms it did not define** — "constitutional," "governed," "financial trust," "GIOS." Volume 2 became the definitional layer in response. Future volumes should cite Volume 2's definitions rather than re-explaining them, and any volume that introduces a new load-bearing term should define it formally or defer to the volume that does.
- **The refusal list is a durable device.** Volume 1's "What CreditVector Will Never Become" — closing with "these are permanent constraints, not current policy" — is the strongest passage in the volume. Volume 2 carried the pattern to company level. Every volume making forward-looking claims should state what the company will not do alongside what it will.
- **State the cost of a strategic choice, don't manage it quietly.** Volume 2 §"Why CreditVector Was Chosen First" includes an explicit statement of the reputational cost of operating in the credit category. Future volumes should hold this standard: a strategy document that omits the known downside of its own strategy is less credible, not more.
- **No pre-announcement.** The Founder Library describes what exists and has been validated. The Future Portfolio section of Volume 2 is explicitly framed as selection principles, not plans. Volumes 7, 9, and 11 will be under the most pressure to violate this.
