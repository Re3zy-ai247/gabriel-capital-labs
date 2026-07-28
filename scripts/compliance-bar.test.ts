// Run: npx tsx scripts/compliance-bar.test.ts
// Guards the CROA scrubber itself (lib/compliance.ts) by EXECUTING it — the rule set
// is a control, so it is tested by running it, never by scanning its source.
//  1. An ADVERSARIAL corpus of promise phrasings is flagged. Wave 1 closed the
//     score-outcome gap (the DISCLAIMER named "score improvement" as never-guaranteed
//     while PROHIBITED carried no score rule); verification then defeated ~half of a
//     20-phrase set by ordinary rewording, so Wave 2 generalised the patterns. This
//     section is that adversarial set, by category: word order, digits vs words,
//     ranges, punctuation/spacing, certainty language, deletion RESULTS, misspellings,
//     and negation-smuggling.
//  2. A matched NEGATIVE corpus of legitimate credit education is NOT flagged and is
//     left byte-identical. The bar prohibits promises, not the topic; over-blocking
//     would gut the product's teaching surface, so a false positive here is a FAILURE.
//  3. The phrases the pre-existing rules already caught still get caught (regression).
//  4. The DISCLAIMER and PROHIBITED do not disagree: every outcome the disclaimer names
//     as not-guaranteed has at least one rule that actually catches a promise of it.
//  5. Rewrites are safe: idempotent (a scrubbed string re-scrubs to zero flags), never
//     re-promise the outcome, and the disclaimer itself never trips the rules it
//     describes. Replacements only use $1..$9 (all applyCompliance expands).
//  6. The admin rule inventory (COMPLIANCE_RULES, rendered by app/api/admin/compliance)
//     stays derived from the enforced rules and discloses the negation carve-out.
//  7. The member-facing promise in lib/community.ts is true: screenCommunityText really
//     does reject score claims, which is what COMMUNITY_CLAIM_ERROR tells members.
//  8. The two carve-outs (clause negation, third-party attribution) are BOUNDED — they
//     must not shelter a first-person promise.
// NOT IN SCOPE: whether these rules satisfy CROA. That is a legal standard counsel
// sets; open questions are tabled in RC1-B05-COUNSEL-REVIEW.md. B-05 stays PARTIAL.
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

// ── 1. Adversarial corpus — every one of these must be flagged ───────────────
// [category, phrase]. Categories exist so a regression report names the evasion
// class that reopened, not just a string.
const ADVERSARIAL: [string, string][] = [
  // Leading guarantee (the shape Wave 1 caught)
  ["lead", "We guarantee a 50 point score increase."],
  ["lead", "I guarantee a 100 point score increase within 30 days."],
  ["lead", "Guaranteed score improvement in 45 days."],
  ["lead", "Get a guaranteed higher credit score."],
  ["lead", "100% guaranteed score improvement."],
  ["lead", "Guaranteed 50 points."],
  ["lead", "Guaranteed score boost."],
  // Trailing guarantee (the shape that defeated Wave 1)
  ["order", "Score increase guaranteed."],
  ["order", "A higher credit score is guaranteed."],
  ["order", "50 point increase guaranteed."],
  ["order", "Credit score improvement, guaranteed."],
  ["order", "Deletion guaranteed."],
  ["order", "Removal is guaranteed."],
  ["order", "Guaranteed removal of collections."],
  // Digits vs words
  ["digits", "We guarantee a fifty point score increase."],
  ["digits", "A hundred point jump is included with the plan."],
  ["digits", "Guaranteed seventy five point increase."],
  ["digits", "Add fifty points to your score."],
  // Ranges
  ["range", "We raise your score by 50-100 points."],
  ["range", "Expect a 40 to 80 point increase."],
  ["range", "Guaranteed 100+ points."],
  // Punctuation and spacing variance
  ["punct", "Guaranteed  score   increase."],
  ["punct", "Guaranteed score-increase."],
  ["punct", "A 50-point boost is promised."],
  ["punct", "100 % guaranteed score increase."],
  ["punct", "Guaranteed 75point gain."],
  // Certainty language instead of the word "guarantee"
  ["certainty", "Your score will definitely go up."],
  ["certainty", "Your credit score is going to jump."],
  ["certainty", "Your score always improves after round one."],
  ["certainty", "We assure you a higher credit score."],
  ["certainty", "We pledge a better score."],
  ["certainty", "This program promises a higher FICO score."],
  ["certainty", "We'll definitely raise your credit score."],
  ["certainty", "This program will boost your credit score."],
  ["certainty", "Your credit score will increase after the first round."],
  // Deletion RESULT claims
  ["deletion", "The collection will be removed."],
  ["deletion", "These accounts are going to be deleted."],
  ["deletion", "We delete negative items from your report."],
  ["deletion", "This service will permanently remove derogatory marks."],
  ["deletion", "It works every time."],
  ["deletion", "100% success rate."],
  // Misspellings of the guarantee word
  ["typo", "Garanteed score increase."],
  ["typo", "Guarantied deletion."],
  ["typo", "Gauranteed 50 point boost."],
  // Negation smuggling: a negation about something ELSE must not shelter the promise
  ["smuggle", "This is not legal advice, but we guarantee a 50 point score increase."],
  ["smuggle", "No refunds, however your score will go up."],
  ["smuggle", "Nothing is certain in credit, but deletion is guaranteed."],
  // Attribution smuggling: a third-party frame must not shelter OUR promise
  ["smuggle", "We are the company that guarantees deletion."],
  ["smuggle", "Our service, which anyone can join, guarantees a higher score."],
];
for (const [cat, s] of ADVERSARIAL) {
  check(`flags [${cat}] promise: "${s.slice(0, 48)}"`, flags(s) > 0);
}

// ── 2. Legitimate education passes UNTOUCHED ─────────────────────────────────
// Hedged, explanatory credit education is the product. If any of these start
// flagging, the scrubber has crossed from "no promises" into "no teaching" — and on
// member-authored surfaces (Operator Network, Brief comments) a flag REJECTS the
// post, so a false positive here silences a member who is teaching correctly.
const EDUCATION: [string, string][] = [
  ["factors", "Payment history is the largest single factor in most credit score models."],
  ["factors", "Paying down revolving balances can improve your credit score over time, though results vary."],
  ["factors", "Utilization is roughly 30% of a FICO score; no single action carries a fixed number of points."],
  ["factors", "Scores are calculated from five categories: payment history, utilization, age of accounts, credit mix, and new credit."],
  ["factors", "Different lenders use different scoring models, so your score varies by bureau and model."],
  ["factors", "Hard inquiries can affect your score for up to 12 months."],
  ["hedged", "Your score may go up or down as accounts age and balances change."],
  ["hedged", "There is no fixed number of points tied to any single dispute outcome."],
  ["hedged", "Results vary based on individual circumstances and the accuracy of reported information."],
  ["negated", "A dispute does not guarantee a score increase."],
  ["negated", "No one can promise what your score will do — outcomes depend on your full credit profile."],
  ["negated", "We cannot guarantee a higher score, and neither can anyone else."],
  ["negated", "No score improvement is guaranteed."],
  ["negated", "Deletion is never guaranteed."],
  ["negated", "Nobody can promise a 50 point increase."],
  ["warning", "Credit repair companies that promise guaranteed deletions are violating the CROA — avoid them."],
  ["warning", "Avoid any service that guarantees a 100 point increase."],
  ["bureau", "Accurate negative information generally stays on a report for up to seven years."],
  ["bureau", "Most negative marks age off after seven years, and bankruptcies after ten."],
  ["bureau", "A bureau may delete, modify, or verify an item after a reinvestigation."],
  ["bureau", "If the furnisher cannot verify the item, it should be corrected or deleted."],
  ["statute", "Under FCRA §611, a bureau must reinvestigate a disputed item within 30 days."],
  ["statute", "The FCRA requires a consumer reporting agency to correct or delete information that cannot be verified."],
  ["statute", "Section 609 entitles you to disclosure of your file, not to deletion."],
  ["statute", "Metro 2 is a data format used by furnishers to report account information."],
  ["statute", "You are entitled to one free report from each bureau every 12 months."],
  ["product", "To ensure your credit score is accurate, review all three reports each year."],
  ["product", "We promise to explain how scoring works in plain English."],
  ["product", "Your data is encrypted; we guarantee your privacy is taken seriously."],
];
for (const [cat, s] of EDUCATION) {
  const r = applyCompliance(s);
  check(`does not flag [${cat}] education: "${s.slice(0, 48)}"`, r.flags.length === 0);
  check(`leaves [${cat}] education verbatim: "${s.slice(0, 36)}"`, r.text === s);
}

// The corpora must not have been quietly emptied or made trivially satisfiable.
check("adversarial corpus covers every evasion category", (() => {
  const cats = new Set(ADVERSARIAL.map(([c]) => c));
  return ["lead", "order", "digits", "range", "punct", "certainty", "deletion", "typo", "smuggle"].every((c) => cats.has(c));
})());
check("adversarial corpus is substantial (>= 45 phrases)", ADVERSARIAL.length >= 45);
check("education corpus is substantial (>= 25 phrases)", EDUCATION.length >= 25);

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
  "you are liable for this reporting",
  "we will raise your score by 100 points",
  "this service can boost your score by up to 150 points",
  "a score increase of 100 points is included with the plan",
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

// ── 5. Rewrites are safe ─────────────────────────────────────────────────────
// A scrubbed string must come out clean on a second pass; if a replacement can itself
// trip a rule, the scrubber contradicts its own output.
for (const [, s] of [...ADVERSARIAL, ...EDUCATION]) {
  const once = applyCompliance(s).text;
  check(`idempotent rewrite: "${s.slice(0, 40)}"`, applyCompliance(once).flags.length === 0);
}
for (const s of LEGACY_PROHIBITED) {
  const once = applyCompliance(s).text;
  check(`idempotent rewrite (legacy): "${s.slice(0, 36)}"`, applyCompliance(once).flags.length === 0);
}
check("no rewrite re-promises an outcome", ADVERSARIAL.every(([, s]) => {
  const t = applyCompliance(s).text;
  return !/\bguaranteed (?:credit )?score\b/i.test(t)
    && !/\b\d+\+? ?points? (?:increase|boost|jump|gain)\b/i.test(t)
    && !/\bwill be (?:deleted|removed)\b/i.test(t);
}));
check("every rewrite of a score promise says outcomes are not guaranteed",
  ADVERSARIAL.filter(([c]) => c !== "deletion").every(([, s]) => {
    const t = applyCompliance(s).text.toLowerCase();
    return /never guaranteed|not guaranteed|no (?:score )?outcome is guaranteed|cannot guarantee|vary|varies/.test(t);
  }));
check("the disclaimer itself never trips the rules it describes",
  flags(DISCLAIMER) === 0 && applyCompliance(DISCLAIMER).text === DISCLAIMER);
// applyCompliance expands $1..$9 by hand; a replacement using $&, $', $` or $$ would
// be emitted literally into a member-facing letter.
check("no replacement uses a substitution token applyCompliance cannot expand",
  !readFileSync(join(__dirname, "..", "lib", "compliance.ts"), "utf8")
    .split("\n")
    .filter((l: string) => /^\s*replacement:/.test(l))
    .some((l: string) => /\$[&`'$]/.test(l)));
// Deterministic and bounded: no network, no clock, no pathological backtracking.
const long = ("Paying down revolving balances can improve your credit score over time. " +
  "Guaranteed 50 point score increase. ").repeat(200);
const t0 = Date.now();
const bulk = applyCompliance(long);
const elapsed = Date.now() - t0;
check(`scrubbing ${long.length} chars stays under 1s (was ${elapsed}ms)`, elapsed < 1000);
check("bulk scrub is deterministic", applyCompliance(long).text === bulk.text);

// ── 6. Admin rule inventory stays truthful ───────────────────────────────────
// app/api/admin/compliance returns COMPLIANCE_RULES verbatim; it must describe what is
// actually enforced, including the carve-out, so an admin is not told the control is
// unconditional when it is not.
check("inventory has one entry per enforced rule (no hand-maintained second list)",
  COMPLIANCE_RULES.length >= 25 && COMPLIANCE_RULES.every((r) => typeof r === "string" && r.length > 0));
check("every inventory entry carries the executable pattern it describes",
  COMPLIANCE_RULES.every((r) => / · \/.+\/i$/.test(r)));
check("every inventory entry carries a plain-English label before the pattern",
  COMPLIANCE_RULES.every((r) => /^[a-z0-9§][^·]{8,}·/i.test(r)));
check("inventory discloses the negation/attribution carve-out where it applies",
  COMPLIANCE_RULES.some((r) => /not applied when the clause itself negates the claim/.test(r)));
check("the score-outcome bar is visible in the inventory (admin view)",
  COMPLIANCE_RULES.some((r) => /score/i.test(r)) && COMPLIANCE_RULES.some((r) => /points\?/i.test(r)));
// Flags are stored on Letter.complianceFlags and rendered to admins; they must name
// the rule in words, not dump a 600-character composed regex into the database.
const sampleFlags = applyCompliance("Guaranteed 50 point score increase.").flags;
check("flags name the rule in plain English", sampleFlags.length > 0 && sampleFlags.every((f) => f.length < 160));
check("flags do not dump raw regex source", sampleFlags.every((f) => !/\(\?:/.test(f)));

// ── 7. The member-facing promise in lib/community.ts is true ─────────────────
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
  "score increase guaranteed, hit me up",
]) {
  // What screenCommunityText computes: flags > 0 ⇒ the post is rejected.
  check(`community-screened score claim produces flags: "${s.slice(0, 36)}"`, flags(s) > 0);
}
check("a clean, educational member post still produces no flags (not rejected)",
  flags(["Score question", "How much does utilization actually matter on a FICO 8 score?"].join("\n\n")) === 0);
check("a member warning others about scam claims is not rejected",
  flags(["Warning", "Stay away from companies that promise guaranteed deletions — that is a CROA violation."].join("\n\n")) === 0);
// The rejection copy stays educational, never accusatory or legalistic.
check("rejection copy tells the member how to rephrase, in plain language",
  /rephrase/i.test(community) && !/\bviolation of the law\b/i.test(community));

// ── 8. The carve-outs are bounded ────────────────────────────────────────────
// Both suppressors exist so the platform can disclaim and can warn. Neither may
// shelter a first-person promise — these pairs differ ONLY in that respect.
const CARVE_OUT_PAIRS: [string, string][] = [
  ["No score improvement is guaranteed.", "A score improvement is guaranteed."],
  ["Nobody can promise a 50 point increase.", "We promise a 50 point increase."],
  ["Avoid companies that guarantee deletion.", "We guarantee deletion."],
  ["Anyone who promises a higher score is lying.", "Our team promises a higher score."],
];
for (const [safe, promise] of CARVE_OUT_PAIRS) {
  check(`carve-out allows: "${safe.slice(0, 40)}"`, flags(safe) === 0);
  check(`carve-out does NOT shelter: "${promise.slice(0, 40)}"`, flags(promise) > 0);
}

// ── Carve-out BOUNDS ────────────────────────────────────────────────────────
// The corpora above prove the rules behave on the sentences we thought of. They do
// NOT pin the carve-out windows, and those are load-bearing: widening
// NEGATION_WINDOW far enough turns "no one can guarantee deletion … <500 chars> …
// guaranteed deletion" into a disclaimed claim, which silently disables the control
// while every corpus assertion stays green. Adversarial verification demonstrated
// exactly that (window widened to 100000, all assertions still passing). Pin the
// bounds to the source so a widening has to be deliberate.
const complianceSrc = readFileSync(join(__dirname, "..", "lib", "compliance.ts"), "utf8");
const negWin = Number((complianceSrc.match(/const NEGATION_WINDOW = (\d+)/) || [])[1]);
check("NEGATION_WINDOW is pinned in source (the check is not vacuous)", Number.isFinite(negWin));
check("NEGATION_WINDOW stays clause-sized, not paragraph-sized (<= 200 chars)",
  Number.isFinite(negWin) && negWin > 0 && negWin <= 200);
check("the attribution carve-out still excludes first-person voice",
  /FIRST_PERSON\.test\(attribution\)/.test(complianceSrc) || /!FIRST_PERSON\.test\(/.test(complianceSrc));
check("the forward attribution window cannot leak across a sentence boundary",
  /text\.slice\(offset, offset \+ NEGATION_WINDOW\)\.split\(\/\[\.!\?;:\\n\]\/\)\[0\]/.test(complianceSrc));

console.log(`\ncompliance-bar.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
