# Tasks (active work queue)

Compact, current-only. Done items get deleted (history lives in git). Company backlog: `~/Documents/Gabriel-Capital-Labs-AIOS/BACKLOG.md` via `/gcl` — link, don't copy.

## Owner-blocked (surface at every session start)
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

## Engineering (next up)
- [ ] Regenerate favicon/PWA/OG from de-shadowed `logo-mark.png`
- [ ] Letters/upload server-prefetch — deliberately deferred until CX-1 conversational letter flow (restructuring those pages first avoids rework)
- [ ] Letters form htmlFor/id association pass (a11y, low)

Done in Wave 3 (2026-07-12): landing force-dynamic→middleware (/ is static now) · Sidebar/shell context fetches deduped via TTL'd module cache.

Verified already done (removed 2026-07-12): `List-Unsubscribe` + One-Click headers live in `lib/briefDigest.ts` · `*.tsbuildinfo` untracked & gitignored · `.env.example` updated (adds `CRON_SECRET`+`COMPANY_POSTAL_ADDRESS`; `SETUP_SECRET`/`STRIPE_PRICE_ID` are still live code paths, so kept with a delete-after-bootstrap warning instead of dropped).

## Candidate features (unscheduled)
- [ ] Brief stat/data cards · [ ] Brief admin image-upload (licensed/.gov only)
