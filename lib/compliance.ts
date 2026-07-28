// Compliance Mode: scrub guarantees and illegal/over-promising language from any
// generated letter. Runs on the FINAL letter text before it is saved or shown.
//
// WHAT THIS IS: a deterministic phrase control. It catches the promise SHAPES that
// CreditVector has decided not to publish (guaranteed outcomes, point figures,
// deletion results, legal conclusions) and rewrites them into educational phrasing.
// WHAT THIS IS NOT: a legal conclusion. Passing this scrubber does NOT establish
// CROA/FCRA/UDAAP compliance — it is one deterministic layer under the policy that
// counsel defines. Open questions are tracked in RC1-B05-COUNSEL-REVIEW.md.
//
// THE BAR IS THE PROMISE, NOT THE TOPIC. Explaining how credit scores work, what a
// bureau may do, or what the FCRA says is the product; over-blocking education is a
// real harm, so every rule requires a guarantee word, a promissory modal, or a
// specific point figure. Hedged teaching ("can improve your score over time", "your
// score may go up") is deliberately left alone.

// ── Pattern vocabulary ───────────────────────────────────────────────────────────
// Rules are composed from these fragments instead of being written as literals, so a
// single reword ("50 point increase" → "fifty-point increase guaranteed") does not
// walk around the control. A LITERAL SPACE in any fragment or rule source means
// "one or more separators" (spaces, newlines, hyphens/dashes, underscores) — that is
// what `sep()` rewrites it to. Sentence punctuation is NOT a separator, so a rule can
// never join two sentences.
const SEP = "[\\s\\u2010-\\u2015_-]+";
const OPT = "[\\s\\u2010-\\u2015_-]*";
const sep = (src: string) => src.replace(/ /g, SEP);
const rx = (src: string) => new RegExp(sep(src), "gi");

const ONES = "one|two|three|four|five|six|seven|eight|nine";
const TEENS = "ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen";
const TENS = "twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety";
// Digits and spelled-out numbers are the same claim: "50" ≡ "fifty" ≡ "a hundred".
const NUMW = `(?:(?:(?:${ONES}|a) )?hundred(?: (?:and )?(?:(?:${TENS})(?: (?:${ONES}))?|${TEENS}|${ONES}))?|(?:${TENS})(?:${OPT}(?:${ONES}))?|${TEENS}|${ONES})`;
const NUM = `(?:\\d{1,4}(?:${OPT}\\+)?|${NUMW})`;
// "50", "50+", "50-100", "50 to 100", "fifty to a hundred"
const RANGE = `${NUM}(?:${OPT}(?:to|through|-|–|—|or)${OPT}${NUM})?`;
// A point figure: "50 points", "50-100 pts", "fifty point", "100point"
const PTS = `(?:${RANGE}${OPT}(?:points?|pts?)\\b)`;

const UP = "(?:increases?|improvements?|boosts?|jumps?|gains?|bumps?|lifts?|rises?|climbs?|surges?|spikes?|hikes?|growth)";
const BETTER = "(?:higher|better|improved|bigger|stronger|excellent|perfect|great|good|top|elite|7\\d\\d|8\\d\\d)";
// Guarantee words, including the common misspellings/inflections.
// `g[ua]{1,2}rant` also covers the two dominant misspellings (garantee, gaurantee);
// no English word other than the guarantee family matches it.
const STRONG = "(?:g[ua]{1,2}rant(?:ee|y|ie)[a-z]{0,4}|promis(?:e|es|ed|ing)|pledg(?:e|es|ed))";
// Softer commitment verbs — only used where a subject makes the commitment explicit
// ("we assure you a higher score"), because "ensure your report is accurate" is fine.
const SOFT_G = `(?:${STRONG}|assur(?:e|es|ed|ance)|ensur(?:e|es|ed))`;
const CERT = "(?:definitely|certainly|absolutely|surely|for sure|no doubt|without fail|100 ?%|guaranteed)";
const DET = "(?:a|an|the|your|their|his|her|my|our|you)";

type Rule = {
  /** Plain-English statement of what this rule catches — shown in the admin rule
   *  inventory and used as the flag text, so the inventory reads as what is enforced. */
  label: string;
  pattern: RegExp;
  replacement: string;
  /** When true, the rule is NOT applied if the enclosing clause already negates the
   *  claim ("no score improvement is guaranteed", "a dispute does not guarantee a
   *  score increase"). Without this, the platform's own disclaimers and this file's
   *  own replacements would trip the rules that describe them. Residual limit: a
   *  claim smuggled into a clause that negates something ELSE could be sheltered —
   *  claimIsDisclaimed's contrast-marker reset handles the common form ("this is not
   *  legal advice, but we guarantee 50 points"), and the promissory-modal and
   *  offer-shaped rules below are deliberately NOT negatable as a second layer. */
  negatable?: boolean;
};

const PROHIBITED: Rule[] = [
  // — Outcome guarantees / over-promising (deletion) —
  {
    label: "asserting an account must be deleted",
    pattern: /\bthis account must be deleted\b/gi,
    replacement: "I request deletion of this account if it cannot be verified",
  },
  {
    label: "asserting the recipient is liable or legally required to delete",
    pattern: /\byou are (liable|required by law to delete)\b/gi,
    replacement: "you may have obligations under the FCRA",
  },
  {
    label: "first-person guarantee",
    pattern: /\bi guarantee\b/gi,
    replacement: "I expect",
  },
  {
    label: "a guarantee/promise attached to deletion or removal",
    pattern: rx(`\\b(?:100 ?% )?${STRONG} (?:${DET} )?(?:deletions?|removals?)\\b`),
    replacement: "requested deletion, which is never guaranteed",
    negatable: true,
  },
  {
    label: "deletion or removal asserted as guaranteed ('deletion guaranteed')",
    pattern: rx(`\\b(?:deletions?|removals?),? (?:is |are |it['’]s |it is |and |100 ?% |absolutely |fully )*${STRONG}\\b`),
    replacement: "requested deletion, which is never guaranteed",
    negatable: true,
  },
  {
    label: "predicting an item will be deleted/removed",
    pattern: rx(`\\b(?:will|shall|['’]ll|is going to|are going to|is gonna|are gonna|is guaranteed to|are guaranteed to) (?:${CERT} )?be (?:deleted|removed|erased|wiped|expunged|stricken)\\b`),
    replacement: "should be deleted if it cannot be verified",
  },
  {
    label: "100% removal claim",
    pattern: /\b100 ?% removal\b/gi,
    replacement: "removal of unverifiable items",
  },
  {
    label: "100% success/deletion/results claim",
    pattern: /\b100 ?% (?:success(?: rate)?|deletions?|results?|approval|guaranteed)\b/gi,
    replacement: "results that vary by individual situation",
  },
  {
    label: "claiming the recipient can be forced to delete",
    pattern: /\bforce (you|them|the bureau|the furnisher) to (delete|remove)\b/gi,
    replacement: "request deletion of unverifiable information",
  },
  {
    label: "a service claiming it deletes negative information",
    pattern: rx(`\\b(?:we|i|our team|this (?:service|program|company)) (?:can |will |do |absolutely )?(?:permanently )?(?:delete|remove|erase|wipe|scrub)s? (?:${DET} )?(?:all |any )?(?:negative|derogatory|bad|inaccurate|late|collections?|charge ?offs?)[a-z]*(?: (?:items?|accounts?|marks?|entries|records?|information|payments?))?\\b`),
    replacement: "we can help you dispute information you believe is inaccurate; deletion is never guaranteed",
  },
  {
    label: "claiming a result works every time / for everyone",
    pattern: rx("\\b(?:works|worked|works out) (?:every ?time|for everyone|every single time|100 ?% of the time)\\b"),
    replacement: "produces results that vary by individual situation",
  },

  // — Score-outcome promises (the DISCLAIMER below names score improvement as
  //   never-guaranteed; these are the rules that actually enforce it) —
  // Ordering: the most specific / longest-consuming rule runs first so a rewrite
  // never leaves a promissory fragment behind for a later rule to half-fix.
  {
    label: "a person or service guaranteeing/promising a credit-score outcome",
    pattern: rx(`\\b(we|i|they|you|our team|this (?:service|program|company|method|system)|the (?:program|service)) (?:can |will |do |really |always |definitely |absolutely )?${SOFT_G} (?:you )?(?:${DET} )?(?:${PTS} )?(?:${BETTER} )?(?:credit |fico )?scores?(?: ${UP})?\\b`),
    replacement: "$1 cannot guarantee any score outcome",
    negatable: true,
  },
  {
    label: "a guarantee/promise attached to a credit score ('guaranteed higher score')",
    pattern: rx(`\\b(?:100 ?% )?${STRONG} (?:${DET} )?(?:${PTS} )?(?:${BETTER} )?(?:credit |fico )?scores?(?: ${UP})?\\b`),
    replacement: "a score change that varies by individual credit profile and is never guaranteed",
    negatable: true,
  },
  {
    label: "a credit-score outcome asserted as guaranteed ('score increase guaranteed')",
    pattern: rx(`\\b(?:${PTS} )?(?:${BETTER} )?(?:credit |fico )?scores?(?: ${UP})?,? (?:is |are |it['’]s |it is |and |100 ?% |absolutely |fully )*${STRONG}\\b`),
    replacement: "a score change that varies by individual credit profile and is never guaranteed",
    negatable: true,
  },
  {
    label: "a guaranteed point figure ('guaranteed 50 points')",
    pattern: rx(`\\b(?:100 ?% )?${STRONG} (?:${DET} )?${PTS}(?: ${UP})?\\b`),
    replacement: "a point change that varies by individual credit profile and is never guaranteed",
    negatable: true,
  },
  {
    label: "a specific point figure presented as a score gain ('50 point increase')",
    pattern: rx(`\\b${PTS}(?: (?:credit |fico )?score)? ${UP}(?:,? (?:is |are )?${STRONG})?\\b`),
    replacement: "point change that varies by individual credit profile and is never guaranteed",
    // Negatable so consumer-protection teaching ("nobody can promise a 50 point
    // increase") survives; the contrast-marker reset in claimIsDisclaimed stops the
    // obvious smuggle ("this is not advice, but we guarantee a 50 point increase").
    negatable: true,
  },
  {
    label: "a score gain quantified in points ('score increase of 100 points')",
    pattern: rx(`\\b(?:credit |fico )?score ${UP} of (?:up to |at least |over |more than )?${PTS}\\b`),
    replacement: "score change that varies by individual credit profile and is never guaranteed",
  },
  {
    label: "offering to raise a score by a stated number of points",
    pattern: rx(`\\b(?:raise|raises|raising|boost|boosts|boosting|increase|increases|increasing|improve|improves|improving|lift|lifts|lifting|bump|bumps|jump|jumps|shoot|pump|pumps) (?:${DET} )?(?:credit |fico )?scores? by (?:up to |at least |as much as |over |more than |a full )?${RANGE}(?:${OPT}(?:points?|pts?)\\b)?`),
    replacement: "help you understand what moves a credit score; point changes vary by profile and are never guaranteed",
  },
  {
    label: "offering to add a stated number of points to a score",
    pattern: rx(`\\b(?:add|adds|adding|put|puts) ${PTS} (?:on)?to (?:${DET} )?(?:credit |fico )?scores?\\b`),
    replacement: "help you understand what moves a credit score; point changes vary by profile and are never guaranteed",
  },
  {
    label: "predicting a score will go up (promissory modal or certainty adverb)",
    pattern: rx(`\\b(?:credit |fico )?scores? (?:(?:${CERT} )?(?:will|shall|['’]ll|is going to|are going to|is gonna|are gonna|would|is guaranteed to|are guaranteed to)|definitely|certainly|absolutely|always) (?:${CERT} )?(?:go up|goes up|going up|increase|improve|rise|jump|climb|soar|skyrocket|shoot up|go higher|be higher|be better)(?: by ${PTS})?`),
    replacement: "score may change over time, and no outcome is guaranteed",
  },
  {
    // Contracted subject is captured so the rewrite keeps a sentence subject:
    // "We'll fix your score" → "We can help you understand ...".
    label: "promising to boost/fix a score (contracted subject)",
    pattern: rx(`\\b(we|i|they|you)['’]ll (?:${CERT} )?(?:boost|raise|increase|improve|fix|repair|rebuild|maximize|skyrocket) (?:${DET} )?(?:credit |fico )?scores?\\b`),
    replacement: "$1 can help you understand what influences a credit score, though no score outcome is guaranteed",
  },
  {
    label: "promising to boost/fix a score",
    pattern: rx(`\\b(?:will|going to|gonna|shall) (?:${CERT} )?(?:boost|raise|increase|improve|fix|repair|rebuild|maximize|skyrocket) (?:${DET} )?(?:credit |fico )?scores?\\b`),
    replacement: "can help you understand what influences a credit score, though no score outcome is guaranteed",
  },

  // — Legal-conclusion assertions (only an adjudicator can declare a violation) —
  { pattern: /\bthis (is|constitutes) fraud\b/gi, replacement: "this raises concerns that warrant investigation", label: "declaring conduct to be fraud" },
  { pattern: /\bthis is illegal\b/gi, replacement: "this raises concerns that warrant investigation", label: "declaring conduct to be illegal" },
  { pattern: /\b(you are|this is) in violation of (the )?(FCRA|FDCPA|the law)\b/gi, replacement: "this raises concerns under the $3", label: "declaring a statutory violation" },
  { pattern: /\bviolat(es|ed|ing) the (FCRA|FDCPA|law)\b/gi, replacement: "raises concerns under the $2", label: "declaring a statutory violation (verb form)" },

  // — "Failure to investigate" stated as fact → lawful adequacy challenge —
  { pattern: /\byou (failed|did not bother) to (investigate|reinvestigate)\b/gi, replacement: "the response does not appear to reflect a reasonable reinvestigation", label: "asserting the recipient failed to investigate" },
  { pattern: /\b(the )?(bureau|furnisher) failed to investigate\b/gi, replacement: "the response does not appear to reflect a reasonable reinvestigation", label: "asserting a bureau/furnisher failed to investigate" },

  // — Re-aging stated as fact → DOFD-inconsistency concern —
  { pattern: /\bthis account (is|has been) re-?aged\b/gi, replacement: "the date of first delinquency on this account appears inconsistent and warrants verification", label: "asserting an account was re-aged" },

  // — Unauthorized-inquiry stated as fact → non-recognition framing —
  { pattern: /\b(the|this) inquiry was unauthorized\b/gi, replacement: "I do not recognize any application or transaction that would authorize this inquiry", label: "asserting an inquiry was unauthorized" },

  // — Credit-repair deletion myths (§609 / Metro 2) —
  // NOTE: no leading \b before "§" — "§" is a non-word character, so \b can never
  // match in front of it and the literal "§609" spelling (the most common way this
  // myth is written) would slip the scrub entirely. Word boundaries are applied to
  // the word-initial branches only.
  {
    label: "the §609 deletion myth (claiming §609 compels deletion)",
    pattern: /(§\s?609|\b(?:section|fcra)\s?609\b)([^.]*?)\b(requires?|compels?|mandates?|forces?) (deletion|removal)\b/gi,
    replacement: "§609 entitles me to disclosure of my file; I separately dispute the item's accuracy under §611",
  },
  {
    label: "the Metro 2 deletion myth (claiming Metro 2 compels deletion)",
    pattern: /\bmetro\s?2\b([^.]*?)\b(requires?|compels?|mandates?) (deletion|removal)\b/gi,
    replacement: "the reported data appears internally inconsistent and warrants verification",
  },
];

// A claim that the surrounding clause already negates is not a promise — it is the
// disclaimer of one ("no score improvement is guaranteed", "a dispute does not
// guarantee a score increase"). Scope is the enclosing clause (bounded by sentence
// punctuation or a line break) and capped at NEGATION_WINDOW characters before the
// match, so a negation far upstream cannot license a downstream promise.
//
// A contrast marker RESETS the scope: in "this is not legal advice, but we guarantee
// 50 points", the negation belongs to the first half and must not shelter the promise
// in the second. Only the text after the last contrast marker is searched for a cue.
const NEGATION_WINDOW = 120;
const NEGATION_CUE =
  /\b(?:no|not|never|none|nothing|nobody|cannot|cant|neither|nor|without|unable|impossible|isnt|arent|wasnt|werent|wont|dont|doesnt|didnt|couldnt|wouldnt|shouldnt|rarely|seldom)\b/i;
const CONTRAST = /\b(?:but|however|yet|although|though|nevertheless|nonetheless|still|except|regardless)\b/i;

// Second carve-out: the claim is ATTRIBUTED to a third party in order to warn about
// it ("credit repair companies that promise guaranteed deletions are violating the
// CROA"). Warning consumers about the prohibited claim is the education this platform
// exists to deliver; rewriting it garbles the warning and, on member-authored
// surfaces, rejects the post outright. Requires an explicit third-party subject AND
// the absence of first-person voice in the same clause, so "we are a company that
// guarantees deletion" is still caught.
// The subject may be linked to the claim by a relative pronoun ("a company THAT
// promises…") or by a bare participle ("a company PROMISING…", "an ad GUARANTEEING…",
// "firms ADVERTISING…"), or the verb may simply follow ("some services CLAIM they
// will…"). Requiring the relative pronoun missed all three participial forms, so a
// member writing "firms advertising guaranteed deletions are usually scams" — a
// warning, and exactly the education this platform exists to deliver — was rejected
// outright by lib/community.ts. Accept any of the three links.
const THIRD_PARTY_SUBJECT =
  "(?:compan(?:y|ies)|services?|firms?|providers?|websites?|sites?|scam(?:s|mers)?|agencies|agency|shops?|ads?|advertisements?|people|anyone|anybody|others?)";
const THIRD_PARTY = new RegExp(
  `\\b${THIRD_PARTY_SUBJECT}\\b[^.]{0,40}?(?:` +
    `\\b(?:that|who|which)\\b` + // relative pronoun: "a company that promises"
    `|\\b\\w+ing\\b` + //          participle:        "a company promising"
    `|\\b(?:claim|promise|say|state|advertise|offer|guarantee)s?\\b` + // bare verb
    `)`,
  "i"
);
const FIRST_PERSON = /\b(?:we|i|our|us|my|creditvector)\b/i;

function claimIsDisclaimed(text: string, offset: number): boolean {
  const clause = text.slice(Math.max(0, offset - NEGATION_WINDOW), offset).split(/[.!?;:\n]/).pop() ?? "";
  // Fold apostrophes so "can't"/"can’t"/"cant" are one cue.
  const folded = clause.replace(/['’]/g, "");
  const afterContrast = folded.split(CONTRAST).pop() ?? "";
  if (NEGATION_CUE.test(afterContrast)) return true;

  // Attribution is checked over a window that extends PAST the offset, because the
  // word linking the third-party subject to the claim is often the matched text
  // itself: in "an ad guaranteeing a 100 point increase", the rule matches at
  // "guaranteeing", so everything before the offset is just "an ad" and a
  // backward-only window can never see the link. The forward span stops at the
  // first sentence break so attribution cannot leak across sentences, and the
  // first-person exclusion still applies to the whole window — "we are a company
  // that guarantees deletion" remains caught.
  const forward = text.slice(offset, offset + NEGATION_WINDOW).split(/[.!?;:\n]/)[0] ?? "";
  const attribution = (folded + forward).replace(/['’]/g, "");
  return THIRD_PARTY.test(attribution) && !FIRST_PERSON.test(attribution);
}

export interface ComplianceResult {
  text: string;
  flags: string[];
}

export function applyCompliance(input: string): ComplianceResult {
  let text = input;
  const flags: string[] = [];
  for (const rule of PROHIBITED) {
    let hit = false;
    const next = text.replace(rule.pattern, (...args) => {
      const match = args[0] as string;
      const offset = args[args.length - 2] as number;
      const whole = args[args.length - 1] as string;
      if (rule.negatable && claimIsDisclaimed(whole, offset)) return match;
      hit = true;
      // $1..$9 only — no rule uses $&/$'/$$ (pinned by scripts/compliance-bar.test.ts).
      const groups = args.slice(1, -2) as (string | undefined)[];
      return rule.replacement.replace(/\$(\d)/g, (_m, d: string) => groups[Number(d) - 1] ?? "");
    });
    if (hit) {
      flags.push(`Adjusted prohibited phrasing: ${rule.label}`);
      text = next;
    }
  }
  return { text, flags };
}

// Human-readable list of the prohibited-phrase rules, for the admin compliance view.
// Derived from PROHIBITED (never hand-maintained) so the inventory cannot drift from
// what is enforced, and it states the negation carve-out where one applies.
export const COMPLIANCE_RULES = PROHIBITED.map(
  (r) =>
    `${r.label}${r.negatable ? " [not applied when the clause itself negates the claim]" : ""} · /${r.pattern.source}/i`,
);

export const DISCLAIMER =
  "Educational Purpose Disclaimer: CreditVector™, a Gabriel Capital Labs platform, is an AI-powered educational tool that helps consumers understand their credit reports and dispute rights under the Fair Credit Reporting Act (FCRA). This platform does not provide legal advice, credit repair services, or guarantees of any outcome. No deletion, correction, or score improvement is guaranteed. Results vary based on individual circumstances and the accuracy of reported information. Consult a licensed attorney for legal guidance.";
