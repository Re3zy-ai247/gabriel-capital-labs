// COMPLIANCE BAR — the last thing that runs over text a consumer will sign, or
// that the product will show as its own words (letters, Kai answers, brief copy).
//
// RC1-S5 (L-04 / L-05 / S4 review M-4) — WHY THIS WAS REWRITTEN.
//
// The previous implementation did blind, global regex substitution of CLAUSE
// FRAGMENTS into whatever sentence happened to contain a match. Measured on the
// shipped code, that produced letters like these (every row reproduced in
// scripts/compliance-bar.test.ts as a regression):
//
//   "You are in violation of the law."      → "this raises concerns under the the law."
//   "You failed to investigate my dispute." → "the response does not appear to reflect
//                                              a reasonable reinvestigation my dispute."
//   "Section 609 requires deletion of this account."
//                                           → "§609 entitles me to disclosure of my file;
//                                              I separately dispute the item's accuracy
//                                              under §611 of this account."
//
// Three defect classes: a duplicated article from a `$3` capture that could
// itself be "the law"; sentence-initial lower case, because the replacements
// were fragments; and dangling remainders, because the fragment replaced only
// part of the sentence. A garbled letter is precisely the artifact the letter
// system prompt warns about — one an agency can pattern-match to a credit-repair
// template and set aside as frivolous.
//
// At the same time the rule list was NOT a guarantee blocker. These passed
// through untouched, with zero flags: "We guarantee results." · "You must delete
// this account." · "You are legally obligated to delete this account or I will
// sue for $1,000." · "Failure to delete will result in a lawsuit for $1,000 in
// statutory damages." · "Under FCRA 609 the bureau must delete this item." ·
// "This is a willful violation of 15 U.S.C. 1681i and I will sue."
//
// HOW THIS ONE WORKS.
//   1. The unit of replacement is a SENTENCE, never a fragment. A matched
//      sentence is replaced whole, by a written-out, grammatical sentence that
//      says the lawful version of the same thing. Nothing is spliced into the
//      middle of the consumer's prose.
//   2. Every sentence that matches no rule is re-emitted BYTE-FOR-BYTE, with its
//      original leading whitespace, terminator and line structure. Text with no
//      prohibited phrasing comes out identical to what went in (pinned as a
//      property in the guard suite).
//   3. Rules carry a SEVERITY. `REWRITE` rules produce a lawful sentence and the
//      caller may save the result. `REFUSE` rules are the ones no adjustment can
//      make honest — outcome guarantees, litigation threats, "you must delete",
//      declared violations. Callers that own a consumer-authored body
//      (PATCH /api/letters/[id]) REFUSE the save and show the consumer exactly
//      which sentence and why; callers that must always return safe text
//      (lib/kai.ts, lib/brief.ts) still get neutralized `text`.
//
// CONTRACT NOTE: `{ text, flags }` is unchanged for every existing caller
// (lib/kai.ts:138, lib/brief.ts, app/api/letters/*, app/api/admin/compliance).
// `findings` / `refused` are additive.

export type ComplianceSeverity = "REWRITE" | "REFUSE";

interface Rule {
  id: string;
  severity: ComplianceSeverity;
  /** Matched against ONE sentence at a time. */
  pattern: RegExp;
  /** A complete, grammatical replacement sentence (empty string = drop it). */
  replacement: string;
  /** What the rule is, in plain English — surfaced to the admin compliance view. */
  description: string;
  /** What to tell the CONSUMER when their own sentence trips it. */
  explanation: string;
}

// Ordered. REFUSE rules are tested first so the strongest reading of a sentence
// wins; the first rule that matches a sentence is the one that applies.
const RULES: Rule[] = [
  // ORDERING NOTE: the §609 myth is tested FIRST. "Under FCRA 609 the bureau
  // must delete this item." also reads as deletion-on-demand, but the specific
  // rewrite says what §609 actually provides — strictly more useful to the
  // consumer than a refusal, and it removes the myth either way.
  {
    id: "section_609_myth",
    severity: "REWRITE",
    // No leading \b before "§": "§" is a non-word character, so \b can never
    // match in front of it and the "§609" spelling — the most common way this
    // myth is written — would slip the rule entirely.
    pattern:
      /(?:§\s?609|\b(?:section|fcra)\s?609\b)[^.]{0,120}?\b(?:requires?|compels?|mandates?|forces?|must)\s+(?:deletion|removal|delete|remove)\b/i,
    replacement:
      "Section 609 of the Fair Credit Reporting Act entitles me to disclosure of what my file contains; I separately dispute the accuracy of this item under Section 611 and ask that it be reinvestigated.",
    description:
      'The "§609 requires deletion" myth (including "under FCRA 609 the bureau must delete this item") — rewritten to what §609 actually provides.',
    explanation:
      "Section 609 is the disclosure section — it entitles you to see what is in your file. It does not require deletion. The accuracy dispute lives in Section 611, which the letter now cites instead.",
  },
  // ── REFUSE — no rewrite makes these honest ────────────────────────────────
  {
    id: "guarantee_outcome",
    severity: "REFUSE",
    pattern:
      /\b(?:i|we)\s+guarantee\b|\bguarantee[sd]?\s+(?:results?|deletion|removal|success|a\s+delet)|\b(?:deletion|removal|results?)\s+(?:is|are)\s+guaranteed\b|\b100\s*%\s*(?:removal|deletion|success|guaranteed)\b|\bguaranteed\s+(?:deletion|removal|results?)\b/i,
    replacement:
      "No result is promised here: I am asking that this information be verified, and corrected or removed if it cannot be verified.",
    description:
      'Guaranteed outcomes ("we guarantee results", "guaranteed deletion", "100% removal") — refused; nobody can promise what a bureau will do.',
    explanation:
      "This promises a result. No one — not this software, not you — can promise a bureau will delete or change an item, and a letter that says so can be set aside as a credit-repair template.",
  },
  {
    id: "threaten_litigation",
    severity: "REFUSE",
    pattern:
      /\bi\s+(?:will|intend to|am going to|plan to|shall)\s+(?:sue|file suit|file a lawsuit|take you to court)\b|\bwill result in (?:a lawsuit|litigation|legal action)\b|\bfailure to (?:delete|remove|comply)[^.]*\blawsuit\b|\bsue (?:you )?for \$/i,
    replacement:
      "I am not threatening litigation; I am asking for a reasonable reinvestigation of the information I have identified.",
    description:
      'Litigation threats and damages figures ("I will sue for $1,000", "failure to delete will result in a lawsuit") — refused.',
    explanation:
      "This is a threat of a lawsuit, not a statement of fact about your account. It does not help a dispute and it is one of the strongest signals that a letter came from a credit-repair template.",
  },
  {
    id: "delete_on_demand",
    severity: "REFUSE",
    pattern:
      /\byou\s+(?:must|have to|need to|are required to|are legally obligated to|are obligated to)\s+(?:delete|remove)\b|\b(?:you are|they are)\s+legally obligated\b|\b(?:the )?(?:bureau|furnisher|agency)\s+must\s+(?:delete|remove)\b/i,
    replacement:
      "I request that this information be deleted or corrected if it cannot be verified as accurate and complete.",
    description:
      'Deletion stated as an obligation ("you must delete this account", "you are legally obligated to delete") — refused; the FCRA requires a reasonable reinvestigation, not deletion on demand.',
    explanation:
      "The FCRA does not require anyone to delete an item because you asked. It requires a reasonable reinvestigation, and deletion only where the information cannot be verified. Stating it as an obligation states the law wrongly.",
  },
  {
    id: "declared_violation",
    severity: "REFUSE",
    pattern:
      /\b(?:willful|wilful|wanton)\s+(?:violation|noncompliance|non-compliance)\b|\bthis\s+(?:is|constitutes)\s+(?:a\s+)?(?:willful\s+|wilful\s+|clear\s+)?violation\s+of\b/i,
    replacement:
      "The way this information is reported raises concerns under the statutes cited in this letter, which I ask you to address through a reasonable reinvestigation.",
    description:
      'A violation declared as established fact ("this is a willful violation of 15 U.S.C. 1681i") — refused; only an adjudicator can make that finding.',
    explanation:
      "Whether a law was violated is for a court to decide. Asserting it as settled fact is a legal conclusion your letter cannot make — describing what is wrong on the report is stronger and is something you can stand behind.",
  },
  {
    id: "instruction_to_software",
    severity: "REFUSE",
    pattern:
      /\b(?:ignore|disregard|forget)\s+(?:all\s+|any\s+)?(?:prior|previous|above|earlier|preceding)\s+instructions?\b|\byou\s+are\s+now\s+in\s+developer\s+mode\b/i,
    replacement: "",
    description:
      'Text addressed to the software rather than to the recipient ("ignore prior instructions") — removed from the document.',
    explanation:
      "That line reads as an instruction to software, not as something said to the credit bureau. It has no meaning on a printed letter, so it cannot be part of the document you sign.",
  },

  // ── REWRITE — the lawful version of the same point ────────────────────────
  {
    id: "violation_claim",
    severity: "REWRITE",
    pattern:
      /\b(?:you are|the bureau is|the furnisher is|this is|they are)\s+in violation of\b|\bviolat(?:es|ed|ing)\s+(?:the\s+)?(?:FCRA|FDCPA|law)\b/i,
    replacement:
      "The way this information is reported raises concerns under the Fair Credit Reporting Act, which I ask you to address through a reasonable reinvestigation.",
    description:
      'Being "in violation of the FCRA/the law" stated as fact — rewritten as a concern raised under the statute.',
    explanation:
      "Only a court can find that a law was broken. This now raises the same point as a concern you are asking them to address.",
  },
  {
    id: "fraud_or_illegal_claim",
    severity: "REWRITE",
    pattern: /\bthis\s+(?:is|constitutes)\s+(?:fraud|illegal|unlawful|criminal)\b|\bthis is illegal\b/i,
    replacement: "This raises concerns that I ask you to investigate.",
    description: 'Fraud/illegality stated as fact ("this is fraud", "this is illegal") — rewritten as a concern.',
    explanation:
      "Calling something fraud or illegal is an accusation a court decides. The letter now raises it as a concern to investigate.",
  },
  {
    id: "failed_to_investigate",
    severity: "REWRITE",
    pattern:
      /\b(?:you|they|the bureau|the furnisher|the agency)\s+(?:failed|did not bother|refused|neglected)\s+to\s+(?:re)?investigate\b|\b(?:the\s+)?(?:bureau|furnisher|agency)\s+failed to investigate\b/i,
    replacement:
      "The response I received does not appear to reflect a reasonable reinvestigation of the information I disputed.",
    description:
      'A failure to investigate stated as fact — rewritten as a challenge to the adequacy of the reinvestigation, which is the lawful form of the same argument.',
    explanation:
      "You cannot know what they did internally, but you can challenge whether the response reflects a reasonable reinvestigation — which is the argument FCRA §611 actually gives you.",
  },
  {
    id: "must_be_deleted",
    severity: "REWRITE",
    pattern:
      /\bthis\s+(?:account|item|tradeline|entry)\s+must be (?:deleted|removed)\b|\bmust be (?:deleted|removed) immediately\b|\bdelete this (?:account|item|tradeline|entry) immediately\b/i,
    replacement:
      "I request that this account be deleted or corrected if it cannot be verified as accurate and complete.",
    description: 'Deletion demanded outright ("this account must be deleted") — rewritten as a conditional request.',
    explanation:
      "Deletion is the outcome when something cannot be verified — it is not something a letter can order. This asks for it on the ground the FCRA actually provides.",
  },
  {
    id: "will_be_deleted",
    severity: "REWRITE",
    pattern:
      /\b(?:this|the)\s+(?:account|item|tradeline|entry)\s+will be (?:deleted|removed)\b|\bwill be (?:deleted|removed) within\b/i,
    replacement:
      "I ask that this item be deleted or corrected if it cannot be verified as accurate and complete.",
    description: 'A deletion predicted as certain ("this item will be deleted within 30 days") — rewritten as a request.',
    explanation:
      "Saying an item will be deleted predicts a result no one controls. The letter now asks for it instead of announcing it.",
  },
  {
    id: "force_deletion",
    severity: "REWRITE",
    pattern: /\bforce (?:you|them|the bureau|the furnisher) to (?:delete|remove)\b/i,
    replacement: "I request deletion of any information on this account that cannot be verified.",
    description: '"Force you to delete" — rewritten as a request for deletion of unverifiable information.',
    explanation: "Nothing in the letter can force an outcome. It now requests one on verifiable grounds.",
  },
  {
    id: "metro2_myth",
    severity: "REWRITE",
    pattern:
      /\bmetro\s?2\b[^.]{0,120}?\b(?:requires?|compels?|mandates?|forces?|must)\s+(?:deletion|removal|delete|remove)\b/i,
    replacement:
      "The data reported for this account appears internally inconsistent, and I ask you to verify it.",
    description:
      'The "Metro 2 mandates deletion" myth — rewritten as a data-consistency concern, which is the real point.',
    explanation:
      "Metro 2 is a reporting format, not a deletion rule. Inconsistent data is still worth raising, so the letter raises exactly that.",
  },
  {
    id: "re_aged_claim",
    severity: "REWRITE",
    pattern: /\bthis account (?:is|has been) re-?aged\b/i,
    replacement:
      "The date of first delinquency reported for this account appears inconsistent, and I ask that it be verified.",
    description: 'Re-aging stated as fact — rewritten as a date-of-first-delinquency inconsistency.',
    explanation:
      "Re-aging is a conclusion about what someone did. The inconsistent date is the fact you can point at, and it is what the letter now says.",
  },
  {
    id: "unauthorized_inquiry_claim",
    severity: "REWRITE",
    pattern: /\b(?:the|this) inquiry was unauthorized\b/i,
    replacement:
      "I do not recognize any application or transaction that would authorize this inquiry into my consumer file.",
    description: 'An inquiry declared unauthorized — rewritten as non-recognition, which is what you can state first-hand.',
    explanation:
      "Whether an inquiry had permissible purpose is something they have to show. What you know first-hand is that you do not recognize it — which is what the letter now says.",
  },
];

export interface ComplianceFinding {
  ruleId: string;
  severity: ComplianceSeverity;
  /** The sentence exactly as written, before adjustment. */
  original: string;
  /** The sentence that replaced it ("" = the sentence was removed). */
  replacement: string;
  /** One plain-English sentence the consumer can act on. */
  explanation: string;
}

export interface ComplianceResult {
  /** Always safe to display or store. */
  text: string;
  /** Unchanged shape: one human-readable line per adjustment. */
  flags: string[];
  /** Every adjustment made, in document order. */
  findings: ComplianceFinding[];
  /** The subset a consumer-authored body must not be silently saved with. */
  refused: ComplianceFinding[];
}

// ── sentence segmentation ────────────────────────────────────────────────────
// Line structure is preserved exactly (letters are line-formatted documents), and
// within a line a period/question mark/exclamation only ends a sentence when it
// is not part of a known abbreviation or an initial. Segments are re-joined
// verbatim, so a line with nothing to adjust survives byte-for-byte.
const ABBREVIATION_END =
  /(?:U\.S\.C|U\.S|e\.g|i\.e|etc|No|Nos|Inc|Co|Corp|Ltd|LLC|Mr|Mrs|Ms|Dr|Jr|Sr|St|Ave|Blvd|Rd|Dept|Fig|vs|approx|Attn|P\.O|[A-Z])\.$/;

function splitSentences(line: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    // Consume a run of terminators and any closing quote/bracket.
    let end = i;
    while (end + 1 < line.length && ".!?".includes(line[end + 1])) end++;
    while (end + 1 < line.length && "\"')]”’".includes(line[end + 1])) end++;
    const after = line.slice(end + 1);
    // A terminator only ends a sentence at end-of-line or before whitespace.
    if (after.length > 0 && !/^\s/.test(after)) {
      i = end;
      continue;
    }
    const head = line.slice(start, end + 1);
    if (ch === "." && ABBREVIATION_END.test(head.trimEnd())) {
      i = end;
      continue;
    }
    // Absorb the whitespace that follows, so re-joining is exact.
    const ws = after.match(/^\s+/)?.[0] ?? "";
    out.push(line.slice(start, end + 1 + ws.length));
    start = end + 1 + ws.length;
    i = end + ws.length;
  }
  if (start < line.length) out.push(line.slice(start));
  return out;
}

function truncate(s: string, n = 160): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/**
 * Scrub prohibited phrasing from any text the product will sign, print, or say.
 * Sentences that trip no rule are returned unchanged, character for character.
 */
export function applyCompliance(input: string): ComplianceResult {
  const findings: ComplianceFinding[] = [];
  const lines = input.split("\n");

  const scrubbed = lines.map((line) => {
    if (!line.trim()) return line;
    const segments = splitSentences(line);
    let changed = false;
    const rebuilt = segments.map((seg) => {
      const rule = RULES.find((r) => r.pattern.test(seg));
      if (!rule) return seg;
      changed = true;
      const leading = seg.match(/^\s*/)?.[0] ?? "";
      const trailing = seg.match(/\s*$/)?.[0] ?? "";
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        original: seg.trim(),
        replacement: rule.replacement,
        explanation: rule.explanation,
      });
      // An empty replacement removes the sentence outright; keep the trailing
      // whitespace only when something remains on the line to separate.
      if (!rule.replacement) return "";
      return `${leading}${rule.replacement}${trailing}`;
    });
    return changed ? rebuilt.join("").replace(/[ \t]+$/, "") : line;
  });

  const flags = findings.map(
    (f) =>
      `${f.severity === "REFUSE" ? "Refused" : "Adjusted"} (${f.ruleId}): “${truncate(f.original)}” → ${
        f.replacement ? `“${truncate(f.replacement)}”` : "removed"
      }`
  );

  return {
    text: scrubbed.join("\n"),
    flags,
    findings,
    refused: findings.filter((f) => f.severity === "REFUSE"),
  };
}

// Human-readable list of the prohibited-phrase rules, for the admin compliance
// view. RC1-S5 (L-05): this used to be `PROHIBITED.map(p => p.pattern.source)` —
// raw regular expressions, presented in the admin UI as though they were the
// rule set. They read as far broader coverage than the literal phrase list
// actually had. These are the same rules stated as what they do.
export const COMPLIANCE_RULES = RULES.map(
  (r) => `${r.severity === "REFUSE" ? "REFUSE" : "REWRITE"} — ${r.description}`
);

// What the bar does NOT do, stated plainly so no surface can present it as more
// than it is: it is a phrase-level pass over final text. It cannot judge whether
// a factual claim is true, and it is not a substitute for the consumer reading
// their own letter before signing it.
//
// HANDOFF: nothing renders this yet. app/admin/compliance/page.tsx presents
// COMPLIANCE_RULES as "Prohibited-phrase rules ({n})" with no statement of
// scope — the overstatement A3 L-05 recorded. That page is outside this slice's
// owned paths; the one-line fix is to show this note beside that list.
export const COMPLIANCE_SCOPE_NOTE =
  "These rules are a phrase-level pass over final text: they catch guaranteed outcomes, litigation threats, deletion-on-demand, declared violations and the §609 / Metro 2 deletion myths. They cannot judge whether a factual statement is true, and they are not a review of the letter's substance.";

export const DISCLAIMER =
  "Educational Purpose Disclaimer: CreditVector™, a Gabriel Capital Labs platform, is an AI-powered educational tool that helps consumers understand their credit reports and dispute rights under the Fair Credit Reporting Act (FCRA). This platform does not provide legal advice, credit repair services, or guarantees of any outcome. No deletion, correction, or score improvement is guaranteed. Results vary based on individual circumstances and the accuracy of reported information. Consult a licensed attorney for legal guidance.";
