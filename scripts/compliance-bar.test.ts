// Run: npx tsx scripts/compliance-bar.test.ts
// Guards the CROA scrubber itself (lib/compliance.ts) by EXECUTING it — the rule set
// is a control, so it is tested by running it, never by scanning its source.
//  1. Score-outcome PROMISES are flagged. The DISCLAIMER has always said "No deletion,
//     correction, or score improvement is guaranteed" while PROHIBITED carried no
//     score/points rule at all — the file named the prohibition in prose and omitted it
//     from the control. This pins the closed gap.
//  2. Legitimate EDUCATION about how scores work is NOT flagged. The bar prohibits
//     promises, not the topic; over-blocking would gut the product's teaching surface.
//  3. The phrases the pre-existing rules already caught still get caught (regression).
//  4. The DISCLAIMER and PROHIBITED do not disagree: every outcome the disclaimer names
//     as not-guaranteed has at least one rule that actually catches a promise of it.
//  5. Rewrites are safe: idempotent (a scrubbed string re-scrubs to zero flags) and the
//     disclaimer itself never trips the rules it describes.
//  6. The member-facing promise in lib/community.ts is true: screenCommunityText really
//     does reject score claims, which is what COMMUNITY_CLAIM_ERROR tells members.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyCompliance, COMPLIANCE_RULES, DISCLAIMER } from "../lib/compliance";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const flags = (s: string) => applyCompliance(s).flags.length;

// ── 1. Score-outcome PROMISES are flagged ────────────────────────────────────
const SCORE_PROMISES = [
  "We guarantee a 50 point score increase.",
  "I guarantee a 100 point score increase within 30 days.",
  "Guaranteed score improvement in 45 days.",
  "Guaranteed score increase or your money back.",
  "Get a guaranteed higher credit score.",
  "We promise a better credit score.",
  "They promise a higher score every time.",
  "We will raise your score by 100 points.",
  "This service can boost your score by up to 150 points.",
  "This program will boost your credit score.",
  "We'll fix your credit score.",
  "Your score will go up by 80 points.",
  "Your credit score will increase after the first round.",
  "Expect a 120 point increase after the first round.",
  "A score increase of 100 points is included with the plan.",
];
for (const s of SCORE_PROMISES) {
  check(`flags score promise: "${s.slice(0, 44)}"`, flags(s) > 0);
}

// ── 2. Legitimate education about scores passes UNTOUCHED ────────────────────
// Hedged, explanatory credit education is the product. If any of these start
// flagging, the scrubber has crossed from "no promises" into "no teaching".
const SCORE_EDUCATION = [
  "Payment history is the largest single factor in most credit score models.",
  "Paying down revolving balances can improve your credit score over time, though results vary.",
  "Utilization is roughly 30% of a FICO score; no single action carries a fixed number of points.",
  "Your score may go up or down as accounts age and balances change.",
  "A dispute does not guarantee a score increase.",
  "Scores are calculated from five categories: payment history, utilization, age of accounts, credit mix, and new credit.",
  "No one can promise what your score will do — outcomes depend on your full credit profile.",
  "Different lenders use different scoring models, so your score varies by bureau and model.",
  "Accurate negative information generally stays on a report for up to seven years.",
];
for (const s of SCORE_EDUCATION) {
  const r = applyCompliance(s);
  check(`does not flag education: "${s.slice(0, 44)}"`, r.flags.length === 0);
  check(`leaves education verbatim: "${s.slice(0, 32)}"`, r.text === s);
}

// ── 3. Regression: the phrases the original rules covered still trip ─────────
const LEGACY_PROHIBITED = [
  "I guarantee this will get deleted",
  "guaranteed deletion every time",
  "this account will be deleted once you send it",
  "this account must be deleted",
  "100% removal, works for everyone",
  "we can force the bureau to delete it",
  "§609 requires deletion of the account",
  "section 609 requires removal of any negative item",
  "metro 2 requires deletion when the fields mismatch",
  "this is illegal and they are in violation of the FCRA",
  "this is fraud",
  "the bureau failed to investigate",
  "this account has been re-aged",
  "the inquiry was unauthorized",
];
for (const s of LEGACY_PROHIBITED) {
  check(`still flags pre-existing prohibition: "${s.slice(0, 44)}"`, flags(s) > 0);
}

// ── 4. DISCLAIMER ↔ PROHIBITED agreement ─────────────────────────────────────
// The disclaimer names the outcomes that are never guaranteed. Each one must have a
// rule that actually catches a promise of it — otherwise the file disclaims a bar it
// does not enforce (exactly the defect this guard was written for).
//
// KNOWN, DELIBERATE EXCEPTION — "correction": a naive correction rule would collide
// with lawful statutory language the deterministic letter templates depend on (FCRA
// §611 literally requires a bureau to "correct or delete" unverifiable information —
// see lib/letter.ts). Writing that rule is a legal-bar question for counsel, not an
// engineering call, so the gap is pinned here rather than papered over: this list is
// the audit trail, and it must not grow without counsel sign-off.
const KNOWN_UNCOVERED_OUTCOMES = ["correction"];
const OUTCOME_PROBES: Record<string, string> = {
  deletion: "This account will be deleted once you send the letter.",
  "score improvement": "We guarantee a 50 point score increase.",
};

const clause = DISCLAIMER.match(/\bNo ([^.]+?) is guaranteed\./)?.[1] ?? "";
check("disclaimer still states the never-guaranteed outcomes", clause.length > 0);
const outcomes = clause.split(/,\s*/).map((o) => o.replace(/^or\s+/i, "").trim()).filter(Boolean);
check("disclaimer names deletion, correction and score improvement",
  outcomes.join("|") === "deletion|correction|score improvement");
check("every disclaimed outcome is either covered by a probe or a pinned known gap",
  outcomes.every((o) => o in OUTCOME_PROBES || KNOWN_UNCOVERED_OUTCOMES.includes(o)));
for (const [outcome, probe] of Object.entries(OUTCOME_PROBES)) {
  check(`disclaimed outcome "${outcome}" is enforced by at least one rule`, flags(probe) > 0);
}
check("the score-improvement gap is closed in the exported rule inventory (admin view)",
  COMPLIANCE_RULES.some((src) => /score/i.test(src)) && COMPLIANCE_RULES.some((src) => /points\?/i.test(src)));

// ── 5. Rewrites are safe ─────────────────────────────────────────────────────
// A scrubbed string must come out clean on a second pass; if a replacement can itself
// trip a rule, the scrubber contradicts its own output.
for (const s of [...SCORE_PROMISES, ...LEGACY_PROHIBITED]) {
  const once = applyCompliance(s).text;
  check(`idempotent rewrite: "${s.slice(0, 36)}"`, applyCompliance(once).flags.length === 0);
}
check("no rewrite re-promises an outcome", [...SCORE_PROMISES].every((s) => {
  const t = applyCompliance(s).text;
  return !/\bguaranteed (?:credit )?score\b/i.test(t) && !/\b\d+\+? ?points? (?:increase|boost|jump|gain)\b/i.test(t);
}));
check("the disclaimer itself never trips the rules it describes",
  flags(DISCLAIMER) === 0 && applyCompliance(DISCLAIMER).text === DISCLAIMER);

// ── 6. The member-facing promise in lib/community.ts is now true ─────────────
// COMMUNITY_CLAIM_ERROR tells members posts can't promise "score increases", and the
// screen is implemented as applyCompliance(...).flags — so before the score rules
// existed that message was unbacked: the screen could never detect a score claim.
// (lib/community.ts is read, not imported: it pulls lib/session → next/headers, which
// is why scripts/community-screen.test.ts owns the end-to-end reject path. The
// claim-DETECTION half — the part that was broken — is executed here.)
const community = readFileSync(join(__dirname, "..", "lib", "community.ts"), "utf8");
check("community error message still names score increases", /score increases/.test(community));
check("community screen is powered by applyCompliance flags (same rule set tested above)",
  /applyCompliance\(joined\)/.test(community) && /flags\.length > 0/.test(community));
for (const s of [
  "I guarantee a 100 point score increase, DM me",
  "this method will raise your score by 120 points",
  "guaranteed score improvement, works every time",
]) {
  // What screenCommunityText computes: flags > 0 ⇒ the post is rejected.
  check(`community-screened score claim now produces flags: "${s.slice(0, 36)}"`, flags(s) > 0);
}
check("a clean, educational member post still produces no flags (not rejected)",
  flags(["Score question", "How much does utilization actually matter on a FICO 8 score?"].join("\n\n")) === 0);

console.log(`\ncompliance-bar.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
