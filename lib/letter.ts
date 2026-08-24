import type { Bureau, AccountType, LetterStatus } from "@prisma/client";
import { STRATEGY_BY_ID, type Strategy } from "./strategies";
import { STATUTES } from "./statutes";
import { BUREAU_ADDRESS, BUREAU_LABEL } from "./bureaus";
import { getBureauData, presentBureaus, hasCrossBureauKnowledge, crossBureauConflicts, type BureauData } from "./bureauData";
import { obsolescenceWindowYears, bureauTextBlob } from "./obsolescence";
import { formatCents, formatDate } from "./utils";

export interface LetterTradeline {
  creditorName: string;
  originalCreditor?: string | null;
  accountNumberMask?: string | null;
  accountType?: AccountType;
  balance: number;
  dateOfFirstDelinquency?: Date | string | null;
  bureauData: unknown;
}

export interface LetterConsumer {
  fullName?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

// ---------------------------------------------------------------------------
// RC1-S4 (Consumer Fact Confirmation) — the CONSUMER is the factual authority.
//
// Before this slice, `buildFindings` below composed the "SUMMARY OF FACTUAL
// CONCERNS" from parsed report data alone: it ALWAYS emitted a Payment History
// concern, and when the parser held no status text it put the sentence "I am
// unable to reconcile the reported status with my records" into the consumer's
// mouth — about records the product had never asked them about. The consumer
// then signed and mailed it.
//
// Findings now come from ONE source and one only: `ConsumerAssertion` rows the
// consumer created by picking, from the typed list below, which fact on the item
// is wrong. No assertion → no finding. The product never supplies the claim, and
// `app/api/letters/generate/route.ts` refuses to compose at all when the
// consumer has confirmed nothing.
//
// The vocabulary is bounded on purpose. A free-text-only confirmation would put
// the drafting burden back on the consumer and let an arbitrary sentence into a
// letter; a typed choice maps to ONE pre-reviewed sentence written in the first
// person, and the optional note is carried verbatim (whitespace-normalized,
// never rewritten, never AI-touched) as the consumer's own words.
// ---------------------------------------------------------------------------
export const CONSUMER_ASSERTION_TYPES = [
  "not_mine",
  "inquiry_not_authorized",
  "inaccurate_balance",
  "inaccurate_status",
  "late_dates_wrong",
  "account_closed",
  "paid_settled",
  "incomplete_info",
  "other",
] as const;
export type ConsumerAssertionType = (typeof CONSUMER_ASSERTION_TYPES)[number];

export function isConsumerAssertionType(v: unknown): v is ConsumerAssertionType {
  return typeof v === "string" && (CONSUMER_ASSERTION_TYPES as readonly string[]).includes(v);
}

// What the consumer sees when they choose. `prompt` is the claim they are making
// in their own name — deliberately written as "I state…", never as a question the
// product answers for them. `help` is the plain-language explanation.
// `requiresNote` marks the one choice that means nothing on its own.
export interface AssertionChoice {
  type: ConsumerAssertionType;
  prompt: string;
  help: string;
  requiresNote: boolean;
  // REMEDIATION M-3. An INQUIRY is a record that someone LOOKED at the file. It
  // has no balance, no payment history, no open/closed status and no date of
  // first delinquency, so offering "the balance is wrong" on one invites the
  // consumer to sign a statement that cannot be true ("I state that this balance
  // is not accurate. The reported balance is $0.00."). Applicability is declared
  // here, enforced at the API boundary, and used to build the UI list.
  appliesTo: "any" | "account" | "inquiry";
}
export const ASSERTION_CHOICES: readonly AssertionChoice[] = [
  {
    type: "not_mine",
    prompt: "This account is not mine",
    help: "You do not recognize it, and you did not open or authorize it.",
    requiresNote: false,
    // S11 AD-8: "account", not "any". M-3 stopped balance/status/date claims
    // reaching an INQUIRY, but this one slipped through and composed "I do not
    // recognize this account. I did not open it and I did not authorize it." —
    // nobody OPENS an inquiry; it is a record that someone looked at the file.
    // The inquiry vocabulary already carries the claim that fits
    // (`inquiry_not_authorized`), plus `other` for anything else.
    appliesTo: "account",
  },
  {
    type: "inquiry_not_authorized",
    prompt: "I did not authorize this inquiry",
    help: "You do not recognize any application or transaction that would have let this company look at your credit.",
    requiresNote: false,
    appliesTo: "inquiry",
  },
  {
    type: "inaccurate_balance",
    prompt: "The balance is wrong",
    help: "The amount reported does not match what you owe, or what you owed.",
    requiresNote: false,
    appliesTo: "account",
  },
  {
    type: "inaccurate_status",
    prompt: "The account status is wrong",
    help: "How the account is described (open, closed, collection, charge-off, and so on) is not accurate.",
    requiresNote: false,
    appliesTo: "account",
  },
  {
    type: "late_dates_wrong",
    prompt: "The late payments or the dates are wrong",
    help: "A late payment is reported that did not happen, or a date on the account is not accurate.",
    requiresNote: false,
    appliesTo: "account",
  },
  {
    type: "account_closed",
    prompt: "This account is closed",
    help: "You closed it, or it was closed, and the report does not say so.",
    requiresNote: false,
    appliesTo: "account",
  },
  {
    type: "paid_settled",
    prompt: "This account was paid or settled",
    help: "You paid or settled it, and the report does not reflect that.",
    requiresNote: false,
    appliesTo: "account",
  },
  {
    type: "incomplete_info",
    prompt: "Information is missing from this account",
    help: "Something the report should include about this account is not there.",
    requiresNote: false,
    appliesTo: "account",
  },
  {
    type: "other",
    prompt: "Something else about this account is wrong",
    help: "Describe it in your own words. Your words go into the letter exactly as you write them.",
    requiresNote: true,
    appliesTo: "any",
  },
];
// The choices a given row may offer. INQUIRY rows get the inquiry vocabulary;
// everything else gets the account vocabulary. `any` appears on both.
export function choicesForAccountType(accountType: string | null | undefined): AssertionChoice[] {
  const kind = accountType === "INQUIRY" ? "inquiry" : "account";
  return ASSERTION_CHOICES.filter((c) => c.appliesTo === "any" || c.appliesTo === kind);
}

export function assertionAppliesTo(type: ConsumerAssertionType, accountType: string | null | undefined): boolean {
  return choicesForAccountType(accountType).some((c) => c.type === type);
}

export const ASSERTION_CHOICE_BY_TYPE: Record<ConsumerAssertionType, AssertionChoice> =
  Object.fromEntries(ASSERTION_CHOICES.map((c) => [c.type, c])) as Record<ConsumerAssertionType, AssertionChoice>;

// The maximum length of the consumer's own note. Enforced at the API boundary
// (a longer note is REFUSED, never silently truncated — truncating a consumer's
// statement of fact changes what they said), and re-applied defensively here.
export const CONSUMER_NOTE_MAX = 500;

// RC1-S11 (critic X-3). Not a product limit — a defensive bound, set at twice
// the entire confirmable vocabulary so no consumer can reach it by confirming
// everything there is to confirm, while a runaway caller still cannot compose an
// unbounded document. Each finding is bounded (fixed prose + CONSUMER_NOTE_MAX),
// so this stays far inside LETTER_BODY_MAX.
export const MAX_LETTER_ASSERTIONS = CONSUMER_ASSERTION_TYPES.length * 2;

// Whitespace/control-character normalization ONLY. The consumer's words are not
// rewritten, spell-corrected, softened, or AI-processed: newlines and control
// characters become single spaces so the sentence stays on one line of a plain-
// text letter, and runs of whitespace collapse. Nothing else is touched.
export function normalizeConsumerNote(note: string | null | undefined): string {
  if (!note) return "";
  // The class is written with \u escapes on purpose: a literal control
  // character in this source file would make the file itself binary to grep.
  // eslint-disable-next-line no-control-regex
  const flattened = note.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ");
  return flattened.replace(/\s+/g, " ").trim();
}

// Normalization PLUS the hard cap. The API refuses an over-length note outright
// (app/api/tradelines/[id]/assertion/route.ts) precisely so this cap never fires
// on anything a consumer actually typed; it is a defensive bound for the
// composer, which must never emit an unbounded line into a signed letter.
export function sanitizeConsumerNote(note: string | null | undefined): string {
  const collapsed = normalizeConsumerNote(note);
  return collapsed.length > CONSUMER_NOTE_MAX ? collapsed.slice(0, CONSUMER_NOTE_MAX).trim() : collapsed;
}

// One confirmed statement of fact, as the composer needs it. Deliberately a
// narrow projection of the Prisma row, so lib/letter.ts stays DB-free and
// unit-testable with plain objects.
export interface ConsumerAssertionInput {
  assertionType: string;
  consumerNote?: string | null;
  bureauScope?: Bureau | null;
  status?: string | null; // ACTIVE | WITHDRAWN — a WITHDRAWN row never composes
}

// Which of the consumer's assertions this particular letter may speak from.
//   · WITHDRAWN rows never compose — the consumer took the statement back.
//   · An unrecognized type never composes (fail closed: we have no sentence for it).
//   · A BUREAU letter composes only assertions scoped to THAT bureau or to no
//     bureau at all. The cross-bureau rule already forbids telling Equifax what
//     Experian reports; it equally forbids telling Equifax about a fact the
//     consumer confirmed only about their Experian file.
//   · A furnisher/collector letter composes every scope: the furnisher supplies
//     all of them, so a fact confirmed about any file is a fact about its data.
export function assertionsForContext(
  assertions: ConsumerAssertionInput[],
  ctx: Pick<LetterContext, "strategy" | "targetBureau">
): ConsumerAssertionInput[] {
  return assertions.filter((a) => {
    if ((a.status ?? "ACTIVE") !== "ACTIVE") return false;
    if (!isConsumerAssertionType(a.assertionType)) return false;
    if (ctx.strategy.recipient !== "bureau") return true;
    return !a.bureauScope || a.bureauScope === ctx.targetBureau;
  });
}

export interface LetterContext {
  strategy: Strategy;
  recipientName: string;
  recipientLines: string[];
  targetBureau?: Bureau;
  consumerComplete: boolean;
  // True when the recipient block is mail-ready: bureau letters always are; a
  // furnisher/collector letter is complete only once a recipient address is given.
  recipientComplete: boolean;
  crossBureau: boolean;
  presentBureaus: Bureau[];
  conflicts: string[];
  data: BureauData;
  // FCRA §605 reporting window for this item (7 years, or 10 for a bankruptcy
  // public record). Used to keep the obsolescence language accurate.
  obsolescenceYears: number;
  // Dispute round (1 = first dispute). Drives the tone ladder: neutral
  // investigation in R1, method-of-verification in R2, regulatory framing by R4/5.
  round: number;
  // RC1-S4: the consumer's OWN confirmed statements of fact about this item,
  // already filtered to the ones this letter may speak from
  // (assertionsForContext). Empty = the consumer has confirmed nothing, so the
  // letter asserts nothing: no SUMMARY OF FACTUAL CONCERNS section is emitted.
  assertions: ConsumerAssertionInput[];
  // RC1-S11 (critic X-3): how many of the consumer's confirmed facts did NOT
  // fit this letter. Non-zero is never silent — the opening paragraph stops
  // claiming the list below is the complete set. Zero in every ordinary case.
  omittedAssertions: number;
  // RC1-S4 (L-03): whether the CONSUMER has explicitly said they intend to take
  // this to the CFPB / their state Attorney General. Default FALSE, everywhere.
  // Nothing in the product may set it except the consumer's own opt-in.
  complaintIntent: boolean;
}

// Optional, additive inputs to buildContext. Kept as one options object so a
// caller that has neither (every pre-RC1-S4 call site) is unchanged and gets the
// conservative defaults: no assertions, no complaint intent.
export interface LetterOptions {
  assertions?: ConsumerAssertionInput[];
  complaintIntent?: boolean;
}

// Optional override of the recipient block for furnisher/collector letters, so a
// direct dispute is addressed to the actual mailing address instead of a
// "[Furnisher mailing address]" placeholder.
export interface RecipientOverride {
  name?: string | null;
  address?: string | null; // free-text, one address line per newline
}

// Split a free-text address into clean, non-empty lines for the recipient block.
function addressLines(address: string | null | undefined): string[] {
  if (!address) return [];
  return address
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function buildContext(
  strategyId: string,
  t: LetterTradeline,
  consumer: LetterConsumer,
  targetBureau?: Bureau,
  round: number = 1,
  recipient?: RecipientOverride,
  options?: LetterOptions
): LetterContext {
  const strategy = STRATEGY_BY_ID[strategyId] ?? STRATEGY_BY_ID["fcra_611"];
  const data = getBureauData(t.bureauData);
  const present = presentBureaus(data);
  const bureau = targetBureau ?? present[0] ?? "EQUIFAX";

  let recipientName = "";
  let recipientLines: string[] = [];
  let recipientComplete = true;
  if (strategy.recipient === "bureau") {
    const addr = BUREAU_ADDRESS[bureau];
    recipientName = addr.name;
    recipientLines = addr.lines;
  } else {
    recipientName = (recipient?.name?.trim() || t.creditorName);
    const provided = addressLines(recipient?.address);
    if (provided.length) {
      recipientLines = provided;
    } else {
      recipientLines = ["[Furnisher mailing address]"];
      recipientComplete = false;
    }
  }

  const consumerComplete = Boolean(consumer.fullName && consumer.addressLine1 && consumer.city && consumer.state && consumer.zip);
  const resolvedTargetBureau = strategy.recipient === "bureau" ? bureau : undefined;

  // RC1-S11 (critic X-3) — EVERY FACT THE CONSUMER CONFIRMED REACHES THE LETTER.
  //
  // buildFindings used to iterate `ctx.assertions.slice(0, 5)`. Nothing capped
  // confirmations upstream (the assertion route creates unconditionally; the
  // confirm UI shows no limit) and EIGHT distinct facts are confirmable about an
  // ordinary account — so a consumer who confirmed six got a letter carrying
  // five of them, with nothing anywhere saying so, under an opening paragraph
  // claiming the information "set out below" was what they had identified. In a
  // product whose whole law is "we only write what you confirm", writing less
  // than they confirmed is the same failure as writing more.
  //
  // The cap is gone. What remains is a defensive bound an ordinary consumer
  // cannot reach (twice the entire vocabulary), because an unbounded loop must
  // never be able to compose an unbounded document — and if it ever DOES bite,
  // `omittedAssertions` makes it visible in the letter's own wording rather than
  // dropping the facts quietly.
  //
  // Filtered and bounded ONCE, here, so every consumer of the context (template
  // render, AI grounding prompt, round-2 prompt) speaks from exactly the same
  // set and no caller can widen or narrow it by accident. That also closes the
  // divergence the critic found between the template path (truncated) and the
  // AI-refinement path (not truncated).
  const applicableAssertions = assertionsForContext(options?.assertions ?? [], {
    strategy,
    targetBureau: resolvedTargetBureau,
  });
  const boundedAssertions = applicableAssertions.slice(0, MAX_LETTER_ASSERTIONS);

  return {
    strategy,
    recipientName,
    recipientLines,
    targetBureau: resolvedTargetBureau,
    consumerComplete,
    recipientComplete,
    crossBureau: hasCrossBureauKnowledge(data),
    presentBureaus: present,
    conflicts: crossBureauConflicts(data),
    data,
    obsolescenceYears: obsolescenceWindowYears({
      accountType: t.accountType ?? "OTHER",
      creditorName: t.creditorName,
      text: bureauTextBlob(data),
    }),
    round: Math.max(1, round),
    // Filtered ONCE, here, so every consumer of the context (template render, AI
    // grounding prompt, round-2 prompt) speaks from exactly the same set and no
    // caller can widen it by accident.
    assertions: boundedAssertions,
    omittedAssertions: Math.max(0, applicableAssertions.length - boundedAssertions.length),
    complaintIntent: options?.complaintIntent === true,
  };
}

// One investigator-style finding: the fact, and the one sentence that explains
// why the fact prevents the information from being verified as accurate and
// complete. This is the FACT → WHY IT MATTERS spine — the investigation request
// itself lives in the REQUESTED ACTION section, never inside a finding.
interface Finding {
  element: string;
  fact: string;
  why: string;
}

// RC1-S4 — findings are the CONSUMER'S confirmed statements, nothing else.
//
// WHAT THIS REPLACED, and why. The previous implementation derived every
// "factual concern" from parsed report data with no consumer input at all: it
// unconditionally appended a Payment History concern ("always a completeness
// concern"), and its Account Status fallback asserted, in the consumer's first
// person, "I am unable to reconcile the reported status with my records" — a
// statement about records the product had never asked them about. Both are gone.
//
// The report's own data has NOT stopped mattering: it still supplies the
// OBSERVABLE half of each finding (what the file actually says the status,
// balance or date is, and where the bureaus disagree). What it may no longer do
// is supply the CLAIM. Every claim below is prefixed by what the consumer
// themselves confirmed, and if they confirmed nothing this returns [].
//
// At most five, in the order the consumer confirmed them.
export function buildFindings(t: LetterTradeline, ctx: LetterContext): Finding[] {
  const data = ctx.data;
  const present = ctx.presentBureaus;
  const lbl = (b: Bureau) => BUREAU_LABEL[b];

  const collect = <V>(pick: (f: BureauData[Bureau]) => V | undefined | null) =>
    present
      .map((b) => ({ b, v: pick(data[b]) }))
      .filter((x) => x.v != null && String(x.v).length > 0) as { b: Bureau; v: V }[];

  // ---- RC1-S11 (journey CRITICAL-1): A BUREAU IS ONLY EVER TOLD WHAT IT SAID
  //
  // `collect()` gathers observations from the bureaus that ACTUALLY attest a
  // datum (`presentBureaus`). The single-value branches below then took
  // `statuses[0].v` — whichever bureau supplied it — and relabelled it with
  // `ctx.targetBureau`. Nothing checked that the target was among the attesting
  // bureaus, and `present` is computed independently of the target. Reproduced
  // end to end at the release gate: an Equifax-only report, a consumer
  // confirmation scoped to Experian, and the Experian-targeted letter printed
  //
  //     Fact: It is reported as "Charge-Off" on the Experian file.
  //
  // three lines under "I make no representation about any other consumer
  // reporting agency, as I have not reviewed those files." Experian's presence
  // was UNKNOWN; only Equifax ever said "Charge-Off". A signed, mailed letter
  // asserting a fact the file never attested is the P0-2 fabrication class in
  // the one artifact that carries legal consequence, and a dispute whose factual
  // predicate is demonstrably false invites the §1681i(a)(3) frivolous
  // determination the assertion gate exists to avoid.
  //
  // THE RULE NOW: an observation may name a bureau only if THAT bureau's own
  // record carries the value. For a bureau-targeted letter that means the target
  // and nobody else — naming another agency would also contradict the scope
  // sentence and break the cross-bureau rule. Where the target attests nothing,
  // the observation is OMITTED and the consumer's own confirmed claim stands
  // alone: dropping an unattested observation costs the letter a detail, while
  // keeping it costs the consumer the dispute. (Options considered: attribute to
  // the attesting bureau instead — rejected for a bureau letter, it tells
  // Experian what Equifax reports; refuse to compose — rejected, the CLAIM is
  // still the consumer's to make about the target's file.)
  //
  // A furnisher/collector letter has no target bureau: there the observation is
  // attributed BY NAME to the bureau that attested it, which is truthful and
  // permitted — the furnisher supplies all of them.
  //
  // The cross-bureau branches are untouched and were never affected: each value
  // is already printed beside the bureau that reported it, and that branch only
  // runs when ≥2 bureaus are known, which is exactly when the letter drops the
  // "no representation about any other agency" sentence and disputes ON the
  // discrepancy.
  const attesting = <V>(obs: { b: Bureau; v: V }[]) =>
    ctx.targetBureau ? obs.filter((o) => o.b === ctx.targetBureau) : obs;

  const statuses = collect((f) => f?.status);
  const statusObservation = (): string => {
    if (ctx.crossBureau && new Set(statuses.map((s) => String(s.v).toLowerCase())).size > 1) {
      return statuses.map((s) => `${lbl(s.b)} reports "${s.v}"`).join("; ") + ".";
    }
    const own = attesting(statuses);
    if (!own.length) return "";
    return ctx.targetBureau
      ? `It is reported as "${own[0].v}" on the ${lbl(ctx.targetBureau)} file.`
      : `${lbl(own[0].b)} reports it as "${own[0].v}".`;
  };
  const balances = collect((f) => f?.balanceCents);
  const balanceObservation = (): string => {
    if (ctx.crossBureau && new Set(balances.map((s) => s.v)).size > 1) {
      return balances.map((s) => `${lbl(s.b)} reports ${formatCents(s.v)}`).join("; ") + ".";
    }
    const own = attesting(balances);
    if (!own.length) return "";
    // The bureau-target wording is unchanged: inside a letter whose scope
    // sentence already says "solely how this account is reported on my {target}
    // file", an unqualified "The reported balance is …" means the target — and
    // the gate above now makes that implication TRUE. The value quoted is the
    // target's OWN attested figure, not the tradeline aggregate.
    return ctx.targetBureau
      ? `The reported balance is ${formatCents(own[0].v)}.`
      : `${lbl(own[0].b)} reports a balance of ${formatCents(own[0].v)}.`;
  };
  const dofds = collect((f) => f?.dofd);
  const dofdObservation = (): string => {
    if (ctx.crossBureau && new Set(dofds.map((s) => String(s.v))).size > 1) {
      return dofds.map((s) => `${lbl(s.b)} reports a date of first delinquency of ${formatDate(s.v)}`).join("; ") + ".";
    }
    const own = attesting(dofds);
    if (!own.length) return "";
    return ctx.targetBureau
      ? `The date of first delinquency reported on the ${lbl(ctx.targetBureau)} file is ${formatDate(own[0].v)}.`
      : `${lbl(own[0].b)} reports a date of first delinquency of ${formatDate(own[0].v)}.`;
  };

  const findings: Finding[] = [];
  for (const a of ctx.assertions) {
    const type = a.assertionType as ConsumerAssertionType;
    const note = sanitizeConsumerNote(a.consumerNote);
    let f: Finding;
    switch (type) {
      case "not_mine":
        f = {
          element: "Account Ownership",
          fact: "I do not recognize this account. I did not open it and I did not authorize it.",
          why: "An account I state is not mine cannot be verified as belonging to me against the original account records, and information that cannot be verified as accurate should not remain on my file.",
        };
        break;
      case "inquiry_not_authorized":
        f = {
          element: "Inquiry Authorization",
          fact: "I do not recognize any application or transaction that would authorize this inquiry into my consumer file.",
          why: "A consumer report may be furnished only for a permissible purpose under FCRA §604 (15 U.S.C. §1681b); an inquiry I do not recognize should be verified as authorized against the requesting party's own records, or removed if it cannot be.",
        };
        break;
      case "inaccurate_balance":
        f = {
          element: "Reported Balance",
          fact: `${balanceObservation()} I state that this balance is not accurate.`.trim(),
          why: "A balance I state is inaccurate must be reconciled to the account's own payment and transaction records before it can be reported as accurate.",
        };
        break;
      case "inaccurate_status": {
        const obs = statusObservation();
        f = {
          element: "Account Status",
          fact: `${obs ? obs + " " : ""}I state that the status reported for this account is not accurate.`,
          why: "A status I state is inaccurate must be verified against the original account records; if it cannot be substantiated as accurate and complete, it cannot be reported as such.",
        };
        break;
      }
      case "late_dates_wrong": {
        const obs = dofdObservation();
        f = {
          element: "Payment History and Dates",
          fact: `I state that the late payment history and/or the dates reported for this account are not accurate.${obs ? " " + obs : ""}`,
          why: "Payment history and the date of first delinquency must be accurate and verifiable to the original account records; the date of first delinquency also controls when this item must cease to be reported under FCRA §605.",
        };
        break;
      }
      case "account_closed": {
        // REMEDIATION L-1: never append an observation that CONTRADICTS the
        // claim. "I state that this account is closed. It is reported as
        // \"Closed\"." is a self-defeating dispute, so the observation is
        // dropped when the report already says closed.
        const rawStatus = statusObservation();
        const obs = /\bclosed\b/i.test(rawStatus) ? "" : rawStatus;
        f = {
          element: "Account Status — Closed",
          fact: `I state that this account is closed.${obs ? " " + obs : ""}`,
          why: "Reporting that does not reflect that the account is closed is incomplete, and incomplete information must be corrected as well as inaccurate information.",
        };
        break;
      }
      case "paid_settled": {
        // REMEDIATION L-1: a $0 reported balance is consistent with "paid or
        // settled", so quoting it back argues against the consumer's own claim.
        // Only a NON-ZERO reported balance is worth putting in the letter.
        // RC1-S11: gate on the balance the letter would actually QUOTE (the
        // target bureau's own), not the tradeline aggregate — otherwise a target
        // reporting $0 could still have a non-zero aggregate quoted at it.
        const quoted = attesting(balances)[0]?.v ?? t.balance;
        const obs = quoted > 0 ? balanceObservation() : "";
        f = {
          element: "Payment or Settlement",
          fact: `I state that this account was paid or settled.${obs ? " " + obs : ""}`,
          why: "Reporting that does not reflect a payment or settlement I state was made is incomplete, and must be reconciled to the account's own records.",
        };
        break;
      }
      case "incomplete_info":
        f = {
          element: "Completeness of Reporting",
          fact: "I state that the information reported for this account is incomplete.",
          why: "FCRA §611 requires disputed information to be verified as both accurate AND complete; information that cannot be substantiated as complete should be corrected or deleted.",
        };
        break;
      case "other":
      default:
        f = {
          element: "Consumer-Identified Concern",
          // REMEDIATION L-3: the note is appended INLINE, so this no longer
          // promises a description "below" that never appears on its own line.
          fact: "I state that information reported for this account is inaccurate or incomplete.",
          why: "Information I state is inaccurate or incomplete must be verified against the original account records before it can continue to be reported.",
        };
        break;
    }
    // The consumer's own words, carried verbatim (whitespace-normalized only)
    // and attributed to them. Never paraphrased, never AI-refined into a claim.
    // REMEDIATION L-2: typographic outer quotes. A note containing a straight
    // double quote used to render as `In my own words: "I said "no" ..."`,
    // where the attribution delimiters are indistinguishable from the
    // consumer's own punctuation. The consumer's characters are NOT altered —
    // only the delimiters around them changed.
    if (note) f = { ...f, fact: `${f.fact} In my own words: \u201C${note}\u201D` };

    // Original-creditor context, attached to the ownership claim only — it is
    // the one finding a collection's chain of title actually bears on, and it is
    // an observation about the file, not a claim of its own.
    if (type === "not_mine" && t.originalCreditor) {
      f = {
        ...f,
        why: `${f.why} The reporting names ${t.originalCreditor} as the original creditor; the chain from that creditor to the party now reporting this account should be documented as part of that verification.`,
      };
    }
    findings.push(f);
  }
  return findings;
}

// REQUESTED ACTION + the exact evidence demanded — differentiated by who the letter
// is to. A bureau owes a §611 reasonable reinvestigation; a furnisher owes its own
// §1681s-2(b) investigation; a collector owes §1692g validation. Emitting the wrong
// demand (asking a collector for a "§611 reinvestigation") is both legally wrong and
// pattern-matchable as a credit-repair template, so the demand tracks the recipient.
// Every request stays conditional ("if it cannot be verified") — never an outcome.
// REMEDIATION H-1 / M-1. `hasFindings` is what makes the demand match the
// letter. With concerns set out, the demand is "reinvestigate each disputed
// item"; with none — the round-2 path today, and any caller that has not been
// given the consumer's assertions — the SAME demand referred to "each disputed
// item" and "any disputed item" when no item had been identified anywhere in
// the document. That is the phantom-findings defect, not a wording nicety: it
// is what makes a claim-free letter read as though a list were attached.
function requestedAction(ctx: LetterContext, hasFindings: boolean): string[] {
  const out: string[] = [];
  switch (ctx.strategy.id) {
    case "goodwill":
      out.push("REQUESTED ACTION");
      out.push(
        "  I am not disputing the accuracy of this item. I am respectfully asking, as a gesture of goodwill, that you consider removing or revising the reported late payment(s) in light of my broader history with the account. I understand this is a courtesy and that you are under no obligation to grant it."
      );
      return out;
    case "cease_desist":
      out.push("REQUESTED ACTION");
      out.push(
        `  Pursuant to ${STATUTES.fdcpa_805c.short} (${STATUTES.fdcpa_805c.usc}), I request that you cease further communication with me regarding this account, except as the statute expressly permits (for example, to advise that collection efforts are being terminated or to notify me of a specific remedy you intend to invoke). This letter does not acknowledge the debt and does not waive any right, including my right to dispute it or to request validation.`
      );
      return out;
    case "pay_delete":
      out.push("REQUESTED ACTION");
      out.push(
        "  Without acknowledging that this debt is owed, I am willing to resolve this account in exchange for the complete deletion of the associated tradeline from every consumer reporting agency to which you furnish it. If you accept, please confirm the arrangement in writing BEFORE any payment is made; a written agreement is a condition of any payment, because some data-furnishing agreements discourage deletion in exchange for payment."
      );
      return out;
  }

  switch (ctx.strategy.recipient) {
    case "collector":
      out.push("REQUESTED ACTION — VALIDATION OF DEBT");
      out.push(`  1. Validate this debt under ${STATUTES.fdcpa_809.short} (${STATUTES.fdcpa_809.usc}): the amount claimed, the name and address of the original creditor, and an itemized accounting of the balance.`);
      out.push("  2. Provide documentation of your authority to collect — the assignment or bill of sale evidencing the chain of title from the original creditor to you.");
      out.push("  3. Cease collection activity until validation is mailed to me.");
      out.push("  4. To the extent you continue to furnish this account to the consumer reporting agencies, conduct the investigation the FCRA requires of a furnisher and report only information you have verified as accurate and complete.");
      return out;
    case "furnisher":
      out.push("REQUESTED ACTION — FURNISHER INVESTIGATION");
      out.push(
        hasFindings
          ? `  1. Conduct your own reasonable investigation of the disputed information under ${STATUTES.fcra_623.short} (${STATUTES.fcra_623.usc}).`
          : `  1. Conduct your own reasonable investigation of the information you report for this account under ${STATUTES.fcra_623.short} (${STATUTES.fcra_623.usc}).`
      );
      out.push("  2. Review the account-level records that would substantiate this reporting — the original signed agreement, the account statements or ledger, and the complete payment history — rather than re-confirming a summary tradeline.");
      out.push("  3. Report the results of your investigation to every consumer reporting agency to which you furnish this account.");
      out.push("  4. Modify, delete, or permanently block any item you find to be inaccurate, incomplete, or that cannot be verified against those records.");
      return out;
    case "bureau":
    default:
      out.push("REQUESTED ACTION — REINVESTIGATION");
      out.push(
        hasFindings
          ? `  1. Conduct a reasonable reinvestigation of each disputed item under ${STATUTES.fcra_611.short} (${STATUTES.fcra_611.usc}).`
          : `  1. Conduct a reasonable reinvestigation of the information reported for this account under ${STATUTES.fcra_611.short} (${STATUTES.fcra_611.usc}).`
      );
      out.push(
        hasFindings
          ? "  2. Forward all relevant information to the furnisher and require it to verify each disputed element against original, account-level documentation — not merely re-match my name and balance to its own record."
          : "  2. Forward all relevant information to the furnisher and require it to verify the information it reports for this account against original, account-level documentation — not merely re-match my name and balance to its own record."
      );
      out.push("  3. Correct or delete any information that cannot be verified as both accurate and complete.");
      out.push("  4. Disclose the method of verification under FCRA §611(a)(7): the business contacted, the procedure used, and the documentation relied upon.");
      out.push("  5. Provide an updated copy of my consumer file and written notice of the results.");
      return out;
  }
}

// The deadline sentence + round-scaled escalation — also recipient-specific, so a
// collector/furnisher is never told to "complete a §611 reinvestigation in 30 days."
function closing(ctx: LetterContext, hasFindings: boolean): string[] {
  // Non-dispute strategies get a matching close and NO reinvestigation/validation
  // demand and NO regulatory escalation ladder.
  if (ctx.strategy.id === "goodwill") {
    return ["Thank you for considering this request. I value the account relationship and appreciate any consideration you can extend."];
  }
  if (ctx.strategy.id === "cease_desist") {
    return [`Please treat this letter as my written cease-communication request under ${STATUTES.fdcpa_805c.short} (${STATUTES.fdcpa_805c.usc}). I am not waiving any right, including my right to dispute this debt or to request validation, and I ask that you confirm in writing that further communication will stop.`];
  }
  if (ctx.strategy.id === "pay_delete") {
    return [`This is a settlement offer and is not an acknowledgment of the debt. Please respond in writing. If we do not reach a written agreement, I reserve all rights, including the right to dispute this debt and to request validation under ${STATUTES.fdcpa_809.short} (${STATUTES.fdcpa_809.usc}).`];
  }
  const out: string[] = [];
  if (ctx.strategy.recipient === "collector") {
    // Timeliness is hedged: the §1692g(b) cease-collection duty only attaches to a
    // dispute made within 30 days of the collector's initial notice — a date we
    // don't track, so we never assert it as fact.
    out.push(`This is a written dispute. To the extent it is timely under ${STATUTES.fdcpa_809.short} (${STATUTES.fdcpa_809.usc}), please cease collection until you have mailed the validation described above. Nothing in this letter acknowledges the debt or waives any defense.`);
  } else if (ctx.strategy.recipient === "furnisher") {
    out.push(`Please complete your investigation and report the corrected results to the consumer reporting agencies under ${STATUTES.fcra_623.short} (${STATUTES.fcra_623.usc}). If ${hasFindings ? "an item" : "any information you report for this account"} cannot be substantiated against your account records, it should be modified, deleted, or blocked.`);
  } else {
    out.push(
      hasFindings
        ? `Under ${STATUTES.fcra_611.short} (${STATUTES.fcra_611.usc}), please complete this reinvestigation within 30 days of receipt. If any disputed item cannot be verified as accurate and complete, it should be corrected or deleted.`
        : `Under ${STATUTES.fcra_611.short} (${STATUTES.fcra_611.usc}), please complete this reinvestigation within 30 days of receipt. If any information reported for this account cannot be verified as accurate and complete, it should be corrected or deleted.`
    );
  }
  out.push("");
  // Escalation ladder — only the regulatory framing scales with the round.
  //
  // RC1-S4 (L-03). The round-4 sentence used to read "I am prepared to submit
  // this record to the Consumer Financial Protection Bureau and my state
  // Attorney General for review" — a statement of the CONSUMER'S INTENT that no
  // consumer had ever expressed, reached by one click and, with the letter body
  // read-only, impossible for them to remove before signing it. An intent to
  // file a regulatory complaint is the consumer's to declare, so it is now
  // gated on `ctx.complaintIntent`, which defaults to FALSE everywhere.
  //
  // The default is NOT silence about the agencies: it is the same
  // RESERVATION-OF-RIGHTS framing rounds 1-3 already use. Reserving a right the
  // FCRA actually gives the consumer states nothing about what they plan to do;
  // "I am prepared to submit this record" states something about them that only
  // they can know.
  if (ctx.round >= 4) {
    out.push(
      "This letter, together with my prior correspondence on this matter, constitutes a complete record of the disputes I have raised and the responses received. " +
        (ctx.complaintIntent
          ? "If the disputed information is not corrected or deleted, I am prepared to submit this record to the Consumer Financial Protection Bureau and my state Attorney General for review. "
          : "If the disputed information is not corrected or deleted, I reserve the right to seek review through the Consumer Financial Protection Bureau, my state Attorney General, and other appropriate regulatory channels. ") +
        "Please preserve all records, investigation notes, verification documentation, and audit trails relating to this dispute."
    );
  } else if (ctx.round === 3) {
    out.push(
      "Because a prior response did not disclose how the disputed information was verified, I again request the method of verification and the specific source documentation relied upon. Please preserve all records related to this dispute. If the information cannot be substantiated, I reserve the right to seek review through the Consumer Financial Protection Bureau and other appropriate channels."
    );
  } else {
    out.push(
      "Please preserve all records related to this dispute. If the disputed information cannot be adequately verified or addressed, I reserve the right to seek review through the Consumer Financial Protection Bureau and other appropriate regulatory channels."
    );
  }
  return out;
}

// Deterministic, compliance-safe letter. Used as the LLM's grounding draft and as
// a fallback when no LLM key is configured. CRITICAL: only emits cross-bureau
// language when crossBureau is true.
export function renderTemplateLetter(t: LetterTradeline, ctx: LetterContext, consumer: LetterConsumer): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const name = consumer.fullName || "[YOUR FULL NAME]";
  const addr1 = consumer.addressLine1 || "[YOUR ADDRESS]";
  const cityLine = consumer.city ? `${consumer.city}, ${consumer.state} ${consumer.zip}` : "[CITY, STATE ZIP]";
  const acct = t.accountNumberMask || "XXXX-XXXX";
  const statutes = ctx.strategy.statutes.map((k) => `${STATUTES[k].short} (${STATUTES[k].usc})`).join(", ");
  const bureauName = ctx.targetBureau ? BUREAU_LABEL[ctx.targetBureau] : ctx.recipientName;

  const lines: string[] = [];
  lines.push(name, addr1, cityLine, "", today, "", ctx.recipientName, ...ctx.recipientLines, "");
  lines.push(`RE: ${ctx.round >= 2 ? "Continued dispute" : "Dispute"} of ${t.creditorName} account ${acct}`, "");
  lines.push(`To Whom It May Concern,`, "");

  // Purpose-built opening. The three NON-DISPUTE strategies do not challenge the
  // item's accuracy, so they open on their own terms and carry NO findings section
  // (a goodwill letter that also lists "factual concerns" contradicts itself). The
  // accuracy disputes keep the neutral, round-aware investigation frame.
  const nonDispute = ctx.strategy.id === "goodwill" || ctx.strategy.id === "cease_desist" || ctx.strategy.id === "pay_delete";
  // Computed ONCE, before the opening paragraph is written, so the opening, the
  // scope disclaimer, the requested action and the closing all describe the same
  // letter. Non-dispute strategies never carry findings by design.
  const findings = nonDispute ? [] : buildFindings(t, ctx);
  const hasFindings = findings.length > 0;
  if (ctx.strategy.id === "goodwill") {
    lines.push(
      "I am writing regarding the above account. I am not disputing the accuracy of what is reported; rather, I am asking you to consider a goodwill adjustment in light of my overall history with the account, as explained below.",
      ""
    );
  } else if (ctx.strategy.id === "cease_desist") {
    lines.push(
      "I am writing regarding the above account to make a formal request under the Fair Debt Collection Practices Act, set out below. This letter is not an acknowledgment that the debt is owed.",
      ""
    );
  } else if (ctx.strategy.id === "pay_delete") {
    lines.push(
      "I am writing to propose a resolution of the above account. This is a settlement communication and is not an acknowledgment that the debt is owed or an admission of liability.",
      ""
    );
  } else if (ctx.round >= 2) {
    lines.push(
      hasFindings
        ? `I am writing to follow up on a prior dispute concerning the above account, which remains unresolved. I have reviewed the information that appears on ${
            ctx.targetBureau ? `my ${bureauName} consumer file` : "my consumer credit file"
          }, and I have set out below the specific information I state is inaccurate or incomplete. I ask that it be addressed through a reasonable reinvestigation under ${statutes}.`
        : // REMEDIATION M-1: with nothing confirmed, this is a follow-up on the
          // PRIOR dispute and a request for the method of verification — it
          // states no concern, and it points at none.
          `I am writing to follow up on a prior dispute concerning the above account, which remains unresolved. I am asking about the reinvestigation of that dispute: please confirm its current status, disclose how the previously disputed information was verified, and address the information reported for this account under ${statutes}.`,
      ""
    );
  } else {
    // RC1-S4 (L-02). The old opening asserted, in the consumer's first person,
    // that the account contained information "that, based on the information
    // currently available to me, I am unable to reconcile" — before the product
    // had asked them a single question about their own records. The opening now
    // says only what is true: the consumer reviewed the item and has identified
    // the specific information they state is wrong. With nothing confirmed, it
    // claims nothing at all.
    lines.push(
      ctx.assertions.length
        ? `I have reviewed the information associated with the above account as it appears on ${
            ctx.targetBureau ? `my ${bureauName} consumer file` : "my consumer credit file"
          }. I have identified ${
            ctx.omittedAssertions > 0 ? "information" : "the specific information"
          } set out below as inaccurate or incomplete, and I respectfully request a reasonable reinvestigation under ${statutes}.`
        : `I am writing regarding the information associated with the above account as it appears on ${
            ctx.targetBureau ? `my ${bureauName} consumer file` : "my consumer credit file"
          }, and I respectfully request a reasonable reinvestigation of that information under ${statutes}.`,
      ""
    );
  }

  // SCOPE DISCLAIMER. Emitted for every accuracy dispute, INDEPENDENTLY of how
  // many concerns follow: it is a statement about the whole letter's scope (one
  // file, reviewed by the consumer), not a caption for the list.
  //
  // REMEDIATION H-1/M-1: the wording is now claim-free. Carrying "The concerns
  // I set out…" out of the findings block left the sentence referring to a list
  // that may not exist — a letter that points at concerns it never states. It
  // is conditional now ("any concerns it raises"), so it is true either way and
  // scaffolds nothing.
  if (!nonDispute && !ctx.crossBureau) {
    lines.push(
      `(This dispute and any concerns it raises relate solely to how this account is reported on my ${bureauName} file. I make no representation about any other consumer reporting agency, as I have not reviewed those files.)`,
      ""
    );
  }

  // INVESTIGATOR SUMMARY — Data Element / Fact / Why It Matters.
  //
  // RC1-S4: every entry here is one statement of fact the CONSUMER confirmed
  // (buildFindings above). With nothing confirmed, the section is omitted
  // entirely rather than padded with concerns nobody asserted — the letter then
  // requests a reinvestigation without putting a single factual claim in the
  // consumer's mouth. app/api/letters/generate/route.ts refuses to compose in
  // that state at all, so the empty case is reachable only from a caller that
  // has not yet been given the consumer's assertions (see the round-2 handoff
  // note on buildRound2UserPrompt in lib/round2.ts).
  if (!nonDispute) {
    if (findings.length) {
      lines.push("SUMMARY OF FACTUAL CONCERNS");
      lines.push("");
      findings.forEach((f, i) => {
        lines.push(`${i + 1}. ${f.element}`);
        lines.push(`   Fact: ${f.fact}`);
        lines.push(`   Why it matters: ${f.why}`);
        lines.push("");
      });
    }
  }

  // Obsolescence grounds — the specific basis for the §605 strategy (bureau only).
  if (ctx.strategy.id === "fcra_605") {
    const windowPhrase =
      ctx.obsolescenceYears === 10
        ? "ten years for a bankruptcy of this type"
        : "seven years for most adverse information";
    lines.push(
      "GROUNDS — OBSOLESCENCE",
      `  Under ${STATUTES.fcra_605.short} (${STATUTES.fcra_605.usc}), adverse information generally may not be reported beyond ${windowPhrase}. If the reporting period for this item has expired, I request that it be treated as obsolete and removed.`,
      ""
    );
  }

  // Statutory authority — quote the actual operative law, not just the code, so the
  // recipient sees the precise obligation they are under. (Skipped for goodwill,
  // which cites no statute and makes no legal demand.)
  if (ctx.strategy.statutes.length) {
    lines.push("STATUTORY AUTHORITY");
    for (const k of ctx.strategy.statutes) {
      const s = STATUTES[k];
      lines.push(`  ${s.short} (${s.usc}):`);
      lines.push(`    ${s.text}`);
    }
    lines.push("");
  }

  // Recipient- and strategy-specific requested action + evidence, then the matching
  // deadline sentence and round-scaled escalation.
  lines.push(...requestedAction(ctx, hasFindings), "");
  lines.push(...closing(ctx, hasFindings), "");
  lines.push("Respectfully,", "", "");
  lines.push(...signatureBlock(name));

  return lines.join("\n");
}

// RC1-S5 (A3 L-07) — SIGNATURE AND DATE, ON THE PAPER.
// The print guide instructs "Print every page … then sign and date it" and the
// mail bar recommends certified mail, but the letter itself ended
// `"Respectfully," / "" / name` — one blank line, no signature rule, no date
// line. A dispute is a signed statement; the artifact has to have somewhere to
// sign it and somewhere to date it, or the instruction is asking the consumer
// to improvise on a document they are about to mail to a credit bureau.
//
// Rules, not free text: the rules are what a reader recognizes as a signature
// block, and they print identically in every browser because the print view
// renders the body as pre-wrapped text.
export function signatureBlock(name: string): string[] {
  return [
    "_____________________________________________        _____________________",
    `${SIGNATURE_LABEL}${SIGNATURE_LABEL_PAD}${DATE_LABEL}`,
    "",
    name,
  ];
}
const SIGNATURE_LABEL = "Signature";
const DATE_LABEL = "Date signed";
// Aligns "Date signed" under the second rule above (45 chars + 8 spaces).
const SIGNATURE_LABEL_PAD = " ".repeat(53 - SIGNATURE_LABEL.length);

// ── RC1-S5 · THE LETTER LIFECYCLE ───────────────────────────────────────────
//
// Lives here, not in a route, because THREE routes write a letter's status —
// app/api/letters/[id]/route.ts (the consumer's own transitions),
// app/api/letters/[id]/response/route.ts (logging the bureau's reply) and
// app/api/letters/generate/route.ts (recomposition resets to GENERATED). Review
// M-5 found the hole that follows from each of them knowing its own rule only:
// the response route wrote RESPONSE_RECEIVED from ANY state, and RESOLVED (which
// can write `tradeline.resolved`) is reachable from there — so a letter that was
// never approved and never mailed could still be reported as a resolved dispute.
//
//   GENERATED ──edit──▶ DRAFT ──approve──▶ PRINTED ──mark mailed──▶ MAILED
//        └────────────approve────────────▶ PRINTED       │
//                     ▲                     │            ├─▶ RESPONSE_RECEIVED ─▶ RESOLVED
//                     └──re-open to edit────┘            └─▶ RESOLVED
//
// ⚠️ NAMING DEBT, DELIBERATE AND DOCUMENTED. "Approved" is carried by the
// existing `PRINTED` enum member because `LetterStatus` has no APPROVED value
// and `prisma/schema.prisma` is outside this slice's owned paths — adding one is
// a migration, which belongs to whichever slice owns the schema next. PRINTED is
// the closest existing meaning (app/api/letters/generate/route.ts:162 already
// treats it as "the printed page still matches this content") and the product
// only ever sets it at the moment it hands the consumer the printable document.
// The follow-up is exactly one change: add `APPROVED` to `enum LetterStatus` +
// a migration, then swap the constant below. The name reaches a consumer-visible
// surface in exactly one place today: lib/intelligence/reasoning.ts:121 renders
// `(status: PRINTED)` into a reasoning trace (review L-3, unowned — S11).
export const LETTER_APPROVED_STATUS: LetterStatus = "PRINTED";

/** Statuses whose body the consumer may still change. */
export const LETTER_EDITABLE_STATUSES: LetterStatus[] = ["GENERATED", "DRAFT"];

export const LETTER_TRANSITIONS: Record<LetterStatus, LetterStatus[]> = {
  GENERATED: ["GENERATED", "DRAFT", LETTER_APPROVED_STATUS],
  DRAFT: ["DRAFT", LETTER_APPROVED_STATUS],
  PRINTED: [LETTER_APPROVED_STATUS, "DRAFT", "MAILED"],
  MAILED: ["MAILED", "RESPONSE_RECEIVED", "RESOLVED"],
  RESPONSE_RECEIVED: ["RESPONSE_RECEIVED", "RESOLVED"],
  RESOLVED: ["RESOLVED"],
};

export function canTransitionLetter(from: LetterStatus, to: LetterStatus): boolean {
  return (LETTER_TRANSITIONS[from] ?? []).includes(to);
}

// ── S11 AD-2 · A WITHDRAWN CONFIRMATION MUST REACH THE LETTER IT AUTHORIZED ──
//
// P0-3 ("no confirmed fact, no letter") was enforced at COMPOSITION time only.
// Nothing re-checked it for a letter that already existed, and two ordinary
// paths revoke the confirmation while the letter stays live and mailable:
//
//   (a) WITHDRAWAL. DELETE /api/tradelines/[id]/assertion flips status to
//       WITHDRAWN. The panel says so — "Withdrawing it stops it being used in
//       anything drafted from here on" — and POST /api/letters/generate does
//       refuse to draft it again. But the letter already on file still offered
//       Approve → Print → Mark mailed, still reading, in the consumer's first
//       person, "I do not recognize this account. I did not open it…". The
//       consumer could mail a statement they had formally retracted, from a
//       product whose own route would now refuse to write it.
//   (b) RE-ANALYSIS. lib/analyze.ts re-links Letter rows to the rebuilt
//       tradelines; ConsumerAssertion rows are deliberately NOT re-linked (H-2:
//       they are history, and a new report is a new set of facts to confirm).
//       So the letter points at a tradeline carrying zero assertions.
//
// Both collapse to one question, asked of the CURRENT state: does an ACTIVE
// confirmation still stand behind this letter?
//
// MAILED IS NEVER RE-JUDGED. A mailed letter is a RECORD of what was sent, and
// the H-2 round established that its authorizing evidence is preserved, never
// rewritten. HISTORICAL is therefore a terminal reading: withdrawing a
// confirmation afterwards changes nothing about the record, and this function
// must never be used to alter, hide or re-score a mailed letter.
export type LetterAuthorizationState =
  | "AUTHORIZED"   // an ACTIVE confirmation still stands behind this draft
  | "REVOKED"      // unmailed, and nothing the consumer still stands behind
  | "HISTORICAL";  // already mailed — a record, not a pending action

export interface LetterAuthorizationInput {
  mailedAt: Date | string | null;
  tradelineId: string | null;
  /** ACTIVE assertions this user holds on that tradeline, counted NOW. */
  activeAssertionCount: number;
}

export function letterAuthorization(l: LetterAuthorizationInput): LetterAuthorizationState {
  if (l.mailedAt != null) return "HISTORICAL";
  // Fails closed: an unmailed letter whose tradeline is gone (report deleted)
  // has nothing left to check the claim against.
  if (!l.tradelineId) return "REVOKED";
  return l.activeAssertionCount > 0 ? "AUTHORIZED" : "REVOKED";
}

/** True only where an action is still pending AND the consumer no longer stands
 *  behind it. Never true of a mailed letter. */
export function letterAuthorizationRevoked(l: LetterAuthorizationInput): boolean {
  return letterAuthorization(l) === "REVOKED";
}

// One message, used by every surface that has to say this, so the refusal a
// consumer meets on Approve reads the same as the one on the print page.
//
// RC1-S5 / S11 (critic X-4): the wording must be true for BOTH populations that
// reach it. A consumer who withdrew a confirmation is one. The other is every
// letter drafted BEFORE confirmations existed: it never had one to withdraw, so
// "has been withdrawn" would state something that never happened to them. The
// message names the three real causes and does not claim which one applies.
export const LETTER_AUTHORIZATION_REVOKED_MESSAGE =
  "This letter states facts in your name, and no confirmation stands behind it right now \u2014 either the confirmation it was drafted from was withdrawn, " +
  "the report it was drafted from has been replaced, or it was drafted before we started asking you to confirm each fact. " +
  "It can\u2019t be approved, printed or mailed until you confirm those facts on your Tradelines page. " +
  "Nothing has been deleted \u2014 the draft is still here.";

// ── RC1-S5 (A3 L-01 / P1-31): the consumer's own edits ──────────────────────
// A dispute letter is a signed statement, so the consumer gets to change it —
// PATCH /api/letters/[id] accepts a body while the letter is still a draft.
// These are the bounds that apply to what they type.
export const LETTER_BODY_MIN = 40;
/** ~10 printed pages. Longer than any letter this product composes, bounded so
 *  nothing unbounded can be persisted, encrypted, printed or re-scrubbed. */
export const LETTER_BODY_MAX = 20_000;

/**
 * Clean a consumer-edited letter body WITHOUT reformatting it.
 *
 * Whitespace is the consumer's: indentation, blank lines and line breaks are
 * preserved exactly, because the print view renders the stored body verbatim
 * and re-wrapping their paragraphs would change the document they approved.
 * What is removed is what cannot legitimately appear in a printed letter:
 * carriage returns (normalized so the body has one line-ending convention),
 * control characters, and the invisible/bidirectional formatting characters
 * that can make printed text read differently from the text on screen.
 */
export function sanitizeLetterBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    // REVIEW M-4: U+2028 / U+2029 are what Word, Pages and Google Docs emit for
    // a soft line break. DELETING them glued words together in a pasted draft
    // ("Account number XXXX-1234" → "Account numberXXXX-1234"); they are line
    // breaks, so they normalize to one, exactly like \r\n two lines above.
    .replace(/[\u2028\u2029]/g, "\n")
    // C0 controls except \n and \t, plus DEL and the C1 block. Written with
    // \u escapes for the same reason normalizeConsumerNote above is: a literal
    // control character in this source file would make the file binary to grep.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    // Zero-width, line/paragraph separators, bidi overrides and BOM.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\s+$/, "");
}

export function buildSystemPrompt(round: number = 1): string {
  const r = Math.max(1, round);
  return [
    "ROLE",
    "You are an expert consumer-protection paralegal who drafts credit dispute letters that are factually grounded, legally precise, and persuasive. You write for ordinary consumers exercising their own federal rights — not as an attorney providing legal advice. Your register is that of a compliance analyst documenting concerns, not a credit-repair template threatening litigation.",
    "",
    "INVESTIGATOR-FIRST METHOD (how to argue — this governs structure):",
    "Every disputed point follows the order FACT → WHY IT MATTERS → INVESTIGATION REQUEST. Never lead with a statute, an accusation, or a demand. State the factual concern first; explain in one sentence why it prevents the information from being verified as accurate and complete; only then invoke the law that entitles the consumer to a reinvestigation. The objective is deletion of UNVERIFIABLE information — and the lawful, higher-yield path to deletion is to compel a real reinvestigation the furnisher cannot satisfy, after which §1681i requires deletion automatically. A letter an agency can pattern-match to a credit-repair template may be deemed frivolous under FCRA §1681i(a)(3) and never investigated; an investigator-style letter compels the reinvestigation. Never demand deletion as a substitute for requesting verification first.",
    "",
    // REMEDIATION M-2: 'I am unable to reconcile' and 'based on the information
    // currently available' were removed from this list. Both are first-person
    // statements about the CONSUMER'S OWN records and recollection — exactly
    // what rule 8 below forbids the model from introducing, and exactly the
    // phrasing RC1-S4 deleted from the deterministic template. Leaving them here
    // instructed the model both ways, with the concrete instruction inviting the
    // deleted claim back on the AI-refinement path.
    "PREFERRED FRAMING — state concerns, not verdicts. Prefer phrasing such as: 'raises concerns regarding', 'appears inconsistent with', 'cannot be readily reconciled', 'warrants verification', 'appears incomplete', 'if it cannot be substantiated'. Present facts that warrant investigation; do not pronounce conclusions only an adjudicator can reach. Phrasings that speak for the consumer about their OWN records, recollection or intentions ('I am unable to reconcile…', 'I do not recall…', 'I intend to…') are reserved to the consumer: use them ONLY where the grounded draft already contains them.",
    "",
    "NEVER STATE AS ESTABLISHED FACT (reframe each as a concern warranting investigation):",
    "• that a law has been violated — no 'this violates the FCRA', 'you are in violation', 'this is illegal', 'this is fraud', 'you are liable';",
    "• that the agency or furnisher 'failed to investigate' — instead, a prior response 'does not appear to reflect a reasonable reinvestigation', and request the method of verification;",
    "• that an account 'is re-aged' — instead, the date of first delinquency 'appears inconsistent and warrants verification';",
    "• that a hard inquiry 'was unauthorized' — UNLESS the consumer has confirmed it; otherwise the consumer 'does not recognize any application or transaction that would authorize' it;",
    "• the §609 and Metro 2 deletion myths — §609 is a disclosure right only; Metro 2 is a formatting standard, never a deletion mandate.",
    "",
    `ROUND-BASED TONE — this letter is ROUND ${r}. Match the tone to the round and never exceed it:`,
    "• Round 1 — neutral, professional, investigation-focused; the goal is a documented reinvestigation request. The CFPB appears at most as a single reserved sentence in the closing.",
    "• Round 2 — reference the prior dispute and the response received; demand the METHOD OF VERIFICATION under FCRA §611(a)(7) (the source contacted and the procedure used); challenge the adequacy of the prior reinvestigation in plain language (Cushman; Hinkle).",
    "• Round 3 — verification-focused; press for the specific source documentation relied upon and challenge any 'verified' result that was not substantiated.",
    "• Round 4 — regulatory-review tone; summarize the chronology of unresolved disputes and frame the letter as the record supporting a CFPB / state-Attorney-General complaint.",
    "• Round 5 — comprehensive final escalation; summarize the full dispute history and preserve all rights.",
    "",
    "GOVERNING LAW (use accurately; never misstate a citation):",
    "• FCRA §611 / 15 U.S.C. §1681i — a consumer reporting agency must conduct a reasonable REINVESTIGATION of disputed information within 30 days and delete or correct anything that cannot be verified as accurate and complete.",
    "• FCRA §607(b) / 15 U.S.C. §1681e(b) — agencies must follow reasonable procedures to assure MAXIMUM POSSIBLE ACCURACY of the information they report.",
    "• FCRA §609 / 15 U.S.C. §1681g — a DISCLOSURE right (the consumer's right to see their file). It is NOT a deletion mechanism. Never imply that a '609 letter' compels removal.",
    "• FCRA §605 / 15 U.S.C. §1681c — obsolete adverse information generally may not be reported after 7 years (10 for certain bankruptcies).",
    "• FCRA §623 / 15 U.S.C. §1681s-2(b) — once notified of a dispute, a FURNISHER must conduct its own reasonable investigation, review all relevant information, and report results back to the agencies.",
    "• FDCPA §809(b) / 15 U.S.C. §1692g — on a timely request, a debt collector must VALIDATE the debt and cease collection until validation is mailed.",
    "• FDCPA §805(c) / 15 U.S.C. §1692c(c) — a consumer may direct a collector to cease further communication.",
    "",
    "STANDARD-OF-CARE CASE LAW (reference the PRINCIPLE in plain language; you may cite the case, but never imply it guarantees an outcome for this consumer):",
    "• Cushman v. Trans Union Corp., 115 F.3d 220 (3d Cir. 1997) — when a consumer supplies specific information, a reasonable reinvestigation may require more than re-confirming the data with the same furnisher that supplied it.",
    "• Hinkle v. Midland Credit Mgmt., 827 F.3d 1295 (11th Cir. 2016) — a reinvestigation can require reviewing actual account-level documentation, not merely matching the consumer's name and balance to the furnisher's record.",
    "• Saunders v. Branch Banking & Trust Co., 526 F.3d 142 (4th Cir. 2008) — information that is technically accurate but materially misleading can still violate the FCRA's accuracy requirement.",
    "• Johnson v. MBNA Am. Bank, NA, 357 F.3d 426 (4th Cir. 2004) — a furnisher's §1681s-2(b) investigation must be a reasonable, good-faith review, not a cursory rubber stamp.",
    "",
    "STRICT COMPLIANCE RULES (these override everything above):",
    "1. NEVER guarantee or predict an outcome. Do not say an item 'must', 'will', or 'has to' be deleted. Request deletion ONLY of information that cannot be verified as accurate and complete.",
    "2. State ONLY facts present in the provided structured data. Never invent balances, dates, account numbers, or events. If a fact is unknown, do not assert it.",
    "3. CROSS-BUREAU RULE: reference what other bureaus report ONLY if crossBureauKnowledge is true. If false, make NO claim or implication about any bureau other than the target. Absence of data is never evidence.",
    "4. Cite only the statutes and cases listed above, and only where they genuinely apply to the chosen strategy. Do not perpetuate the §609-forces-deletion myth.",
    "5. No threats, no all-caps demands, no fabricated legal consequences. A firm, professional, literate tone. This is consumer education, not legal advice — do not claim to be the consumer's attorney.",
    "6. RECIPIENT-SPECIFIC DEMANDS — match the demand to the recipient and never mix them. A BUREAU is asked to conduct a §611 reasonable reinvestigation and to disclose the §611(a)(7) method of verification (the business contacted, the procedure used, the documentation relied upon). A FURNISHER is asked to conduct its own §1681s-2(b) investigation against account-level records (the original agreement, statements/ledger, full payment history) and to report corrections to every CRA it furnishes. A COLLECTOR is asked to validate under FDCPA §1692g (the amount, the original creditor's name and address, and the chain of title) and to cease collection until validation is mailed. NEVER demand a '§611 reinvestigation within 30 days' from a collector or furnisher, and NEVER ask a bureau to 'validate' a debt. A goodwill request makes no legal demand; a cease-and-desist or pay-for-delete adds no accuracy dispute and admits nothing.",
    "7. Output ONLY the finished letter text (sender block, date, recipient block, RE line, body, signature). No preamble, no commentary, no markdown.",
    "8. CONSUMER-CONFIRMED FACTS ONLY. Every first-person factual claim in the 'SUMMARY OF FACTUAL CONCERNS' section of the grounded draft was confirmed by the consumer personally. You may reword for clarity, but you may NOT add a concern, generalize one into a broader claim, or introduce any new first-person statement about the consumer's own records, recollection, payments, or intentions. If the draft contains no such section, the consumer has confirmed nothing: request the reinvestigation without asserting a single factual concern, and never supply one yourself. Never state or imply that the consumer intends to file a complaint with the CFPB, a state Attorney General, or any regulator unless the grounded draft already says so in those words.",
  ].join("\n");
}

// Picks the case-law principle most relevant to the strategy's recipient so the
// model invokes the correct standard of care for a bureau vs. furnisher vs. collector.
function applicableStandards(ctx: LetterContext): string {
  switch (ctx.strategy.recipient) {
    case "bureau":
      return "Reinvestigation standard (§611 + §607(b)); Cushman and Hinkle on what a *reasonable* reinvestigation requires.";
    case "furnisher":
      return "Furnisher investigation duty (§623 / §1681s-2(b)); Johnson v. MBNA on the good-faith standard.";
    case "collector":
      return "Debt validation (FDCPA §809(b)); accuracy duties under §607(b) and Saunders if the item is materially misleading.";
    default:
      return "FCRA accuracy and reinvestigation standards.";
  }
}

// ---- Phase 1A-R RB-4 / RB-6: shared letter-lifecycle helpers -----------------
// Both fixes below are deliberately DETERMINISTIC and DB-free — no AI, no
// regeneration, no schema change — so they run identically from a Server
// Component (render path) or a route handler (write path), and are
// unit-testable in scripts/letter.test.ts with zero DB/network.

// The exact literal tokens renderTemplateLetter/buildContext emit above when
// sender or recipient data is missing at generation time. Every placeholder-
// aware surface (print, download, Mail Center) keys off these SAME strings —
// one source of truth, never re-derived per caller.
export const SENDER_PLACEHOLDER_TOKENS = ["[YOUR FULL NAME]", "[YOUR ADDRESS]", "[CITY, STATE ZIP]"] as const;
export const FURNISHER_PLACEHOLDER_TOKEN = "[Furnisher mailing address]";

// RENDER-TIME SENDER RESOLUTION (RB-4). The stored Letter.body is frozen at
// generation time — deliberately: the dispute CONTENT (findings, statutes,
// requested action) must never silently change after the fact. But the
// sender block is not dispute content — it is the consumer's own CURRENT
// legal name/address, the same fields Settings already treats as live. When
// the profile was incomplete at generation, the stored body carries literal
// placeholder tokens; once the profile is completed, this substitutes the
// CURRENT profile values into a RENDERED COPY ONLY — plain string
// replacement, no AI, no regeneration, no letter credit, no DB write. The
// stored row (and the `preview` field GET /api/letters returns) is never
// touched. Each token substitutes independently, so a partially-filled
// profile still gets whatever it has replaced rather than all-or-nothing.
export function resolveSenderPlaceholders(body: string, consumer: LetterConsumer): string {
  let out = body;
  if (consumer.fullName?.trim()) out = out.replaceAll("[YOUR FULL NAME]", consumer.fullName.trim());
  if (consumer.addressLine1?.trim()) out = out.replaceAll("[YOUR ADDRESS]", consumer.addressLine1.trim());
  if (consumer.city?.trim() && consumer.state?.trim() && consumer.zip?.trim()) {
    out = out.replaceAll("[CITY, STATE ZIP]", `${consumer.city.trim()}, ${consumer.state.trim()} ${consumer.zip.trim()}`);
  }
  return out;
}

export interface PlaceholderStatus {
  senderIncomplete: boolean; // [YOUR FULL NAME] / [YOUR ADDRESS] / [CITY, STATE ZIP] still present
  recipientIncomplete: boolean; // [Furnisher mailing address] still present — no live source to auto-resolve
  hasPlaceholder: boolean;
}

// PLACEHOLDER GATE (RB-4): what the RENDERED artifact (post render-time
// resolution) still carries. The furnisher/collector recipient address has no
// "current profile" equivalent to pull from at render time — it's only ever
// fixed by adding it on the letter's own recipient field and regenerating
// (RB-6 made that regenerate free and idempotent), so this function only
// DETECTS that placeholder; it never resolves it.
export function detectPlaceholders(renderedBody: string): PlaceholderStatus {
  const senderIncomplete = SENDER_PLACEHOLDER_TOKENS.some((t) => renderedBody.includes(t));
  const recipientIncomplete = renderedBody.includes(FURNISHER_PLACEHOLDER_TOKEN);
  return { senderIncomplete, recipientIncomplete, hasPlaceholder: senderIncomplete || recipientIncomplete };
}

// ---- RB-6: idempotent-regenerate matching (pure) -----------------------------
export interface RegenerateCandidate {
  /** Optional — see the AD-3 note in planLetterRegeneration. */
  status?: string | null;
  id: string;
  targetBureau: Bureau | null;
  mailedAt: Date | string | null;
}
export interface RegeneratePlan {
  toUpdate: { target: Bureau | undefined; existingId: string }[];
  toCreate: (Bureau | undefined)[];
}

// For each requested target (a specific bureau, or undefined for a single-
// recipient furnisher/collector letter), decide whether an UNMAILED existing
// letter for the same tradeline+strategy+round already covers it (→ update in
// place: no new row, no quota consumed) or whether a fresh row is genuinely
// needed (→ create, quota-gated exactly as before). A MAILED letter is NEVER
// matched for update — regenerating against a mailed target falls through to
// create, the existing unchanged behavior; the real "next round" journey is
// the dedicated /api/letters/[id]/round2 endpoint, untouched by this function.
export function planLetterRegeneration(
  targets: (Bureau | undefined)[],
  candidates: RegenerateCandidate[]
): RegeneratePlan {
  const unmailedByBureau = new Map<string, RegenerateCandidate>();
  for (const c of candidates) {
    if (c.mailedAt) continue; // mailed rows are never regenerate-matched
    // RC1-S11 (review AD-3): nor is a letter the consumer has APPROVED. An
    // approved letter is one they read, edited and said was right; overwriting
    // it in place destroys their own words and silently un-approves it. Skipped
    // here means the plan CREATES a new draft beside it instead — never
    // destroys.
    //
    // ⚠️ DORMANT until the caller supplies it. app/api/letters/generate/route.ts
    // selects only { id, targetBureau, mailedAt } for these candidates, so
    // `status` is undefined today and this line is inert. That route belongs to
    // another slice; the routed change is one word in its select. Until then the
    // protection is the two-press confirmation on app/letters/page.tsx.
    if (c.status === LETTER_APPROVED_STATUS) continue;
    const key = c.targetBureau ?? "__none__";
    if (!unmailedByBureau.has(key)) unmailedByBureau.set(key, c); // first match wins, stable
  }
  const toUpdate: RegeneratePlan["toUpdate"] = [];
  const toCreate: RegeneratePlan["toCreate"] = [];
  for (const t of targets) {
    const match = unmailedByBureau.get(t ?? "__none__");
    if (match) toUpdate.push({ target: t, existingId: match.id });
    else toCreate.push(t);
  }
  return { toUpdate, toCreate };
}

export function buildUserPrompt(t: LetterTradeline, ctx: LetterContext, draft: string): string {
  const statutes = ctx.strategy.statutes
    .map((k) => `${STATUTES[k].short} (${STATUTES[k].usc}) — ${STATUTES[k].desc}\n    Operative text: ${STATUTES[k].text}`)
    .join("\n  ");

  return [
    "TASK: Refine the grounded draft below into a polished, persuasive dispute letter. Preserve every factual claim and statute citation exactly as grounded; improve only clarity, structure, tone, and legal framing. KEEP the STATUTORY AUTHORITY section and quote the operative statutory language provided below verbatim (in quotation marks) so the recipient sees the exact obligation — do not paraphrase the quoted text. You may articulate the applicable legal STANDARD in plain language (and optionally cite a governing case from the system prompt) — but add NO new facts about this account.",
    "PRESERVE THE INVESTIGATOR STRUCTURE: each concern in the 'SUMMARY OF FACTUAL CONCERNS' section must keep the FACT → WHY IT MATTERS shape — the fact first, then one sentence on why it prevents verification. Do not collapse these into a bare list and do not convert any 'Why it matters' sentence into an accusation that a violation occurred. Honor the round-based tone for the round indicated below.",
    "",
    `Dispute round: ${ctx.round}`,
    `Strategy: ${ctx.strategy.label}`,
    `Recipient type: ${ctx.strategy.recipient}`,
    `Target recipient: ${ctx.recipientName}`,
    `Applicable legal standards for this strategy:\n  ${applicableStandards(ctx)}`,
    `Statutes in play:\n  ${statutes || "(none — this is a goodwill/non-statutory request; do not cite statutes as leverage)"}`,
    `crossBureauKnowledge: ${ctx.crossBureau}`,
    `Bureaus with data: ${ctx.presentBureaus.join(", ") || "single-bureau / unknown"}`,
    `Verified cross-bureau conflicts: ${ctx.conflicts.length ? ctx.conflicts.join("; ") : "NONE — do not assert any cross-bureau conflict"}`,
    `Account: ${t.creditorName}${t.originalCreditor ? ` (original creditor: ${t.originalCreditor})` : ""}, balance ${formatCents(t.balance)}`,
    // RC1-S4: the model is told EXACTLY which claims the consumer confirmed, so
    // "add no new facts" has a concrete referent instead of being a general
    // exhortation. An empty list is stated explicitly rather than omitted.
    ctx.assertions.length
      ? `Facts the CONSUMER personally confirmed (the ONLY factual claims permitted in this letter): ${ctx.assertions
          .map((a) => a.assertionType)
          .join(", ")}`
      : "Facts the CONSUMER personally confirmed: NONE. Assert no factual concern of any kind; request the reinvestigation only.",
    `Consumer's expressed intent to file a regulatory complaint: ${ctx.complaintIntent ? "YES — the consumer opted in" : "NO — never state or imply such an intent"}`,
    "",
    "----- GROUNDED DRAFT -----",
    draft,
  ].join("\n");
}
