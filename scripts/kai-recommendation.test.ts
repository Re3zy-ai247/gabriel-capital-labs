// Run: npx tsx scripts/kai-recommendation.test.ts
// CROA guard for Kai's Home recommendation reasoning. Locks:
//   1. DELEGATION — Kai's "past its reporting window" recommendation fires only
//      when the canonical strategy engine (lib/recommend.ts) says fcra_605, so
//      it honors the 10-year bankruptcy window + 180-day collection/charge-off
//      offset and never contradicts the authority.
//   2. LANGUAGE — the recommendation copy carries no forbidden outcome language
//      (no "must drop off", "will be removed", guarantees). Kai observes facts,
//      explains the law, flags the issue, and recommends verification.
//   3. (Phase 1A, Agent C) BRANCH-5 RANKING — SIM-REVIEW finding 3: candidate
//      selection over un-disputed tradelines is ranked by `score`, deterministic
//      tie-break, never raw array/DB order.
//   4. (Phase 1A, Agent C) STARVATION GUARD — SIM-REVIEW finding 5: an absorbing
//      branch (verified-no-follow-up; lapsed window) yields the primary slot to
//      §605 once its own subject has sat un-actioned a full extra §611 window —
//      demoting to `secondary`, never disappearing.
//   5. (Phase 1A, Agent C) JOURNEY PANEL — static reuse/zero-fabrication checks
//      on app/journey/page.tsx's Case Progression panel.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pickRecommendation } from "../lib/kaiHome";
import { scanForbiddenLanguage } from "../lib/intelligence/reasoning";
import type { Letter, Report, Tradeline } from "@prisma/client";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const DAY = 86_400_000;
const yearsAgo = (y: number) => new Date(Date.now() - y * 365.25 * DAY);
const daysAgo = (d: number) => new Date(Date.now() - d * DAY);

function tl(over: Partial<Tradeline>): Tradeline {
  return {
    id: "t1", userId: "u1", reportId: "r1", creditorName: "Test Creditor",
    accountType: "CHARGE_OFF", isDebtBuyer: false, probability: "HIGH",
    dateOfFirstDelinquency: yearsAgo(8), bureauData: {}, resolved: false,
    score: 50, // default mid-range; branch-5 tests below override explicitly
    // fields not read by pickRecommendation/recommendStrategy:
    accountNumber: null, balance: null, status: null, reasons: [] as unknown,
    createdAt: new Date(), updatedAt: new Date(),
    ...over,
  } as unknown as Tradeline;
}
const oneReport = [{ id: "r1" }] as unknown as Report[];

// Letter fixture — mirrors tl()'s cast-through-unknown style. Defaults describe
// a plain, already-mailed, unanswered bureau letter; each test overrides only
// what it needs.
function lt(over: Partial<Letter>): Letter {
  return {
    id: "l1", userId: "u1", tradelineId: null, strategy: "fcra_611",
    recipientType: "bureau", recipientName: "Equifax", targetBureau: "EQUIFAX", round: 1,
    body: "", status: "MAILED", complianceFlags: [] as unknown,
    responseText: null, responseOutcome: null, responseAnalysis: null, responseAt: null,
    parentLetterId: null, createdAt: new Date(), mailedAt: daysAgo(10),
    ...over,
  } as unknown as Letter;
}

// --- 1. DELEGATION: an 8yr charge-off IS obsolete → the §605 recommendation fires
const chargeoff = pickRecommendation([tl({ accountType: "CHARGE_OFF", dateOfFirstDelinquency: yearsAgo(8) })], [], oneReport);
check("8yr charge-off → §605 obsolescence recommendation fires", chargeoff?.href.includes("strategy=fcra_605") ?? false);

// --- 1b. DELEGATION: an 8yr Chapter 7 bankruptcy public record is NOT yet obsolete
//     (10-year window). The OLD hardcoded `>= 7` bug would have wrongly fired §605.
const bk8 = pickRecommendation(
  [tl({ accountType: "PUBLIC_RECORD", creditorName: "US Bankruptcy Court", dateOfFirstDelinquency: yearsAgo(8), bureauData: { EQUIFAX: { presence: "PRESENT", status: "Chapter 7 Bankruptcy" } } as unknown as Tradeline["bureauData"] })],
  [], oneReport
);
check("8yr Chapter 7 bankruptcy → does NOT fire §605 (10yr window honored)", !(bk8?.href.includes("strategy=fcra_605") ?? false));

// --- 1c. DELEGATION: an 11yr Chapter 7 bankruptcy IS obsolete → §605 fires
const bk11 = pickRecommendation(
  [tl({ accountType: "PUBLIC_RECORD", creditorName: "US Bankruptcy Court", dateOfFirstDelinquency: yearsAgo(11), bureauData: { EQUIFAX: { presence: "PRESENT", status: "Chapter 7 Bankruptcy" } } as unknown as Tradeline["bureauData"] })],
  [], oneReport
);
check("11yr Chapter 7 bankruptcy → fires §605", bk11?.href.includes("strategy=fcra_605") ?? false);

// --- 2. LANGUAGE: the obsolescence recommendation carries no forbidden outcome copy
for (const [name, rec] of [["charge-off", chargeoff], ["11yr bankruptcy", bk11]] as const) {
  const combined = `${rec?.title} ${rec?.body} ${rec?.cta} ${rec?.basis}`;
  const hit = scanForbiddenLanguage(combined);
  check(`${name} recommendation copy passes scanForbiddenLanguage (hit: ${hit ?? "none"})`, hit === null);
  check(`${name} copy avoids "must drop off"`, !/must drop off/i.test(combined));
  check(`${name} copy avoids "will be removed"`, !/will be removed/i.test(combined));
}

// --- 3. SCANNER TEETH: the extended patterns now catch the old defect string
check("scanner catches the OLD 'must drop off under FCRA §605' copy",
  scanForbiddenLanguage("Items older than 7 years must drop off under FCRA §605.") !== null);
check("scanner catches 'will fall off'", scanForbiddenLanguage("this will fall off your report") !== null);
check("scanner catches 'automatically removed'", scanForbiddenLanguage("the item is automatically removed") !== null);
// ...but does NOT over-match legitimate process language ("must complete its reinvestigation")
check("scanner allows legitimate process language ('must complete its reinvestigation')",
  scanForbiddenLanguage("the bureau must complete its reinvestigation within 30 days") === null);

// ============================================================================
// 4. BRANCH-5 RANKING (Phase 1A, SIM-REVIEW finding 3 — live defect fix).
//    Two undisputed, non-obsolete tradelines (dateOfFirstDelinquency recent —
//    nowhere near the §605 window, so branch 3 never preempts branch 5).
// ============================================================================
const lowScore = tl({ id: "low", creditorName: "Low Score Co", accountType: "REVOLVING", dateOfFirstDelinquency: yearsAgo(1), score: 20 });
const highScore = tl({ id: "high", creditorName: "High Score Co", accountType: "COLLECTION", isDebtBuyer: true, dateOfFirstDelinquency: yearsAgo(1), score: 90 });

const rankedLowFirst = pickRecommendation([lowScore, highScore], [], oneReport);
check("branch 5: highest score wins even when listed SECOND in the array", rankedLowFirst?.href.includes("tradeline=high") ?? false);

const rankedHighFirst = pickRecommendation([highScore, lowScore], [], oneReport);
check("branch 5: highest score wins when listed FIRST too (order-independent — not just array order)", rankedHighFirst?.href.includes("tradeline=high") ?? false);

check("branch 5: basis truthfully states the score-based rule (names the winning score)",
  /score/i.test(rankedHighFirst?.basis ?? "") && /90/.test(rankedHighFirst?.basis ?? ""));
check("branch 5: recommendation copy passes scanForbiddenLanguage", scanForbiddenLanguage(`${rankedHighFirst?.title} ${rankedHighFirst?.body} ${rankedHighFirst?.basis}`) === null);

// Deterministic tie-break #1: equal score → OLDER createdAt wins (an equal-score
// item can never be starved forever by a newer arrival).
const olderTie = tl({ id: "older", creditorName: "Older Co", accountType: "REVOLVING", dateOfFirstDelinquency: yearsAgo(1), score: 50, createdAt: new Date("2026-01-01T00:00:00Z") });
const newerTie = tl({ id: "newer", creditorName: "Newer Co", accountType: "REVOLVING", dateOfFirstDelinquency: yearsAgo(1), score: 50, createdAt: new Date("2026-06-01T00:00:00Z") });
const tieBreak = pickRecommendation([newerTie, olderTie], [], oneReport);
check("branch 5 tie-break: equal score → OLDER createdAt wins", tieBreak?.href.includes("tradeline=older") ?? false);

// Deterministic tie-break #2: equal score AND createdAt → id breaks it.
const sameTimeHigh = tl({ id: "zzz", creditorName: "Z Co", accountType: "REVOLVING", dateOfFirstDelinquency: yearsAgo(1), score: 50, createdAt: new Date("2026-01-01T00:00:00Z") });
const sameTimeLow = tl({ id: "aaa", creditorName: "A Co", accountType: "REVOLVING", dateOfFirstDelinquency: yearsAgo(1), score: 50, createdAt: new Date("2026-01-01T00:00:00Z") });
const idTieBreak = pickRecommendation([sameTimeHigh, sameTimeLow], [], oneReport);
check("branch 5 tie-break: fully tied score+createdAt → lexicographically smaller id wins (fully deterministic)", idTieBreak?.href.includes("tradeline=aaa") ?? false);

// ============================================================================
// 5. STARVATION GUARD (Phase 1A, SIM-REVIEW finding 5). A shared §605 candidate
//    (`obsoleteTl`) that both starvation tests below can "yield" to.
// ============================================================================
const obsoleteTl = tl({ id: "obs1", creditorName: "Obsolete Co", accountType: "CHARGE_OFF", dateOfFirstDelinquency: yearsAgo(8) });

// -- branch 1 (verified-no-follow-up) --
const freshVerified = lt({ id: "lv1", recipientName: "Equifax", responseOutcome: "verified", responseAt: daysAgo(5), round: 1, mailedAt: daysAgo(40) });
const notStaleVerified = pickRecommendation([obsoleteTl], [freshVerified], oneReport);
check("starvation: verified NOT yet stale (5d) + §605 exists → branch 1 still wins", notStaleVerified?.cta === "Review response & start Round 2");
check("...and carries no `secondary` (nothing was yielded)", notStaleVerified?.secondary === undefined);

const staleVerified = lt({ id: "lv2", recipientName: "TransUnion", responseOutcome: "verified", responseAt: daysAgo(35), round: 1, mailedAt: daysAgo(70) });
const staleVerifiedYield = pickRecommendation([obsoleteTl], [staleVerified], oneReport);
check("starvation: verified STALE (35d ≥ 30d) + §605 exists → yields the primary slot to §605", staleVerifiedYield?.cta === "Review this item & dispute");
check("...the verified item demotes to `secondary` (never disappears)", /TransUnion/.test(staleVerifiedYield?.secondary?.label ?? ""));
check("...`secondary.href` is a real, non-empty link", (staleVerifiedYield?.secondary?.href.length ?? 0) > 0);
check("...secondary label passes scanForbiddenLanguage", scanForbiddenLanguage(staleVerifiedYield?.secondary?.label ?? "") === null);

const staleVerifiedNoObsolete = pickRecommendation([], [staleVerified], oneReport);
check("starvation: verified STALE but NO §605 candidate → branch 1 still wins (nothing to yield to)", staleVerifiedNoObsolete?.cta === "Review response & start Round 2");
check("...and no `secondary` (nothing was yielded)", staleVerifiedNoObsolete?.secondary === undefined);

// -- branch 2 (lapsed window) --
// Phase 1A F2: deadlinesFrom is now RECEIPT-anchored (daysElapsed subtracts
// the 5-day MAIL_TRANSIT_DAYS allowance before comparing to the 30-day §611
// window) — so "days ago mailed" no longer equals "days on the clock". Fixture
// day-counts below are chosen against the RECEIPT-anchored math.
const freshLapsed = lt({ id: "ll1", recipientName: "Experian", mailedAt: daysAgo(37) }); // daysElapsed = 37-5 = 32, daysLeft = 30-32 = -2 (just lapsed, overdue 2d, below the 30d starvation threshold)
const notStaleLapsed = pickRecommendation([obsoleteTl], [freshLapsed], oneReport);
check("starvation: lapsed window just-overdue (2d) + §605 exists → branch 2 still wins", notStaleLapsed?.cta === "Log the response");
check("...and carries no `secondary`", notStaleLapsed?.secondary === undefined);

const staleLapsed = lt({ id: "ll2", recipientName: "Experian", mailedAt: daysAgo(65) }); // daysElapsed = 65-5 = 60, daysLeft = 30-60 = -30, overdue 30d ≥ 30d threshold
const staleLapsedYield = pickRecommendation([obsoleteTl], [staleLapsed], oneReport);
check("starvation: lapsed window overdue 30d (≥30d further) + §605 exists → yields to §605", staleLapsedYield?.cta === "Review this item & dispute");

// F2 boundary pin: at exactly 30 days since MAILING, the OLD (mailing-
// anchored) math would already call the window lapsed (daysLeft = 30-30 = 0).
// The fixed, RECEIPT-anchored math still has 5 days left (30 - (30-5) = 5) —
// the transit allowance hasn't been used up yet. Only at 35 days since
// mailing does the receipt-anchored window actually close (30 - (35-5) = 0).
const day30 = lt({ id: "b30", recipientName: "Equifax", mailedAt: daysAgo(30) });
const atDay30 = pickRecommendation([], [day30], oneReport);
check("F2 boundary: mailed exactly 30 days ago is NOT past the receipt-anchored window (branch 2 does not fire)", atDay30?.cta !== "Log the response");

const day35 = lt({ id: "b35", recipientName: "Equifax", mailedAt: daysAgo(35) });
const atDay35 = pickRecommendation([], [day35], oneReport);
check("F2 boundary: mailed exactly 35 days ago IS past the receipt-anchored window (branch 2 fires)", atDay35?.cta === "Log the response");
check("...the lapsed item demotes to `secondary`", /Experian/.test(staleLapsedYield?.secondary?.label ?? ""));
check("...secondary label passes scanForbiddenLanguage", scanForbiddenLanguage(staleLapsedYield?.secondary?.label ?? "") === null);

const staleLapsedNoObsolete = pickRecommendation([], [staleLapsed], oneReport);
check("starvation: lapsed STALE but NO §605 candidate → branch 2 still wins", staleLapsedNoObsolete?.cta === "Log the response");

// obsolete-only baseline (no absorbing branch above it at all) → no secondary,
// same copy as the yield case (proves the starvation path never mutates §605's
// own primary copy, only whether `secondary` is attached).
const obsoleteAlone = pickRecommendation([obsoleteTl], [], oneReport);
check("§605 with nothing absorbing above it → identical primary copy to the yield case", obsoleteAlone?.title === staleVerifiedYield?.title && obsoleteAlone?.basis === staleVerifiedYield?.basis);
check("...and no `secondary` (nothing was starved)", obsoleteAlone?.secondary === undefined);

// ============================================================================
// 6. JOURNEY PANEL — static reuse / zero-fabrication checks (Phase 1A).
//    app/journey/page.tsx's Case Progression panel is composed, not forked.
// ============================================================================
const JOURNEY_SRC = readFileSync(join(__dirname, "..", "app", "journey", "page.tsx"), "utf8");
check("journey page imports getKaiHomeData (cites the engine, never forks a recommendation)",
  /import\s*\{[^}]*\bgetKaiHomeData\b[^}]*\}\s*from\s*["']@\/lib\/kaiHome["']/.test(JOURNEY_SRC));
check("journey page imports REINVESTIGATION_DAYS rather than hardcoding the §611 day count",
  /REINVESTIGATION_DAYS/.test(JOURNEY_SRC) && !/\b30\s*\*\s*86_400_000\b/.test(JOURNEY_SRC));
check("journey page imports WATCHING_CLOCK_LINE from lib/mailCenter (one source, not a re-typed string)",
  /import\s*\{[^}]*\bWATCHING_CLOCK_LINE\b[^}]*\}\s*from\s*["']@\/lib\/mailCenter["']/.test(JOURNEY_SRC));
check("WATCHING_CLOCK_LINE is rendered on ≥2 surfaces in this file (panel + Coming-up), one imported source",
  (JOURNEY_SRC.match(/WATCHING_CLOCK_LINE/g) ?? []).length >= 2);
check("current/next step reads the SAME `allSteps` checklist array rendered below (no second, parallel ladder)",
  (JOURNEY_SRC.match(/\ballSteps\b/g) ?? []).length >= 3);
check("no Send/Wallet-only placeholder stage key is ever surfaced as a Download-path step",
  !/["'](payment|provider_print|carrier|delivery|tracking|certified)["']/.test(JOURNEY_SRC));
check("evidence count is derived via a real filter over `letters`, never a hardcoded number",
  /letters\.filter\(\(l\) => l\.mailedAt\)\.length/.test(JOURNEY_SRC));
check("the panel's watching-the-clock line is gated on a still-running window (daysLeft > 0), never unconditional",
  /upcoming\[0\]\.daysLeft > 0/.test(JOURNEY_SRC));

// ============================================================================
// 7. RB-1 (Founder Experience Gate) — an item with a letter ALREADY generated
//    (mailed or not) is never re-offered as a fresh §605 "review & dispute"
//    pick, including through the starvation-guard's secondary slot. Mechanism:
//    lib/kaiHome.ts's `disputedIds` set is now hoisted above the §605
//    candidate (`obsolete`) and excludes it there — the single fix point every
//    consumer of `obsolete` (branches 1, 2, and 3) shares.
// ============================================================================
const letteredObsolete = tl({ id: "obs-lettered", creditorName: "Navient", accountType: "STUDENT_LOAN", dateOfFirstDelinquency: yearsAgo(8) });
// Mirrors the demo account's exact repro shape: a GENERATED-but-unmailed
// letter already exists for this tradeline.
const existingLetter = lt({ id: "gen1", tradelineId: "obs-lettered", recipientName: "Navient", status: "GENERATED", responseOutcome: null, mailedAt: null });

// (a) direct pick: with nothing else in play, an already-lettered §605 item
// must never resurface as the primary pick.
const letteredPick = pickRecommendation([letteredObsolete], [existingLetter], oneReport);
check("RB-1: an item with a letter already generated is NOT re-offered as the §605 pick", !(letteredPick?.href.includes("strategy=fcra_605") ?? false));
check("RB-1: ...(nothing else competes here, so the recommendation is honestly null, not a fabricated substitute)", letteredPick === null);

// (b) un-lettered control: the IDENTICAL item shape with no letter on file
// still fires normally — proves the exclusion is per-item, not a blanket
// suppression of branch 3 (starvation guard preserved).
const unletteredPick = pickRecommendation([letteredObsolete], [], oneReport);
check("RB-1 control: the identical item with NO letter on file still fires the §605 pick (starvation guard alive)", unletteredPick?.href.includes("strategy=fcra_605") ?? false);

// (c) starvation-guard secondary slot: a stale-verified OTHER letter would
// normally yield the primary slot to §605 (see section 5 above) — but when
// the only §605-eligible item is ITSELF already lettered, there is nothing
// eligible to yield to, so branch 1's own copy stands with no `secondary`.
const staleVerifiedOther = lt({ id: "lv-other", recipientName: "TransUnion", responseOutcome: "verified", responseAt: daysAgo(35), round: 1, mailedAt: daysAgo(70) });
const guardWithLetteredObsolete = pickRecommendation([letteredObsolete], [staleVerifiedOther, existingLetter], oneReport);
check("RB-1: starvation guard does NOT yield to an already-lettered §605 item", guardWithLetteredObsolete?.cta === "Review response & start Round 2");
check("RB-1: ...and carries no `secondary` (nothing eligible to yield to)", guardWithLetteredObsolete?.secondary === undefined);

// (d) positive control, reusing section 5's fixtures: the starvation guard
// still yields normally when the §605 item is genuinely un-lettered.
check("RB-1 control: starvation guard still yields to §605 when the item is genuinely un-lettered", staleVerifiedYield?.cta === "Review this item & dispute");

// ============================================================================
// 8. M1 (Phase 1A-R CCO correction, HIGH) — branch-5's `undisputed` selector
//    now applies the RB-2 fact test (isFactualNegative) AND excludes
//    NOT_RECOMMENDED (government/statutory — the Strategy Desk already
//    refuses these). Before this fix, a first-time user with a clean or
//    government-debt top-scored account was told "{Creditor} is flagged on
//    your file" and steered into the letter builder — an affirmative false
//    statement plus an inducement to dispute accurate/undisputable data.
//    A clean-only file must yield NO branch-5 recommendation (null); a
//    NOT_RECOMMENDED-topped file must never propose that item; a genuine
//    negative is still recommended exactly as before (regression pin).
// ============================================================================

// (a) Clean-only file: no factual negative anywhere on file, no letters, one
// report on file (so branch 4 — "upload your report" — doesn't fire either).
// Mirrors missionControl.test.ts's own "Nelnet"/"Toyota" clean fixtures.
const cleanStudentLoan = tl({ id: "clean-sl", creditorName: "Clean Student Loan Co", accountType: "STUDENT_LOAN", dateOfFirstDelinquency: null, probability: "LOW", score: 25 });
const cleanInstallment = tl({ id: "clean-inst", creditorName: "Clean Installment Co", accountType: "INSTALLMENT", dateOfFirstDelinquency: null, probability: "MEDIUM", score: 55 });
const cleanOnlyPick = pickRecommendation([cleanStudentLoan, cleanInstallment], [], oneReport);
check("M1: a clean-only file (no factual negative on file, no letters) → pickRecommendation yields NO dispute recommendation (quiet is allowed)", cleanOnlyPick === null);

// (b) NOT_RECOMMENDED-topped file (government/statutory), nothing else on
// file → also null, never proposed.
const notRecommendedOnly = tl({ id: "notrec-only", creditorName: "Statutory Only Co", accountType: "COLLECTION", dateOfFirstDelinquency: yearsAgo(1), probability: "NOT_RECOMMENDED", score: 95 });
const notRecOnlyPick = pickRecommendation([notRecommendedOnly], [], oneReport);
check("M1: a NOT_RECOMMENDED-topped file (nothing else on file) → pickRecommendation yields NO dispute recommendation", notRecOnlyPick === null);

// (c) Mixed file: a NOT_RECOMMENDED item AND a clean item both outscore a
// genuine negative — branch 5 must skip both and still find the genuine one
// (proves active exclusion, not coincidental absence), and the genuine
// negative is recommended exactly as before (regression pin).
const notRecommendedTop = tl({ id: "notrec-top", creditorName: "Statutory Co", accountType: "COLLECTION", dateOfFirstDelinquency: yearsAgo(1), probability: "NOT_RECOMMENDED", score: 95 });
const genuineLower = tl({ id: "genuine-lower", creditorName: "Genuine Negative Co", accountType: "CHARGE_OFF", dateOfFirstDelinquency: yearsAgo(1), probability: "HIGH", score: 30 });
const mixedPick = pickRecommendation([notRecommendedTop, cleanStudentLoan, genuineLower], [], oneReport);
check("M1: a NOT_RECOMMENDED item never wins branch 5, even top-scored", !(mixedPick?.href.includes("tradeline=notrec-top") ?? false));
check("M1: a clean item never wins branch 5 either", !(mixedPick?.href.includes("tradeline=clean-sl") ?? false));
check("M1 regression: the genuine negative still wins branch 5 among the three — genuine negatives are unaffected by the correction", mixedPick?.href.includes("tradeline=genuine-lower") ?? false);
check("M1: branch-5 basis still truthfully names the winning score", /30/.test(mixedPick?.basis ?? ""));
check("M1: branch-5 copy still passes scanForbiddenLanguage after the correction", scanForbiddenLanguage(`${mixedPick?.title} ${mixedPick?.body} ${mixedPick?.basis}`) === null);

// (d) Rider: the false "recipient's address" pre-fill claim is gone from the
// branch-5 body — the letter builder pre-fills the strategy, never an
// address (gate finding X9).
check("M1 rider: branch-5 body no longer claims the letter builder pre-fills the recipient's address", !/recipient's address/i.test(mixedPick?.body ?? ""));
check("M1 rider: branch-5 body still states the true claim (pre-fills the recommended strategy)", /pre-fills the recommended strategy/i.test(mixedPick?.body ?? ""));

console.log(`\nkai-recommendation.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
