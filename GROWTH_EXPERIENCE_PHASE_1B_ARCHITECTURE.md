# CreditVector Growth Experience Phase 1B — Remediated Preview Architecture

Status: **REMEDIATION IMPLEMENTATION COMPLETE; FOUNDER_DECISION_PENDING; CONTRACT NOT FOUNDER-RATIFIED**
Scope: protected, synthetic, non-monetary Founder review only

## Architecture decision

Phase 1B is a nested annex under the approved Phase 1A Growth Center Preview. It reuses Growth Foundation and CXOS Core Runtime presentation mechanics while keeping all product and source truth outside the annex.

The implementation is intentionally pure and effect-free:

- server route performs three gates before importing the client stage;
- one immutable contract module contains fixed fixtures, owner maturity, the explicit 7 × 10 decision table, rationales, and projection rules;
- one route-local stage presents the projection;
- one route-local stylesheet owns appearance;
- no source adapter, participant loader, API, persistence, runtime model, analytics, billing, or economic seam exists.

## Authority model

Implementation authorization, Preview evidence, and contract ratification are separate facts. The route may state that work is authorized. It may state that a protected Preview completed only when deployment evidence exists. It must always state that contract ratification is pending until a Founder receipt records otherwise.

## Ownership model

The frozen ownership registry is read as authority and is not amended. Each pathway carries:

- an owner reference;
- an owner maturity: registry-resolved, built dormant, proposed, future-owned, or owner-unresolved;
- registry evidence explaining the classification; and
- separate evidence, completion, review, visibility, correction, and appeal owner references.

An owner-unresolved pathway is non-operational. Proposed vocabulary may be displayed only with proposed maturity and no favorable operational implication. Growth Experience is the projection owner, not the owner of the projected fact.

## Positive decision architecture

The policy is a literal 7 × 10 table, not a blacklist. Each known pair contains one result and one written rationale. Every supported pair additionally carries its required owner state, required evidence state, allowed presentation behavior, prohibited inference, correction semantics, appeal semantics, and fail-closed result. Only an exact `SUPPORTED_SYNTHETIC_REVIEW` entry may render the supported synthetic path. `PROPOSED` remains visibly proposed. `OWNER_UNRESOLVED`, `UNSUPPORTED`, and `INVALID` fail closed.

The resolver accepts exactly one known contract and one known fixture, or the all-absent default orientation defined by the contract. Unknown keys, duplicate values, partial pairs, malformed arrays, conflicts, and impossible combinations return the generic invalid projection. Rejected text is never interpolated into UI copy.

Objects exposed by the contract module are deeply frozen. Resolution uses no time, randomness, browser state, database, network, model, or environment fallback.

## Semantic architecture

Eight separate lanes prevent status laundering: availability, preparation/participation, evidence, completion, source review, correction, appeal, and visibility.

The following laws are guard-pinned:

- Completion is not approval.
- Correction is not appeal.
- Submission is not acceptance.
- Supported is not authorized.
- Synthetic is not live.
- Visible is not public.
- Reviewable is not ratified.
- Evidence-present is not verified.
- Qualification is not eligibility.
- Proposed ownership is not canonical ownership.

Correction routes conceptually to the source-fact owner. Appeal requires an underlying review decision and a distinct future human-review authority. Nothing is filed, stored, routed, or resolved.

## Server production hard-off

The server-authoritative hosted identity is evaluated before all subordinate public flags and before stage import.

| Identity condition | Decision |
|---|---|
| Hosted production | deny |
| Hosted unknown, missing, malformed, or contradictory identity | deny |
| Hosted Preview with consistent server identity | eligible for subordinate gates |
| Local development | eligible for review tooling |
| Non-hosted local production verification | eligible only through the bounded local review override |

A client/public identity cannot authorize a server route. A manual review override cannot defeat hosted production or unknown hosted identity. The adversarial matrix covers absent, malformed, contradictory, and every flag combination.

## Interaction and history

Every contract or fixture change creates a browser-history entry. `popstate` re-resolves the URL through the same strict resolver; Back and Forward restore every changed pair deterministically without trusting serialized projection data.

Only one polite, atomic live region announces selection/history changes. Status panels and Kai output are not additional competing live regions.

## Kai architecture

The stage offers deterministic explanations authored inside the fixed contract. This is a route-local synthetic explanation mode of canonical Kai, not an independent Kai identity. It has no prompt, SDK, model, memory, source access, persistence, tool, action, or authority seam.

## Privacy architecture

The annex creates no Growth Experience-owned cookies, Web Storage, analytics, or telemetry. It reads only fixed allowlisted route selectors and button selections. Contract and fixture selectors are recorded in the URL and browser history solely to make Back and Forward reversible; they are not participant facts or private state. The annex contains no participant, customer, organization, PII, upload, free-text, source-record, identity lookup, or organization lookup.

The application shell may perform inherited authentication/session or theme behavior. Browser/network evidence separates those inherited requests from Growth-owned behavior and proves the annex has no write path.

## Presentation and accessibility

The persistent boundary disclosure sits outside any arrival mask so it is available on the first frame and after settlement. Evidence captures are taken only after arrival settles, with separate first-frame assertions.

Acceptance covers desktop, tablet, mobile portrait, compact landscape, dark mode, light mode, genuine reduced motion, 200% text reflow, zero horizontal overflow, keyboard/focus, native Back/Forward, and semantic distinctions. Human comprehension is never inferred from mechanical checks.

## Evidence model

Every claim uses one result: `PASS`, `FAIL`, `NOT RUN`, `NOT APPLICABLE`, or `BLOCKED`. Each `PASS` links to a preserved raw-evidence digest. Browser rows distinguish local optimized-build evidence from authenticated protected-Preview evidence. Human comprehension is labeled **NOT HUMAN-VALIDATED** unless a human test occurred.

The deployment bill of materials records baseline/candidate lineage, parentage, commit range, exact delta allowlist, Git binding, build identity, exclusions, artifact identity, protection, production-unchanged proof, and any platform HTML mutation. To avoid understating a full-app Next.js build, the closure hashes every tracked repository input at the candidate commit and separately labels the route-critical Phase 1A, Growth Foundation, review-shell, CXOS Runtime, Phase 1B-R, and build-configuration subset. Emitted build assets are bound by the preserved normalized build-output manifest and deployment identity.

## Deterministic Founder package

The immutable candidate commit is created and pushed before package generation. This avoids a package naming the SHA of a commit that contains the package itself.

The post-commit generator:

1. verifies branch, baseline, candidate, remote binding, and tracked cleanliness;
2. validates a package-safe structured evidence index;
3. generates eight non-manifest members;
4. generates a manifest containing hashes and sizes for those eight;
5. creates one flat deterministic nine-member ZIP;
6. builds twice and requires byte identity; and
7. publishes the ZIP hash externally to avoid recursive self-hashing.

Raw logs, screenshots, private deployment coordinates, and package-integrity sidecars remain outside the ZIP.

## Rollback

Retire the protected Preview and revert the bounded candidate commit. No database, participant, source, billing, payment, or economic state exists to reverse.
