# Compliance Review — Phase 1A-R (Founder Experience Remediation)

**Reviewer:** CreditVector CCO (internal gate — not legal advice, not outside counsel) · **Scope:** Phase 1A-R diffs (`7750cba`, `ec8ad41`, `fd15988`, `18f0ea2`), RB-2 determination behavior, all new/modified user-facing language, the four standing docket items · **Date:** 2026-08-04
**Method:** rulebook-anchored CCO pass over a verbatim evidence inventory (Sonnet), adversarially challenged by one narrow Opus review that confirmed 9 dispositions, refined 4, and found 1 missed defect — every challenge finding re-verified against source by the coordinator before adoption.

---

## 1. Executive CCO Verdict: **CORRECTIONS REQUIRED**

Six enumerated corrections — one HIGH logic defect, four Medium copy lines, one Low gate — then this review converts to **APPROVED WITH DISCLOSURES** with no re-review needed beyond the targeted guards. **Zero Critical findings. Zero items require outside counsel.** Nothing found threatens the educational/not-a-CRO posture, the CROA bar, or Stripe standing; the money-path and billing language were re-confirmed clean.

**2. Merge blocker: YES** — until the correction slice lands on this branch.
**3. Deployment blocker: YES** — same slice; nothing additional beyond it.

The correction slice is bounded (~6 lines of copy/logic + 2 guard extensions) and is **not authorized yet** — per your stop conditions, no application code was modified in this review. Authorization request is at §7.

---

## 4. Compliance Matrix

Severity: per the CCO rulebook (Critical/High/Medium/Low). Basis key: LAW = legal requirement · BP = compliance best practice · CLARITY = product clarity · RISK = conservative risk reduction.

| # | Item | Classification | Severity / Basis | Blocks merge / deploy |
|---|---|---|---|---|
| M1 | **kaiHome branch-5 selector ignores the RB-2 fact test** — `lib/kaiHome.ts:217-223` filters only `!resolved && !disputedIds`; no `isFactualNegative`, no `NOT_RECOMMENDED` exclusion. A first-time user with a clean (or government-debt) top-scored account is told **"{Creditor} is flagged on your file"** + "Start with this item" → the letter builder — an affirmative false statement about their file plus inducement to dispute accurate data, on the highest-traffic surface, while the Strategy Desk says "Nothing to dispute" on every row. FTC §5 deception / UDAAP / FCRA §611(a)(3) frivolous-dispute exposure. *(Found by the Opus challenge; missed by my draft and by RB-2's slice.)* | **LOGIC CORRECTION REQUIRED** | **HIGH** / LAW+RISK | **YES / YES** |
| M2 | **New Phase 1A-R band string is mailing-anchored** — `lib/mailCenter.ts:522` "…review, download, and mail **to start the §611 clock**." compresses to "mailing starts the clock," violating the product's own ratified receipt-anchor law. | **COPY CORRECTION REQUIRED** | Medium / LAW-adjacent (FCRA process accuracy) + BP | **YES / YES** |
| M3 | **Three legacy mailing-anchored lines** — `lib/kaiSeen.ts:34`, `app/journey/page.tsx:105`, `:144` ("— §611 clock started" upon mailing). Same false statement, same regime, same direction (anti-conservative: implies the clock started earlier than it did). Blocking status identical to M2 on risk, not provenance. | **COPY CORRECTION REQUIRED** | Medium / LAW-adjacent + BP | **YES / YES** (same slice) |
| M4 | **Guard gap** — `scripts/mail-download.test.ts`'s §611 static is a phrase-specific list that read the very file and missed M2. Extending it with another literal reproduces the failure. | **LOGIC CORRECTION REQUIRED** (guard) | Medium / RISK | **YES / YES** (same slice) |
| M5 | **conflictLines on clean rows** — `app/tradelines/page.tsx:280-285` "…that's the dispute angle." renders inside the `hasDetail` block Phase 1A-R deliberately preserved for clean rows (this branch *increased* its reachability). Same-screen tension with "nothing to dispute." | **COPY CORRECTION REQUIRED** (one-line `!clean` gate) | Low / CLARITY+RISK | **YES / YES** (same slice — our own doing) |
| M6 | **"(soon)" fulfillment line** (6 sites, verbatim-identical) — conditional, non-purchase-driving, and it *is* the required evidence-asymmetry disclosure. | **APPROVED WITH DISCLOSURE** — Founder owns a timing-claim maintenance duty: revisit the "(soon)" if fulfillment slips materially | Low / FTC §5 substantiation | No / No |
| M7 | **Dormant "queued for CreditVector to mail" labels** — `lib/operatorSession.ts:244` AND `lib/kaiSeen.ts:38` (second site found in challenge). Unreachable while live mailing is off (send wizard hard-gates before queue). Would misstate the service if reachable. | **APPROVED WITH DISCLOSURE** — both labels ride the LetterStream/MAIL_LIVE activation review (already a standing gate; that review also owns the genuine counsel question of CRO posture when CreditVector performs mailing) | Low / RISK | No / No |
| M8 | **"dispute-priority score N/100"** — `lib/kaiHome.ts:233` basis line. Clearly labeled, deterministic, provenance-serving; approved **as to wording only** (its selector is M1). | **APPROVED** (optional post-launch rename to "priority") | Low / CLARITY | No / No |
| M9 | **RB-2 determination logic** — `isFactualNegative` (derogatory type OR real DOFD), applied at counts, staging, and per-item surfaces. Materially improves CROA/FTC posture: accurate clean accounts are never counted, staged, or framed dispute-ready. | **APPROVED** | — / LAW+RISK improvement | No / No |
| M10 | **Clean-state strings** — "Clean" · "Nothing to dispute" · "Account in good standing — no derogatory history on file." · "Status" · "Bureau detail". Receipt-backed, anti-overreach, register-consistent. | **APPROVED** | — | No / No |
| M11 | **Chase-style case** (late history, currently positive, real DOFD → counted an "active negative", dispute-framed). The derogatory ITEM genuinely exists on file and is score-suppressing; no removal/outcome claim is made; a consumer is not induced into a transaction they'd otherwise avoid. Residual exposure correctly identified as FCRA §611(a)(3) frivolous-dispute risk (mitigated: dispute framing on such items targets *inaccuracy*, and the item is real data). Challenge note adopted: "active negative" is NOT defensible as a term-of-art meaning "unresolved presence" — a reasonable consumer reads "currently delinquent" — the claim survives because the underlying derogatory data is true. | **APPROVED WITH DISCLOSURE** — wording refinement **scheduled** (not indefinite): counter label toward "negative items on file" idiom, post-launch batch. **No outside counsel required.** | Medium→Low / LAW analysis + CLARITY | No / No |
| M12 | **Strategy Desk H/M/L tiles + per-row score bubble on clean rows** — `app/strategist/page.tsx:19-24` tallies raw probability bands; `:69` renders the nonzero `{t.score}` bubble beside the "Clean" pill. Inconsistent with the row's own "Nothing to dispute"; not a dark pattern (no induced action, no obscured cost). | **OUT OF SCOPE / POST-LAUNCH** with disclosure — fold both (tiles + bubble) into the scheduled M11 wording batch | Low / CLARITY | No / No |
| M13 | **RB-4 behavior** — render-time sender substitution on unmailed only; mailed letters verbatim (record integrity); stored row/preview never mutated; warnings at every chain surface; **no new AI surface bypasses `lib/compliance.ts`** (`updateOne` routes through the same `composeLetter` → `applyCompliance`). | **APPROVED** | — / LAW (scrubber law) | No / No |
| M14 | **RB-5 behavior** — operator-local calendar date; ±14h shift-then-floor tolerance; UTC-noon storage; ≤1-day over-acceptance on a self-attested date; §611 figures remain labeled estimates. Recordkeeping: the stored value is the consumer's own attestation, deterministically anchored. | **APPROVED** (historical rows → Decision A) | — | No / No |
| M15 | **RB-6 behavior + copy** — idempotent regenerate; "Regenerate Letter (updates your draft)" accurate; **zero billing/credit claims** anywhere in the new copy; cancel-campaign two-step plain language (anti-dark-pattern); 402 message unchanged with a narrower, truer trigger; quota line unchanged and accurate. | **APPROVED** (optional post-launch clarity: quota line could note a regenerate uses no allowance — that is a billing claim, so route it through this gate if added) | — | No / No |

---

## 5. The Correction Slice (exact, awaiting authorization)

1. **M1 (HIGH, logic):** `lib/kaiHome.ts` branch-5 filter adds `isFactualNegative(t)` and excludes `probability === "NOT_RECOMMENDED"`; new guard case in `kai-recommendation.test.ts`: a clean-only file yields **no** dispute recommendation (and a government-debt-topped file never proposes it).
2. **M2 (copy):** `lib/mailCenter.ts:522` → "Generated, not mailed yet — review, download, and mail; the §611 clock starts once the bureau receives it."
3. **M3 (copy ×3):** `lib/kaiSeen.ts:34`, `app/journey/page.tsx:105`, `:144` → mirror `lib/operatorSession.ts:225-230`'s receipt-anchored phrasing ("— the §611 clock starts once the bureau receives it").
4. **M4 (guard):** extend the §611 static from a phrase list to a general negative pattern (any §611/clock reference co-located with mail/mailed/mailing language lacking receipt anchoring), asserted against the current sources.
5. **M5 (copy gate):** `app/tradelines/page.tsx` conflictLines block gated `!clean` (one line).
6. **Optional rider (Founder's call):** the same branch-5 body sentence carries the gate's known false promise "The letter builder pre-fills … the recipient's address" (gate finding X9 — it doesn't). Two-word fix ("the recommended strategy") while the line is open.

Estimated diff: ~10 lines + 2 guard blocks. Validation: typecheck + kai-recommendation + mail-download + mailCenter + schema-safety guards. No schema, no architecture, no new surfaces.

---

## 6. Founder Decision Packages

**A. Historical mailed-date rows (pre-fix UTC-midnight `mailedAt`).**
**CCO recommendation: Option 1 + a pre-merge count (Option 4-lite). Do NOT silently normalize (Option 2).** A `mailedAt` is the consumer's own attestation of a legally meaningful date; rewriting it without consent is UDAAP-flavored even when well-intentioned, and the true date is unknowable post-hoc (the old picker *forced* a possibly-wrong day, so the stored day itself may be off — normalization would fix display coherence, not truth). Option 3 (user-confirmed correction) remains available post-launch if the count is material. **Pre-merge count (owner-run, read-only, direct prod connection):**
```sql
SELECT count(*) FROM "Letter"
WHERE "mailedAt" IS NOT NULL
  AND to_char("mailedAt" AT TIME ZONE 'UTC', 'HH24:MI:SS.MS') = '00:00:00.000';
```
Zero or near-zero → disclose-and-move-on. Material → schedule Option 3.

**B. Strategy Desk clean-account presentation (tiles + score bubble).**
**CCO determination: (1) no compliance violation, mild consumer-confusion only; (2) does NOT block launch; (4) defer with disclosure** — fold into the scheduled M11 wording batch (a 5th "Clean" tile or an NR-merge plus hiding the score bubble on clean rows). The per-row truth ("Clean / Nothing to dispute") is already the operative claim a consumer acts on.

**C. Chase-style historical delinquency.**
**CCO determination: APPROVED with revised wording SCHEDULED (not indefinite), logic unchanged, no outside counsel.** The count is defensible because the derogatory data is real and score-suppressing — not because "active" is a term of art. Keep the fact test; move counter labels toward "negative items on file" in the post-launch batch; dispute framing on such items already targets accuracy, which is the lawful frame.

---

## 7. Outside Counsel Questions

**None arising from this review.** The one genuine counsel item in the vicinity — whether CreditVector performing mailing (MAIL_LIVE / LetterStream) disturbs the not-a-CRO posture under CROA / state CSO law — belongs to the LetterStream activation review where it already sits, and is untouched by Phase 1A-R.

## 8. Recommended Smallest Next Action

Authorize the §5 correction slice (one bounded Sonnet packet + targeted guards + coordinator commit). On green: this review converts to **APPROVED WITH DISCLOSURES** (M6 timing duty · M7 LetterStream rider · M11/M12 scheduled wording batch · Decision A disclosure), the merge blocker lifts from the compliance side, and the branch is ready for your push/merge decision.

## 9. Git Status Confirmation

Branch `feat/experience-runtime-phase-1a` @ `f81882c`, **[ahead 7] of origin, NOT pushed**, working tree clean. Production `origin/main` @ `f449c35`, untouched.

## 10. Stop-Condition Confirmation

No application code changed in this review. No push, no merge, no deploy, no production migration, no production-data access or modification, no flags, no Wallet Runtime, no Phase 1B, no LetterStream activation, no CROA policy design. This review is an internal compliance gate, **not outside counsel approval**.
