// Compliance Mode: scrub guarantees and illegal/over-promising language from any
// generated letter. Runs on the FINAL letter text before it is saved or shown.
const PROHIBITED: { pattern: RegExp; replacement: string }[] = [
  // — Outcome guarantees / over-promising —
  { pattern: /\bthis account must be deleted\b/gi, replacement: "I request deletion of this account if it cannot be verified" },
  { pattern: /\byou are (liable|required by law to delete)\b/gi, replacement: "you may have obligations under the FCRA" },
  { pattern: /\bi guarantee\b/gi, replacement: "I expect" },
  { pattern: /\bguaranteed deletion\b/gi, replacement: "requested deletion" },
  { pattern: /\bwill be deleted\b/gi, replacement: "should be deleted if it cannot be verified" },
  { pattern: /\b100% removal\b/gi, replacement: "removal of unverifiable items" },
  { pattern: /\bforce (you|the bureau) to delete\b/gi, replacement: "request deletion of unverifiable information" },

  // — Score-outcome promises (the DISCLAIMER below names score improvement as
  //   never-guaranteed; these are the rules that actually enforce it) —
  // The BAR IS PROMISES, NOT THE TOPIC: explaining how scores work is educational and
  // must pass untouched, so every pattern requires a guarantee, a promissory modal, or
  // a specific point figure. Hedged teaching ("can improve your score over time",
  // "your score may go up") is deliberately left alone.
  // Ordering note: the specific "guarantee + score" rule runs BEFORE the bare
  // point-figure rules so it consumes the whole promise instead of leaving a fragment,
  // and the "by N points" rule runs before the generic modal rule for the same reason.
  { pattern: /\bguaranteed (?:\d+\+?[-\s]?point )?(?:credit )?score (increase|improvement|boost|jump|gain)\b/gi, replacement: "possible score change, which is never guaranteed" },
  { pattern: /\bguaranteed (higher|better|improved) (?:credit )?score\b/gi, replacement: "possible score change, which is never guaranteed" },
  { pattern: /\b(we|i|they) (?:guarantee|promise)s? (?:you )?(?:a |an )?(?:\d+\+?[-\s]?point )?(?:higher |better |improved )?(?:credit )?scores?(?: (?:increase|improvement|boost|jump|gain))?\b/gi, replacement: "$1 cannot guarantee any score outcome" },
  { pattern: /\b(?:raise|boost|increase|improve|lift|add) (?:your |their |his |her |the )?(?:credit )?scores? by (?:up to )?\d+\+?(?: ?points?)?/gi, replacement: "help you understand what moves a credit score; point changes vary by profile and are never guaranteed" },
  { pattern: /\b\d+\+?[-\s]?points?(?: score)? (?:increase|boost|jump|gain|improvement)\b/gi, replacement: "point change that varies by individual credit profile and is never guaranteed" },
  { pattern: /\b(?:credit )?score (?:increase|boost|jump|gain|improvement) of \d+\+? ?points?\b/gi, replacement: "score change that varies by individual credit profile and is never guaranteed" },
  { pattern: /\b(?:your |their |the )?(?:credit )?scores? will (?:go up|increase|improve|rise|jump|climb)(?: by \d+\+? ?points?)?/gi, replacement: "your score may change over time, and no score outcome is guaranteed" },
  { pattern: /\b(?:will|we'll|i'll|going to) (?:boost|raise|increase|improve|fix|repair) (?:your |their |his |her |the )?(?:credit )?scores?\b/gi, replacement: "can help you understand what influences your credit score, though no score outcome is guaranteed" },

  // — Legal-conclusion assertions (only an adjudicator can declare a violation) —
  { pattern: /\bthis (is|constitutes) fraud\b/gi, replacement: "this raises concerns that warrant investigation" },
  { pattern: /\bthis is illegal\b/gi, replacement: "this raises concerns that warrant investigation" },
  { pattern: /\b(you are|this is) in violation of (the )?(FCRA|FDCPA|the law)\b/gi, replacement: "this raises concerns under the $3" },
  { pattern: /\bviolat(es|ed|ing) the (FCRA|FDCPA|law)\b/gi, replacement: "raises concerns under the $2" },

  // — "Failure to investigate" stated as fact → lawful adequacy challenge —
  { pattern: /\byou (failed|did not bother) to (investigate|reinvestigate)\b/gi, replacement: "the response does not appear to reflect a reasonable reinvestigation" },
  { pattern: /\b(the )?(bureau|furnisher) failed to investigate\b/gi, replacement: "the response does not appear to reflect a reasonable reinvestigation" },

  // — Re-aging stated as fact → DOFD-inconsistency concern —
  { pattern: /\bthis account (is|has been) re-?aged\b/gi, replacement: "the date of first delinquency on this account appears inconsistent and warrants verification" },

  // — Unauthorized-inquiry stated as fact → non-recognition framing —
  { pattern: /\b(the|this) inquiry was unauthorized\b/gi, replacement: "I do not recognize any application or transaction that would authorize this inquiry" },

  // — Credit-repair deletion myths (§609 / Metro 2) —
  // NOTE: no leading \b before "§" — "§" is a non-word character, so \b can never
  // match in front of it and the literal "§609" spelling (the most common way this
  // myth is written) would slip the scrub entirely. Word boundaries are applied to
  // the word-initial branches only.
  { pattern: /(§\s?609|\b(?:section|fcra)\s?609\b)([^.]*?)\b(requires?|compels?|mandates?|forces?) (deletion|removal)\b/gi, replacement: "§609 entitles me to disclosure of my file; I separately dispute the item's accuracy under §611" },
  { pattern: /\bmetro\s?2\b([^.]*?)\b(requires?|compels?|mandates?) (deletion|removal)\b/gi, replacement: "the reported data appears internally inconsistent and warrants verification" },
];

export interface ComplianceResult {
  text: string;
  flags: string[];
}

export function applyCompliance(input: string): ComplianceResult {
  let text = input;
  const flags: string[] = [];
  for (const rule of PROHIBITED) {
    if (rule.pattern.test(text)) {
      flags.push(`Adjusted prohibited phrasing: ${rule.pattern.source}`);
      text = text.replace(rule.pattern, rule.replacement);
    }
  }
  return { text, flags };
}

// Human-readable list of the prohibited-phrase rules, for the admin compliance view.
export const COMPLIANCE_RULES = PROHIBITED.map((p) => p.pattern.source);

export const DISCLAIMER =
  "Educational Purpose Disclaimer: CreditVector™, a Gabriel Capital Labs platform, is an AI-powered educational tool that helps consumers understand their credit reports and dispute rights under the Fair Credit Reporting Act (FCRA). This platform does not provide legal advice, credit repair services, or guarantees of any outcome. No deletion, correction, or score improvement is guaranteed. Results vary based on individual circumstances and the accuracy of reported information. Consult a licensed attorney for legal guidance.";
