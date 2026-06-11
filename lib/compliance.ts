// Compliance Mode: scrub guarantees and illegal/over-promising language from any
// generated letter. Runs on the FINAL letter text before it is saved or shown.
const PROHIBITED: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\bthis account must be deleted\b/gi, replacement: "I request deletion of this account if it cannot be verified" },
  { pattern: /\byou are (liable|required by law to delete)\b/gi, replacement: "you may have obligations under the FCRA" },
  { pattern: /\bi guarantee\b/gi, replacement: "I expect" },
  { pattern: /\bguaranteed deletion\b/gi, replacement: "requested deletion" },
  { pattern: /\bwill be deleted\b/gi, replacement: "should be deleted if it cannot be verified" },
  { pattern: /\b100% removal\b/gi, replacement: "removal of unverifiable items" },
  { pattern: /\bforce (you|the bureau) to delete\b/gi, replacement: "request deletion of unverifiable information" },
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

export const DISCLAIMER =
  "Educational Purpose Disclaimer: Gabriel Capital Labs is an AI-powered educational tool that helps consumers understand their credit reports and dispute rights under the Fair Credit Reporting Act (FCRA). This platform does not provide legal advice, credit repair services, or guarantees of any outcome. No deletion, correction, or score improvement is guaranteed. Results vary based on individual circumstances and the accuracy of reported information. Consult a licensed attorney for legal guidance.";
