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
// NON-VACUITY (measured 2026-08-23; pre-slice files restored from the branch
// base `git show 31d4e35:<path>` and reverted immediately, never committed):
//   · pre-slice lib/letter.ts                   → the suite cannot even load
//     (sanitizeLetterBody / signatureBlock / LETTER_BODY_MAX do not exist there), exit 1
//   · pre-slice app/letters/print/[id]/page.tsx → 101 passed,  9 failed (exit 1)
//   · pre-slice app/letters/page.tsx            →  85 passed, 27 failed (exit 1)
//   · (unmodified slice tree)                   → 112 passed,  0 failed (exit 0)
export {};

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildContext,
  renderTemplateLetter,
  sanitizeLetterBody,
  signatureBlock,
  LETTER_BODY_MAX,
  LETTER_BODY_MIN,
  type LetterConsumer,
  type LetterTradeline,
} from "../lib/letter";
import { STRATEGIES } from "../lib/strategies";
import type { BureauData } from "../lib/bureauData";

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
  ok("the editor PATCHes the body", /method: "PATCH"[\s\S]{0,160}JSON\.stringify\(\{ body: draft \}\)/.test(PAGE));
  ok("the editor never calls a model", !/generate|round2|anthropic/i.test(PAGE.slice(PAGE.indexOf("function LetterEditor("), PAGE.indexOf("function ComplaintIntentChoice("))));
  ok("a refused save shows the sentence AND the reason, and keeps their text", /complianceRefusals/.test(PAGE) && /r\.sentence/.test(PAGE) && /r\.why/.test(PAGE));
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

  ok("the route only accepts a body edit in a draft state", /const EDITABLE_STATUSES: LetterStatus\[\] = \["GENERATED", "DRAFT"\]/.test(ROUTE));
  ok("the route defines one transition map, not an anything-goes list", /const ALLOWED_TRANSITIONS: Record<LetterStatus, LetterStatus\[\]>/.test(ROUTE));
  ok("MAILED cannot go back to a draft state", /MAILED: \["MAILED", "RESPONSE_RECEIVED", "RESOLVED"\]/.test(ROUTE));
  ok("RESOLVED is terminal", /RESOLVED: \["RESOLVED"\]/.test(ROUTE));
  ok("the naming debt of PRINTED-as-approved is documented where it is used", /NAMING DEBT, DELIBERATE AND DOCUMENTED/.test(ROUTE));
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
  ok("…and before anything is charged", gateIdx < spendIdx);
  ok("the refusal is not an upsell", /needsAssertion: true/.test(ROUND2) && !/upgrade: true[\s\S]{0,80}needsAssertion/.test(ROUND2));
  ok("complaintIntent is read strictly, so no truthy value asserts it", /payload\?\.complaintIntent === true/.test(ROUND2));
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
  ok("the editor tells the consumer nothing is rewritten behind their back", /Nothing is rewritten for you/.test(PAGE));
}

console.log(failures === 0 ? "\nAll letter-control guards passed." : `\n${failures} letter-control guard(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
