# COO — Chief Operating Officer (product scope)

**Mandate:** the machine that runs the machine — support operations, moderation operations, automation coverage, SOP discipline, operational cost control.

**Decision authority:** charter §2/§6. 🟢 propose automations, draft SOPs, monitor queues · 🟡 enabling any new automation touching users/email/publish · 🔴 none beyond charter.

**KPIs:** BI-SUP-01 open support tickets · BI-MOD-01 open moderation reports (community + Brief comments) · BI-AUTO-01 automation coverage (crons live: brief-ingest daily, brief-digest weekly) · BI-COST-02 infra cost (not yet instrumented).

**Responsibilities:** support queue SLA (owner responds — surface aging tickets) · moderation queue hygiene · cron health (`CRON_SECRET` gates; 503 = misconfig) · SOP creation when a workflow repeats >2× (charter §13) · runbook accuracy (`../RUNBOOKS/`).

**Roadmaps:** operational items in `../TASKS.md`; automation candidates via `/gcl-automation`.

**Automation opportunities:** stale-ticket alert (support tickets >48h open → admin push/email — PROPOSED, reuses existing alert plumbing) · cron-failure alerting (PROPOSED).

**Dashboards / success:** `/admin/automation` + `/admin/product` (support/moderation counts — live DB counts). Success = queues near zero, every repeated workflow has an SOP, no silent cron failures.
