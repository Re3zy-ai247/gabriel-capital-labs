// RC1-S4 — Consumer Fact Confirmation guards. Pure: no DB, no AI, no network.
// Run: npx tsx scripts/consumer-assertion.test.ts
//
// The law under test: CreditVector may put a factual claim about a consumer's
// account into a letter the consumer signs ONLY if that consumer confirmed that
// claim. Everything here is either an assertion→sentence mapping, a proof that
// an unconfirmed claim is absent, or a source-level pin on the two boundaries
// (letter generation, identity correction) that enforce it.
//
// NON-VACUITY. Several checks below assert that specific strings are GONE. Each
// one was present in the pre-change output, so each fails against the old code:
//   · "The payment history associated with this account as reported." was pushed
//     unconditionally by buildFindings for every accuracy dispute.
//   · "I am unable to reconcile the reported status with my records" was the
//     Account Status fallback whenever the parser held no status text.
//   · "based on the information currently available to me, I am unable to
//     reconcile" opened every round-1 accuracy dispute.
//   · "I am prepared to submit this record to the Consumer Financial Protection
//     Bureau and my state Attorney General" was emitted at round ≥ 4 always.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ASSERTION_CHOICES,
  choicesForAccountType,
  assertionAppliesTo,
  ASSERTION_CHOICE_BY_TYPE,
  CONSUMER_ASSERTION_TYPES,
  CONSUMER_NOTE_MAX,
  assertionsForContext,
  buildContext,
  buildFindings,
  buildSystemPrompt,
  buildUserPrompt,
  isConsumerAssertionType,
  letterAuthorization,
  letterAuthorizationRevoked,
  normalizeConsumerNote,
  renderTemplateLetter,
  sanitizeConsumerNote,
  type ConsumerAssertionInput,
  type ConsumerAssertionType,
  type LetterConsumer,
  type LetterTradeline,
} from "../lib/letter";
import { buildRound2UserPrompt } from "../lib/round2";
import { recommendStrategy, suggestAssertionTypes } from "../lib/recommend";
import { applyCompliance } from "../lib/compliance";
import type { BureauData } from "../lib/bureauData";
import type { Bureau } from "@prisma/client";

export {};

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

let failures = 0;
function ok(label: string, cond: boolean) {
  if (!cond) {
    failures++;
    console.error(`✗ ${label}`);
  } else console.log(`✓ ${label}`);
}

const consumer: LetterConsumer = { fullName: "Jane Q. Consumer", addressLine1: "1 Main St", city: "Austin", state: "TX", zip: "78701" };
const bk: BureauData = { EQUIFAX: { presence: "PRESENT", status: "Charge-off", balanceCents: 128900, dofd: "2021-03-01" } };
const tl: LetterTradeline = {
  creditorName: "Midland Funding LLC",
  originalCreditor: "Synchrony Bank",
  balance: 128900,
  accountType: "COLLECTION",
  dateOfFirstDelinquency: "2021-03-01",
  bureauData: bk,
};
// A tradeline the parser could read nothing from — the shape that used to
// trigger the "I am unable to reconcile … with my records" fallback.
const blankTl: LetterTradeline = { creditorName: "Unknown Bank", balance: 0, accountType: "OTHER", bureauData: {} };

const A = (type: ConsumerAssertionType, extra: Partial<ConsumerAssertionInput> = {}): ConsumerAssertionInput => ({
  assertionType: type,
  ...extra,
});

function letterFor(
  assertions: ConsumerAssertionInput[],
  opts: { strategyId?: string; round?: number; bureau?: Bureau; complaintIntent?: boolean; tradeline?: LetterTradeline } = {}
) {
  const t = opts.tradeline ?? tl;
  const ctx = buildContext(opts.strategyId ?? "fcra_611", t, consumer, opts.bureau ?? "EQUIFAX", opts.round ?? 1, undefined, {
    assertions,
    complaintIntent: opts.complaintIntent,
  });
  return { ctx, body: renderTemplateLetter(t, ctx, consumer) };
}

// ---------------------------------------------------------------------------
console.log("\n— vocabulary");
// ---------------------------------------------------------------------------
{
  ok("every declared type has exactly one consumer-facing choice", ASSERTION_CHOICES.length === CONSUMER_ASSERTION_TYPES.length);
  ok(
    "every type resolves through ASSERTION_CHOICE_BY_TYPE",
    CONSUMER_ASSERTION_TYPES.every((t) => ASSERTION_CHOICE_BY_TYPE[t]?.type === t)
  );
  ok("`other` is the only choice that demands the consumer's own words", ASSERTION_CHOICES.filter((c) => c.requiresNote).map((c) => c.type).join() === "other");
  ok("an unknown type is rejected by the type guard", !isConsumerAssertionType("delete_it") && !isConsumerAssertionType(null) && !isConsumerAssertionType(7));
  ok("a known type passes the type guard", CONSUMER_ASSERTION_TYPES.every(isConsumerAssertionType));
  ok(
    "no choice promises an outcome or offers a legal conclusion",
    !ASSERTION_CHOICES.some((c) => /guarantee|will be (?:deleted|removed)|illegal|violat/i.test(`${c.prompt} ${c.help}`))
  );
}

// ---------------------------------------------------------------------------
console.log("\n— every assertion type maps to exactly one first-person finding");
// ---------------------------------------------------------------------------
{
  const seen = new Set<string>();
  for (const type of CONSUMER_ASSERTION_TYPES) {
    const assertions = [A(type, type === "other" ? { consumerNote: "The creditor agreed to remove this in writing." } : {})];
    const { ctx } = letterFor(assertions);
    const findings = buildFindings(tl, ctx);
    ok(`${type}: produces exactly one finding`, findings.length === 1);
    if (findings.length !== 1) continue;
    const f = findings[0];
    ok(`${type}: the fact is stated in the consumer's first person`, /\bI (?:state|do not recognize)\b/.test(f.fact));
    ok(`${type}: carries a "why it matters" sentence`, f.why.length > 40);
    ok(`${type}: asserts no violation and promises no outcome`, !/violat|illegal|must be deleted|will be deleted|guarantee/i.test(`${f.fact} ${f.why}`));
    seen.add(f.element);
  }
  ok("the eight types do not all collapse into one element label", seen.size >= 6);
}

// ---------------------------------------------------------------------------
console.log("\n— the unconfirmed claims are GONE (each of these fails on the old code)");
// ---------------------------------------------------------------------------
{
  const withOne = letterFor([A("inaccurate_balance")]).body;
  ok(
    "the always-on Payment History concern is gone",
    !withOne.includes("The payment history associated with this account as reported.")
  );
  ok(
    "the letter no longer says 'I am unable to reconcile … with my records'",
    !/I am unable to reconcile the reported status with my records/.test(withOne)
  );
  ok(
    "the opening no longer asserts an unreconcilable account before the consumer speaks",
    !/based on the information currently available to me, I am unable to reconcile/.test(withOne)
  );

  // The parser-silent shape: the old code emitted the first-person fallback here.
  const blank = letterFor([A("not_mine")], { tradeline: blankTl }).body;
  ok(
    "…including when the parser read nothing at all from the report",
    !/I am unable to reconcile/.test(blank) && !/The payment history associated/.test(blank)
  );

  // Exactly one finding for one assertion — not one plus a padded extra.
  const numbered = withOne.match(/^\d+\. /gm) ?? [];
  ok("one confirmed fact yields one numbered concern, not one plus padding", numbered.length === 1);
}

// ---------------------------------------------------------------------------
console.log("\n— nothing confirmed ⇒ nothing asserted");
// ---------------------------------------------------------------------------
{
  const { body } = letterFor([]);
  ok("no SUMMARY OF FACTUAL CONCERNS section at all", !body.includes("SUMMARY OF FACTUAL CONCERNS"));
  ok("no first-person factual claim about the account", !/\bI state\b/.test(body) && !/I do not recognize/.test(body));
  ok("the reinvestigation request itself survives (the letter is still a dispute)", /REQUESTED ACTION — REINVESTIGATION/.test(body));
  ok("the single-file scope disclaimer still renders", /relate solely to how this account is reported on my/.test(body));
  ok("still compliance-clean", applyCompliance(body).flags.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n— withdrawn, unknown and out-of-scope assertions never compose");
// ---------------------------------------------------------------------------
{
  const withdrawn = letterFor([A("not_mine", { status: "WITHDRAWN" })]).body;
  ok("a WITHDRAWN assertion produces no finding", !withdrawn.includes("SUMMARY OF FACTUAL CONCERNS") && !/I do not recognize/.test(withdrawn));

  const mixed = letterFor([A("not_mine", { status: "WITHDRAWN" }), A("inaccurate_balance", { status: "ACTIVE" })]).body;
  ok("…and does not suppress the ACTIVE one beside it", /I state that this balance is not accurate/.test(mixed) && !/I do not recognize/.test(mixed));

  const unknown = letterFor([{ assertionType: "make_it_go_away" }]).body;
  ok("an unrecognized assertion type composes nothing (fail closed)", !unknown.includes("SUMMARY OF FACTUAL CONCERNS"));

  // Bureau scoping: a fact confirmed about the Experian file may not be told to Equifax.
  const eq = letterFor([A("inaccurate_status", { bureauScope: "EXPERIAN" })], { bureau: "EQUIFAX" }).body;
  ok("a fact scoped to another bureau is not asserted to this one", !eq.includes("SUMMARY OF FACTUAL CONCERNS"));
  const eqOwn = letterFor([A("inaccurate_status", { bureauScope: "EQUIFAX" })], { bureau: "EQUIFAX" }).body;
  ok("…while a fact scoped to THIS bureau composes normally", /I state that the status reported for this account is not accurate/.test(eqOwn));
  const unscoped = letterFor([A("inaccurate_status", { bureauScope: null })], { bureau: "EQUIFAX" }).body;
  ok("…and an unscoped fact composes to any bureau", unscoped.includes("SUMMARY OF FACTUAL CONCERNS"));

  // A furnisher/collector letter is not bureau-scoped: it goes to the source.
  const collectorCtx = buildContext("validation", tl, consumer, undefined, 1, { name: "X", address: "PO Box 1" }, {
    assertions: [A("inaccurate_balance", { bureauScope: "EXPERIAN" })],
  });
  ok("a collector letter composes assertions from any bureau scope", collectorCtx.assertions.length === 1);

  ok(
    "assertionsForContext is the single filter (defaults ACTIVE when status is absent)",
    assertionsForContext([{ assertionType: "not_mine" }], { strategy: collectorCtx.strategy, targetBureau: undefined }).length === 1
  );
}

// ---------------------------------------------------------------------------
console.log("\n— the consumer's own words");
// ---------------------------------------------------------------------------
{
  ok("newlines and tabs collapse to single spaces", normalizeConsumerNote("a\n\nb\tc") === "a b c");
  ok("control characters are removed, not rendered", !/[ -]/.test(normalizeConsumerNote("ab c")));
  ok("leading/trailing whitespace is trimmed", normalizeConsumerNote("   padded   ") === "padded");
  ok("empty/absent input is the empty string", normalizeConsumerNote(null) === "" && normalizeConsumerNote(undefined) === "" && normalizeConsumerNote("   ") === "");
  ok("normalizeConsumerNote does NOT cap (so the API can refuse instead of truncating)", normalizeConsumerNote("x".repeat(CONSUMER_NOTE_MAX + 50)).length === CONSUMER_NOTE_MAX + 50);
  ok("sanitizeConsumerNote caps defensively for the composer", sanitizeConsumerNote("x".repeat(CONSUMER_NOTE_MAX + 50)).length === CONSUMER_NOTE_MAX);
  ok("the words themselves are not rewritten", normalizeConsumerNote("I payed this off in 2019, they no it") === "I payed this off in 2019, they no it");

  const noted = letterFor([A("paid_settled", { consumerNote: "Paid in\nfull on 3/2/2024 by cashier's check." })]).body;
  ok(
    "the note reaches the letter verbatim, attributed to the consumer",
    noted.includes("In my own words: \u201CPaid in full on 3/2/2024 by cashier's check.\u201D")
  );
  // REMEDIATION L-2: a straight double quote inside the note must not be
  // confusable with the attribution delimiters around it.
  const quoted = letterFor([A("other", { consumerNote: 'I said "no" to this account.' })]).body;
  ok(
    "a note containing a double quote keeps distinguishable attribution delimiters",
    quoted.includes("In my own words: \u201CI said \"no\" to this account.\u201D")
  );
  ok("a note never lands on its own line and never breaks the Fact: layout", !/^\s*Paid in full/m.test(noted));

  const otherOnly = letterFor([A("other", { consumerNote: "The account number shown is not one I have ever had." })]).body;
  ok("`other` carries the consumer's words as the substance of the concern", otherOnly.includes("The account number shown is not one I have ever had."));
  // REMEDIATION L-3: it no longer promises a description "below" that is
  // actually appended inline on the same line.
  ok("`other` does not promise text that appears nowhere", !/as described below/.test(otherOnly));

  const longNote = "y".repeat(CONSUMER_NOTE_MAX + 200);
  const capped = letterFor([A("other", { consumerNote: longNote })]).body;
  ok("an over-long note can never emit an unbounded line into a signed letter", !capped.includes("y".repeat(CONSUMER_NOTE_MAX + 1)));
}

// ---------------------------------------------------------------------------
console.log("\n— regulatory-complaint intent is the consumer's to declare (L-03)");
// ---------------------------------------------------------------------------
{
  const dflt = buildContext("fcra_611", tl, consumer, "EQUIFAX", 4);
  ok("buildContext defaults complaintIntent to FALSE with no options at all", dflt.complaintIntent === false);
  ok("…and to FALSE when options are given without it", buildContext("fcra_611", tl, consumer, "EQUIFAX", 4, undefined, {}).complaintIntent === false);

  const r4 = letterFor([A("inaccurate_status")], { round: 4 }).body;
  ok(
    "round 4 no longer states an intent to file with the CFPB / state AG",
    !/I am prepared to submit this record to the Consumer Financial Protection Bureau/.test(r4)
  );
  ok("…it reserves the right instead", /I reserve the right to seek review through the Consumer Financial Protection Bureau/.test(r4));

  const r4opt = letterFor([A("inaccurate_status")], { round: 4, complaintIntent: true }).body;
  ok("with the consumer's explicit opt-in, the intent sentence returns", /I am prepared to submit this record to the Consumer Financial Protection Bureau and my state Attorney General/.test(r4opt));
  ok("both forms stay compliance-clean", applyCompliance(r4).flags.length === 0 && applyCompliance(r4opt).flags.length === 0);

  // The round-2 AI prompt carries the same rule.
  const ctxOff = letterFor([A("inaccurate_status")], { round: 2 }).ctx;
  const promptOff = buildRound2UserPrompt(tl, ctxOff, "draft", "response", null);
  ok("round-2 prompt FORBIDS asserting complaint intent by default", /Does NOT state, imply, or hint at any intention to file a complaint/.test(promptOff));
  ok("…and never instructs the model to state it", !/States the consumer's intent to file complaints/.test(promptOff));

  const ctxOn = letterFor([A("inaccurate_status")], { round: 2, complaintIntent: true }).ctx;
  const promptOn = buildRound2UserPrompt(tl, ctxOn, "draft", "response", null);
  ok("…and permits it only on the consumer's opt-in", /States the consumer's intent to file complaints/.test(promptOn) && /expressly opted in/.test(promptOn));
}

// ---------------------------------------------------------------------------
console.log("\n— the AI grounding prompt names the confirmed set");
// ---------------------------------------------------------------------------
{
  const { ctx, body } = letterFor([A("not_mine"), A("inaccurate_balance")]);
  const prompt = buildUserPrompt(tl, ctx, body);
  ok("the confirmed types are listed for the model", /Facts the CONSUMER personally confirmed[^\n]*not_mine/.test(prompt));
  ok("the complaint-intent state is stated explicitly", /Consumer's expressed intent to file a regulatory complaint: NO/.test(prompt));
  const emptyCtx = letterFor([]);
  const emptyPrompt = buildUserPrompt(tl, emptyCtx.ctx, emptyCtx.body);
  ok("an empty confirmed set is stated as NONE, not omitted", /Facts the CONSUMER personally confirmed: NONE/.test(emptyPrompt));
}

// ---------------------------------------------------------------------------
console.log("\n— recommendations SUGGEST, never assert");
// ---------------------------------------------------------------------------
{
  const rec = recommendStrategy({
    accountType: "COLLECTION",
    isDebtBuyer: true,
    probability: "HIGH",
    dateOfFirstDelinquency: "2021-03-01",
    bureauData: bk,
    creditorName: "Midland Funding LLC",
  });
  ok("a recommendation carries suggested fact-checks", rec.suggestedAssertions.length > 0);
  ok("every suggestion is a real assertion type", rec.suggestedAssertions.every(isConsumerAssertionType));
  ok("a government/statutory item suggests nothing", recommendStrategy({ accountType: "GOVERNMENT", isDebtBuyer: false, probability: "NOT_RECOMMENDED", bureauData: {}, creditorName: "IRS" }).suggestedAssertions.length === 0);
  ok(
    "suggestions are deduplicated and bounded",
    (() => {
      const s = suggestAssertionTypes({ accountType: "COLLECTION", isDebtBuyer: true, probability: "HIGH", dateOfFirstDelinquency: "2021-03-01", bureauData: bk, creditorName: "X" });
      return s.length <= 4 && new Set(s).size === s.length;
    })()
  );
  const RECOMMEND_SRC = read("lib/recommend.ts");
  ok(
    "lib/recommend.ts writes nothing — it cannot create an assertion",
    // The `@prisma/client` TYPE import is fine; a prisma CLIENT or any write is not.
    !/from "@\/lib\/prisma"|from "\.\/prisma"|prisma\.[a-zA-Z]/.test(RECOMMEND_SRC) && !/consumerAssertion/.test(RECOMMEND_SRC)
  );
}

// ---------------------------------------------------------------------------
console.log("\n— the enforcement boundaries (source-level)");
// ---------------------------------------------------------------------------
{
  const GEN = read("app/api/letters/generate/route.ts");
  ok(
    "letter generation loads the consumer's ACTIVE assertions for THIS user and tradeline",
    /consumerAssertion\.findMany\(\{[\s\S]{0,200}userId: user\.id[\s\S]{0,120}tradelineId: tradeline\.id[\s\S]{0,120}status: "ACTIVE"/.test(GEN)
  );
  ok("…and refuses with 400 when there are none", /assertions\.length === 0[\s\S]{0,900}status: 400/.test(GEN));
  ok("…with a machine-readable needsAssertion flag for the UI", /needsAssertion: true/.test(GEN));
  // `prisma.letter.create(` lives in the generateOne HELPER, defined above the
  // handler, so a whole-file index would compare against a position that
  // precedes the handler entirely. Compare inside the handler, against the call
  // sites that actually commit a letter.
  const GEN_POST = GEN.slice(GEN.indexOf("export async function POST("));
  const commitIdx = Math.min(
    ...["await updateOne(", "await generateOne("].map((t) => GEN_POST.indexOf(t)).filter((i) => i > -1)
  );
  const refusalIdx = GEN_POST.indexOf("assertions.length === 0");
  // RC1-S6a: there is no charge left to run ahead of (Founder D-3 froze
  // purchased credits and the quota is gone), so the pin is re-expressed rather
  // than deleted. First the ABSENCE, so the removal is asserted and not merely
  // implied; then the surviving ordering law — refuse before you commit a row.
  ok("nothing is charged at all — the spend path is not called",
    GEN.indexOf("await spendLetterCredits(") === -1);
  ok(
    "the refusal runs BEFORE the entitlement read and BEFORE any letter row is written",
    // Compared against the CALL SITES, not the import line at the top of the file.
    refusalIdx > 0 && refusalIdx < GEN_POST.indexOf("await getEntitlement(user)") && refusalIdx < commitIdx
  );
  ok("no upsell, upgrade or price appears in the refusal path", !/upgrade: true[\s\S]{0,200}needsAssertion/.test(GEN));

  const ASSERT_ROUTE = read("app/api/tradelines/[id]/assertion/route.ts");
  ok("the assertion route scopes every tradeline read to the caller", /findFirst\(\{\s*where: \{ id: tradelineId, userId \}/.test(ASSERT_ROUTE));
  ok("…and every assertion read to BOTH the caller and the tradeline", /where: \{ id: assertionId, userId: user\.id, tradelineId: tradeline\.id \}/.test(ASSERT_ROUTE));
  ok("withdrawal is a status flip, never a delete", /status: "WITHDRAWN", withdrawnAt: new Date\(\)/.test(ASSERT_ROUTE) && !/\.delete\(|deleteMany/.test(ASSERT_ROUTE));
  ok("the route is free — no entitlement/paywall call anywhere in it", !/getEntitlement|entitlement|premium|upgrade|stripe/i.test(ASSERT_ROUTE.replace(/\/\/.*$/gm, "")));

  const IDENT = read("app/api/identity/letter/route.ts");
  ok("the identity letter disputes only items the consumer confirmed", /const relevant = reportedByTarget\.filter\(isConfirmed\)/.test(IDENT));
  ok("…confirmation is strictly `=== true`, never truthy-coerced", /d\.confirmed === true/.test(IDENT));
  ok(
    "…and it refuses, before any AI call, when nothing is confirmed",
    /needsConfirmation: true/.test(IDENT) && IDENT.indexOf("needsConfirmation") < IDENT.indexOf("await meteredMessage(")
  );
  ok("the phantom strategy id is gone", !/strategy: "personal_info"/.test(IDENT));
  ok("…replaced with a strategy that actually exists", /strategy: "fcra_611"/.test(IDENT));

  const SCHEMA = read("prisma/schema.prisma");
  ok("ConsumerAssertion exists in the schema", /model ConsumerAssertion \{/.test(SCHEMA));
  ok("…with back-relations on both User and Tradeline", (SCHEMA.match(/consumerAssertions ConsumerAssertion\[\]/g) ?? []).length === 2);
  const MIGRATION = read("prisma/migrations/20260823120000_consumer_assertion/migration.sql");
  ok("the migration is additive only — no DROP, no ALTER of an existing table", !/\bDROP\b/i.test(MIGRATION.replace(/^--.*$/gm, "")) && !/ALTER TABLE "(?:User|Tradeline)"/.test(MIGRATION));
  ok(
    "…and carries no backfill (no consumer statement is ever manufactured)",
    // "ON UPDATE CASCADE" in an FK clause is referential-action syntax, not a write.
    !/\bINSERT\s+INTO\b/i.test(MIGRATION.replace(/^--.*$/gm, "")) && !/\bUPDATE\s+"/i.test(MIGRATION.replace(/^--.*$/gm, ""))
  );
  ok("…with a preflight block", /PREFLIGHT/.test(MIGRATION) && /ROLLBACK/.test(MIGRATION));
}

// ---------------------------------------------------------------------------
console.log("\n— existing letter discipline is undisturbed");
// ---------------------------------------------------------------------------
{
  const all = ["fcra_611", "fcra_609", "validation", "metro2", "fcra_605", "fcra_623", "fdcpa", "escalation", "goodwill", "pay_delete", "cease_desist", "cfpb_threat"];
  let clean = true;
  for (const sId of all) {
    const ctx = buildContext(sId, tl, consumer, "EQUIFAX", 1, { name: tl.creditorName, address: "PO Box 1\nSan Diego, CA 92193" }, {
      assertions: [A("inaccurate_balance"), A("late_dates_wrong")],
    });
    const body = renderTemplateLetter(tl, ctx, consumer);
    if (applyCompliance(body).flags.length > 0) clean = false;
    if (/\bwill be deleted\b|\bmust be deleted\b|\bguarantee\b/i.test(body)) clean = false;
  }
  ok("every strategy composed from confirmed facts stays compliance-clean and non-promissory", clean);

  const goodwill = buildContext("goodwill", tl, consumer, undefined, 1, { name: "X", address: "PO Box 1" }, { assertions: [A("not_mine")] });
  const goodwillBody = renderTemplateLetter(tl, goodwill, consumer);
  ok("a goodwill letter still carries NO factual concerns, even with assertions on file", !goodwillBody.includes("SUMMARY OF FACTUAL CONCERNS"));
  ok("…and still says it is not disputing accuracy", /I am not disputing the accuracy/.test(goodwillBody));

  const single = letterFor([A("inaccurate_balance")]).body;
  ok("single-bureau discipline holds: no other bureau is named", !/TransUnion|Experian/i.test(single));
}

// ---------------------------------------------------------------------------
console.log("\n— zero findings ⇒ a coherent letter, not a scaffold (H-1 / M-1)");
// ---------------------------------------------------------------------------
{
  const empty = letterFor([]).body;
  ok("the scope disclaimer no longer points at concerns that do not exist", !/The concerns I set out/.test(empty));
  ok("…and is still present, claim-free", /This dispute and any concerns it raises relate solely to how this account is reported on my/.test(empty));
  ok("the demand does not reference 'each disputed item' when no item is set out", !/each disputed item/.test(empty));
  ok("…nor 'each disputed element'", !/each disputed element/.test(empty));
  ok("…nor 'any disputed item' in the closing", !/any disputed item cannot be verified/.test(empty));
  ok("it still demands a reinvestigation and the method of verification", /REQUESTED ACTION — REINVESTIGATION/.test(empty) && /611\(a\)\(7\)/.test(empty));
  ok("…of 'the information reported for this account'", /reinvestigation of the information reported for this account/.test(empty));

  const withFindings = letterFor([A("inaccurate_balance")]).body;
  ok("WITH a confirmed fact the demand names the disputed items again (control)", /each disputed item/.test(withFindings));

  // Round 2 with nothing confirmed reads as a follow-up, not a broken dispute.
  const r2 = letterFor([], { round: 2 }).body;
  ok("round-2 with nothing confirmed asks about the prior reinvestigation", /please confirm its current status, disclose how the previously disputed information was verified/.test(r2));
  ok("…and sets out no phantom concerns", !/I have set out below/.test(r2) && !/each disputed item/.test(r2));
  ok("…and stays compliance-clean", applyCompliance(r2).flags.length === 0);

  const furnisherEmpty = renderTemplateLetter(
    tl,
    buildContext("fcra_623", tl, consumer, undefined, 1, { name: "X", address: "PO Box 1" }, { assertions: [] }),
    consumer
  );
  ok("the furnisher demand likewise stops referencing 'the disputed information' with none", !/investigation of the disputed information/.test(furnisherEmpty));
  ok("…while still demanding a §1681s-2(b) investigation", /1681s-2\(b\)/.test(furnisherEmpty));
}

// ---------------------------------------------------------------------------
console.log("\n— INQUIRY rows get a claim they can actually make (M-3)");
// ---------------------------------------------------------------------------
{
  const inquiryChoices = choicesForAccountType("INQUIRY").map((c) => c.type);
  const accountChoices = choicesForAccountType("COLLECTION").map((c) => c.type);
  ok("an inquiry can say it was not authorized", inquiryChoices.includes("inquiry_not_authorized"));
  ok("an inquiry is NOT offered balance / status / dates / closed / paid", !["inaccurate_balance", "inaccurate_status", "late_dates_wrong", "account_closed", "paid_settled"].some((t) => inquiryChoices.includes(t as ConsumerAssertionType)));
  ok("an account is NOT offered the inquiry claim", !accountChoices.includes("inquiry_not_authorized"));
  // S11 AD-8: `not_mine` is an ACCOUNT claim. It composed "I do not recognize
  // this account. I did not open it…" onto an INQUIRY, which nobody opens.
  ok("an inquiry is NOT offered the account-ownership claim", !inquiryChoices.includes("not_mine"));
  ok("an account still is", accountChoices.includes("not_mine"));
  ok("both keep the free-text claim", inquiryChoices.includes("other") && accountChoices.includes("other"));
  ok("an inquiry still has at least two things it can honestly say", inquiryChoices.length >= 2);
  ok(
    "assertionAppliesTo agrees with the list",
    assertionAppliesTo("inquiry_not_authorized", "INQUIRY") &&
      !assertionAppliesTo("inaccurate_balance", "INQUIRY") &&
      !assertionAppliesTo("not_mine", "INQUIRY") &&
      assertionAppliesTo("inaccurate_balance", "COLLECTION") &&
      assertionAppliesTo("not_mine", "COLLECTION")
  );
  ok(
    "suggestAssertionTypes never steers an inquiry toward balance / status / dates",
    (() => {
      const sug = suggestAssertionTypes({ accountType: "INQUIRY", isDebtBuyer: false, probability: "MEDIUM", bureauData: {}, creditorName: "Some Lender" });
      return sug.length > 0 && sug.every((x) => x === "inquiry_not_authorized");
    })()
  );

  const inq = letterFor([A("inquiry_not_authorized")]).body;
  ok("the inquiry claim composes in the consumer's own voice", /I do not recognize any application or transaction that would authorize this inquiry/.test(inq));
  ok("…cites permissible purpose, asserts no violation", /permissible purpose/.test(inq) && !/violat/i.test(inq));
  ok("…and stays compliance-clean", applyCompliance(inq).flags.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n— self-defeating observations are not quoted back (L-1)");
// ---------------------------------------------------------------------------
{
  const closedTl: LetterTradeline = { ...tl, bureauData: { EQUIFAX: { presence: "PRESENT", status: "Closed", balanceCents: 0 } } };
  const closed = letterFor([A("account_closed")], { tradeline: closedTl }).body;
  ok("'I state that this account is closed' is not followed by 'It is reported as \"Closed\"'", /I state that this account is closed\./.test(closed) && !/reported as "Closed"/.test(closed));

  const paidZero: LetterTradeline = { ...tl, balance: 0 };
  const paid = letterFor([A("paid_settled")], { tradeline: paidZero }).body;
  ok("a $0 balance is not quoted back against a paid/settled claim", !/The reported balance is \$0/.test(paid));
  const paidOwing = letterFor([A("paid_settled")]).body;
  ok("…while a non-zero reported balance still is (control)", /The reported balance is \$1,289/.test(paidOwing));
}

// ---------------------------------------------------------------------------
console.log("\n— the AI prompt cannot invite the deleted claim back (M-2)");
// ---------------------------------------------------------------------------
{
  const sys = buildSystemPrompt(1);
  // The SUGGESTION list is the segment between "Prefer phrasing such as:" and
  // "Present facts". The phrase may still appear AFTER that, in the sentence
  // that reserves it to the consumer — that is the fix, not a leak.
  const suggestionList = sys.slice(sys.indexOf("Prefer phrasing such as:"), sys.indexOf("Present facts that warrant"));
  ok("'I am unable to reconcile' is no longer a PREFERRED FRAMING suggestion", !/I am unable to reconcile/.test(suggestionList));
  ok("'based on the information currently available' is no longer suggested either", !/based on the information currently available/.test(suggestionList));
  ok("…and first-person statements about the consumer's records are explicitly reserved to them", /reserved to the consumer/.test(sys));
  ok("rule 8 still forbids introducing new first-person statements", /CONSUMER-CONFIRMED FACTS ONLY/.test(sys));
}

// ---------------------------------------------------------------------------
console.log("\n— the confirmation record survives re-analysis (H-2)");
// ---------------------------------------------------------------------------
{
  const SCHEMA_FULL = read("prisma/schema.prisma");
  // Scoped to the ConsumerAssertion MODEL BLOCK: `Letter` already declares a
  // nullable tradelineId with SetNull, so a whole-file regex would pass on
  // Letter's line and prove nothing about this table.
  const modelStart = SCHEMA_FULL.indexOf("model ConsumerAssertion {");
  const SCHEMA = modelStart >= 0 ? SCHEMA_FULL.slice(modelStart, SCHEMA_FULL.indexOf("\n}", modelStart)) : "";
  const MIGRATION = read("prisma/migrations/20260823120000_consumer_assertion/migration.sql");
  ok("schema: the ConsumerAssertion model block was located", SCHEMA.length > 0);
  ok("schema: tradelineId is NULLABLE", /tradelineId String\?/.test(SCHEMA));
  ok("schema: the Tradeline FK is SetNull, not Cascade", /tradeline\s+Tradeline\? @relation\(fields: \[tradelineId\], references: \[id\], onDelete: SetNull\)/.test(SCHEMA));
  ok("schema: an immutable snapshot keeps an orphaned row meaningful", /tradelineCreditorName String/.test(SCHEMA) && /tradelineAccountMask\s+String\?/.test(SCHEMA) && /tradelineAccountType\s+String\?/.test(SCHEMA));
  ok("migration: the Tradeline FK is ON DELETE SET NULL", /ConsumerAssertion_tradelineId_fkey[^;]*ON DELETE SET NULL/.test(MIGRATION));
  ok("migration: the column is created nullable", /"tradelineId" TEXT,/.test(MIGRATION));
  ok("migration: the snapshot columns are created", /"tradelineCreditorName" TEXT NOT NULL/.test(MIGRATION));
  ok("the User FK stays CASCADE (no path hard-deletes a User)", /ConsumerAssertion_userId_fkey[^;]*ON DELETE CASCADE/.test(MIGRATION));

  // The false claim that motivated H-2 must be gone from BOTH files, and the
  // real deletion paths named.
  for (const [name, src] of [["schema", SCHEMA_FULL], ["migration", MIGRATION]] as const) {
    ok(`${name}: the false "nothing deletes a Tradeline" claim is gone`, !/(?:nothing|none) deletes a Tradeline/.test(src));
    ok(`${name}: the real deletion paths are cited`, /lib\/analyze\.ts:168/.test(src) && /app\/api\/reports\/\[id\]\/route\.ts:17/.test(src));
  }

  const ROUTE = read("app/api/tradelines/[id]/assertion/route.ts");
  ok("the snapshot is written at creation", /tradelineCreditorName: tradeline\.creditorName/.test(ROUTE) && /tradelineAccountMask: tradeline\.accountNumberMask/.test(ROUTE));
  const PAGE = read("app/tradelines/page.tsx");
  ok("the page skips orphaned assertions, so a re-analyzed item shows as unconfirmed", /if \(!a\.tradelineId\) continue;/.test(PAGE));
  ok("the page offers only claims the row can make", /choicesForAccountType\(t\.accountType\)/.test(PAGE));
}

// ---------------------------------------------------------------------------
console.log("\n— the per-target bureau gate (H-1, source-level)");
// ---------------------------------------------------------------------------
{
  const GEN = read("app/api/letters/generate/route.ts");
  ok("the route narrows per target with the SAME filter the composer uses", /assertionsForContext\(assertions, \{ strategy: ctxProbe\.strategy, targetBureau: b \}\)/.test(GEN));
  ok("targets with no applicable confirmation are dropped before anything is planned", /targets = validTargets;/.test(GEN) && GEN.indexOf("targets = validTargets;") < GEN.indexOf("planLetterRegeneration(targets"));
  ok("nothing is charged for a skipped target either — the spend path is not called",
    GEN.indexOf("await spendLetterCredits(") === -1);
  const POST = GEN.slice(GEN.indexOf("export async function POST("));
  const commit = Math.min(
    ...["await updateOne(", "await generateOne("].map((t) => POST.indexOf(t)).filter((i) => i > -1)
  );
  ok("…and the narrowing happens before the entitlement read and before any letter is composed",
    POST.indexOf("validTargets.length === 0") < POST.indexOf("await getEntitlement(user)") &&
    POST.indexOf("validTargets.length === 0") < commit);
  ok("all-targets-unsupported is a 400, not a silent empty success", /if \(validTargets\.length === 0\)[\s\S]{0,1600}status: 400/.test(GEN));
  ok("partial skips are disclosed, not swallowed", /skippedBureaus,/.test(GEN) && /skippedReason/.test(GEN));
  ok("each target composes from ITS OWN applicable set", (GEN.match(/assertionsByTarget\.get\(targetKey\(b\)\)/g) ?? []).length === 2);

  const IDENT = read("app/api/identity/letter/route.ts");
  ok("the identity refusal carries an actionable next step (M-5)", /nextStep:/.test(IDENT) && /nothing has been charged/.test(IDENT));
}

// ---------------------------------------------------------------------------
console.log("\n— S11 AD-1: no state has an unfollowable instruction");
// ---------------------------------------------------------------------------
{
  const PAGE = read("app/tradelines/page.tsx");
  // The panel is mounted in exactly one place in the product, so what gates it
  // decides who can confirm anything at all.
  ok(
    "the confirmation panel is no longer withheld from a CLEAN row",
    /const canAssert = !setAside && t\.accountType !== "GOVERNMENT";/.test(PAGE)
  );
  ok("…and the CLEAN exclusion is really gone", !/canAssert = [^;]*condition !== "CLEAN"/.test(PAGE));
  ok(
    "a CLEAN row's disclosure names the panel behind it",
    /\{canAssert \? "Review the facts ▾" : "Bureau detail ▾"\}/.test(PAGE)
  );
  ok(
    "…while the report's own read is unchanged (no invented dispute claim)",
    /Your report shows no derogatory status for this account/.test(PAGE) && /nothing to dispute/.test(PAGE)
  );
  ok(
    "a GOVERNMENT / set-aside row still has NO confirmation path",
    /!setAside && t\.accountType !== "GOVERNMENT"/.test(PAGE)
  );

  const GEN = read("app/api/letters/generate/route.ts");
  ok(
    "…so the route answers those rows with the true reason instead of a confirm-first instruction",
    /tradeline\.accountType === "GOVERNMENT" \|\| tradeline\.probability === "NOT_RECOMMENDED"/.test(GEN) &&
      /setAside: true/.test(GEN)
  );
  const setAsideIdx = GEN.indexOf('setAside: true');
  ok(
    "…before the confirm-first refusal can be reached",
    setAsideIdx > 0 && setAsideIdx < GEN.indexOf("needsAssertion: true")
  );
  ok(
    "…and before the entitlement resolve and any composition, so it costs nothing",
    // S6a made the consumer product free, so there is no credit spend left in
    // this route to order against; the entitlement resolve and the first write
    // are what the refusal must still precede.
    setAsideIdx < GEN.indexOf("await getEntitlement(user)") && setAsideIdx < GEN.indexOf("await generateOne(")
  );
  ok("the set-aside refusal invents no CTA", !/Review the facts[^\n]*set aside|setAside: true[\s\S]{0,40}Upgrade/.test(GEN));
}

// ---------------------------------------------------------------------------
console.log("\n— S11 AD-2: a withdrawal reaches the letter it authorized");
// ---------------------------------------------------------------------------
{
  const mailed = { mailedAt: new Date("2026-08-01"), tradelineId: "t1", activeAssertionCount: 0 };
  ok("a MAILED letter is HISTORICAL, never re-judged", letterAuthorization(mailed) === "HISTORICAL");
  ok("…and is never reported as revoked, whatever the consumer does later", !letterAuthorizationRevoked(mailed));
  ok(
    "…including one whose tradeline is gone entirely",
    letterAuthorization({ mailedAt: new Date("2026-08-01"), tradelineId: null, activeAssertionCount: 0 }) === "HISTORICAL"
  );
  ok(
    "an UNMAILED letter with a standing confirmation is AUTHORIZED",
    letterAuthorization({ mailedAt: null, tradelineId: "t1", activeAssertionCount: 1 }) === "AUTHORIZED"
  );
  ok(
    "an UNMAILED letter whose confirmations are all withdrawn is REVOKED",
    letterAuthorization({ mailedAt: null, tradelineId: "t1", activeAssertionCount: 0 }) === "REVOKED"
  );
  ok(
    "…and one whose tradeline is gone fails CLOSED, not open",
    letterAuthorization({ mailedAt: null, tradelineId: null, activeAssertionCount: 0 }) === "REVOKED"
  );

  const PATCH = read("app/api/letters/[id]/route.ts");
  ok(
    "approval and mailing are gated on the CURRENT authorization",
    /if \(!existing\.mailedAt && \(status === APPROVED \|\| status === "MAILED"\)\)/.test(PATCH) &&
      /letterAuthorizationRevoked\(/.test(PATCH)
  );
  ok("…counted for THIS user and THIS tradeline", /consumerAssertion\.count\(\{[\s\S]{0,160}userId: user\.id[\s\S]{0,120}status: "ACTIVE"/.test(PATCH));
  ok("…answered with a truthful, shared message", /LETTER_AUTHORIZATION_REVOKED_MESSAGE/.test(PATCH) && /authorizationRevoked: true/.test(PATCH));
  ok("…and the mailed record is explicitly excluded from the check", /!existing\.mailedAt &&/.test(PATCH));

  const PRINT = read("app/letters/print/[id]/page.tsx");
  ok("the printable packet is withheld too", /letterAuthorizationRevoked\(\{ mailedAt: letter\.mailedAt/.test(PRINT));
  ok(
    "…and a MAILED letter still prints its record verbatim",
    /renderedBody = letter\.mailedAt \? letter\.body :/.test(PRINT)
  );

  const LIST = read("app/api/letters/route.ts");
  ok("the letters list exposes the state so the page can say it", /authorizationRevoked: letterAuthorizationRevoked\(/.test(LIST));
  ok("…without a query per letter", /groupBy\(\{/.test(LIST));
  ok("…and without re-judging mailed rows", /filter\(\(l\) => !l\.mailedAt && l\.tradelineId\)/.test(LIST));

  const MESSAGE = read("lib/letter.ts");
  ok("the message says nothing was deleted (the draft survives)", /Nothing has been deleted/.test(MESSAGE));
  ok("…and promises no outcome", !/LETTER_AUTHORIZATION_REVOKED_MESSAGE[\s\S]{0,400}guarantee/.test(MESSAGE));
}

// ---------------------------------------------------------------------------
console.log("\n— S11 AD-5 / B-6 / E-4");
// ---------------------------------------------------------------------------
{
  const PAGE = read("app/tradelines/page.tsx");
  ok(
    "AD-5: the scope picker offers only bureaus the report says are PRESENT",
    /bureaus=\{presentBureaus\(data\)\.map/.test(PAGE) && !/bureaus=\{known\.map/.test(PAGE)
  );
  ok("E-4: the stat row stacks below sm", /grid grid-cols-1 gap-3 sm:grid-cols-3/.test(PAGE));

  const IDENT = read("app/api/identity/letter/route.ts");
  ok("B-6: the client-supplied array is bounded", /DISCREPANCY_MAX = 50/.test(IDENT) && /rawDiscrepancies\.length > DISCREPANCY_MAX/.test(IDENT));
  ok("B-6: every text field is bounded", /DISCREPANCY_FIELD_MAX = 500/.test(IDENT) && /DISCREPANCY_TEXT_FIELDS\.some/.test(IDENT));
  ok(
    "B-6: bounded BEFORE the paid model is called",
    IDENT.indexOf("rawDiscrepancies.length > DISCREPANCY_MAX") < IDENT.indexOf("await meteredMessage(")
  );
  ok("B-6: refused, never silently truncated", !/\.slice\(0, DISCREPANCY_MAX\)/.test(IDENT));
}

// ---------------------------------------------------------------------------
console.log("\n— S11: a month-precision DOFD reaches the recommendation (S3 adoption)");
// ---------------------------------------------------------------------------
{
  // "08/2018" is what a report prints; the persisted column cannot hold it at
  // day precision, so reading the column alone used to leave age = 0 and the
  // §605 recommendation silently off — while fallOffInsight, scoring and
  // factualCondition all ran the clock. Same input, two spellings, one answer.
  const monthOnly = {
    accountType: "CHARGE_OFF" as const,
    isDebtBuyer: false,
    probability: "HIGH" as const,
    dateOfFirstDelinquency: null,
    bureauData: { EQUIFAX: { presence: "PRESENT", status: "Charge-off", dofd: "08/2018" } },
    creditorName: "Capital One",
  };
  const fullDate = { ...monthOnly, dateOfFirstDelinquency: "2018-08-31", bureauData: { EQUIFAX: { presence: "PRESENT", status: "Charge-off" } } };

  const a = recommendStrategy(monthOnly);
  const b = recommendStrategy(fullDate);
  ok("a month-only DOFD yields the same strategy as the equivalent full date", a.strategyId === b.strategyId);
  ok("…which is the §605 obsolescence play, not the generic accuracy dispute", a.strategyId === "fcra_605");
  ok("…with the same stated age, to the year", a.reason === b.reason);
  ok("…and the same suggested fact-checks", a.suggestedAssertions.join() === b.suggestedAssertions.join());
  ok("…including 'the dates are wrong', which the raw column alone would have missed", a.suggestedAssertions.includes("late_dates_wrong"));

  // Control: a RECENT month-only DOFD must NOT be recommended as obsolete —
  // the adoption must not make the clock run early.
  const recentYear = new Date().getUTCFullYear() - 1;
  const recent = { ...monthOnly, bureauData: { EQUIFAX: { presence: "PRESENT", status: "Charge-off", dofd: `08/${recentYear}` } } };
  ok("a recent month-only DOFD is not recommended as obsolete (control)", recommendStrategy(recent).strategyId !== "fcra_605");

  // No DOFD anywhere: unchanged behaviour. (`late_dates_wrong` still appears
  // here, from the unconditional tail of suggestAssertionTypes — the DOFD
  // branch only promotes it earlier in the ordering. Asserting its absence
  // would be asserting something the design never claimed.)
  const none = { ...monthOnly, bureauData: { EQUIFAX: { presence: "PRESENT", status: "Charge-off" } } };
  ok("with no DOFD at all, no obsolescence recommendation", recommendStrategy(none).strategyId !== "fcra_605");

  // Both sites read the ONE derivation, not the raw column — the whole point of
  // the adoption is that this file cannot drift from the §605 clock again.
  const RECOMMEND_SRC = read("lib/recommend.ts");
  ok("both DOFD sites read reportedDofd()", (RECOMMEND_SRC.match(/reportedDofd\(t\)/g) ?? []).length === 2);
  ok("…and neither still reads the raw persisted column for the clock", !/yearsSince\(t\.dateOfFirstDelinquency\)/.test(RECOMMEND_SRC));
}

console.log(failures === 0 ? "\nAll consumer-assertion guards passed." : `\n${failures} guard(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
