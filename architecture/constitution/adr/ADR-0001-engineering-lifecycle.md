# ADR-0001 — Engineering Lifecycle

- **Status:** PROPOSED (drafted 2026-07-17; **not merged** — awaiting founder approval)
- **Track:** Constitution amendment (the sanctioned path per PRODUCT-CONSTITUTION-v1.0 Article IX)
- **Amends:** PRODUCT-CONSTITUTION-v1.0 — the engineering order of operations in Article IX
- **Author:** founder directive, 2026-07-17

---

## Context

Constitution v1.0 codifies, in Article IX, an engineering order of operations:

> Product Constitution → Architecture → Implementation Plan → Production Code.

After the Constitution Freeze, the founder's engineering discipline evolved: the order must make the
**Brand Constitution**, **Kai Identity**, **Product Design**, **QA**, and **Release** explicit
first-class stages, so that intent (constitution) is fully locked before structure (architecture),
and structure before implementation.

Per the Constitution's own change-control rule, this evolution may **not** be applied by silently
editing Article IX. It is applied here, as the first amendment, on the ADR track. **Constitution v1.0
is not modified directly; this ADR is authoritative over the Article IX order it supersedes.**

## Decision

The official engineering lifecycle for all CreditVector / Kai work is the following nine stages, in
sequence:

1. **Product Constitution**
2. **Brand Constitution**
3. **Kai Identity**
4. **Architecture (ADRs)**
5. **Product Design**
6. **Implementation Plan**
7. **Production Code**
8. **QA**
9. **Release**

This supersedes the four-stage order in Constitution v1.0 Article IX. The three governing principles
are unchanged and remain in force:

- **No new concepts in code.** Production code (stage 7) may introduce no concept that does not
  already exist in the Constitution or an approved ADR.
- **Conflict stops implementation.** If implementation discovers a constitutional conflict, work
  halts and the change is proposed as either an ADR (structure) or a Constitutional Amendment
  (intent). **Never a silent change in code.**
- **Layer separation.** The Constitution governs intent · Architecture governs structure ·
  Engineering governs implementation.

## Consequences

- The Constitution's apex text (Article IX) is left intact; readers are pointed here for the
  authoritative, superseding order (see the Constitution footer and the constitution README).
- Every future task is planned and executed in these nine stages; the first six are design/governance
  gates before any production code is written.
- This ADR is itself the demonstration of the discipline: intent evolved, and it was amended through
  the sanctioned path rather than by silent edit.

## Status / next step

Drafted, not merged. Ratification of this amendment is a founder decision. On approval, it becomes the
binding engineering lifecycle and Constitution v1.0's Article IX order is considered superseded by
reference.
