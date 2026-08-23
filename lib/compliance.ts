// COMPLIANCE BAR — the last thing that runs over text a consumer will sign, or
// that the product will show as its own words (letters, Kai answers, brief copy,
// community posts).
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
//   2. Sentences are LOGICAL, not physical lines (review M-3): a paragraph is
//      segmented into sentences with soft line breaks treated as spaces, and the
//      match is tested against a whitespace-normalized probe. So a prohibited
//      phrase that straddles a newline — "We\nguarantee results." — is caught as
//      one sentence and replaced as one sentence, instead of leaving "We" in
//      front of the replacement (the very dangling-remainder defect above) or
//      slipping through entirely.
//   3. Every sentence that matches no rule is re-emitted BYTE-FOR-BYTE, with its
//      original leading whitespace, terminator and line structure. Text with no
//      prohibited phrasing comes out identical to what went in (pinned as a
//      property in the guard suite).
//   4. Findings carry a SEVERITY and a PARTIAL flag, and rules carry a BAR.
//      See the two sections below — they are what callers act on.
//
// SEVERITY + PARTIAL — WHOSE WORDS ARE BEING REPLACED (review H-1).
//   `REWRITE` produces a lawful sentence; `REFUSE` is what no adjustment can
//   make honest. But the distinction that matters for CONSUMER-AUTHORED text is
//   not severity — it is whether the rule matched the WHOLE sentence or only
//   part of it. "You failed to investigate my dispute." is entirely the
//   prohibited claim: replacing it loses nothing. "I paid this account in full
//   in March 2023 and you failed to investigate my dispute." is the same claim
//   welded to the consumer's evidence, and replacing the sentence deletes the
//   payment date they are disputing on. So every finding reports `partial`
//   (matched span shorter than the sentence), and the consumer-edit path
//   (PATCH /api/letters/[id]) REFUSES to save a partial match, handing back the
//   sentence, the reason and the suggested wording for the consumer to adopt in
//   their own words. Callers that must always return safe text (lib/kai.ts,
//   lib/brief.ts, the letter composers) still get neutralized `text`.
//
// BAR — WHICH SURFACE IS BEING SCREENED (review M-2).
//   `lib/community.ts:144` and `lib/brief.ts:347` reject a post outright when
//   `flags.length > 0`. Widening the rule set therefore silently tightened
//   MODERATION, and blocked consumers describing their own experience ("Round 3
//   done. Still reported. I will sue for $1,000 if they keep this up."). Rules
//   that are prohibited *in a document the consumer signs and mails* but are
//   ordinary speech in a forum post are marked `bar: "signed-letter"` and are
//   off by default. `applyCompliance(text)` — every existing caller — is at the
//   BASE bar; the letter surfaces pass `{ bar: "signed-letter" }` explicitly.
//
// CONTRACT NOTE: `{ text, flags }` is unchanged for every existing caller
// (lib/kai.ts:138, lib/brief.ts, lib/community.ts, app/api/letters/*,
// app/api/admin/compliance). `findings` / `refused` are additive, and the second
// parameter is optional.

export type ComplianceSeverity = "REWRITE" | "REFUSE";

/** Which surface is being screened. See "BAR" above. */
export type ComplianceBar = "base" | "signed-letter";

interface Rule {
  id: string;
  severity: ComplianceSeverity;
  /** "signed-letter" rules are OFF unless the caller asks for that bar. */
  bar: ComplianceBar;
  /** Matched against ONE whitespace-normalized sentence at a time. */
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
    bar: "base",
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
    bar: "base",
    // Review L-1: "I guarantee I mailed this on October 1." is a statement about
    // the consumer's OWN conduct, not a promise of an outcome. The rule now
    // requires the guarantee to be ABOUT something — a result, a deletion, or
    // the item itself — so a first-person factual assurance passes.
    pattern:
      /\b(?:i|we)\s+guarantee\s+(?:that\s+)?(?:this|that|the|it|they|your|you'll|you will|results?|deletion|removal|success)\b|\bguarantee[sd]?\s+(?:results?|deletion|removal|success)\b|\b(?:deletion|removal|results?)\s+(?:is|are)\s+guaranteed\b|\b100\s*%\s*(?:removal|deletion|success|guaranteed)\b|\bguaranteed\s+(?:deletion|removal|results?)\b|,\s*guaranteed\s*[.!?]?$/i,
    replacement:
      "No result is promised here: I am asking that this information be verified, and corrected or removed if it cannot be verified.",
    description:
      'Guaranteed outcomes ("we guarantee results", "guaranteed deletion", "100% removal", "…, guaranteed") — refused; nobody can promise what a bureau will do.',
    explanation:
      "This promises a result. No one — not this software, not you — can promise a bureau will delete or change an item, and a letter that says so can be set aside as a credit-repair template.",
  },
  {
    id: "threat_of_suit_consequence",
    severity: "REFUSE",
    bar: "base",
    pattern:
      /\bwill result in (?:a lawsuit|litigation|legal action)\b|\bfailure to (?:delete|remove|comply)[^.]{0,80}\blawsuit\b/i,
    replacement:
      "I am not threatening litigation; I am asking for a reasonable reinvestigation of the information I have identified.",
    description:
      'Consequence-style litigation threats ("failure to delete will result in a lawsuit for $1,000") — refused.',
    explanation:
      "This is a threat of a lawsuit, not a statement of fact about your account. It does not help a dispute and it is one of the strongest signals that a letter came from a credit-repair template.",
  },
  {
    id: "threat_of_suit_personal",
    severity: "REFUSE",
    // Review M-2: "Round 3 done. Still reported. I will sue for $1,000 if they
    // keep this up." is a consumer describing their own plan — ordinary speech
    // in the community, and the base rule set never blocked it. In a signed
    // dispute letter it is a litigation threat, so the rule applies there only.
    bar: "signed-letter",
    pattern:
      /\bi\s+(?:will|intend to|am going to|plan to|shall)\s+(?:sue|file suit|file a lawsuit|take you to court)\b|\bsue (?:you )?for \$/i,
    replacement:
      "I am not threatening litigation; I am asking for a reasonable reinvestigation of the information I have identified.",
    description:
      'A stated intention to sue, in a document the consumer signs and mails ("I will sue for $1,000") — refused on letters only.',
    explanation:
      "Announcing a lawsuit in the letter itself is a threat rather than a statement of fact about your account, and it is one of the strongest signals that a letter came from a credit-repair template. Your right to sue is unaffected by leaving it out.",
  },
  {
    id: "delete_on_demand",
    severity: "REFUSE",
    bar: "base",
    // Review L-2: the "legally obligated" branch used to need "you are"/"they
    // are" and missed "The bureau is legally obligated to remove this."
    pattern:
      /\byou\s+(?:must|have to|need to|are required to|are legally obligated to|are obligated to)\s+(?:delete|remove)\b|\b(?:you|they|the bureau|the furnisher|the agency)\s+(?:is|are)\s+legally obligated\b/i,
    replacement:
      "I request that this information be deleted or corrected if it cannot be verified as accurate and complete.",
    description:
      'Deletion stated as an obligation ("you must delete this account", "you are legally obligated to delete") — refused; the FCRA requires a reasonable reinvestigation, not deletion on demand.',
    explanation:
      "The FCRA does not require anyone to delete an item because you asked. It requires a reasonable reinvestigation, and deletion only where the information cannot be verified. Stating it as an obligation states the law wrongly.",
  },
  {
    id: "third_party_must_delete",
    severity: "REFUSE",
    // Review M-2: "the bureau must delete it if they can't verify, right?" is a
    // consumer asking a question in the forum. Only a signed letter is making a
    // demand by saying it.
    bar: "signed-letter",
    pattern: /\b(?:the\s+)?(?:bureau|furnisher|agency)\s+must\s+(?:delete|remove)\b/i,
    replacement:
      "I request that this information be deleted or corrected if it cannot be verified as accurate and complete.",
    description:
      'A letter demanding that the bureau or furnisher "must delete" — refused on letters only; the FCRA requires a reasonable reinvestigation, not deletion on demand.',
    explanation:
      "In the letter itself this reads as an order rather than a request, and it states the law wrongly — deletion follows from information that cannot be verified, not from being told to delete.",
  },
  {
    id: "declared_violation",
    severity: "REFUSE",
    bar: "base",
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
    bar: "base",
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
    bar: "base",
    pattern:
      /\b(?:you are|the bureau is|the furnisher is|this is|they are)\s+in violation of\b|\bviolat(?:es|ed|ing)\s+(?:the\s+)?(?:FCRA|FDCPA|law)\b/i,
    replacement:
      "The way this information is reported raises concerns under the Fair Credit Reporting Act, which I ask you to address through a reasonable reinvestigation.",
    description:
      'Being "in violation of the FCRA/the law" stated as fact — rewritten as a concern raised under the statute.',
    explanation:
      "Only a court can find that a law was broken. This says the same thing as a concern you are asking them to address.",
  },
  {
    id: "fraud_or_illegal_claim",
    severity: "REWRITE",
    bar: "base",
    pattern: /\bthis\s+(?:is|constitutes)\s+(?:fraud|illegal|unlawful|criminal)\b|\bthis is illegal\b/i,
    replacement: "This raises concerns that I ask you to investigate.",
    description: 'Fraud/illegality stated as fact ("this is fraud", "this is illegal") — rewritten as a concern.',
    explanation:
      "Calling something fraud or illegal is an accusation a court decides. The letter now raises it as a concern to investigate.",
  },
  {
    id: "failed_to_investigate",
    severity: "REWRITE",
    bar: "base",
    // Review M-2: narrowed back to the base rule's reach — the recipient
    // addressed directly ("you failed to investigate") or named ("the bureau
    // failed to investigate"). A consumer telling the forum "in my experience
    // they failed to investigate my dispute" is reporting their experience, and
    // the pre-slice rule set never touched it.
    pattern:
      /\byou\s+(?:failed|did not bother|refused|neglected)\s+to\s+(?:re)?investigate\b|\b(?:the\s+)?(?:bureau|furnisher|agency)\s+failed to (?:re)?investigate\b/i,
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
    bar: "base",
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
    bar: "base",
    // The bare form is deliberate and matches the pre-slice rule's reach
    // (`\bwill be deleted\b`): scripts/brief-comment.test.ts pins "that account
    // will be deleted, trust me" as a rejection at the BASE bar, and narrowing
    // the determiner would have quietly loosened moderation.
    pattern: /\bwill be (?:deleted|removed)\b/i,
    replacement:
      "I ask that this item be deleted or corrected if it cannot be verified as accurate and complete.",
    description: 'A deletion predicted as certain ("this item will be deleted within 30 days") — rewritten as a request.',
    explanation:
      "Saying an item will be deleted predicts a result no one controls. The letter now asks for it instead of announcing it.",
  },
  {
    id: "force_deletion",
    severity: "REWRITE",
    // Review M-2: back to the base rule's reach — the recipient addressed
    // directly or named. "My collector told me they would force them to delete
    // it — is that even a thing?" is a question about someone else's claim.
    bar: "base",
    pattern: /\bforce (?:you|the bureau|the furnisher) to delete\b/i,
    replacement: "I request deletion of any information on this account that cannot be verified.",
    description: '"Force you to delete" — rewritten as a request for deletion of unverifiable information.',
    explanation: "Nothing in the letter can force an outcome. It now requests one on verifiable grounds.",
  },
  {
    id: "metro2_myth",
    severity: "REWRITE",
    bar: "base",
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
    bar: "base",
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
    bar: "base",
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
  /**
   * TRUE when the rule matched only PART of the sentence — i.e. replacing the
   * sentence would drop words the author wrote for another reason. Review H-1:
   * consumer-authored text must never be saved with a partial replacement; the
   * consumer is handed the suggestion and rewrites it themselves.
   */
  partial: boolean;
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

export interface ComplianceOptions {
  /** Default "base". See the BAR note at the top of this file. */
  bar?: ComplianceBar;
}

// ── segmentation ─────────────────────────────────────────────────────────────
// Paragraph structure is preserved exactly (blank lines separate blocks in a
// letter and must never be crossed by a replacement), and WITHIN a paragraph a
// sentence may span soft line breaks. A period/question mark/exclamation only
// ends a sentence when it is not part of a known abbreviation or an initial.
// Segments are re-joined verbatim, so text with nothing to adjust survives
// byte-for-byte.
const ABBREVIATION_END =
  /(?:U\.S\.C|U\.S|e\.g|i\.e|etc|No|Nos|Inc|Co|Corp|Ltd|LLC|Mr|Mrs|Ms|Dr|Jr|Sr|St|Ave|Blvd|Rd|Dept|Fig|vs|approx|Attn|P\.O|[A-Z])\.$/;

/** Split on blank-line runs, KEEPING the separators so a join is exact. */
function splitParagraphs(text: string): string[] {
  return text.split(/(\n(?:[ \t]*\n)+)/);
}

function isParagraphSeparator(chunk: string): boolean {
  return /^\n(?:[ \t]*\n)+$/.test(chunk);
}

function splitSentences(block: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    // Consume a run of terminators and any closing quote/bracket.
    let end = i;
    while (end + 1 < block.length && ".!?".includes(block[end + 1])) end++;
    while (end + 1 < block.length && "\"')]”’".includes(block[end + 1])) end++;
    const after = block.slice(end + 1);
    // A terminator only ends a sentence at end-of-block or before whitespace
    // (a newline counts — a hard-wrapped sentence is still one sentence).
    if (after.length > 0 && !/^\s/.test(after)) {
      i = end;
      continue;
    }
    const head = block.slice(start, end + 1);
    if (ch === "." && ABBREVIATION_END.test(head.trimEnd())) {
      i = end;
      continue;
    }
    // Absorb the whitespace that follows, so re-joining is exact.
    const ws = after.match(/^\s+/)?.[0] ?? "";
    out.push(block.slice(start, end + 1 + ws.length));
    start = end + 1 + ws.length;
    i = end + ws.length;
  }
  if (start < block.length) out.push(block.slice(start));
  return out;
}

/** One line of prose for a flag/finding: whitespace collapsed, length capped. */
function oneLine(s: string, n = 160): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/**
 * Scrub prohibited phrasing from any text the product will sign, print, or say.
 * Sentences that trip no rule are returned unchanged, character for character.
 */
export function applyCompliance(input: string, options?: ComplianceOptions): ComplianceResult {
  const bar: ComplianceBar = options?.bar ?? "base";
  const rules = bar === "signed-letter" ? RULES : RULES.filter((r) => r.bar === "base");
  const findings: ComplianceFinding[] = [];

  const scrubbed = splitParagraphs(input).map((block) => {
    if (isParagraphSeparator(block) || !block.trim()) return block;
    const segments = splitSentences(block);
    let changed = false;
    const rebuilt = segments.map((seg) => {
      // Match against a whitespace-normalized probe so a phrase that straddles a
      // soft line break is caught, and so the matched span can be compared with
      // the sentence on equal terms (review M-3, H-1).
      const probe = seg.replace(/\s+/g, " ").trim();
      if (!probe) return seg;
      let hit: { rule: Rule; matched: string } | null = null;
      for (const rule of rules) {
        const m = probe.match(rule.pattern);
        if (m) {
          hit = { rule, matched: m[0] };
          break;
        }
      }
      if (!hit) return seg;
      changed = true;
      const leading = seg.match(/^\s*/)?.[0] ?? "";
      const trailing = seg.match(/\s*$/)?.[0] ?? "";
      // The sentence minus its terminator and closing punctuation: what the rule
      // would have to cover for the replacement to lose nothing.
      const core = probe.replace(/[.!?"')\]”’]+$/, "").trim();
      findings.push({
        ruleId: hit.rule.id,
        severity: hit.rule.severity,
        original: seg.trim(),
        replacement: hit.rule.replacement,
        partial: hit.matched.trim().length < core.length,
        explanation: hit.rule.explanation,
      });
      // An empty replacement removes the sentence outright; keep the trailing
      // whitespace only when something remains on the line to separate.
      if (!hit.rule.replacement) return "";
      return `${leading}${hit.rule.replacement}${trailing}`;
    });
    return changed ? rebuilt.join("").replace(/[ \t]+$/, "") : block;
  });

  const flags = findings.map(
    (f) =>
      `${f.severity === "REFUSE" ? "Refused" : "Adjusted"} (${f.ruleId}): “${oneLine(f.original)}” → ${
        f.replacement ? `“${oneLine(f.replacement)}”` : "removed"
      }`
  );

  return {
    text: scrubbed.join(""),
    flags,
    findings,
    refused: findings.filter((f) => f.severity === "REFUSE"),
  };
}

/**
 * The findings a CONSUMER-AUTHORED body must not be saved with (review H-1):
 * anything refused outright, plus any partial match, because replacing that
 * sentence would delete words the consumer wrote for another reason.
 */
export function blockingFindings(result: ComplianceResult): ComplianceFinding[] {
  return result.findings.filter((f) => f.severity === "REFUSE" || f.partial);
}

// Human-readable list of the prohibited-phrase rules, for the admin compliance
// view. RC1-S5 (L-05): this used to be `PROHIBITED.map(p => p.pattern.source)` —
// raw regular expressions, presented in the admin UI as though they were the
// rule set. They read as far broader coverage than the literal phrase list
// actually had. These are the same rules stated as what they do.
export const COMPLIANCE_RULES = RULES.map(
  (r) =>
    `${r.severity === "REFUSE" ? "REFUSE" : "REWRITE"}${r.bar === "signed-letter" ? " (letters only)" : ""} — ${r.description}`
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
  "These rules are a phrase-level pass over final text: they catch guaranteed outcomes, litigation threats, deletion-on-demand, declared violations and the §609 / Metro 2 deletion myths. Rules marked “letters only” apply to a document the consumer signs and mails, not to community posts or chat. They cannot judge whether a factual statement is true, and they are not a review of the letter's substance.";

export const DISCLAIMER =
  "Educational Purpose Disclaimer: CreditVector™, a Gabriel Capital Labs platform, is an AI-powered educational tool that helps consumers understand their credit reports and dispute rights under the Fair Credit Reporting Act (FCRA). This platform does not provide legal advice, credit repair services, or guarantees of any outcome. No deletion, correction, or score improvement is guaranteed. Results vary based on individual circumstances and the accuracy of reported information. Consult a licensed attorney for legal guidance.";
