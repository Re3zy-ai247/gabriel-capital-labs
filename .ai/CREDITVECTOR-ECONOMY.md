# CreditVector Professional Growth Economy — architecture

Status: **PROPOSED architecture over RATIFIED principles (ADR-0038).** No code, schema, migration, or policy values.
Authority: derives from [`ADR-0038`](ADR/ADR-0038-professional-growth-economy.md) (the law) + [`ADR-0037`](ADR/ADR-0037-operator-growth-constitution.md). **Governs relationships + fairness; it does NOT restate subsystem detail** — Vector XP mechanics live in [`VECTOR-XP.md`](VECTOR-XP.md), measurement in [`PERFORMANCE-INTELLIGENCE.md`](PERFORMANCE-INTELLIGENCE.md), scoring policy in [`ARENA-CONTRIBUTION-POLICY.md`](ARENA-CONTRIBUTION-POLICY.md). Cite, do not duplicate.

---

## 1. What this document owns
The **economic relationships and fairness laws** of the Professional Growth Economy: how evidence becomes recognition **fairly** (improvement over scale), how competitions/cohorts stay manipulation-resistant, how referral/affiliate/promotional instruments stay **separate** from reputation, how the marketplace unlocks without mutating XP, how the economy stays **explainable + appealable**, and the **economic threat model**. It owns **no** XP amounts, weights, or formulas (owner-gated).

## 2. Progression dimensions (canonical set — no weights)
Reconciles the vision's 10 candidates with `VECTOR-XP.md §7` (which already maps dimensions to Arena classes) and `PERFORMANCE-INTELLIGENCE.md`. Canonical set = **six earning dimensions** (VECTOR-XP owns the XP mapping) plus **two cross-cutting quality lenses** that modulate every dimension. Redundant candidates are folded, not multiplied.

| Dimension | Purpose | Qualifying evidence | Prohibited evidence | Primary abuse mode | Scale-bias risk | Verification authority |
|---|---|---|---|---|---|---|
| **Knowledge & Education** | learn credit/financial literacy, professional competence | durable Campus completion / assessment records | self-asserted "I read it"; client-controlled ticks | fake completions, answer-sharing | LOW (size-independent — a fairness *equalizer*) | Campus (durable completion record) |
| **Business Operations** | run credit work well | logged outcomes, workflow completion w/ evidence, SOP adherence | login/page-open; raw activity counts | fabricated outcomes/clients | HIGH (volume) — needs caps + improvement lens | Reputation policy over domain evidence |
| **Client Value** | verifiable value delivered to a client | evidenced favorable outcomes; consumer-consented confirmations | AI-classified self-attested text beyond the documented cap | fake clients/outcomes | MEDIUM | Reputation (evidence-owner attribution) |
| **Community Contribution** | strengthen the professional community | *accepted* answers, verified bug reports, moderation assists | message/reply counts; likes/bookmarks | collusion rings, spam farming | LOW | independent acceptor (not self/reciprocal) |
| **Education & Mentorship** | teach/mentor others | verified learner completion attributed to the teacher | self-asserted "I taught"; fake sessions | teacher–student collusion | LOW | independent completion evidence |
| **Business Growth** | grow a legitimate business | **independently verified** member/client activation, retention milestones | referral clicks, invite-sends, unpaid signups, self-referral | referral/account farms | HIGH — **capped so it can never dominate** | Reputation + verified-client signal (ADR-0038) |
| *lens:* **Operational Improvement** | reward getting better, not just being big | PI-measured percentage/goal gains over the org's own baseline (§3) | scale snapshots; single-window spikes | deliberate-degrade-then-recover (§3) | **inverts** scale bias | Performance Intelligence |
| *lens:* **Compliance & Evidence Quality** | keep evidence honest | provenance + completeness + compliance-clean signals | unverified/low-quality evidence | evidence fabrication | neutral | PI + compliance scrub |

**Rule (PGE-1):** a dimension that improves none of {knowledge, operations, community, verifiable client value} may not become a **primary** progression mechanism. Every prohibited-evidence entry above is already on the Arena prohibited-XP-sources list or the refusal register.

## 3. Improvement-measurement architecture (fairness = deterministic + un-gameable)
**Performance Intelligence MEASURES improvement; the Economy REWARDS it.** Improvement recognition is only fair if the measurement is deterministic and resistant to manufactured gains. Binding constraints (constitutional; formulas owner-gated):

- **Baseline + measurement windows are rolling and policy-versioned;** both, plus the policy version, are recorded on any improvement award (deterministic recalculation).
- **Minimum data sufficiency + minimum activity threshold** before improvement is scorable — kills small-denominator distortion (1→2 clients is not "+100%").
- **Best-prior-baseline comparison, not most-recent-trough.** Improvement is measured against the operator's *best sustained prior* state, so **deliberately degrading then recovering earns nothing** (the keystone improvement exploit). A **minimum healthy baseline floor** applies.
- **Sustained-performance requirement:** a transient spike does not qualify; improvement must hold across a rolling window (regression-to-the-mean and seasonal effects absorbed by the window length).
- **Cold-start / new-account:** new operators earn on **absolute** size-independent dimensions (knowledge, community, education) first; improvement scoring waits for sufficient baseline data (an **eligibility waiting period**).
- **Denominator honesty:** org growth, team-size change, and client-volume change during the comparison window are normalized or the comparison is voided (never silently rewarded as "improvement").
- **Changed SOP/KPI definitions void the cross-version comparison** (you cannot "improve" by redefining the metric).
- **Evidence-quality threshold + confidence/provenance** on every improvement award; **high-value awards require manual review**; **anomaly detection** flags implausible jumps for hold.

## 4. Business-size fairness controls (equal opportunity, not equal outcome)
PGE-2 in mechanism. Safeguards against large-agency dominance · incumbency · volume bias · wealth advantage · team-size · client-count · historic-data advantage · new-operator exclusion:
1. **Per-dimension weight floors** (ADR-0037/VECTOR-XP §6.1) so no single volume dimension can dominate total progression.
2. **Size-independent dimensions ship first** (education, community, mentorship) and are always earnable — the small-but-excellent operator's real path.
3. **Improvement lens** (§3) rewards percentage/goal gains, structurally favoring the improving small operator over the static large one.
4. **Cohorts** (§5) — recognition is compared within evidence-based brackets, never one global ladder dominated by the biggest.
5. **No pay-to-win:** money buys plan features, never XP/milestones/recognition (PGE-3).
6. **Absolute-scale is *measured and shown* but never the sole determinant** of progression or a public quality grade (PGE-2 + ADR-0037 §3 no-star).

## 5. Competitions & cohorts
Competitions (Arena presents; Reputation owns eligibility truth) may recognize **Most Improved · SOP Excellence · Client Engagement Growth · Education Champion · Community Builder · Innovation · Rookie Achievement · Mentor Contribution · Compliance Excellence · Operational Consistency · Verified Client Outcomes · Legitimate Agency Growth.** Constitutional constraints:
- **Never raw-totals-only** — every competition weights improvement/quality/evidence, not just absolute volume (PGE-2).
- **Evidence-based cohorts, manipulation-resistant:** new · solo · small · growth-stage · established · educators · marketplace creators · mentors. Cohort assignment is derived from **verified** signals (not self-declared), **stable** (an operator can't hop cohorts to farm the easier bracket — §9 threat), and re-evaluated on a slow cadence.
- **Opt-in** where cross-user visibility exists; all cross-user competitive surfaces stay under the **CROA §1679b / FTC §5** counsel STOP (Arena refusal register) until a display-consent record + CCO sign-off exist.
- **Anti-collusion:** competition awards inherit the XP anti-Sybil/collusion controls (VECTOR-XP §6/§6.1); multi-account and reciprocal boosting are detected and held.

## 6. Referral / affiliate / promotional-credits separation (ADR-0038 PGE-4)
- **Referrals** contribute to progression **only when independently verified** and **capped so they can never dominate** (ADR-0038; Arena already prohibits referral-clicks/invite-sends/unpaid-signups/self-acceptance). Referral policy must account for: **qualified** membership, payment validation, **refund/chargeback windows** (an award pends until the window clears), duplicate identities, self-/related-party referrals, account farms, circular referrals, low-quality acquisition, cancellation patterns, velocity, and lawful geo/device signals — with privacy + data-minimization.
- **Affiliate payouts** are **cash**, a **separate instrument with separate ownership** (commission policy · attribution · payment ledger · tax · refunds/chargebacks · recurring eligibility · fraud review · accounting · legal terms). **Reserved, not built, never combined with XP/reputation.**
- **Promotional credits** are **not introduced.** If ever reserved: a closed-loop, non-transferable, no-cash-redemption promotional instrument with its own ledger + terminology + legal/accounting review + expiration + liability treatment. **Vector XP is never a credit/coin/token/currency/balance (PGE-3).**

## 7. Marketplace economic boundaries
Marketplace access may be conditioned on milestones · certifications · entitlements · identity verification · organization status · compliance approval · product-specific eligibility. **Marketplace consumes entitlements; it NEVER mutates XP** (PGE-4). No credit-related inventory (templates/SOPs/coaching) publishes without CROA/CCO content screening equivalent to the letter/Kai bar + a facilitator-liability position + seller terms/indemnity (ADR-0037 §5). Marketplace owns inventory; Reputation owns the entitlement that gates it; neither owns the other.

## 8. Explainability & appeal (PGE-5)
An operator can see: what action qualified · which policy + **version** applied · why XP was awarded **or denied** · why a milestone was reached · why an entitlement is available · why a claim is unavailable · whether an award is **pending review** · how to **appeal** an error · which evidence was considered · which privacy restrictions limit disclosure. Safeguards against **hidden scoring · arbitrary ranking · discriminatory proxies · business-size/geography/disability/schedule/wealth bias · pay-to-win · unexplainable Kai recommendations · permanent punishment from an erroneous fraud classification** (a fraud hold is **appealable and reversible**, never a silent permanent ban). No unsupported legal claims are made anywhere in the economy surface. Fairness, accessibility, privacy, consumer-protection, and counsel review are **owner gates**.

## 9. Economic threat model
Builds on the XP-specific controls in [`VECTOR-XP.md §6/§6.1`](VECTOR-XP.md) (XP farming, Sybil, collusion, fake clients, admin mint, replay, outcome-flip, mutable-balance — **already documented; cross-referenced, not repeated**). This table covers the **new economic surfaces** (improvement, competitions/cohorts, referral/affiliate, refunds, insider/policy). Severity is the residual after the stated preventive control.

| Threat | Attack / precondition | Benefit | Preventive control | Corrective + audit | Owner gate | Residual |
|---|---|---|---|---|---|---|
| **Deliberate-degradation improvement farming** | tank KPIs, then "recover" to mint Most-Improved | competition/XP recognition | **best-prior-baseline** + minimum healthy baseline floor + sustained-window (§3) | anomaly hold; invalidation record | improvement formula + floor values | **MEDIUM→LOW** |
| **Small-denominator improvement distortion** | 1→2 of anything = "+100%" | inflated improvement | minimum data sufficiency + activity threshold (§3) | void comparison | thresholds | LOW |
| **Cohort-hopping / size-misclassification** | self-present as "new/solo" to farm the easy bracket | cohort competition wins | cohorts from **verified** signals, stable, slow re-eval (§5) | reclassify + reverse; audit | cohort criteria | MEDIUM |
| **Referral farming across refund/chargeback** | refer, get award, then cancel/refund | referral XP + affiliate cash | award **pends** until refund/chargeback window clears; verified-qualified only; velocity/dup caps (§6) | claw back on refund; append compensating record | referral qualification window | MEDIUM |
| **Affiliate ↔ reputation cross-crediting** | try to convert cash affiliate activity into XP or vice-versa | launder pay-to-win | **PGE-4 separation** — distinct ledgers, no conversion path exists by construction | n/a (no path) | affiliate ledger design | LOW |
| **Fake marketplace assets / fake mentorship** | list a low-value/plagiarized asset or stage fake mentoring for milestone | Marketplace-Creator / Mentor recognition | acceptance authority + CROA/CCO content screen (§7); independent learner-completion for mentorship (§2) | delist + reverse milestone; audit | screening + approval authority | MEDIUM |
| **KPI/SOP checkbox theater feeding the economy** | mark SOP steps done without doing them → health/maturity → recognition | maturity/health recognition | PI input-integrity + **evidence-not-tick** + outcome>activity (PERFORMANCE-INTELLIGENCE §2.1/§3A) | correct + re-derive | SOP evidence rules | MEDIUM |
| **Insider / admin economic abuse** | admin mints XP, grants an entitlement, or edits a threshold | arbitrary economic value | **maker-checker + magnitude cap** on manual awards; server-authoritative issuance; append-only audit (VECTOR-XP §6.1) | reverse; audit trail; separation of duties | maker-checker design | MEDIUM |
| **Retroactive / rollback policy manipulation** | change weights and re-apply to history, or roll a policy back to re-mint | mass re-award / erasure | **forward-only re-weights**; issued awards immutable; recompute only via governed compensating records (VECTOR-XP §5.1) | recompute audit | policy-governance sign-off | LOW |
| **Erasure vs immutable ledger (privacy)** | data-subject erasure over an append-only economic ledger | compliance conflict | tombstone/crypto-shred identity join; retain pseudonymous PII-free rows (VECTOR-XP §6.1) | documented CCO position | privacy/CCO | MEDIUM |
| **Identity/profile fraud entering the economy** | impersonation or unverified credentials → recognition | false trust/marketplace access | identity precedes reputation (OG-3); verification state on every credential; CROA screen on profile free-text (OPERATOR-IDENTITY §5b) | suspend; reverse; audit | identity verification | MEDIUM |

**No BLOCKER at the architecture layer** given these controls; every residual is bounded by an owner gate and the fact that the entire economy is dormant behind fail-closed flags. XP-layer BLOCKER (award idempotency) was already fixed in VECTOR-XP §5.1.

## 10. Status & gates
PROPOSED architecture over RATIFIED principles. No code/schema/migration/flag/weight. Every policy value (weights, caps, windows, referral/affiliate qualification, fraud thresholds), every public cross-user surface, and every legal/accounting/tax/liability question is **owner + counsel gated** (ADR-0038 §6). Dependency order and gates in [`ROADMAP.md`](ROADMAP.md).
