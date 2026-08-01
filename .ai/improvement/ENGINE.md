# Autonomous Improvement Engine

Standing process that turns observation into prioritized work. Proposing is 🟢 autonomous; implementing follows normal gates. Output flows to: `../TASKS.md` (repo-level) or the AIOS backlog as G-NN (company-level). Constitution guard: max 3 improvement proposals per task session (Constitution §Continuous improvement); this engine is the ONE place broader sweeps happen.

## The standing questions (run each on a monthly sweep, or when evidence surfaces)
| # | Question | Evidence source today |
|---|---|---|
| 1 | What do users struggle with? | support tickets, community threads, comment patterns (manual read — BI-SUP-01) |
| 2 | What features are unused? | ❌ blocked on BI-FEAT-01 instrumentation |
| 3 | What bugs repeat? | support queue + git history |
| 4 | What documentation drifted? | `.ai/` last-verified dates vs code; INDEX audit |
| 5 | What integrations fail? | Stripe event deliveries, Resend logs, cron 503s |
| 6 | What code duplicates? | grep sweeps during eng sessions (e.g. G-14's overview/stats dupe — found this way) |
| 7 | Which AI providers/models perform best? | guard scripts + manual review; formal evals PROPOSED |
| 8 | What pages convert? | ❌ blocked on BI-REV-02/BI-MKT-04 |
| 9 | What content/videos perform? | Brief views/likes (BI-MKT-03); social ❌ until channels launch |
| 10 | What APIs/AI cost too much? | ❌ blocked on BI-COST-01 (top unblock) |
| 11 | Where are tokens wasted (session efficiency)? | session self-audit — startup-set size, reread counts |

## Current prioritized opportunities (2026-07-12 — evidence-based, deduped against TASKS/backlog)
| Pri | Opportunity | Why now | Route |
|---|---|---|---|
| P0 | Close launch gates: integrate and delivery-test resolved G-01 legal footer · verify encryption backfills · obtain G-02 counsel | source fact resolved; production/counsel evidence still gates launch | AIOS backlog (open) |
| P1 | BI-COST-01 AI-cost instrumentation | can't manage AI margin blind; pre-scale | new task (CAIO) |
| P1 | G-14 real MRR + overview/stats dedupe | truthful revenue reporting; known duplication | AIOS backlog (open) |
| P2 | BI-FEAT-01 usage events (privacy-clean) | unblocks questions 2, 8; retention truth | new task (CPO, needs CSO/CCO pass) |
| P2 | Stale-support-ticket + cron-failure alerting | reuses existing alert plumbing; cheap ops win | new task (COO) |
| P3 | Doc-drift audit automation (last-verified sweep) | keeps CVIOS honest as it grows | new task (CTO) |

## Cadence
Monthly full sweep (all 11 questions) → refresh this table → top item becomes a proposed task. Ad-hoc: any session may append an evidence-backed row (no vague hunches — Constitution Art. II).
