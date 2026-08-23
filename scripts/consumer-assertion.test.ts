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
  ASSERTION_CHOICE_BY_TYPE,
  CONSUMER_ASSERTION_TYPES,
  CONSUMER_NOTE_MAX,
  assertionsForContext,
  buildContext,
  buildFindings,
  buildUserPrompt,
  isConsumerAssertionType,
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
  ok("the note reaches the letter verbatim, attributed to the consumer", noted.includes('In my own words: "Paid in full on 3/2/2024 by cashier\'s check."'));
  ok("a note never lands on its own line and never breaks the Fact: layout", !/^\s*Paid in full/m.test(noted));

  const otherOnly = letterFor([A("other", { consumerNote: "The account number shown is not one I have ever had." })]).body;
  ok("`other` carries the consumer's words as the substance of the concern", otherOnly.includes("The account number shown is not one I have ever had."));

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
  const refusalIdx = GEN.indexOf("assertions.length === 0");
  ok(
    "the refusal runs BEFORE the entitlement gate and any credit spend (a refusal costs nothing)",
    // Compared against the CALL SITES, not the import line at the top of the file.
    refusalIdx > 0 && refusalIdx < GEN.indexOf("await getEntitlement(user)") && refusalIdx < GEN.indexOf("await spendLetterCredits(")
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

console.log(failures === 0 ? "\nAll consumer-assertion guards passed." : `\n${failures} guard(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
