# CXOS Agency RC5 — Integration File Matrix

**Repository:** gabriel-capital-labs  
**Base:** f449c35d0eca9463c15e86f8cbd4cd7f4e948d03  
**Source evidence:** 29260fddfc59d71e3d963d2ec791657ea57084af  
**Current strategy:** STRATEGY C — hold integration and correct conflicts first  
**Post-blocker construction:** reconstruct a new clean patch from current main  
**Maximum proposed integration allowlist:** 25 paths  
**Default exclusion:** CXOS_LANGUAGE_1_0.html

Status meanings:

- **KEEP EXACT:** preserve the RC5 blob unless a guard-only adjustment is explicitly named.
- **RECONSTRUCT:** rebuild the hunk on current main; do not copy the RC5 file wholesale.
- **KEEP BOUNDED:** include only for the protected review prerequisite and preserve its boundary.
- **EXCLUDE:** do not include in the product integration commit.

## Exact transitive matrix

| # | Path | Main state | Classification | Integration action | Reason / boundary |
|---:|---|---|---|---|---|
| 1 | .ai/ADR/ADR-0040-cxos-core-runtime.md | New in RC5 | Governance | RECONSTRUCT | Ratify RC5 approval, dormant exposure, stronger review gate, security/performance gates; remove RC1-pending wording |
| 2 | .ai/CURRENT-STATE.md | Exists on main | Governance, mixed file | RECONSTRUCT | Append only current RC5 readiness truth; preserve every unrelated current-main entry |
| 3 | .ai/DECISIONS.md | Exists on main | Governance, mixed file | RECONSTRUCT | Record Founder experience approval separately from integration/production authority |
| 4 | .ai/INDEX.md | Exists on main | Governance index, mixed file | RECONSTRUCT | Add only the final ADR/language routes; preserve current routing |
| 5 | CXOS_FOUNDATION.md | New in RC5 | Canonical CXOS governance | KEEP BOUNDED | Keep the approved ownership/runtime language; reconcile status labels if they still say pending/RC1 |
| 6 | CXOS_LANGUAGE_1_0.html | New in RC5 | Derived documentation | EXCLUDE | Duplicates the canonical Markdown and is not runtime-required; regenerate outside product commit only if repository policy later requires it |
| 7 | CXOS_LANGUAGE_1_0.md | New in RC5 | Canonical CXOS language | KEEP BOUNDED | Preserve approved chamber/heartbeat/runtime law; reconcile approval/status wording only |
| 8 | app/globals.css | Exists on main | Shared production CSS | RECONSTRUCT | Apply only the required 25-line motion-token hunk; verify names/usages; never replace the file |
| 9 | app/review/agency-command/agency-command.module.css | New in RC5 | Agency production-candidate presentation | KEEP EXACT | Founder-approved RC5 spatial composition, responsive tiers, zero-CLS geometry, in-flow Director |
| 10 | app/review/agency-command/fixtures.ts | New in RC5 | Synthetic fixture-only | KEEP EXACT | Protected review only; every value invented; never a live adapter or customer truth source |
| 11 | app/review/agency-command/page.tsx | New in RC5 | Protected review route | RECONSTRUCT | Preserve stage selection, but align with the hardened server/layout gate and current RC5 identity |
| 12 | app/review/agency-command/stage.tsx | New in RC5 | Agency production-candidate composition | KEEP EXACT | Founder-approved seven-chamber semantics, Kai resolver, Director, arrival/departure, history/focus |
| 13 | app/review/layout.tsx | New in RC5 | Review security boundary | RECONSTRUCT | Retain noindex; add server-authoritative unknown-host fail-closed and recommended layout-level notFound |
| 14 | app/review/mission-control/page.tsx | New in RC5 | Protected review prerequisite | KEEP BOUNDED | Preserve return destination; inherit the corrected layout gate; do not expose as live Mission Control |
| 15 | app/review/mission-control/stage.tsx | New in RC5 | Protected review prerequisite | KEEP BOUNDED | Preserve return behavior only; timing copy remains synthetic/review-only and must not become live advice |
| 16 | app/review/page.tsx | New in RC5 | Protected review hub | RECONSTRUCT | Replace stale “RC1” title/status with current RC5 candidate truth; remain protected and unlinked |
| 17 | components/cxos/mission/CommandHeader.tsx | New in RC5 | Mission Control review prerequisite | KEEP BOUNDED | Review destination dependency only; no broader Mission Control migration |
| 18 | components/cxos/mission/MissionEntry.tsx | New in RC5 | Mission Control review prerequisite | KEEP BOUNDED | Retain forceReview so sessionStorage write is suppressed; do not claim this component is storage-free outside review |
| 19 | components/cxos/runtime/useCxosRoomRuntime.ts | New in RC5 | Reusable CXOS runtime | KEEP EXACT | Approved deterministic presentation lifecycle, chamber targeting, focus/history projection |
| 20 | lib/cxos/capability.ts | New in RC5 | Review presentation prerequisite | KEEP BOUNDED | Read-only capability projection; localStorage read is not authorization and must not become one |
| 21 | lib/cxos/reviewMode.ts | New in RC5 | Review security boundary | RECONSTRUCT | Use one pure server-authoritative policy; fail closed on production, hosted development, missing/malformed hosted identity, or contradictory public identity |
| 22 | lib/cxos/rooms.ts | New in RC5 | Protected review registry | RECONSTRUCT | Preserve only Agency and Mission Control entries; update stale phase/RC1 wording; no dead room links |
| 23 | lib/cxos/runtime.ts | New in RC5 | Reusable CXOS runtime | KEEP EXACT | Presentation-only contract; no facts, effects, network, persistence, identity, or authorization |
| 24 | scripts/cxos-agency-command.test.ts | New in RC5 | Test/guard | RECONSTRUCT | Preserve RC5 assertions and add exact corrected review/exposure/performance contract as appropriate |
| 25 | scripts/cxos-core-runtime.test.ts | New in RC5 | Test/guard | KEEP EXACT | Preserve the exact RC5 runtime ownership and zero-write contract |
| 26 | scripts/cxos-isolated-review.test.ts | New in RC5 | Test/guard | RECONSTRUCT | Add adversarial hosted-identity matrix, layout hard-off, noindex, route scope, and exact allowlist assertions |

## Included exact-product blobs

The following approved blobs should remain byte-identical to RC5 unless the protected integration Preview exposes a reproducible defect:

- app/review/agency-command/agency-command.module.css
- app/review/agency-command/fixtures.ts
- app/review/agency-command/stage.tsx
- components/cxos/runtime/useCxosRoomRuntime.ts
- lib/cxos/runtime.ts

These five paths define the approved Agency spatial experience and Core Runtime behavior. Do not substitute older versions from feat/cxos-phase3 or the Growth Experience branch.

## Included bounded review prerequisites

- app/review/mission-control/page.tsx
- app/review/mission-control/stage.tsx
- components/cxos/mission/CommandHeader.tsx
- components/cxos/mission/MissionEntry.tsx
- lib/cxos/capability.ts

They exist only to support the protected review return flow. They do not authorize a Mission Control migration, live customer route, persistence, or capability-based authorization.

## Required reconstructed paths

- .ai/ADR/ADR-0040-cxos-core-runtime.md
- .ai/CURRENT-STATE.md
- .ai/DECISIONS.md
- .ai/INDEX.md
- app/globals.css
- app/review/agency-command/page.tsx
- app/review/layout.tsx
- app/review/page.tsx
- lib/cxos/reviewMode.ts
- lib/cxos/rooms.ts
- scripts/cxos-agency-command.test.ts
- scripts/cxos-isolated-review.test.ts

The governance and gate files must be reconstructed from current main and final approved truth. The tests may change only to prove the corrected contract.

## Excluded source and history

Exclude all of the following:

- CXOS_LANGUAGE_1_0.html from the product integration commit;
- every report, handoff, evidence directory, screenshot, manifest, ZIP, and local browser artifact;
- .agents, .claude, agent infrastructure, and private tool state;
- feat/cxos-phase3 commits and files not in this matrix;
- Growth Network, Growth Center, Community, Marketplace, Arena, GIOS, HELIOS, and parallel-stream modifications;
- package.json, package-lock.json, yarn.lock, pnpm-lock.yaml;
- prisma/schema.prisma and prisma/migrations;
- auth, session, middleware, billing, Stripe, API, backend, environment, and Vercel configuration changes;
- database, telemetry, model, task, calendar, notification, customer, and billing adapters.

## Parallel-branch collision matrix

| Lineage | Relation to main | RC5 overlap | Decision |
|---|---:|---:|---|
| feat/cxos-phase3 | 63 commits ahead | Historical source for older rooms | Never merge or cherry-pick wholesale |
| Growth Experience remediation RC1, b913e50 | 67 commits ahead | 25/26 paths; 18 differ | Do not merge; independently reconstruct only the stricter review-gate contract |
| Current origin/main | Exact RC5 base | 4 existing/mixed paths | Surgical hunk integration |

## Live versus dormant truth

| Candidate material | Dormant integration | Live activation |
|---|---|---|
| Core Runtime presentation contract | Eligible after corrections | May be reused |
| Agency stage/CSS architecture | Eligible after corrections | Requires separate authenticated adapter |
| Synthetic fixtures | Protected review only | Prohibited as live truth |
| Kai deterministic resolver | Protected review only | Requires canonical server/compliance path |
| Review Mission Control | Protected review only | Must not replace /dashboard |
| /review route | Protected Preview; production hard-off | Never the customer route |
| /agency | Unchanged | Existing live entry remains authoritative |

## Final matrix decision

The exact RC5 product/runtime content remains usable, but the integration unit is not the five-commit RC history and not the raw 26-file tree. The executable production-integration candidate is a newly reconstructed maximum 25-path patch with exact approved blobs, surgically reconciled governance and review gating, no derived HTML duplicate, no historical contamination, and no live activation.
