// LETTER CONTROL — RC1-S5 (P1-31 / A3 L-01, L-06, L-07, L-10, L-11 · D-2).
// Run: npx --no-install tsx scripts/letter-control.test.ts
//
// Pure + source-level. No DB, no AI, no network.
//
// Two kinds of guard live here, and the split is deliberate:
//   · BEHAVIOUR of the pure composer/sanitizer functions in lib/letter.ts —
//     executed, not read.
//   · SHAPE of the two surfaces that cannot be executed offline: the print
//     server component (app/letters/print/[id]/page.tsx) and the letters client
//     page. Those are read as source, because the claims that matter there are
//     claims made in markup — an enclosure list that names a page the packet
//     does not contain, or copy promising an assessment that did not run.
// The route BEHAVIOUR is proven separately, by executing the real handlers:
// scripts/runtime/letter-control.runtime.test.ts.
//
// NON-VACUITY (measured 2026-08-24; pre-fix files reverted and restored
// immediately, never committed):
//   · merged candidate `bd6cfbb` (lib/letter.ts, app/letters/page.tsx,
//     app/api/letters/generate/route.ts)        → 170 passed, 10 failed (exit 1)
//     — NEW-1 ("Invalid Date" in a printable letter), AD-R2-1 (every identity
//       correction letter unauthorized at birth), NEW-2 (approved letter
//       silently duplicated instead of refused)
//   · release candidate `59f2afd` (eight files)  → 151 passed, 40 failed (exit 1)
//   · branch base `31d4e35:lib/letter.ts`        → the suite cannot even load
//   · `31d4e35:app/letters/print/[id]/page.tsx`  → 126 passed,  9 failed (exit 1)
//   · `31d4e35:app/letters/page.tsx`             →  99 passed, 36 failed (exit 1)
//   · this tree                                  → 226 passed,  0 failed (exit 0)

export {};

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertionAppliesTo,
  buildContext,
  buildUserPrompt,
  canTransitionLetter,
  isConsumerAssertionType,
  letterAuthorization,
  letterAuthorizationRevoked,
  LETTER_AUTHORIZATION_REVOKED_MESSAGE,
  MAX_LETTER_ASSERTIONS,
  planLetterRegeneration,
  renderTemplateLetter,
  sanitizeLetterBody,
  signatureBlock,
  LETTER_APPROVED_STATUS,
  LETTER_BODY_MAX,
  LETTER_BODY_MIN,
  LETTER_TRANSITIONS,
  type LetterConsumer,
  type LetterTradeline,
} from "../lib/letter";
import { applyCompliance } from "../lib/compliance";
import { STRATEGIES } from "../lib/strategies";
import type { BureauData } from "../lib/bureauData";
import type { Bureau } from "@prisma/client";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

let failures = 0;
function ok(label: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures++;
    console.error(`✗ ${label}${detail ? `\n    ${detail}` : ""}`);
  } else console.log(`✓ ${label}`);
}

const PAGE = read("app/letters/page.tsx");
const PRINT = read("app/letters/print/[id]/page.tsx");
const ROUTE = read("app/api/letters/[id]/route.ts");
const ROUND2 = read("app/api/letters/[id]/round2/route.ts");
const RESPONSE = read("app/api/letters/[id]/response/route.ts");

const consumer: LetterConsumer = { fullName: "Jane Q. Consumer", addressLine1: "1 Main St", city: "Austin", state: "TX", zip: "78701" };
const bureauData: BureauData = { EQUIFAX: { presence: "PRESENT", status: "Charge-off", balanceCents: 128900, dofd: "2021-03-01" } };
const tradeline: LetterTradeline = {
  creditorName: "Midland Funding LLC",
  originalCreditor: "Synchrony Bank",
  accountNumberMask: "XXXX-1234",
  balance: 128900,
  accountType: "COLLECTION",
  dateOfFirstDelinquency: "2021-03-01",
  bureauData,
};
function letterFor(strategyId: string, round = 1): string {
  const ctx = buildContext(
    strategyId,
    tradeline,
    consumer,
    undefined,
    round,
    { name: tradeline.creditorName, address: "PO Box 1\nSan Diego, CA 92193" },
    { assertions: [{ assertionType: "not_mine", consumerNote: null, bureauScope: null, status: "ACTIVE" }] }
  );
  return renderTemplateLetter(tradeline, ctx, consumer);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SIGNATURE + DATE ON THE PAPER (A3 L-07)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 1. signature and date block —");
{
  for (const strategy of STRATEGIES) {
    const body = letterFor(strategy.id);
    ok(`${strategy.id}: has a signature rule`, /_{20,}/.test(body));
    ok(`${strategy.id}: labels the signature and the date`, /\bSignature\b/.test(body) && /\bDate signed\b/.test(body));
    ok(`${strategy.id}: the typed name still closes the letter`, body.trimEnd().endsWith("Jane Q. Consumer"));
  }
  const block = signatureBlock("Jane Q. Consumer");
  ok("the block is rule → labels → blank → name, in that order", /_{20,}/.test(block[0]) && /Signature/.test(block[1]) && block[2] === "" && block[3] === "Jane Q. Consumer");
  ok("there are two rules on the signature line (one to sign, one to date)", (block[0].match(/_{5,}/g) ?? []).length === 2);
  ok("an incomplete profile still gets a signature block (placeholder name)", signatureBlock("[YOUR FULL NAME]")[3] === "[YOUR FULL NAME]");
  ok(
    "the print guide points at the signature line rather than leaving it to improvisation",
    /sign and date it on the signature line/.test(PRINT)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EDITED BODY: BOUNDS + SANITIZATION THAT PRESERVES WHITESPACE (A3 L-01)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 2. the consumer's edits —");
{
  ok("a minimum length is defined and is small enough for a short letter", LETTER_BODY_MIN >= 20 && LETTER_BODY_MIN <= 200);
  ok("a maximum length is defined and bounded", LETTER_BODY_MAX >= 5_000 && LETTER_BODY_MAX <= 100_000);
  // CLAUDE.md gotcha 2: the client page cannot import lib/letter, so the cap is
  // duplicated there. Pin the two to the same number.
  const uiCap = PAGE.match(/const LETTER_BODY_MAX_UI = ([\d_]+);/)?.[1]?.replace(/_/g, "");
  ok("the editor's character cap matches lib/letter.ts's LETTER_BODY_MAX", Number(uiCap) === LETTER_BODY_MAX, `ui=${uiCap} lib=${LETTER_BODY_MAX}`);

  const spaced = "Dear Sir or Madam,\n\n    Indented paragraph.\n\tTabbed line.\n\n\nThree blank lines above.";
  ok("indentation, tabs and blank-line runs are preserved exactly", sanitizeLetterBody(spaced) === spaced, JSON.stringify(sanitizeLetterBody(spaced)));
  ok("CRLF is normalized", sanitizeLetterBody("a\r\nb") === "a\nb");
  ok("a lone CR is normalized", sanitizeLetterBody("a\rb") === "a\nb");
  // Escapes, never literals: a real control character here would make this
  // guard file itself binary to grep (lib/letter.ts writes its class the same way).
  ok("control characters are removed", sanitizeLetterBody("a\u0000b\u0007c") === "abc");
  ok("bidi overrides and zero-width characters are removed", sanitizeLetterBody("a\u202Eb\u200Bc\uFEFF") === "abc");
  // REVIEW M-4: U+2028/U+2029 are soft line breaks from Word/Pages/Docs. Deleting
  // them glued words together in a pasted draft.
  ok("M-4: U+2028 becomes a newline, it does not glue words together", sanitizeLetterBody("Account number\u2028XXXX-1234") === "Account number\nXXXX-1234");
  ok("M-4: U+2029 becomes a newline too", sanitizeLetterBody("One\u2029Two") === "One\nTwo");
  ok("trailing spaces per line are trimmed (they print as nothing anyway)", sanitizeLetterBody("a   \nb") === "a\nb");
  ok("trailing whitespace at the end of the document is trimmed", sanitizeLetterBody("a\n\n  \n") === "a");
  ok("the consumer's own text is otherwise untouched", sanitizeLetterBody("I paid this on 3/2/2024 — in full.") === "I paid this on 3/2/2024 — in full.");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE PRINTED BODY IS THE STORED BODY (A3 L-01: what you edit is what prints)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 3. print reads the stored body verbatim —");
{
  ok("the print page decrypts and renders the STORED body", /letter\.body = decryptText\(letter\.body\)/.test(PRINT));
  ok("a MAILED letter prints verbatim, with no render-time substitution at all", /renderedBody = letter\.mailedAt \? letter\.body : resolveSenderPlaceholders\(/.test(PRINT));
  ok("nothing re-composes or re-renders the letter at print time", !/renderTemplateLetter|buildContext|buildFindings/.test(PRINT));
  ok("the body is rendered as pre-wrapped text, so the consumer's line breaks survive", /whitespace-pre-wrap/.test(PRINT));
  ok("the route saves the SCRUBBED text, so what is stored is what was checked", /body: encryptText\(compliance\.text\)/.test(ROUTE));
  ok("…and returns the saved body, so the editor shows what will print", /letter: decryptedLetter\(edited\)/.test(ROUTE));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ENCLOSURE TRUTH (A3 L-06 / P1-07)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 4. the packet lists only what it contains —");
{
  ok("the printable and unprintable enclosures are separated", /const printedEnclosures = enclosures\.filter\(\(e\) => e\.dataUri\)/.test(PRINT) && /const unprintableEnclosures = enclosures\.filter\(\(e\) => !e\.dataUri\)/.test(PRINT));
  ok("the Enclosures section on the paper lists ONLY what prints", /\{printedEnclosures\.length > 0 && \(/.test(PRINT));
  ok("…and never the full list", !/\{enclosures\.length > 0 && \(/.test(PRINT));
  ok("the enclosure PAGES come from the same list as the enclosure NAMES", /\{printedEnclosures\s*\n?\s*\.map\(\(e\) => \(/.test(PRINT));
  ok("what is not in the packet is named to the consumer", /Bring these documents yourself/.test(PRINT));
  ok("…with the file type, so they know which upload it is", /e\.mimeType/.test(PRINT));
  ok("…and it is screen-only — never printed as though it were enclosed", /unprintableEnclosures\.length > 0 \|\| !cryptoReady\) && \([\s\S]{0,400}print:hidden/.test(PRINT));
  ok("a packet that silently shipped with no enclosures now says so (docCryptoReady false)", /const cryptoReady = docCryptoReady\(\)/.test(PRINT) && /nothing you marked/.test(PRINT));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE LIFECYCLE THE PAGE OFFERS (A3 L-01 / L-11)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 5. read → edit → approve → mail —");
{
  ok("the page has a real editor", /function LetterEditor\(/.test(PAGE) && /<textarea/.test(PAGE));
  ok("the editor PATCHes the body", /method: "PATCH"[\s\S]{0,400}JSON\.stringify\(\{ body: draft, baseBody \}\)/.test(PAGE));
  ok("the editor never calls a model", !/generate|round2|anthropic/i.test(PAGE.slice(PAGE.indexOf("function LetterEditor("), PAGE.indexOf("function ComplaintIntentChoice("))));
  ok("a refused save shows the sentence AND the reason, and keeps their text", /complianceRefusals/.test(PAGE) && /r\.sentence/.test(PAGE) && /r\.why/.test(PAGE));
  // REVIEW H-1 — the consumer's own facts are never overwritten.
  ok("the route blocks on REFUSE *or* a partial match", /const blocking = blockingFindings\(compliance\);/.test(ROUTE) && /if \(blocking\.length > 0\)/.test(ROUTE));
  ok("…and the old refuse-only predicate is gone", !/compliance\.refused\.length > 0/.test(ROUTE));
  ok("the refusal hands back a suggested compliant wording", /suggestion: f\.replacement/.test(ROUTE) && /partial: f\.partial/.test(ROUTE));
  ok("the editor offers it as the consumer's own action", /Use this wording/.test(PAGE) && /function adoptSuggestion\(/.test(PAGE));
  ok("…and explains why it will not swap the sentence for them", /anything you\s*\n?\s*wrote there would be lost/.test(PAGE));
  ok("the editor copy no longer claims nothing is ever rewritten", !/Nothing is rewritten for you/.test(PAGE));
  ok("…it states the actual rule", /If a sentence carries facts of your own,/.test(PAGE) && /I will never replace it for you/.test(PAGE));
  ok("the letter surfaces screen at the signed-letter bar", /bar: "signed-letter"/.test(ROUTE) && /bar: "signed-letter"/.test(ROUND2));
  // REVIEW M-4: the textarea must always show what was actually stored.
  ok("the editor re-syncs after every successful save, not only on an adjustment", /\/\/ REVIEW M-4: re-sync UNCONDITIONALLY[\s\S]{0,400}setDraft\(savedBody\);\n      setBaseBody\(savedBody\);\n      onSaved\(savedBody\);/.test(PAGE));
  // REVIEW L-5 / L-7 / L-10.
  ok("L-5: a long paste is not silently truncated", !/maxLength=\{LETTER_BODY_MAX_UI\}/.test(PAGE) && /characters too long — trim it before saving/.test(PAGE));
  ok("L-7: approval is committed before the print tab opens", (PAGE.match(/const e = await (setStatus|onStatus)\(l?e?t?t?e?r?\.?i?d?/g) ?? []).length >= 0 && /if \(e\) return;[\s\S]{0,200}window\.open\(`\/letters\/print\//.test(PAGE));
  ok("…and a blocked popup is reported rather than assumed", /blocked the print tab/.test(PAGE));
  ok("L-10: regenerating over an edited draft asks first", /if \(editedDraft && !confirmRegen\)/.test(PAGE) && /the edits you made to it will be gone/.test(PAGE));
  ok("…and the button says what it will do", /Regenerate Letter \(replaces your edits\)/.test(PAGE));
  ok("an adjusted save shows before → after before approval", /complianceAdjustments/.test(PAGE) && /a\.replacedWith/.test(PAGE));
  ok("approval is an explicit act with its own control", /Approve &amp; print/.test(PAGE));
  ok("approval is reversible", /Re-open for editing/.test(PAGE));
  ok("mark-mailed is gated on approval in the saved-letter row", /\{isApproved && \(\s*<MarkMailedControl/.test(PAGE));
  ok("mark-mailed is gated on approval in the fresh-letter panel too", /\{approved && \(\s*<MarkMailedControl/.test(PAGE));
  ok("the editor is offered only for editable statuses", /const isEditable = EDITABLE_STATUSES\.includes\(l\.status\) && !l\.mailedAt/.test(PAGE));
  ok("the status vocabulary tells the consumer whether it is approved", /"Draft — not approved"/.test(PAGE) && /"Approved · ready to print"/.test(PAGE));
  // Comments quoting the old string are fine; the RETURNED copy is what matters.
  ok("an unapproved letter is never described as ready to mail", !/return "Ready to mail|\? "Ready to mail/.test(PAGE));
  ok("…it is described as ready to read and approve", /Read it, change anything that's wrong, then approve it/.test(PAGE));

  // REVIEW M-5: one lifecycle, shared by every route that writes a status.
  ok("the route imports the shared lifecycle rather than defining its own", /LETTER_TRANSITIONS,/.test(ROUTE) && /const ALLOWED_TRANSITIONS = LETTER_TRANSITIONS;/.test(ROUTE));
  ok("MAILED cannot go back to a draft state", !LETTER_TRANSITIONS.MAILED.includes("DRAFT") && !LETTER_TRANSITIONS.MAILED.includes("GENERATED"));
  ok("MAILED can only advance to a response or a close-out", LETTER_TRANSITIONS.MAILED.join(",") === "MAILED,RESPONSE_RECEIVED,RESOLVED");
  ok("RESOLVED is terminal", LETTER_TRANSITIONS.RESOLVED.join(",") === "RESOLVED");
  ok("mark-mailed is unreachable without approval", !canTransitionLetter("GENERATED", "MAILED") && !canTransitionLetter("DRAFT", "MAILED") && canTransitionLetter(LETTER_APPROVED_STATUS, "MAILED"));
  ok("approval is reversible", canTransitionLetter(LETTER_APPROVED_STATUS, "DRAFT"));
  ok("the naming debt of PRINTED-as-approved is documented where the map lives", /NAMING DEBT, DELIBERATE AND DOCUMENTED/.test(read("lib/letter.ts")));
  ok("…and it names the one consumer-visible leak (review L-3, unowned)", /lib\/intelligence\/reasoning\.ts:121/.test(read("lib/letter.ts")));
  // REVIEW M-5: the response route is the other writer of a letter's status.
  ok("the response route answers to the same lifecycle", /canTransitionLetter\(letter\.status, "RESPONSE_RECEIVED"\)/.test(RESPONSE));
  ok("…and refuses before the PDF is read or any analysis runs", RESPONSE.indexOf("canTransitionLetter") < RESPONSE.indexOf("extractPdfText(") && RESPONSE.indexOf("canTransitionLetter") < RESPONSE.indexOf("analyzeResponse("));
  ok("…with a message that says what to do first", /Mark this letter mailed first/.test(RESPONSE));
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. RESOLVED IS A CLAIM THE CONSUMER MAKES (A3 L-11)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 6. closing a dispute out —");
{
  ok("the page asks how it ended instead of asserting it", /function ResolveControl\(/.test(PAGE) && /How did this end\?/.test(PAGE));
  ok("both endings are offered", /corrected_or_deleted/.test(PAGE) && /closed_no_change/.test(PAGE));
  ok("the outcome is sent to the server", /\.\.\.\(opts\?\.outcome \? \{ outcome: opts\.outcome \} : \{\}\)/.test(PAGE));
  ok("the server refuses to record an outcome nobody stated", /needsOutcome: true/.test(ROUTE));
  ok("only 'corrected or removed' writes resolved to the tradeline", /setsTradelineResolved: true/.test(ROUTE) && /setsTradelineResolved: false/.test(ROUTE) && /if \(claimsItemFixed && existing\.tradelineId\)/.test(ROUTE));
  ok("the record says the consumer self-reported it", /selfReported: true/.test(ROUTE));
  ok("the old evidence-free write is gone", !/if \(status === "RESOLVED" && existing\.tradelineId\) \{/.test(ROUTE));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ROUND 2: THE GATE AND THE OPT-IN (S4 handoff / A3 L-03)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 7. round 2 —");
{
  ok("the round-2 route reads the consumer's ACTIVE assertions", /prisma\.consumerAssertion\.findMany/.test(ROUND2) && /status: "ACTIVE"/.test(ROUND2));
  ok("the gate reads the NARROWED set, so gate and composer cannot disagree", /if \(ctx\.assertions\.length === 0\)/.test(ROUND2));
  const gateIdx = ROUND2.indexOf("if (ctx.assertions.length === 0)");
  const entitlementIdx = ROUND2.indexOf("const entitlement = await getEntitlement(user)");
  const spendIdx = ROUND2.indexOf("await spendLetterCredits(");
  ok("the refusal happens BEFORE the entitlement gate", gateIdx > 0 && gateIdx < entitlementIdx, `gate=${gateIdx} entitlement=${entitlementIdx}`);
  // RC1-S6a: assert the ABSENCE first, so the removal of the charge is pinned
  // rather than merely implied by an ordering check that can no longer fail.
  ok("nothing is charged at all — the spend path is not called", spendIdx === -1);
  ok("…and the refusal still precedes the commit of a letter row",
    gateIdx > 0 && gateIdx < ROUND2.indexOf("prisma.letter.create("));
  ok("the refusal is not an upsell", /needsAssertion: true/.test(ROUND2) && !/upgrade: true[\s\S]{0,80}needsAssertion/.test(ROUND2));
  ok("complaintIntent is read strictly, so no truthy value asserts it", /payload\?\.complaintIntent === true/.test(ROUND2));
  // REVIEW L-4: a REFUSE rule must bind the model too, not only the consumer.
  ok("a refinement that trips a REFUSE rule is discarded for the grounded draft", /applyCompliance\(candidate, \{ bar: "signed-letter" \}\)\.refused\.length > 0/.test(ROUND2));
  ok("…and is passed to the composer with the assertions", /\{ assertions, complaintIntent \}/.test(ROUND2));

  ok("the page offers the opt-in, unchecked by default", /function ComplaintIntentChoice\(/.test(PAGE) && /const \[complaintIntent, setComplaintIntent\] = useState\(false\)/.test(PAGE));
  ok("the label is the consumer's own statement", /Include that I intend to file a complaint with the CFPB and my state Attorney General/.test(PAGE));
  ok("the label gives no legal advice about whether to file", !/you should file|we recommend filing|filing (a complaint )?will/i.test(PAGE));
  ok("the opt-in is POSTed on every round-2 request", /JSON\.stringify\(\{ complaintIntent \}\)/.test(PAGE));
  ok("the opt-in is reachable whether or not an assessment exists", (PAGE.match(/<ComplaintIntentChoice/g) ?? []).length === 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. TRUTHFUL COPY (A3 L-10 · D-2 · P1-35)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 8. the page says what the product does —");
{
  ok("the response logger no longer promises an AI assessment + a Round 2 draft", !/AI will assess it and draft a Round 2 escalation/.test(PAGE));
  ok("…and the page now reads the route's own needsAI signal", /j\.needsAI/.test(PAGE));
  ok("…and says plainly when nothing assessed the response", /Automatic reading of the response isn't available right now/.test(PAGE));
  ok("the round-2 button no longer claims the draft targets the listed weaknesses", !/targeting these weaknesses/.test(PAGE));
  ok("the empty state no longer promises refinement to everyone", !/refined by me/.test(PAGE));
  ok("no copy claims Kai drafted a template letter", !/Kai is drafting/.test(PAGE));
  ok("the 'Refined by Kai' pill is still gated on the server's own aiRefined flag", /\{aiRefined && \(/.test(PAGE));
  // D-2: with refinement off, nothing may promise AI-refined output to anyone.
  ok("no copy promises AI-refined letters", !/AI-refined|refined by AI|our AI will (refine|rewrite)/i.test(PAGE));
  ok("no deletion or score guarantee anywhere on the page", !/guarantee/i.test(PAGE.replace(/no outcome is guaranteed/gi, "")));
  ok("the editor tells the consumer exactly which sentences it will and will not touch", /I will never replace it for you/.test(PAGE) && /show you the change before you approve/.test(PAGE));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. RC1-S11 · JOURNEY CRITICAL-1 — A BUREAU IS ONLY EVER TOLD WHAT IT SAID.
//    Reproduces the release-gate scenario end to end: an Equifax-only report, a
//    consumer confirmation scoped to Experian, an Experian-targeted letter.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 9. per-bureau facts name only the attesting bureau (CRITICAL-1) —");

const equifaxOnly: BureauData = {
  EQUIFAX: { presence: "PRESENT", status: "Charge-Off", balanceCents: 128900, dofd: "2021-03-01" },
  EXPERIAN: { presence: "UNKNOWN" },
  TRANSUNION: { presence: "UNKNOWN" },
};
const eqOnlyTradeline: LetterTradeline = { ...tradeline, bureauData: equifaxOnly };

function bureauLetter(target: Bureau | undefined, assertionType: string, scope: Bureau | null): string {
  const ctx = buildContext(
    "fcra_611",
    eqOnlyTradeline,
    consumer,
    target,
    1,
    undefined,
    { assertions: [{ assertionType, consumerNote: null, bureauScope: scope, status: "ACTIVE" }] }
  );
  return renderTemplateLetter(eqOnlyTradeline, ctx, consumer);
}

{
  // The exact reproduction: Equifax attests "Charge-Off"; Experian's presence is
  // UNKNOWN; the letter goes to Experian.
  const body = bureauLetter("EXPERIAN", "inaccurate_status", "EXPERIAN");
  ok(
    'CRITICAL-1: the Experian letter never says Experian reports "Charge-Off"',
    !/reported as "Charge-Off" on the Experian file/.test(body),
    body.split("\n").find((l) => /Charge-Off/.test(l))
  );
  ok("…and does not carry the unattested value at all", !/Charge-Off/.test(body));
  ok("…while the consumer's own confirmed claim still stands", /I state that the status reported for this account is not accurate\./.test(body));
  ok("…and the letter still refuses to speak about other agencies", /I make no representation about any other consumer reporting agency/.test(body));
  ok("…so the finding and the scope sentence no longer contradict each other", /SUMMARY OF FACTUAL CONCERNS/.test(body));
}
{
  // Control: the bureau that DID attest it is told exactly what it reported.
  const body = bureauLetter("EQUIFAX", "inaccurate_status", "EQUIFAX");
  ok("the attesting bureau is still told what it reports", /It is reported as "Charge-Off" on the Equifax file\./.test(body));
}
{
  // Same rule for the date of first delinquency…
  const away = bureauLetter("EXPERIAN", "late_dates_wrong", "EXPERIAN");
  ok("CRITICAL-1 (DOFD): no date is attributed to a bureau that never reported one", !/date of first delinquency reported on the Experian file/.test(away) && !/date of first delinquency is reported as/.test(away));
  ok("…and the claim survives", /I state that the late payment history and\/or the dates reported for this account are not accurate\./.test(away));
  const home = bureauLetter("EQUIFAX", "late_dates_wrong", "EQUIFAX");
  ok("…and the attesting bureau still gets the date", /date of first delinquency reported on the Equifax file is/.test(home));
}
{
  // …and for the balance, which used to be quoted from the tradeline aggregate
  // with no attribution at all.
  const away = bureauLetter("EXPERIAN", "inaccurate_balance", "EXPERIAN");
  ok("CRITICAL-1 (balance): no balance is quoted at a bureau that reports none", !/The reported balance is/.test(away));
  ok("…and the claim survives", /I state that this balance is not accurate\./.test(away));
  const home = bureauLetter("EQUIFAX", "inaccurate_balance", "EQUIFAX");
  // The wording for a bureau target is unchanged (the scope sentence already
  // names the file); what changed is that it is only emitted when that bureau
  // actually attests the figure.
  ok("…and the attesting bureau still gets its own figure", /The reported balance is \$1,289\./.test(home));
}
{
  // A furnisher letter has no target bureau: the observation is attributed BY
  // NAME to whoever attested it, which is truthful and permitted.
  const ctx = buildContext(
    "fcra_623",
    eqOnlyTradeline,
    consumer,
    undefined,
    1,
    { name: "Midland Funding LLC", address: "PO Box 1\nSan Diego, CA 92193" },
    { assertions: [{ assertionType: "inaccurate_status", consumerNote: null, bureauScope: null, status: "ACTIVE" }] }
  );
  const body = renderTemplateLetter(eqOnlyTradeline, ctx, consumer);
  ok("a furnisher letter attributes the observation to the bureau that made it", /Equifax reports it as "Charge-Off"\./.test(body), body.split("\n").find((l) => /Charge-Off/.test(l)));
  ok("…and never claims it unattributed", !/It is reported as "Charge-Off"\./.test(body));
}
{
  // The cross-bureau branch is untouched: every value is already printed beside
  // the bureau that reported it, and that is the letter's whole argument.
  const twoBureaus: BureauData = {
    EQUIFAX: { presence: "PRESENT", status: "Charge-Off", balanceCents: 128900, dofd: "2021-03-01" },
    EXPERIAN: { presence: "PRESENT", status: "Paid", balanceCents: 0, dofd: "2021-03-01" },
    TRANSUNION: { presence: "UNKNOWN" },
  };
  const tl: LetterTradeline = { ...tradeline, bureauData: twoBureaus };
  const ctx = buildContext("fcra_611", tl, consumer, "EQUIFAX", 1, undefined, {
    assertions: [{ assertionType: "inaccurate_status", consumerNote: null, bureauScope: null, status: "ACTIVE" }],
  });
  const body = renderTemplateLetter(tl, ctx, consumer);
  ok("a real cross-bureau discrepancy is still stated, bureau by bureau", /Equifax reports "Charge-Off"; Experian reports "Paid"\./.test(body));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9b. RC1-S11 · CRITIC X-3 — every confirmed fact reaches the letter.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 9b. no confirmed fact is silently dropped (X-3) —");
{
  // Eight facts are confirmable about an ordinary account. The consumer confirms
  // every one of them; all eight must appear.
  const eight = [
    "not_mine",
    "inaccurate_balance",
    "inaccurate_status",
    "late_dates_wrong",
    "account_closed",
    "paid_settled",
    "duplicate",
    "other",
  ];
  const available = eight.filter((t) => isConsumerAssertionType(t) && assertionAppliesTo(t as never, "COLLECTION"));
  ok("the fixture uses facts that really are confirmable on this account", available.length >= 6, available.join(","));

  const ctx = buildContext("fcra_611", tradeline, consumer, "EQUIFAX", 1, undefined, {
    assertions: available.map((t) => ({
      assertionType: t,
      consumerNote: t === "other" ? "The account number does not match my records." : null,
      bureauScope: null,
      status: "ACTIVE",
    })),
  });
  ok("every confirmed fact survives narrowing", ctx.assertions.length === available.length);
  ok("…and nothing is recorded as omitted", ctx.omittedAssertions === 0);

  const body = renderTemplateLetter(tradeline, ctx, consumer);
  const numbered = (body.match(/^\d+\. /gm) ?? []).length;
  ok(`X-3: all ${available.length} confirmed facts are set out in the letter (was capped at 5)`, numbered === available.length, `numbered=${numbered}`);
  ok("…including the consumer's own words on the last one", /The account number does not match my records\./.test(body));
  ok("…and the opening still claims the list is the specific information identified", /I have identified the specific information set out below/.test(body));

  // The two composition paths must speak from the SAME set — the AI grounding
  // prompt mapped the full array while the template truncated.
  const prompt = buildUserPrompt(tradeline, ctx, body);
  const promptFacts = (prompt.match(/CONFIRMED/g) ?? []).length;
  ok("the AI grounding prompt and the template agree on what was confirmed", promptFacts === 0 || promptFacts === ctx.assertions.length, `prompt=${promptFacts} ctx=${ctx.assertions.length}`);
}
{
  // The defensive bound is not a product limit, and it is never silent.
  const many = Array.from({ length: MAX_LETTER_ASSERTIONS + 3 }, () => ({
    assertionType: "other",
    consumerNote: "Another thing that is wrong.",
    bureauScope: null,
    status: "ACTIVE",
  }));
  const ctx = buildContext("fcra_611", tradeline, consumer, "EQUIFAX", 1, undefined, { assertions: many });
  ok("the defensive bound is far above the whole confirmable vocabulary", MAX_LETTER_ASSERTIONS >= 16);
  ok("…it does bound a runaway caller", ctx.assertions.length === MAX_LETTER_ASSERTIONS);
  ok("…and the drop is COUNTED, never silent", ctx.omittedAssertions === 3);
  const body = renderTemplateLetter(tradeline, ctx, consumer);
  ok("…and the letter stops claiming the list below is the specific information identified", !/I have identified the specific information set out below/.test(body) && /I have identified information set out below/.test(body));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9c. RC1-S11 · JOURNEY NEW-1 — a date is PARSED before it is stated.
//     A month-precision DOFD ("08/2021") is what the fallback parser produces,
//     which is the default whenever AI extraction is unavailable.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 9c. no letter ever states 'Invalid Date' (NEW-1) —");
{
  const monthPrecision: BureauData = {
    EQUIFAX: { presence: "PRESENT", status: "Charge-Off", balanceCents: 128900, dofd: "08/2021" },
    EXPERIAN: { presence: "UNKNOWN" },
    TRANSUNION: { presence: "UNKNOWN" },
  };
  // The persisted column is NULL for a month-precision value — that is exactly
  // why the raw report string is the only source, and why it must be parsed.
  const tl: LetterTradeline = { ...tradeline, dateOfFirstDelinquency: null, bureauData: monthPrecision };
  const ctx = buildContext("fcra_611", tl, consumer, "EQUIFAX", 1, undefined, {
    assertions: [{ assertionType: "late_dates_wrong", consumerNote: null, bureauScope: null, status: "ACTIVE" }],
  });
  const body = renderTemplateLetter(tl, ctx, consumer);
  ok("NEW-1: 'Invalid Date' appears nowhere in the letter", !/Invalid Date/.test(body), body.split("\n").find((l) => /Invalid Date/.test(l)));
  ok("…the month-precision date is stated as a MONTH, not a fabricated day", /date of first delinquency reported on the Equifax file is Aug 2021\./.test(body), body.split("\n").find((l) => /first delinquency/.test(l)));
  ok("…and no day is invented for it", !/Aug 31, 2021/.test(body) && !/Aug 1, 2021/.test(body));
  ok("…while the consumer's claim is unchanged", /I state that the late payment history and\/or the dates reported for this account are not accurate\./.test(body));

  // Day precision still renders as a day.
  const dayTl: LetterTradeline = { ...tl, bureauData: { ...monthPrecision, EQUIFAX: { presence: "PRESENT", dofd: "2021-03-01" } } };
  const dayCtx = buildContext("fcra_611", dayTl, consumer, "EQUIFAX", 1, undefined, {
    assertions: [{ assertionType: "late_dates_wrong", consumerNote: null, bureauScope: null, status: "ACTIVE" }],
  });
  ok("a day-precision date still renders as a day", /date of first delinquency reported on the Equifax file is Mar 1, 2021\./.test(renderTemplateLetter(dayTl, dayCtx, consumer)));

  // An unparseable value is DROPPED, never rendered — the pre-regression behaviour.
  const junkTl: LetterTradeline = { ...tl, bureauData: { ...monthPrecision, EQUIFAX: { presence: "PRESENT", dofd: "not a date" } } };
  const junkCtx = buildContext("fcra_611", junkTl, consumer, "EQUIFAX", 1, undefined, {
    assertions: [{ assertionType: "late_dates_wrong", consumerNote: null, bureauScope: null, status: "ACTIVE" }],
  });
  const junk = renderTemplateLetter(junkTl, junkCtx, consumer);
  ok("an unparseable date states nothing at all", !/Invalid Date/.test(junk) && !/date of first delinquency reported on/.test(junk));

  // Two spellings of the same month are not a cross-bureau discrepancy.
  const sameDate: BureauData = {
    EQUIFAX: { presence: "PRESENT", dofd: "08/2021" },
    EXPERIAN: { presence: "PRESENT", dofd: "8/2021" },
    TRANSUNION: { presence: "UNKNOWN" },
  };
  const sameTl: LetterTradeline = { ...tl, bureauData: sameDate };
  const sameCtx = buildContext("fcra_611", sameTl, consumer, "EQUIFAX", 1, undefined, {
    assertions: [{ assertionType: "late_dates_wrong", consumerNote: null, bureauScope: null, status: "ACTIVE" }],
  });
  const same = renderTemplateLetter(sameTl, sameCtx, consumer);
  ok("'8/2021' and '08/2021' are not reported as a disagreement", !/Experian reports a date of first delinquency/.test(same), same.split("\n").find((l) => /first delinquency/.test(l)));

  // And the whole letter still passes the compliance bar unchanged.
  const res = applyCompliance(body, { bar: "signed-letter" });
  ok("…and the letter still trips nothing and is returned byte-identical", res.flags.length === 0 && res.text === body);
}
{
  // The sweep: no raw report value reaches formatDate anywhere in lib/letter.ts.
  const src = read("lib/letter.ts");
  ok("NEW-1 sweep: lib/letter.ts renders dates only through the shared parser", !/formatDate\((?:s|own\[0\])\.v\)/.test(src));
  ok("…and the DOFD sites go through parseReportDate", /parseReportDate\(s\.v as string\)/.test(src) && /renderDofd\(own\[0\]\.d\)/.test(src));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9d. RC1-S11 · AD-R2-1 — a letter with no tradeline is not judged by a
//     tradeline-confirmation rule. Every identity correction letter is one.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 9d. the identity letter is authorized at birth (AD-R2-1) —");
{
  ok("AD-R2-1: an unmailed letter that carries no tradeline is AUTHORIZED", letterAuthorization({ mailedAt: null, tradelineId: null, activeAssertionCount: 0 }) === "AUTHORIZED");
  ok("…so no gate refuses it", letterAuthorizationRevoked({ mailedAt: null, tradelineId: null, activeAssertionCount: 0 }) === false);
  // …and the tradeline protection is undiminished.
  ok("a tradeline letter with nothing standing behind it is still REVOKED", letterAuthorization({ mailedAt: null, tradelineId: "t1", activeAssertionCount: 0 }) === "REVOKED");
  ok("…and one with a live confirmation is AUTHORIZED", letterAuthorization({ mailedAt: null, tradelineId: "t1", activeAssertionCount: 1 }) === "AUTHORIZED");
  ok("a mailed letter is never re-judged", letterAuthorization({ mailedAt: new Date(), tradelineId: null, activeAssertionCount: 0 }) === "HISTORICAL");
  ok("the residual (a deleted report's letter) is stated, not hidden", /RESIDUAL, stated rather than hidden/.test(read("lib/letter.ts")));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9e. RC1-S11 · JOURNEY NEW-2 — regeneration over an approved letter.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 9e. an approved letter is neither overwritten nor duplicated (NEW-2) —");
{
  const approved = [{ id: "l_ok", targetBureau: "EQUIFAX" as Bureau, mailedAt: null, status: LETTER_APPROVED_STATUS }];
  const plan = planLetterRegeneration(["EQUIFAX"], approved);
  ok("NEW-2: an approved letter is NOT update-matched", plan.toUpdate.length === 0);
  ok("NEW-2: …and is NOT quietly duplicated either", plan.toCreate.length === 0);
  ok("NEW-2: …it is reported so the caller can refuse", plan.blockedByApproval.length === 1 && plan.blockedByApproval[0].existingId === "l_ok");

  const replace = planLetterRegeneration(["EQUIFAX"], approved, { replaceApproved: true });
  ok("with the consumer's explicit instruction the approved row is UPDATED in place", replace.toUpdate.length === 1 && replace.toUpdate[0].existingId === "l_ok");
  ok("…so the outcome is one letter, never two", replace.toCreate.length === 0 && replace.blockedByApproval.length === 0);

  const draftPlan = planLetterRegeneration(["EQUIFAX"], [{ id: "l_d", targetBureau: "EQUIFAX" as Bureau, mailedAt: null, status: "DRAFT" }]);
  ok("an unapproved draft is still updated in place, unblocked", draftPlan.toUpdate.length === 1 && draftPlan.blockedByApproval.length === 0);
  const freshPlan = planLetterRegeneration(["EXPERIAN"], approved);
  ok("a target with no letter at all still creates one", freshPlan.toCreate.length === 1 && freshPlan.blockedByApproval.length === 0);
  const mailedPlan = planLetterRegeneration(["EQUIFAX"], [{ id: "l_m", targetBureau: "EQUIFAX" as Bureau, mailedAt: new Date(), status: LETTER_APPROVED_STATUS }]);
  ok("a MAILED letter is untouched by all of this", mailedPlan.toUpdate.length === 0 && mailedPlan.blockedByApproval.length === 0 && mailedPlan.toCreate.length === 1);

  // Through the ROUTE, not just the helper — a helper-level pin is what let the
  // 200-and-duplicate through.
  const GEN = read("app/api/letters/generate/route.ts");
  ok("the route asks for the plan WITH the consumer's instruction", /planLetterRegeneration\(targets, existingRoundOne, \{\s*replaceApproved,\s*\}\)/.test(GEN));
  ok("…reads it strictly", /const replaceApproved = body\?\.replaceApproved === true;/.test(GEN));
  ok("…and REFUSES when an approved letter blocks, before composing anything", /if \(blockedByApproval\.length > 0\)/.test(GEN) && GEN.indexOf("blockedByApproval.length > 0") < GEN.indexOf("const entitlement = await getEntitlement(user)"));
  ok("…with a 409 and a machine-readable flag", /approvedLetterExists: true/.test(GEN) && /\{ status: 409 \}/.test(GEN.slice(GEN.indexOf("approvedLetterExists"))));
  ok("…and the page sends the confirmation and handles the refusal", /\.\.\.\(replaceApproved \? \{ replaceApproved: true \} : \{\}\)/.test(PAGE) && /res\.status === 409 && j\.approvedLetterExists/.test(PAGE));
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. RC1-S11 · the response route, the regenerate guard and the edit token.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 10. S11 review items (B-1 / B-2 / B-4 / AD-3 / AD-7) —");
{
  // B-1: the spend control is applied, not merely available.
  ok("B-1: the response analysis runs inside an AI principal", /withAiPrincipal\(user\.id, \(\) => analyzeResponse\(/.test(RESPONSE));
  ok("B-1: a budget refusal is distinguished from a failure", /e instanceof AiSpendRefusal/.test(RESPONSE) && /budgetRefused/.test(RESPONSE));
  ok("B-1: a second response on the same letter is refused, so the paid call cannot be replayed", /if \(letter\.responseAt\)/.test(RESPONSE) && /alreadyLogged: true/.test(RESPONSE));
  ok("B-1: …and the refusal is placed before the body is read or the model is called", RESPONSE.indexOf("if (letter.responseAt)") < RESPONSE.indexOf("boundBodySize(") && RESPONSE.indexOf("if (letter.responseAt)") < RESPONSE.indexOf("analyzeResponse("));
  ok("B-1: the status self-transition is left alone (a repeat PATCH stays idempotent)", canTransitionLetter("RESPONSE_RECEIVED", "RESPONSE_RECEIVED"));

  // B-2: the body is bounded before it is buffered, from the shared helper.
  ok("B-2: the response route bounds the body before parsing it", /const bounded = boundBodySize\(req, MAX_BODY_BYTES\);/.test(RESPONSE));
  ok("B-2: …and both branches read from the BOUNDED request", /await bounded\.req\.formData\(\)/.test(RESPONSE) && /await bounded\.req\.json\(\)/.test(RESPONSE));
  ok("B-2: …the raw request is never parsed", !/await req\.formData\(\)/.test(RESPONSE) && !/await req\.json\(\)/.test(RESPONSE));
  ok("B-2: …a body that blows the cap mid-stream is a 413, not a 400", /if \(bounded\.exceeded\.value\)/.test(RESPONSE));
  ok("B-2: the bound lives in one shared module", /from "@\/lib\/bodyBounds"/.test(RESPONSE) && /export function boundBodySize/.test(read("lib/bodyBounds.ts")));

  // B-4: the comment no longer contradicts the control it documents.
  // The phrase survives only inside the note recording what it used to say; what
  // must be gone is the ASSERTION that the limiter fails open.
  ok("B-4: the rate-limiter comment no longer asserts that it fails open", !/kai\)\. Fails open\./.test(RESPONSE) && !/^\s*\/\/ .*\bFails open\.\s*$/m.test(RESPONSE.replace(/used to end "Fails open\."/, "")));
  ok("B-4: …it says what the limiter actually does", /fails CLOSED/.test(RESPONSE));

  // AD-3: an approved, consumer-edited letter is not silently overwritten.
  ok("AD-3: the regenerate guard covers the approved state, not just DRAFT", /\(sl\.status === "DRAFT" \|\| sl\.status === APPROVED_STATUS\)/.test(PAGE));
  ok("AD-3: …and the warning says approval is lost too", /it stops being approved/.test(PAGE));
  ok("AD-3: …and the button stops calling an approved letter a draft", /replaces the one you approved/.test(PAGE));

  // AD-3, server half: the seam is ready and inert until the caller supplies it.
  {
    const cands = [{ id: "l_approved", targetBureau: "EQUIFAX" as Bureau, mailedAt: null, status: LETTER_APPROVED_STATUS }];
    const plan = planLetterRegeneration(["EQUIFAX"], cands);
    // NEW-2 corrected the second half of this: an approved row is not matched
    // AND not silently created beside — it is reported so the route refuses.
    ok("AD-3: an APPROVED row is never regenerate-matched when the status is known", plan.toUpdate.length === 0 && plan.toCreate.length === 0 && plan.blockedByApproval.length === 1);
    const draftPlan = planLetterRegeneration(["EQUIFAX"], [{ id: "l_draft", targetBureau: "EQUIFAX" as Bureau, mailedAt: null, status: "DRAFT" }]);
    ok("AD-3: …while an unapproved draft is still updated in place", draftPlan.toUpdate.length === 1);
    const legacyPlan = planLetterRegeneration(["EQUIFAX"], [{ id: "l_legacy", targetBureau: "EQUIFAX" as Bureau, mailedAt: null }]);
    ok("AD-3: …and a caller that supplies no status behaves exactly as before", legacyPlan.toUpdate.length === 1);
    ok("AD-3: the seam is live — the route selects status and passes it", /select: \{ id: true, targetBureau: true, mailedAt: true, status: true \}/.test(read("app/api/letters/generate/route.ts")));
  }

  // S11 AD-2 / critic X-4: the /letters banner.
  {
    ok("the row surfaces the authorization flag the list route now returns", /const authorizationRevoked = Boolean\(l\.authorizationRevoked\)/.test(PAGE));
    ok("…as a banner that says why, not a silent missing button", /This letter can&apos;t be approved or printed right now/.test(PAGE));
    ok("…with one real next step, deep-linked to the account", /\/tradelines\?tradeline=\$\{encodeURIComponent\(l\.tradelineId\)\}/.test(PAGE) && /Review the facts on this account/.test(PAGE));
    ok("…and no control is offered that the server would 409", /\{isEditable && !authorizationRevoked && \(/.test(PAGE) && /\{!authorizationRevoked && \(\s*<Link href=\{`\/letters\/print/.test(PAGE));
    ok("…while reading and editing the draft stay open", /\{isEditable && \(\s*<button onClick=\{\(\) => setOpenEdit/.test(PAGE));
    ok("…and an approved-then-revoked letter can no longer be marked mailed", /const isApproved = l\.status === APPROVED_STATUS && !l\.mailedAt && !authorizationRevoked;/.test(PAGE));

    // X-4: the wording must be true for a letter that NEVER had a confirmation,
    // not only for one whose confirmation was withdrawn.
    ok("the message does not claim a withdrawal that may never have happened", !/^.*The confirmation this letter was drafted from has been withdrawn/m.test(read("lib/letter.ts")));
    ok("…it names all three real causes", /either the confirmation it was drafted from was withdrawn/.test(LETTER_AUTHORIZATION_REVOKED_MESSAGE) && /the report it was drafted from has been replaced/.test(LETTER_AUTHORIZATION_REVOKED_MESSAGE) && /before we started asking you to confirm each fact/.test(LETTER_AUTHORIZATION_REVOKED_MESSAGE));
    ok("…and says nothing was deleted", /Nothing has been deleted/.test(LETTER_AUTHORIZATION_REVOKED_MESSAGE));
    // The page cannot import lib/letter (client bundle), so the copy is pinned.
    const uiCopy = PAGE.match(/const LETTER_AUTHORIZATION_REVOKED_MESSAGE_UI =\n([\s\S]*?);\n/)?.[1] ?? "";
    const uiText = (uiCopy.match(/"([^"]*)"/g) ?? []).map((q) => q.slice(1, -1)).join("").replace(/\\u2014/g, "\u2014").replace(/\\u2019/g, "\u2019");
    ok("the banner copy is byte-identical to the shared message", uiText === LETTER_AUTHORIZATION_REVOKED_MESSAGE, `ui=${JSON.stringify(uiText.slice(0, 80))}`);

    // HISTORICAL is terminal: a mailed letter is never re-judged.
    ok("a mailed letter is never judged unauthorized, whatever the confirmations say", letterAuthorization({ mailedAt: new Date(), tradelineId: null, activeAssertionCount: 0 }) === "HISTORICAL");
    ok("…and an unmailed letter with nothing standing behind it is", letterAuthorization({ mailedAt: null, tradelineId: "t1", activeAssertionCount: 0 }) === "REVOKED");
    ok("…while a live confirmation authorizes it", letterAuthorization({ mailedAt: null, tradelineId: "t1", activeAssertionCount: 1 }) === "AUTHORIZED");
  }

  // AD-7: concurrent edits.
  ok("AD-7: the body PATCH takes a compare-and-swap token", /typeof body\?\.baseBody === "string" && body\.baseBody !== decryptText\(existing\.body\)/.test(ROUTE));
  ok("AD-7: …refuses a stale save rather than overwriting", /staleEdit: true/.test(ROUTE));
  ok("AD-7: …and the editor sends what it loaded, and offers to reload", /baseBody \}\)/.test(PAGE) && /Load the current letter/.test(PAGE));
}

console.log(failures === 0 ? "\nAll letter-control guards passed." : `\n${failures} letter-control guard(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
