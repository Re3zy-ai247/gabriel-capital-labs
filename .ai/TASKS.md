# Tasks (active work queue)

Compact, current-only. Done items get deleted (history lives in git). Company backlog: `~/Documents/Gabriel-Capital-Labs-AIOS/BACKLOG.md` via `/gcl` — link, don't copy.

## Owner-blocked (surface at every session start)
- [ ] **Founder decision (Low, from XXV release):** Kai's title is now split — CreditVector product role = "**Credit** Intelligence Officer" (CVOS/KAI-OS/landing/KAI-INTELLIGENCE), company-level brand-IP character = "**Chief** Intelligence Officer of the room he's standing in" (`creative/` + `BRAND-UNIVERSE.md`, founder-locked ADR-0008). Decide whether these coexist by design or should unify; unifying the creative canon needs an explicit founder decision + ADR (do NOT edit the frozen Kai IP without it).
- [ ] Decide: upgrade Vercel to Pro (~$20/mo) to enable Skew Protection (eliminates stale-tab 500s across deploys; checklist in `OPERATIONS.md`)
- [ ] Set `COMPANY_POSTAL_ADDRESS` in Vercel prod → digest test → verify (CAN-SPAM gate)
- [ ] Run `/api/admin/encrypt-letters` backfill (admin console, one-time, idempotent); confirm `/api/admin/encrypt-reports` was run
- [ ] Counsel: CROA positioning sign-off · news-editorial posture before first auto-drafted publish
- [ ] Stripe: enable Customer emails → Successful payments; merchant-notification email
- [ ] Owner test: Brief comment flow (banned phrase → 422; report → moderate)
- [ ] MDG verify: Re-analyze a report (also backfills furnisher addresses)

## Sprint XII — Kai Campaign Intelligence (shipped to working tree, ADR-0012)
- [ ] **CCO/counsel review** the consumer-facing campaign copy + the frivolous-or-irrelevant framing before pushing (compliance-review gate) — every warning is category-tagged (law/policy/recommendation); confirm the §611(a)(3) citation + "not a headcount" framing is acceptable.
- [ ] Backlog: admin policy-editor UI for `CampaignPolicy` (today: `CAMPAIGN_POLICY` env override + version stamped into each snapshot = audit history).
- [ ] Backlog: agency per-client Campaign Command view (the composer + store are already per-client-isolated; this is a surfacing task).
- [ ] Backlog (Low, from Sprint XII adversarial review, MAIL_LIVE off): concurrency hardening — `attachLetterForQueue` find→create and `nextSequence` read-then-write can, on a double-clicked/retried confirm, mint a duplicate single-item campaign or a duplicate per-user sequence number. Add a `(userId,sequence)` unique constraint + an idempotency key (letterId) so the auto-campaign create is exactly-once. Mail double-queue is already prevented by the MailManifest optimistic audit-length guard.
- [ ] Backlog (Low): a multi-CRA bureau `CampaignItem` records only the first per-CRA `letterId`/`queued` flag (every per-CRA letter still passes the gate via `snapshotCovers`; only the item↔letters tracking is partial). Model item→letters as one-to-many if per-CRA queue tracking is needed.

## Sprint XIII — Mission Control (shipped to working tree, ADR-0013)
- [ ] Backlog (Low, from the 5-review pass): export the live-campaign status set from the campaign engine and reuse it in `lib/missionControl.ts` (currently duplicated) · dedupe `getMissionControl` row reads (tradelines/letters fetched by several reused engines per dashboard load; Accelerate bills per query) · the single next step renders in three framings (mission row / Next Action hero / Command Center tile) — deliberate, revisit if it reads redundant · the "view" link in the Waiting-on list is <44px (a11y polish).

## Sprint XIV — Verified Outcome Ledger (shipped to working tree, ADR-0014)
- [ ] Fast-follow: surface own verified-outcome history in `recommendationIntel` + `forecast` panels (tradelines/letters), not just Mission Control — pass `ownOutcomeTrack` in and add a gate-free own-history line via `ownTrackLine`.
- [ ] When the CCO opens `consumerDisplayApproved`: point the cross-user aggregation at `ledgerCorpus` (the durable, provenance-tagged source) and retire the dormant Letters-based `buildOutcomeCorpus`.

## Sprint XV — Credit Intelligence Platform (shipped to working tree, ADR-0015)
- [ ] Follow-up: unify `getMissionControl` onto the platform `loadSnapshot` so the dashboard loads the case once (today it calls both — overlapping userId-scoped reads). Makes Mission Control thinner, per the platform principle.
- [ ] Future modules (Funding Hub, Credit Builder, Business Credit, Monitoring, Mobile, AI API) MUST consume `@/lib/intelligence` — never compute their own intelligence.

## Sprint XVI — Financial Mission Engine (shipped to working tree, ADR-0016)
- [ ] Follow-up: fold Mission Control's own Today's-Mission task list into the Mission Engine queue so the dashboard has one ranked source (they currently overlap — the engine's #1 == Mission Control's next action by construction, but consolidating removes the redundancy).
- [ ] Future modules (Credit Builder, Funding Hub, Business Credit, Monitoring, Mobile, API) plug into `financialMission` — never build their own queue/priority.

## Sprint XVII — Financial Roadmap Engine (shipped to working tree, ADR-0017)
- [ ] Future modules (Credit Builder, Funding Hub, Business Credit, Monitoring, Mobile, API) consume `financialRoadmap` for the journey view — never build their own roadmap/stage logic.

## Sprint XVIII — Credit Builder OS (shipped to working tree, ADR-0018)
- [x] Closed the CVI double-load: the dashboard now calls `loadSnapshot` once and `assembleIntelligence(snap)` (was `creditIntelligence` + a separate CVI load) — CVI/Mission/Roadmap/Builder all share the one snapshot. (getMissionControl still loads its own rows — folding it onto the snapshot remains the open half of that follow-up.)
- [ ] Future modules (Funding Hub, Business Credit, Monitoring, Mobile, API) consume `builderOS` — never build their own builder recommendations.

## Sprint XIX — Knowledge Graph (shipped to working tree, ADR-0019)
- [ ] The dashboard now runs 3 load paths (getMissionControl, loadSnapshot, financialGraph) — tradelines/letters are read by more than one. Consider a single link-row load shared across snapshot + graph to shave queries (perf, not correctness).
- [ ] Future modules consume `financialGraph` / `neighbors` for relationship lookups — never re-derive edges.

## Engineering (next up)
- [ ] Regenerate favicon/PWA/OG from de-shadowed `logo-mark.png`
- [ ] Letters/upload server-prefetch — deliberately deferred until CX-1 conversational letter flow (restructuring those pages first avoids rework)
- [ ] Letters form htmlFor/id association pass (a11y, low)

Done in Wave 3 (2026-07-12): landing force-dynamic→middleware (/ is static now) · Sidebar/shell context fetches deduped via TTL'd module cache.

Verified already done (removed 2026-07-12): `List-Unsubscribe` + One-Click headers live in `lib/briefDigest.ts` · `*.tsbuildinfo` untracked & gitignored · `.env.example` updated (adds `CRON_SECRET`+`COMPANY_POSTAL_ADDRESS`; `SETUP_SECRET`/`STRIPE_PRICE_ID` are still live code paths, so kept with a delete-after-bootstrap warning instead of dropped).

## Sprint XX — Execution Engine (committed to `sprint-xx-execution-engine`, ADR-0020; PREVIEW-ONLY, UNMERGED)
- [x] Preview-deploy mechanism chosen (owner: push-branch → auto-preview). Branch `sprint-xx-execution-engine` pushed to origin; **Vercel Preview LIVE, owner-SSO-protected:** https://gabriel-capital-labs-amuchhnzf-rey-gabriel-s-projects.vercel.app (Ready; view logged into Vercel).
- [x] **RELEASED 2026-07-15** (founder-approved): `main` ff `a4e1204`→`691a72e`→`4c88cbc`; prod deploy `3psaf0xsl` Ready; route checks pass; MAIL_LIVE OFF. Sprints XII–XX now LIVE. See CURRENT-STATE release record.
- [ ] **Founder: eyeball the authenticated click-through in prod** (Recommendation→…→Execution Queue) — Claude can't log in / can't fabricate test data; engine integration proven by 26 guards + build + live `/api/execution` 401.
- [ ] **Product decision (from ADR-0020):** the Executive Queue currently AUGMENTS the per-module views (MissionQueue/Roadmap/Builder/Knowledge/Command remain below as drill-downs). Decide whether to fully retire those into the queue ("replace scattered recommendations") or keep them as expandable detail. Reversible either way.
- [ ] Backlog (Low, CCO hygiene — non-blocking, from the compliance GO): "strengthens the file over time" phrasing (`ExecutionPriority.ts` builder tier reason + `ExecutionRisk.ts` builder ifIgnored) — optionally reword to "the habits that build strong credit" (general mechanism, never a personalized outcome). Consistent with the already-approved Builder OS framing.
- [ ] Backlog (Low): the ladder rungs `waiting_creditor` / `funding_dependency` / `mortgage_dependency` have no mission `type` mapped to them yet (they exist for future missions); wire them when those mission types ship so the queue orders them explicitly rather than via the `outcome_dependency` fallback.

## Sprint XXI — Founder Polish & Intelligence (branch `sprint-xxi-founder-polish` `c9396e2`, ADR-0021; PREVIEW-ONLY, UNMERGED)
- [ ] **Founder: review the Preview + authed click-through, then approve merge.** Preview (owner-SSO): https://gabriel-capital-labs-7yw6xk4qp-rey-gabriel-s-projects.vercel.app · `main`/prod untouched · MAIL_LIVE OFF.
- [x] Phase 1 Letter Intelligence (recipient-differentiated, CCO GO) · Phase 2 Credit Builder page + educational planners · Phase 3 Academy · Phase 4 Readiness→Executive Queue · nav restored. Guards 28/28.
- [ ] **Sprint XXII (deferred, founder-scoped):** comprehensive every-page copy/CTA polish + landing/pricing/onboarding audit; IA regrouping (CORE/INTELLIGENCE/ACCOUNT); **dashboard slimming** (Builder + Knowledge now have dedicated pages → the dashboard could drop the inline BuilderView/KnowledgeJourney and link to the pages, reducing the wall-of-widgets — needs founder OK as a visible change); Kai platform-wide positioning + a canonical pricing/entitlement matrix.
- [ ] Backlog (Low): Letter precision — direct-furnisher dispute cites §1681s-2(b) (full duty attaches on CRA notice; direct disputes run via §1681s-2(a)(8)/Reg V) — add a precision note; `cfpb_threat` strategy could force the regulatory-tone closing regardless of round.
- [ ] Backlog: when a future report upload provides limits/statement dates, the Builder educational planners (utilization/payment-timing/statement-dates) auto-upgrade to data-driven — wire the data path when available.

## Candidate features (unscheduled)
- [ ] Brief stat/data cards · [ ] Brief admin image-upload (licensed/.gov only)
