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
