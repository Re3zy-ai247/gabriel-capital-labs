# CXOS Living Environment Engine RC1 — Validation Report

**Report date:** 2026-08-01

**Local candidate status:** **ACCEPTED WITH DISCLOSED CAVEATS**

**Delivery status:** **PRODUCTION HARD-OFF VERIFIED · PROTECTED PREVIEW VERIFIED**

This report records the local, review-enabled validation of the isolated CXOS Living Environment Engine RC1 candidate. It is not production authorization, a merge approval, or evidence of a production deployment.

Truth labels used below:

- **VERIFIED** — directly supported by the bound source revision, emitted build artifacts, browser ledger, screenshots, or recorded command result.
- **DISCLOSED CAVEAT** — a known limitation, inherited local condition, or measurement boundary that remains visible in the evidence.
- **DELIVERY VERIFIED** — independently confirmed against the external protected Preview and its exact Git metadata.

## 1. Identity and evidence binding

| Item | Bound value | Status |
| --- | --- | --- |
| Candidate branch | `feat/cxos-living-environment-engine-rc1` | VERIFIED |
| Candidate source revision | `188aa78cf60d1565a35ac20710724dc7e1e32724` | VERIFIED |
| Approved RC5 baseline revision | `29260fddfc59d71e3d963d2ec791657ea57084af` | VERIFIED |
| Candidate optimized build ID | `iO4wrRp0PmFrLQpR176tX` | VERIFIED |
| Candidate route | `/review/agency-command` | VERIFIED |
| Candidate render mode | static prerender with `/review/agency-command.rsc` | VERIFIED |
| Review build mode | `NEXT_PUBLIC_CXOS_REVIEW=1 npx next build` from clean committed HEAD | VERIFIED |

The final candidate browser ledger declares the candidate source revision above. The optimized review build was produced after that revision was committed, with tracked source clean and Git HEAD at the same revision.

### Evidence integrity

| Artifact | SHA-256 | Status |
| --- | --- | --- |
| `CXOS_LIVING_ENVIRONMENT_ENGINE_RC1_EVIDENCE/candidate/candidate-build-metrics.json` | `a09d95d0b4fa43ca723b94ca2263295c7f54e1026d9a890d0e3c520f430c1542` | VERIFIED |
| `CXOS_LIVING_ENVIRONMENT_ENGINE_RC1_EVIDENCE/candidate/final/candidate-final-browser-evidence.json` | `4a07581e10c7f23464a52e36c273499c3c8e8dcfdb7e901d33d34f609c7a9477` | VERIFIED |
| `scripts/cxos-living-environment/browser.mjs` | `317652c96c4d06112c2f2e7334d4b1ee69a6ac31473b7fc921f49d25d9ebbea6` | VERIFIED |

All 18 candidate PNG captures exist and have 18 distinct SHA-256 values. The evidence set includes deterministic settled views for every chamber plus the required responsive, reduced-motion, constrained, reflow, and JavaScript-disabled projections.

## 2. Toolchain and measurement contract

| Tool | Version or identity |
| --- | --- |
| Next.js | `14.2.18` |
| Node.js used for build metrics | `v26.3.0` |
| zlib used for gzip metrics | `1.2.12`, level 9, no filename header |
| Playwright | `1.62.0` |
| Browser | Chromium `151.0.7922.72` |
| Axe | `4.12.1` |
| Browser evidence schema | `5` |
| Build-metrics schema | `2.1.0` |

Raw sizes are exact file lengths. Gzip sizes are reproducible zlib level-9 measurements. Digests are SHA-256 over exact bytes. Candidate source CSS and baseline source CSS were measured from their committed Git blobs. Route ownership was calculated from exact references across `app-build-manifest.json` route entries.

The browser harness assigns events to non-overlapping phases by invocation, execution, or performance-entry start time. Only explicitly marked cumulative fields are cumulative. Request bodies, response bodies, cookie values, and storage values are not recorded.

The candidate and baseline `package.json` and lockfile hashes are identical:

- `package.json`: `fd78b398d3356905e9c72b36a7eb591433f998a2c1b51433f360fea4bcb25edd`
- `package-lock.json`: `bf7f8abc9146b72d5b281aad40c13a2f7ea1259342a3e779af950f8c9b61b8c9`

No package delta is part of this candidate.

## 3. Previously passed static validation

The following checks were previously run against this candidate and passed:

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| Touched-file ESLint | PASS |
| PostCSS parse | PASS |
| `git diff --check` | PASS |
| `scripts/cxos-living-environment.test.ts` | 35/35 PASS |
| `scripts/cxos-agency-command.test.ts` | 185/185 PASS |
| `scripts/cxos-core-runtime.test.ts` | 76/76 PASS |
| `scripts/cxos-isolated-review.test.ts` | 25/25 PASS |
| `scripts/schema-safety.test.ts` | 17/17 PASS |
| `scripts/network-authz.test.ts` | 36/36 PASS |
| `scripts/eventbus-authz-isolation.test.ts` | 43/43 PASS |
| `scripts/session-security.test.ts` | 11/11 PASS |
| Letter/compliance guards | PASS |
| `scripts/cxos-living-environment/handoff.mjs self-test` | PASS, including 7 negative controls |
| Clean committed-HEAD optimized review build | PASS |

**DISCLOSED CAVEAT — full-repository lint:** the full lint run retains four inherited findings outside this candidate's scoped validation: one agency hook-dependency warning, one unescaped apostrophe in GXL, one unescaped apostrophe in letters, and one missing-rule-definition finding in `lib/pdf`. Touched-file ESLint passed.

## 4. Exact RC5 bundle comparison

| Surface | RC5 raw | Candidate raw | Raw delta | RC5 gzip | Candidate gzip | Gzip delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Route-owned client assets | 293,661 | 324,471 | +30,810 | 54,594 | 60,514 | +5,920 |
| Route-owned JavaScript | 118,198 | 127,418 | +9,220 | 30,152 | 32,639 | +2,487 |
| All route-manifest JavaScript | 418,778 | 427,998 | +9,220 | 117,385 | 119,872 | +2,487 |
| Route-owned emitted CSS | 175,463 | 197,053 | +21,590 | 24,442 | 27,875 | +3,433 |
| Source CSS | 159,925 | 181,755 | +21,830 | 25,056 | 28,988 | +3,932 |
| Shared first-load JavaScript | 300,580 | 300,580 | 0 | 87,233 | 87,233 | 0 |
| All route-manifest client assets | 594,241 | 625,051 | +30,810 | 141,827 | 147,747 | +5,920 |
| Server route JavaScript | 109,428 | 119,627 | +10,199 | 28,832 | 31,504 | +2,672 |

### Budget decisions

| Budget | Measured increment | Limit | Headroom | Result |
| --- | ---: | ---: | ---: | --- |
| All incremental route-manifest client JavaScript, gzip | 2,487 B | 15,360 B | 12,873 B | PASS |
| Route-owned emitted CSS, raw | 21,590 B | 24,576 B | 2,986 B | PASS |
| Source CSS, raw | 21,830 B | 24,576 B | 2,746 B | PASS |

The authoritative JavaScript budget is applied to all JavaScript referenced by the route manifest. Shared first-load JavaScript is byte-identical to RC5, so the all-manifest and route-owned JavaScript deltas are the same in this build.

## 5. Browser acceptance matrix

The strict candidate ledger passed **10/10 browser cases**, **17/17 coverage gates**, and recorded **0 findings and 0 observations** across **152 measured candidate states**. The preserved RC5 baseline contains 149 measured states and 134 missing-feature observations; its status is a captured missing-feature ledger, not an accepted candidate.

| Case | CSS viewport | Mode and input | Result |
| --- | --- | --- | --- |
| Desktop large | 1728×1000 | full, natural arrival, keyboard, replay | PASS |
| Desktop | 1440×900 | full, Escape arrival, keyboard, 3 measured cycles, resize/lifecycle/departure | PASS |
| Tablet | 1024×768 | smoke, skipped arrival, keyboard | PASS |
| Mobile | 390×844 | full, coarse pointer, touch | PASS |
| Mobile 360 | 360×800 | smoke, coarse pointer, touch | PASS |
| Mobile narrow | 320×800 | smoke, coarse pointer, touch | PASS |
| Landscape | 740×390 | smoke, coarse pointer, touch | PASS |
| Reduced motion | 1440×900 | full, natural arrival, keyboard | PASS |
| Constrained capability | 1024×768 | smoke, natural arrival, keyboard | PASS |
| 200% reflow model | 720×450 at device scale factor 2; 1440×900 physical surface | smoke, skipped arrival, keyboard | PASS |

The 17 passing coverage gates cover viewport completeness, the reflow model, arrival paths, keyboard and touch activation, inspection close/focus restoration, Kai presentation states, lifecycle, history/resize/departure, trusted BFCache, seven chamber screenshots, repeated cycles, animation ledgers, native scroll-linked choreography, target sizing, network-failure ledgers, detailed Axe evidence, and JavaScript-disabled completeness.

## 6. Scroll-linked choreography proof

**VERIFIED — one Tier-A Client Operations probe:**

- Visible animated subject matched the `ViewTimeline` subject.
- Timeline source matched the document scroller.
- Timeline type was `ViewTimeline`; duration was nonzero at `83.9997%`.
- The probe traversed 801 CSS pixels of real document scroll, from `scrollY=0` to `scrollY=801`.
- Computed progress changed from `0.1677158385` to `0.5917742723`, a delta of `0.4240584338`.
- Animation current time changed by `35.6207787876` percentage points.
- Rendered horizontal translation changed by `6.78494px`.
- Endpoint response, rendered-transform response, genuine ViewTimeline identity, and nonzero duration all passed.

Across the complete ledger, all three eligible Living Environment profiles recorded nonzero ViewTimeline instances: Client Operations, Evidence Archive, and Growth Threshold. The dedicated endpoint proof is one Client Operations desktop-large sample and should not be generalized as an exhaustive endpoint traversal of every profile.

## 7. Motion, idle, and performance

### Motion ownership and boundedness

- All 152 animation-budget snapshots passed: Tier A 60, Tier B 60, Tier C 9, and Tier D 23.
- The maximum running environmental animation count was 2, matching the Tier-A ceiling.
- Every quiet or static projection recorded zero running environmental animations and zero declared running channels.
- Hidden phases recorded zero environmental animations, zero running channels, and zero rAF callbacks.
- Visible phases resumed only the capability-appropriate bounded motion; reduced motion remained static.
- Desktop-large, desktop, and mobile idle sequences settled to zero environmental motion and then recorded zero rAF callbacks in `idle:quiescence`.
- Reduced motion recorded zero rAF callbacks and zero environmental motion in both static idle and quiescence.

### Layout stability, animation frames, and Long Tasks

- CLS was exactly 0 in every phase and every cumulative case ledger.
- The final ledger contains 30 Long Animation Frame entries: 21 first-party-unattributed, 4 inherited-framework, 2 candidate-owned, and 3 mixed.
- Five entries are candidate-owned or mixed:

| Case and phase | Ownership | Duration | Blocking duration |
| --- | --- | ---: | ---: |
| Desktop large · Kai Suite | candidate-owned | 275.5 ms | 0 ms |
| Tablet · navigation | mixed, framework plus unattributed | 59.0 ms | 0 ms |
| Mobile narrow · skipped arrival | mixed, candidate plus unattributed | 60.3 ms | 0 ms |
| Landscape · skipped arrival | mixed, candidate plus unattributed | 113.5 ms | 51.9 ms |
| Constrained · natural arrival | candidate-owned | 66.7 ms | 0 ms |

- The landscape mixed frame is the only candidate/mixed entry with nonzero blocking duration and is retained as a performance caveat.
- Ten Long Tasks were observed; all were classified first-party-unattributed, with a maximum duration of 109 ms. No Long Task was classified candidate-owned.
- The candidate-specific criterion of no repeated application-attributable Long Tasks passed. This is not a claim that the local browser run contained zero Long Tasks.

## 8. Accessibility, targets, reflow, and JavaScript-off

### Axe and targeted contrast review

- Axe recorded 248 passing rule-case instances and zero violations.
- Axe also recorded 10 serious `color-contrast` incomplete rule cases covering 511 nodes. Gradients and pseudo-elements prevented automated background resolution, so these are explicitly retained for manual review and are not reclassified as automated passes.
- Targeted manual sampling measured the formerly failing 12px desktop sample at approximately 8.27:1.
- Conservative representative high-light samples measured approximately Central 9.09:1, Clients 9.25:1, Team 9.36:1, Health 7.01:1, Evidence 8.69:1, Kai 9.62:1, and Growth 5.65:1. Every sampled ratio exceeds 4.5:1.
- **DISCLOSED CAVEAT:** targeted sampling closes the known contrast defect but is not an exhaustive per-node contrast ledger for all 511 Axe-incomplete nodes.

### Targets and obstruction sampling

- 141 visible enabled targets were measured; all met the 44px minimum.
- The minimum measured dimensions were 58.63×44 CSS pixels.
- 63 in-viewport center-point obstruction hit tests produced zero obstruction failures.
- **DISCLOSED CAVEAT:** mobile, mobile-360, mobile-narrow, landscape, and reflow recorded zero center-point obstruction samples because no measured target center qualified as in-viewport at the sampled state. Successful touch flows, target sizes, and screenshot review mitigate this gap, but “zero obstruction failures” is not comprehensive for those five cases.

### Reflow and JavaScript-disabled document

- The reflow case used a 720×450 CSS viewport at device scale factor 2, yielding a 1440×900 physical surface. It did not change the root font size.
- The JavaScript-disabled document retained all seven districts and nine expected headings, recorded zero horizontal overflow, and completed without a capture error.

No physical-device, assistive-technology, or screen-reader test is claimed by this report. Mobile and tablet results are automated browser emulation.

## 9. Lifecycle, history, and BFCache

- Hidden and visible lifecycle projections passed the motion-pause and capability-appropriate resume checks.
- Synthetic visibility and synthetic persisted page events are recorded with `isTrusted=false`; they are diagnostic only and are not used as BFCache proof.
- Inspection toggle-close, Escape-close, and focus restoration passed.
- Browser history back/forward behavior, active-chamber/hash restoration, responsive projection, bounded departure, and return focus passed their coverage gate.
- One real desktop `history.back()` traversal provided trusted BFCache proof: the document identifier was reused, trusted `pagehide.persisted=true` and `pageshow.persisted=true` events were recorded, the Growth Threshold path was preserved, and the CDP not-used ledger was empty.
- **DISCLOSED CAVEAT:** trusted BFCache evidence is one desktop traversal, not a cross-viewport BFCache matrix.

## 10. Network, console, and persistence observations

Candidate and baseline each recorded 293 requests. Candidate results:

| Observation | Count | Ownership and disposition |
| --- | ---: | --- |
| HTTP 200 responses | 269 | expected local responses |
| HTTP 500 responses | 24 | inherited NextAuth session failures |
| Browser-level request failures | 0 | none |
| Candidate-owned HTTP failures | 0 | none |
| External requests | 0 | none recorded |
| Console errors | 39 | all inherited-framework; associated with local NextAuth failures |
| Page errors | 0 | none |
| Recorded persistence events | 9 | inherited NextAuth `nextauth.message` localStorage `setItem` events |
| Candidate-owned persistence events | 0 | none |

The 24 inherited HTTP 500 responses, 39 inherited console errors, and 9 inherited storage events are disclosed local-auth noise. They are not silently removed from the evidence. No request or response body and no storage value was captured.

## 11. Exact caveats and authorization boundary

The local candidate has no remaining implementation P0/P1 finding in the final strict ledger. The following limitations remain explicit:

1. Axe leaves 511 serious color-contrast nodes incomplete; targeted manual samples pass, but sampling is not exhaustive.
2. Five responsive cases recorded no center-point obstruction samples, so the zero-obstruction result is not comprehensive for those cases.
3. One landscape mixed Long Animation Frame measured 113.5 ms with 51.9 ms blocking; four other candidate/mixed frames had zero blocking.
4. Ten Long Tasks occurred and were first-party-unattributed; none was candidate-owned.
5. Local NextAuth noise remains visible: 24 inherited HTTP 500 responses, 39 inherited console errors, and 9 inherited storage writes.
6. Trusted BFCache proof covers one desktop traversal.
7. Full-repository lint retains the four inherited findings listed in Section 3.
8. Testing used automated Chromium. No physical-device, assistive-technology, or screen-reader validation is claimed.

This assignment does not authorize a merge to `main`, production deployment or promotion, production alias change, database action, migration, schema change, auth change, billing change, force-push, or activation of another CXOS room.

## 12. Production-identity hard-off

**Status: VERIFIED**

The exact source revision was rebuilt from a clean `.next` directory with the server and
public Vercel environment identities set to `production` while
`NEXT_PUBLIC_CXOS_REVIEW=1` deliberately contradicted that identity. The optimized build
completed with build ID `lHw-8Tsk0ZhXJNjvlRrAE`. Local HTTP GET probes carrying all three
activation parameters returned 404 for `/review`, `/review/agency-command`, and
`/review/mission-control` (3/3 expected denials). The proof ledger SHA-256 is
`89c5fff44755756c12413f65f5c19cc699ac92a13a2edae9135ed56241bd1907`.

This was a local production-identity build and response probe only. It created no
production deployment, alias, project-setting change, environment-variable change, or
database action.

## 13. Protected Preview

**Status: VERIFIED**

Vercel’s exact `githubCommitSha` metadata filter returns one Ready Preview for delivery
commit `b2ba206aade2d41aa7b718fdb3c352bbc27edb59`. The product runtime files in that
delivery commit are unchanged from browser-bound implementation source
`188aa78cf60d1565a35ac20710724dc7e1e32724`; only documentation, curated evidence,
and the handoff scanner follow it.

An anonymous request to `/review/agency-command?director=1` returns a 302 Vercel SSO
redirect with `no-store` and `x-robots-tag: noindex`, exposing no candidate content. An
authenticated protection-aware GET returns 200, matches `/review/agency-command`,
reports release header `b2ba206aade2`, carries `x-robots-tag: noindex`, and renders
`noindex, nofollow` metadata. The Preview has one branch alias and no production alias.
The existing production target remains Ready and four days old with its aliases
unchanged. Sanitized proof SHA-256:
`2cc53e9db3cfe174b59dba0d50ccf8da0e8a8359b9bf530662e29a0eb0e3cd0d`.

The private Preview hostname is intentionally omitted from this offline report and is
delivered through the authenticated handoff channel.

## 14. Local validation decision

**LOCAL RC1 DECISION: ACCEPTED WITH DISCLOSED CAVEATS.**

The candidate is exact-source-bound locally, passes its static and scoped guard suite, stays within every declared incremental bundle budget, passes all 10 strict browser cases and all 17 coverage gates, proves functional native scroll-linked choreography, preserves deterministic reduced/static projections, records zero candidate findings or observations, fails closed under a contradictory production identity, and is served from an exact-commit-bound protected Preview. It is ready for Founder review with the disclosed caveats. It is not approved for production integration by this report.
