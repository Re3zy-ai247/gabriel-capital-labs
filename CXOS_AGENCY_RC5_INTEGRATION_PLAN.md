# CXOS Agency RC5 — Executable Integration Plan

**Plan status:** HOLD — INTEGRATION BLOCKED  
**Execution status:** NOT AUTHORIZED  
**Chosen method:** STRATEGY C — hold integration and correct conflicts first  
**Readiness baseline:** f449c35d0eca9463c15e86f8cbd4cd7f4e948d03  
**Approved source evidence:** 29260fddfc59d71e3d963d2ec791657ea57084af

This plan is executable only after separate Founder authorization. It does not authorize a branch push, Preview, merge, production deployment, alias change, dependency change, environment change, database action, or customer activation.

## 1. Preconditions

All preconditions are hard gates.

| Gate | Required state |
|---|---|
| Founder experience decision | RC5 experience remains approved |
| Integration authority | Separate explicit authorization received |
| Dependency-security lane | Applicable Next.js and NextAuth blockers remediated and validated under separate authority |
| Remote truth | Fresh origin/main and RC5 remote SHAs verified |
| Main drift | If origin/main differs from the readiness baseline, rerun delta and conflict analysis |
| Worktree | New clean isolated worktree; never the dirty feat/cxos-phase3 worktree |
| Package/schema/config | No unapproved changes |
| Company legal identity | `COMPANY_POSTAL_ADDRESS — RESOLVED BY FOUNDER`; keep the separate identity correction outside the RC5 allowlist unless explicitly included in a future integration authorization; production deployment/test remains unverified |
| Production authority | Not implied by integration or Preview approval |

Because a push to main auto-deploys this repository, merge authority and production-deployment authority must be explicit and coordinated. A dormant feature state does not make an unauthorized main push safe.

## 2. Exact branch and base

Proposed branch:

    review/cxos-agency-rc5-production-integration-rc1

Procedure:

    git fetch --prune origin
    git rev-parse origin/main
    git rev-parse origin/review/cxos-agency-spatial-chambers-rc5
    git merge-base origin/main origin/review/cxos-agency-spatial-chambers-rc5

Expected readiness values:

- origin/main: f449c35d0eca9463c15e86f8cbd4cd7f4e948d03
- RC5: 29260fddfc59d71e3d963d2ec791657ea57084af
- merge base: f449c35d0eca9463c15e86f8cbd4cd7f4e948d03

If origin/main has changed, stop. Recreate the worktree from the new SHA and rerun the complete file, semantic, dependency, guard, build, and browser delta. Do not rebase a partially reconstructed candidate onto unknown drift.

## 3. Construction order

### Phase A — exact approved implementation

Restore only these exact RC5 blobs:

- app/review/agency-command/agency-command.module.css
- app/review/agency-command/fixtures.ts
- app/review/agency-command/stage.tsx
- components/cxos/runtime/useCxosRoomRuntime.ts
- lib/cxos/runtime.ts

Confirm their blob identity against RC5 before further edits.

### Phase B — bounded review prerequisites

Restore and preserve the stated review-only boundary for:

- app/review/mission-control/page.tsx
- app/review/mission-control/stage.tsx
- components/cxos/mission/CommandHeader.tsx
- components/cxos/mission/MissionEntry.tsx
- lib/cxos/capability.ts

Required assertions:

- Mission Control is only the protected review return destination.
- forceReview suppresses MissionEntry sessionStorage writes.
- capability projection does not authorize anything.
- no live Mission Control migration occurs.

### Phase C — hardened review gate

Reconstruct:

- lib/cxos/reviewMode.ts
- app/review/layout.tsx
- app/review/agency-command/page.tsx
- app/review/page.tsx
- lib/cxos/rooms.ts

Required gate contract:

1. The server-authoritative hosted identity is the only Preview grant.
2. Hosted production, hosted development, missing identity, malformed identity, and contradictory public identity fail closed.
3. Production /review uses a layout-level notFound boundary; individual pages retain a defensive check.
4. Preview remains behind Vercel Authentication.
5. Review routes remain noindex/nofollow and unlinked from the public product.
6. Local production review is allowed only by the established non-hosted test override.
7. The hub and registry say RC5, not RC1, and list only Agency and the required Mission Control destination.

Do not copy the Growth branch. Reconstruct and test the policy independently.

### Phase D — shared CSS

Apply only the required 25-line app/globals.css motion-token hunk. Confirm:

- every token is used by the approved RC5 surface;
- names do not collide with current main;
- no existing value is replaced;
- no unrelated global selector changes;
- zero layout shift and zero overflow remain.

### Phase E — governance

Integrate:

- .ai/ADR/ADR-0040-cxos-core-runtime.md
- .ai/CURRENT-STATE.md
- .ai/DECISIONS.md
- .ai/INDEX.md
- CXOS_FOUNDATION.md
- CXOS_LANGUAGE_1_0.md

Governance must state:

- Founder experience approval is final for RC5;
- production-integration readiness is “hold — integration blocked” until the named gates clear;
- merge and production authority are still absent;
- customer activation remains off;
- Core Runtime owns presentation lifecycle only;
- Agency owns facts, semantics, composition, fixtures, Kai intent, and routes;
- review hard-off, security, performance, compliance, and live-adapter gates remain;
- the historical feature branch must not be merged wholesale.

Exclude CXOS_LANGUAGE_1_0.html from the product commit by default.

### Phase F — guards

Integrate:

- scripts/cxos-agency-command.test.ts
- scripts/cxos-core-runtime.test.ts
- scripts/cxos-isolated-review.test.ts

Preserve scripts/cxos-core-runtime.test.ts exactly. Surgically update only the Agency and isolated-review guards where the corrected review/gating contract requires it.

Add or preserve assertions for:

- exact 25-path maximum allowlist;
- pure runtime/no ownership expansion;
- production hard-off and adversarial hosted-identity matrix;
- no live Agency, API, database, auth, billing, or environment import;
- review hub/registry limited to Agency and Mission Control;
- synthetic fixture disclosures and no-action receipts;
- forceReview storage suppression;
- no dependency/schema/migration changes;
- one visible chamber, stable first-frame geometry, focus/history behavior;
- no derived report/evidence/agent files.

## 4. Prohibited inputs

Do not merge, rebase from, or cherry-pick:

- feat/cxos-phase3;
- RC1, RC2, RC3, RC4, or RC5 as whole commits;
- origin/review/growth-experience-phase-1b-remediation-rc1;
- any Growth Center, Growth Network, Community, Marketplace, Arena, GIOS, or HELIOS stream;
- any report, handoff, evidence directory, screenshot, manifest, ZIP, or agent-infrastructure path.

Do not modify:

- package.json or a lockfile;
- Prisma schema or migrations;
- auth, session, middleware, billing, Stripe, APIs, or backend;
- environment values or Vercel configuration;
- database or customer data;
- live /agency behavior;
- production aliases.

## 5. Validation order

Stop on the first failure.

### Layer 1 — repository identity

- fresh origin/main and RC5 SHA;
- merge base;
- clean worktree;
- exact file allowlist;
- no untracked file staged;
- package/lock/schema/migration/auth/billing/config identity;
- git diff --check.

### Layer 2 — static engineering

    npm run typecheck

Run touched-file ESLint, then:

    npx tsx scripts/cxos-core-runtime.test.ts
    npx tsx scripts/cxos-agency-command.test.ts
    npx tsx scripts/cxos-isolated-review.test.ts

Run the relevant Mission Control, authorization, identity, event, network, attachment, session, capability, compliance, and schema-safety guards.

### Layer 3 — builds

1. Optimized review-enabled build.
2. Optimized production-identity build with the public review override deliberately present.
3. Probe /review, /review/agency-command, and /review/mission-control.

Expected production result: fail-closed server response with no review stage, no synthetic room text, and no public authorization path.

### Layer 4 — browser and accessibility

Test:

- 1728 × 1000;
- 1440 × 900;
- 1024 × 768;
- 390 × 844;
- 360 × 800;
- 320 × 800;
- 740 × 390;
- practical 200% text reflow.

Required:

- natural, Skip, Escape, and replay arrival;
- 7 chambers × required projections;
- exact hash and H2 focus;
- one visible chamber and one rendered aria-current location;
- browser Back and Forward;
- Director and inspection-plane Escape;
- Mission Control return, scroll zero, route-local Kai clearing, Back restoration;
- Tier C static behavior;
- genuine Tier D reduced motion;
- no-JavaScript full seven-district fallback;
- dark theme;
- visible 44 px controls;
- zero horizontal overflow;
- zero Axe violations in sampled states;
- CLS 0.

### Layer 5 — performance

Use a quiet, repeatable run on the exact optimized candidate:

1. fresh browser/context;
2. cold natural arrival;
3. one complete warm-up traversal;
4. at least three measured seven-chamber cycles;
5. settled idle window;
6. task attribution to first-party bundle, style/layout, browser, or external source.

Go criteria:

- no repeated application-attributable task above 50 ms;
- no continuous requestAnimationFrame measurement/animation loop;
- no forced-layout loop;
- settled idle has zero long tasks;
- CLS remains 0;
- transition duration remains bounded and no focus/scroll regression appears.

The current fresh run failed the repeated cold-arrival task criterion. The integration Preview must resolve the contradiction before merge authorization.

### Layer 6 — network and writes

Instrument fetch, XHR, beacon, Storage mutations, cookies, and route transitions.

Required Agency/Core Runtime result:

- zero runtime-owned fetch/XHR/beacon;
- zero localStorage/sessionStorage/cookie write;
- zero API/database/customer/task/calendar/billing/model/telemetry action;
- navigation requests classified separately;
- app-shell auth traffic reported separately and never attributed to CXOS.

### Layer 7 — compliance and security

- dormant integration CCO gate;
- synthetic fixture exclusion;
- Kai no-action/no-model boundary;
- production-hard-off security gate;
- applicable dependency advisories cleared;
- no app-level Review authorization assumption;
- Vercel Authentication verified independently.

## 6. Candidate commit policy

After every gate passes, create one bounded candidate commit:

    feat(cxos): reconstruct agency headquarters rc5 dormant candidate

The commit must:

- have the then-current origin/main as its sole parent;
- contain at most the 25 allowed paths;
- contain no reporting artifacts;
- contain no dependency/schema/environment/config drift;
- preserve exact approved blobs;
- include only the reconstructed governance/gate corrections;
- leave customer activation off.

Do not amend RC5. Do not force-push.

## 7. Protected Preview sequence

Only after separate push/Preview authorization:

1. Push only review/cxos-agency-rc5-production-integration-rc1.
2. Verify remote SHA equals the candidate commit.
3. Deploy Vercel Preview only.
4. Verify target is preview and Deployment Protection is enabled.
5. Verify no production alias is attached.
6. Verify deployment logs identify the exact candidate SHA.
7. Run authenticated review-route validation.
8. Run anonymous 302/protection check.
9. Run production-identity build hard-off check.
10. Record deployment ID, URL, branch SHA, build SHA, guard/build/browser ledgers.

Preview approval means only “the isolated integration candidate is reviewable.” It is not a merge or production-integration approval.

## 8. Merge authorization

After all corrections and Preview validation, request this separate Founder decision:

    AUTHORIZE CXOS AGENCY RC5 DORMANT INTEGRATION CANDIDATE MERGE AND
    PRODUCTION DEPLOYMENT — CUSTOMER ACTIVATION REMAINS OFF.

If authorization is granted:

- refresh origin/main;
- if main drifted, stop and revalidate;
- use the repository’s protected PR/merge process;
- squash to the one bounded integration commit;
- do not merge RC history;
- coordinate the main push with explicit production-deployment authority;
- verify production hard-off immediately after deployment.

If authorization is absent or narrower: do not merge and do not deploy.

## 9. Production activation state

After any authorized dormant integration:

- live /agency remains unchanged;
- no new navigation entry;
- no live Agency Headquarters route;
- /review remains production hard-off;
- synthetic fixtures remain protected;
- no real-data, Kai-model, calendar, task, customer, billing, or telemetry adapter;
- no database/schema/environment change.

Live Agency Headquarters requires a new product-adaptation authorization and its own architecture, security, compliance, accessibility, and release gates.

## 10. Rollback

### Before main

- close or abandon the candidate branch/Preview;
- no production rollback.

### After an authorized merge/deployment

1. Revert the single integration commit.
2. Validate the revert.
3. Under separate production authority, redeploy/restore the known-good deployment at f449c35 if required.
4. Verify the production release header and all aliases.
5. Confirm /agency behavior, billing/auth, schema, database, and review hard-off.

No data migration rollback is expected because no schema or data change is allowed.

## 11. Go / No-Go checklist

| Gate | Current state |
|---|---|
| Founder RC5 experience approval | GO |
| Lineage and clean reconstruction | GO |
| Current-main textual compatibility | GO |
| Exact product/runtime ownership | GO |
| Stale governance correction | NO-GO until reconstructed |
| Strong server review hard-off | NO-GO until reconciled |
| Dependency-security lane | NO-GO before production deployment |
| Repeatable cold-arrival performance | NO-GO until contradiction resolves |
| Protected integration Preview | NOT AUTHORIZED / NOT RUN |
| Merge | NOT AUTHORIZED |
| Production deployment | NOT AUTHORIZED |
| Customer activation | NO-GO / separate phase |

## 12. Final plan decision

# HOLD — INTEGRATION BLOCKED

The next action is to clear the dependency, performance-attribution, governance, and review-gate blockers under separate authority. Only then should a clean current-main reconstruction begin. Do not merge RC history. Stop after the protected integration Preview and request separate Founder merge/production authority.
