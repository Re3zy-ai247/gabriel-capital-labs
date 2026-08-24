// NO PAID ADVANTAGE — RC1-S6a (P0-6 · Founder D-2 / D-3 / D-4 / D-8 · P1-26 / P1-36).
// Run: npx --no-install tsx scripts/no-paid-advantage.test.ts
//
// THE INVARIANT, EXECUTABLE:
//   No payment status, payer identity, credit balance, plan, subscription or
//   agency relationship changes the assistance a consumer receives.
//
// Pure + source-level. No DB, no AI, no network. Route BEHAVIOUR (the same
// invariant proven by executing the real handlers against a fake database) is
// guarded separately in scripts/runtime/free-entitlement.runtime.test.ts.
//
// WHY BOTH. A source guard can prove a branch does not EXIST — which is the
// stronger claim for a paywall, because a paywall that exists is one config
// change away from firing. The runtime guard proves the observable behaviour is
// identical for five different payer shapes. Neither alone is enough.
//
// SCANNING RULE. Every source scan below runs over `codeOnly()`, which strips
// comments first. These files deliberately NARRATE the paywalls they removed
// ("this is where the 402 lived"), and a guard that could be satisfied by
// deleting a comment — or defeated by writing one — would be worthless.
//
// NON-VACUITY (measured 2026-08-23 against this worktree's branch base
// `0024873`; each pre-change file restored one at a time with `git show` and
// reverted immediately, never committed) — see the table in the slice report.

export {};

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canGenerateLetter,
  isPremium,
  agencyClientLimit,
  FREE_LETTER_LIMIT,
  type Entitlement,
} from "../lib/entitlements";
// Pure pricing maths — no I/O, no provider, safe to execute offline.
import { computePrice, DEFAULT_PRICING_POLICY } from "../lib/mail/MailPricing";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

let failures = 0;
function ok(label: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures++;
    console.error(`✗ ${label}${detail ? `\n    ${detail}` : ""}`);
  } else console.log(`✓ ${label}`);
}

/** Source with comments removed, so no assertion can be satisfied by prose. */
function codeOnly(src: string): string {
  return src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("*/"));
    })
    .map((l) => l.replace(/\s\/\/.*$/, ""))
    .join("\n");
}

const ENT = read("lib/entitlements.ts");
const ENT_CODE = codeOnly(ENT);
const COMMUNITY = read("lib/community.ts");
const COMMUNITY_CODE = codeOnly(COMMUNITY);

// The five consumer-assistance surfaces the invariant is about.
const SURFACES = {
  "app/api/letters/generate/route.ts": read("app/api/letters/generate/route.ts"),
  "app/api/letters/[id]/round2/route.ts": read("app/api/letters/[id]/round2/route.ts"),
  "app/api/identity/letter/route.ts": read("app/api/identity/letter/route.ts"),
  "app/api/strategist/plan/route.ts": read("app/api/strategist/plan/route.ts"),
} as const;

// The community routes this slice owns (the 403 "Members only" paywall family).
const COMMUNITY_ROUTES = {
  "app/api/community/threads/route.ts": read("app/api/community/threads/route.ts"),
  "app/api/community/threads/[id]/route.ts": read("app/api/community/threads/[id]/route.ts"),
  "app/api/community/threads/[id]/replies/route.ts": read("app/api/community/threads/[id]/replies/route.ts"),
  "app/api/community/threads/[id]/ask-kai/route.ts": read("app/api/community/threads/[id]/ask-kai/route.ts"),
  "app/api/community/access/route.ts": read("app/api/community/access/route.ts"),
  // REMEDIATION M-1. These two were the last of the six-route 403 family the
  // evidence names (B report S-07) still answering "Members only", and the
  // reply route stranded an author's own words behind the feature switch.
  "app/api/community/replies/[id]/route.ts": read("app/api/community/replies/[id]/route.ts"),
  "app/api/community/reports/route.ts": read("app/api/community/reports/route.ts"),
} as const;

/**
 * The lines of a route that form a REFUSAL a consumer can read back: the
 * response payloads. Scanning whole files for commercial words would catch
 * unrelated internal text (the reports route composes an ADMIN moderation email
 * that legitimately says "A member flagged…"), which is neither shown to a
 * consumer nor a paywall. The refusal is what the invariant is about.
 */
function refusalPayloads(code: string): string {
  return code
    .split("\n")
    .filter((l) => /NextResponse\.json\(|error:|communityUnavailable/.test(l))
    .join("\n");
}

const CHECKOUT = read("app/api/stripe/checkout/route.ts");
const CHECKOUT_CODE = codeOnly(CHECKOUT);
const STATUS = read("app/api/billing/status/route.ts");
const STATUS_CODE = codeOnly(STATUS);

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE RESOLVER CANNOT SEE WHO IS PAYING (P1-26 · S-09 / S-10)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 1. getEntitlement is structurally blind to payment —");
{
  const sig = ENT_CODE.slice(
    ENT_CODE.indexOf("export async function getEntitlement("),
    ENT_CODE.indexOf("): Promise<Entitlement> {")
  );
  ok("the resolver exists", sig.length > 0);
  for (const field of ["plan", "subscriptionStatus", "isAgency", "managedByAgencyId"]) {
    ok(`the parameter type cannot accept \`${field}\``, !new RegExp(`\\b${field}\\b`).test(sig), sig);
  }
  ok("it accepts only an id and the (frozen) credit balance",
    /\bid: string;/.test(sig) && /letterCredits\?: number \| null;/.test(sig));

  const body = ENT_CODE.slice(
    ENT_CODE.indexOf("export async function getEntitlement("),
    ENT_CODE.indexOf("export function canGenerateLetter")
  );
  ok("the resolver never calls the billing predicate", !/isPremium\(/.test(body));
  // REMEDIATION L-4: pinning only `findUnique` left `findFirst` / `$queryRaw` as
  // ways to re-fetch the payer row by id. Pin the whole User accessor.
  ok("the managed-payer lookup is gone (no agency row is read, by any accessor)",
    !/managedByAgencyId/.test(body) && !/prisma\.user\./.test(body) && !/\$queryRaw(?!Unsafe<Array<\{ meta)/.test(body.replace(/lettersUsedFromLedger/g, "")));
  // REMEDIATION L-3: the old two-branch resolver indented its premium `return {`
  // by four spaces, so an `^\s{2}`-anchored count read 1 and this passed on the
  // pre-change code. Count at ANY indentation.
  ok("there is exactly ONE return — no tier branch to fall into",
    (body.match(/^\s*return \{/gm) ?? []).length === 1,
    `found ${(body.match(/^\s*return \{/gm) ?? []).length}`);
  ok("the single return is premium:false / plan:\"free\" / aiRefinement:false",
    /premium: false,/.test(body) && /plan: "free",/.test(body) && /aiRefinement: false,/.test(body));
  // REMEDIATION L-3: `letterLimit: null` / `lettersRemaining: null` were literally
  // present in the OLD premium branch, so asserting them alone passed on
  // pre-change code. What is new is the ABSENCE of the capped free branch.
  ok("letters are unbounded by plan (letterLimit and lettersRemaining are null)",
    /letterLimit: null,/.test(body) && /lettersRemaining: null,/.test(body));
  ok("…and the capped free branch is gone, for everyone",
    !/letterLimit: FREE_LETTER_LIMIT/.test(body) && !/freeMonthlyRemaining/.test(body));
  ok("no premium tier distinction survives anywhere in the returned shape",
    !/premium: true/.test(body) && !/plan: "premium"/.test(body) && !/aiRefinement: true/.test(body));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FIVE PAYER SHAPES, ONE ANSWER (behavioural, executed)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 2. every payer shape gets the identical capability —");
{
  const base = { lettersUsedThisMonth: 0, letterLimit: null, lettersRemaining: null } as const;
  const SHAPES: Array<[string, Entitlement]> = [
    ["a free consumer", { premium: false, plan: "free", aiRefinement: false, letterCredits: 0, ...base }],
    // Shapes the resolver can no longer produce are still fed in on purpose: the
    // gate must not refuse even if a legacy-shaped object reaches it.
    ["a legacy Professional", { premium: true, plan: "premium", aiRefinement: true, letterCredits: 0, ...base }],
    ["a credit holder", { premium: false, plan: "free", aiRefinement: false, letterCredits: 5, ...base }],
    ["an exhausted legacy meter", { premium: false, plan: "free", aiRefinement: false, letterCredits: 0, lettersUsedThisMonth: 99, letterLimit: 3, lettersRemaining: 0 }],
    ["an agency-managed consumer", { premium: false, plan: "free", aiRefinement: false, letterCredits: 0, ...base }],
  ];
  const answers = SHAPES.map(([, e]) => JSON.stringify(canGenerateLetter(e)));
  for (const [name, e] of SHAPES) {
    ok(`${name} may generate`, canGenerateLetter(e).allowed === true);
  }
  ok("every shape gets the byte-identical answer", new Set(answers).size === 1, answers.join(" | "));
  ok("the gate carries no refusal reason at all",
    SHAPES.every(([, e]) => canGenerateLetter(e).reason === undefined));
  ok("even a zero-remaining legacy shape is allowed (the meter no longer gates)",
    canGenerateLetter(SHAPES[3][1]).allowed === true);
  ok("no upsell string survives in the entitlement module",
    !/Upgrade to Professional/.test(ENT_CODE) && !/buy a letter pack/.test(ENT_CODE));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE BILLING PREDICATE SURVIVES — AND NO CONSUMER SURFACE READS IT
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 3. isPremium is a billing record, not a capability —");
{
  ok("isPremium still answers truthfully about a paid row",
    isPremium({ plan: "premium" }) === true && isPremium({ plan: "free" }) === false);
  ok("…and about an agency row (B2B account type is preserved)",
    isPremium({ isAgency: true }) === true);
  ok("agencyClientLimit still resolves B2B capacity (S-11 untouched)",
    agencyClientLimit({ plan: "agency", isAgency: true, createdAt: new Date("2026-08-01") }) === 15 &&
      agencyClientLimit({ role: "ADMIN" }) === null);
  ok("the historical free-letter constant is preserved for the dormant matrix",
    FREE_LETTER_LIMIT === 3);

  for (const [name, src] of Object.entries(SURFACES)) {
    const code = codeOnly(src);
    ok(`${name}: does not import or call the billing predicate`, !/isPremium/.test(code));
    ok(`${name}: reads no plan / subscription / credit / payer field`,
      !/\.plan\b|subscriptionStatus|letterCredits|managedByAgencyId|\.isAgency\b|entitlement\.premium/.test(code));
  }
  ok("the community gate no longer delegates to the billing predicate",
    !/isPremium/.test(COMMUNITY_CODE));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. HISTORICAL CREDITS ARE FROZEN (D-3 · the letterCredits trap)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 4. purchased credits are preserved, never spent —");
{
  ok("the spend path is frozen by a source constant",
    /const LETTER_CREDITS_FROZEN: boolean = true;/.test(ENT_CODE));
  ok("the freeze is the FIRST thing the spend function does",
    /export async function spendLetterCredits\([\s\S]{0,240}?\{\s*\n\s*if \(LETTER_CREDITS_FROZEN\) return;/.test(ENT_CODE));
  ok("the freeze is not an env flag an ops change could flip",
    !/LETTER_CREDITS_FROZEN\s*=\s*process\.env/.test(ENT_CODE));
  // The reviewed clamp/guard accounting is kept intact for the day fulfilment is
  // ever re-authorised — freezing must not quietly delete it.
  ok("the clamped, non-negative decrement is preserved beneath the freeze",
    /Math\.min\(beyondFree, Math\.max\(0, e\.letterCredits\)\)/.test(ENT_CODE) &&
      /letterCredits: \{ gte: fromCredits \}/.test(ENT_CODE) &&
      /letterCredits: \{ lt: fromCredits \}/.test(ENT_CODE));

  for (const name of ["app/api/letters/generate/route.ts", "app/api/letters/[id]/round2/route.ts"] as const) {
    const code = codeOnly(SURFACES[name]);
    ok(`${name}: does not import spendLetterCredits`, !/spendLetterCredits/.test(code));
    ok(`${name}: contains no credit decrement of its own`, !/letterCredits/.test(code));
  }
  ok("no consumer surface anywhere calls the spend path",
    Object.values(SURFACES).every((s) => !/spendLetterCredits\(/.test(codeOnly(s))));
  ok("the frozen balance is still READ back, so history stays visible",
    /letterCredits = Math\.max\(0, user\.letterCredits \?\? 0\)/.test(ENT_CODE));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE FOUR CONSUMER 402s ARE GONE (S-01 · S-03 · S-05 · S-06)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 5. no consumer can reach a payment-required refusal —");
{
  for (const [name, src] of Object.entries(SURFACES)) {
    const code = codeOnly(src);
    ok(`${name}: emits no 402`, !/402/.test(code));
    ok(`${name}: emits no upgrade nudge`, !/upgrade:/.test(code));
    ok(`${name}: no commercial word survives in a refusal`,
      !/[Uu]pgrade|Professional feature|letter pack|free monthly limit|\$\d/.test(code));
  }
  // The hidden 200-path nudge: a partially-filled request used to return
  // capped/upgrade + "You hit your free monthly limit — upgrade for unlimited
  // letters" on a SUCCESS response, which a 402-only sweep never sees.
  const gen = codeOnly(SURFACES["app/api/letters/generate/route.ts"]);
  ok("the partial-success cap is gone (every confirmed target is written)",
    !/capped/.test(gen) && /const newTargets = toCreate;/.test(gen));
  // The refusals that REMAIN must be truthful and non-commercial.
  ok("the assertion gate still refuses with a 400, and says why",
    /needsAssertion: true/.test(gen) && /status: 400/.test(gen));
  ok("round 2 keeps the same truthful 400, and nothing else",
    /needsAssertion: true/.test(codeOnly(SURFACES["app/api/letters/[id]/round2/route.ts"])));
  ok("the identity letter keeps its per-item confirmation gate",
    /needsConfirmation: true/.test(codeOnly(SURFACES["app/api/identity/letter/route.ts"])));
  // Exactly one 402 may remain in the whole API: the B2B workspace-capacity gate,
  // which is an Agency's own plan capacity, not consumer assistance.
  ok("the only surviving 402 is the Agency workspace-capacity gate (S-11)",
    /status: 402/.test(read("app/api/agency/clients/route.ts")));
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. COMMUNITY IS OFF, NOT PRICED (D-8 · P1-36 · S-07 / S-08)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 6. the community 403 family is a feature switch, not a paywall —");
{
  ok("access is a plain switch, absent = off",
    /process\.env\.COMMUNITY_ENABLED === "true"/.test(COMMUNITY_CODE));
  ok("the switch is consulted by the gate", /return communityEnabled\(\);/.test(COMMUNITY_CODE));
  // The one exception is a ROLE, not a tier: an ADMIN keeps access so reported
  // content stays moderatable while the feature is off. Paying can never make an
  // account an ADMIN, so this cannot become a purchasable advantage.
  ok("the only exception is staff moderation (role, never plan)",
    /if \(account\.role === "ADMIN"\) return true;/.test(COMMUNITY_CODE) &&
      !/plan|subscri|premium|isAgency/i.test(
        COMMUNITY_CODE.slice(COMMUNITY_CODE.indexOf("export function canAccessCommunity"),
          COMMUNITY_CODE.indexOf("const COMMUNITY_DDL"))
      ));
  ok("the gate reads no plan, subscription or agency field",
    !/subscriptionStatus|isAgency|\bplan\b/.test(
      COMMUNITY_CODE.slice(COMMUNITY_CODE.indexOf("export function canAccessCommunity"),
        COMMUNITY_CODE.indexOf("export async function ensureCommunityTables"))
    ));
  ok("one refusal string, and it is about availability only",
    /export const COMMUNITY_UNAVAILABLE = "Community is not available right now\.";/.test(COMMUNITY_CODE));
  for (const [name, src] of Object.entries(COMMUNITY_ROUTES)) {
    const code = codeOnly(src);
    ok(`${name}: the "Members only" paywall string is gone`, !/Members only/.test(code));
    ok(`${name}: no refusal it can return says anything about membership, plans or payment`,
      !/member|paid|plan|subscri|upgrade|pricing/i.test(
        refusalPayloads(code).replace(/requireCommunityA\w+/g, "")
      ),
      refusalPayloads(code));
  }
  ok("Kai-in-community refuses through the same truthful string",
    /COMMUNITY_UNAVAILABLE/.test(codeOnly(COMMUNITY_ROUTES["app/api/community/threads/[id]/ask-kai/route.ts"])));
  ok("the access probe reports the honest feature state for the UI",
    /available/.test(COMMUNITY_ROUTES["app/api/community/access/route.ts"]) &&
      /unavailableReason/.test(COMMUNITY_ROUTES["app/api/community/access/route.ts"]));
  // Nothing is destroyed by switching the feature off.
  ok("no route or table is deleted — the DDL and the models are still here",
    /CREATE TABLE IF NOT EXISTS "CommunityThread"/.test(COMMUNITY) &&
      /deleteThreadAndAttachments/.test(COMMUNITY));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. AN AUTHOR CAN ALWAYS WITHDRAW THEIR OWN WORDS (D-8 carve-out)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 7. author data-control outranks the feature switch —");
{
  const thread = codeOnly(COMMUNITY_ROUTES["app/api/community/threads/[id]/route.ts"]);
  const del = thread.slice(thread.indexOf("export async function DELETE"));
  ok("delete resolves the author WITHOUT an availability check",
    /const account = await requireCommunityAuthor\(\);/.test(del));
  ok("…and the availability-gated helper is not used on the delete path",
    !/requireCommunityAccount\(\)/.test(del));
  const authorAt = del.indexOf("thread.authorId === account.id");
  const availabilityAt = del.indexOf("canAccessCommunity(");
  ok("the AUTHOR check comes before any availability check",
    authorAt > -1 && availabilityAt > -1 && authorAt < availabilityAt,
    `author=${authorAt} availability=${availabilityAt}`);
  ok("a non-author is refused for ownership, or for availability — never for payment",
    /You can only delete your own discussions\./.test(del) && /COMMUNITY_UNAVAILABLE/.test(del));
  ok("the helper grants identity only, never a read or a write",
    /export async function requireCommunityAuthor/.test(COMMUNITY_CODE) &&
      !/canAccessCommunity/.test(
        COMMUNITY_CODE.slice(COMMUNITY_CODE.indexOf("export async function requireCommunityAuthor"))
      ));
  // REMEDIATION M-1. Deleting a THREAD cascades its own replies, so it never
  // covered the case that matters most: a reply left inside SOMEONE ELSE'S
  // thread. Same law, same order, same helper.
  const replies = codeOnly(COMMUNITY_ROUTES["app/api/community/replies/[id]/route.ts"]);
  const replyDel = replies.slice(replies.indexOf("export async function DELETE"));
  ok("reply delete resolves the author WITHOUT an availability check",
    /const account = await requireCommunityAuthor\(\);/.test(replyDel));
  ok("…and the availability-gated helper is not used on the reply delete path",
    !/requireCommunityAccount\(\)/.test(replyDel));
  const replyAuthorAt = replyDel.indexOf("reply.authorId === account.id");
  const replyAvailabilityAt = replyDel.indexOf("canAccessCommunity(");
  ok("the AUTHOR check comes before any availability check, on replies too",
    replyAuthorAt > -1 && replyAvailabilityAt > -1 && replyAuthorAt < replyAvailabilityAt,
    `author=${replyAuthorAt} availability=${replyAvailabilityAt}`);
  ok("a non-author is refused for ownership, or for availability — never for payment",
    /You can only delete your own replies\./.test(replyDel) && /COMMUNITY_UNAVAILABLE/.test(replyDel));
  ok("Kai's replies are still not the consumer's to delete",
    /!reply\.isKai && reply\.authorId === account\.id/.test(replyDel));
  ok("the reply is really removed, attachments and count included",
    /deleteReplyAndAttachments\(reply\.id, reply\.threadId\)/.test(replyDel));

  ok("reads and new content stay gated (the switch still means something)",
    /requireCommunityAccount\(\)/.test(codeOnly(COMMUNITY_ROUTES["app/api/community/threads/route.ts"])) &&
      /requireCommunityAccount\(\)/.test(codeOnly(COMMUNITY_ROUTES["app/api/community/threads/[id]/replies/route.ts"])));
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. NOTHING IS FOR SALE TO A CONSUMER (D-3 · D-4 · S-13 / S-14)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 8. checkout refuses before it reaches Stripe —");
{
  ok("PURCHASABLE_PLANS is empty", /const PURCHASABLE_PLANS = \[\] as const;/.test(CHECKOUT_CODE));
  ok("no plan name is sellable", !/PURCHASABLE_PLANS = \[[^\]]*["']/.test(CHECKOUT_CODE));
  const refuseAt = CHECKOUT_CODE.indexOf("const refusal = refuseSale(body);");
  const stripeAt = CHECKOUT_CODE.indexOf("getStripe()");
  const customerAt = CHECKOUT_CODE.indexOf("getOrCreateStripeCustomer(");
  const sessionAt = CHECKOUT_CODE.indexOf("stripe.checkout.sessions.create");
  ok("the refusal runs BEFORE the Stripe client is constructed",
    refuseAt > -1 && stripeAt > -1 && refuseAt < stripeAt, `refuse=${refuseAt} getStripe=${stripeAt}`);
  ok("…before any Stripe customer is created or looked up",
    refuseAt > -1 && customerAt > -1 && refuseAt < customerAt);
  ok("…and before any Checkout Session", refuseAt > -1 && sessionAt > -1 && refuseAt < sessionAt);
  ok("the refusal is 410 Gone (the product existed and no longer does)",
    /status: 410/.test(CHECKOUT_CODE));
  for (const product of ["letters_5", "premium", "agency"]) {
    ok(`${product} is named in the closed-sales map`,
      new RegExp(`^\\s{2}${product}:`, "m").test(CHECKOUT_CODE));
  }
  ok("an unnamed product is refused too, never coerced into a sale",
    /SALES_CLOSED\[key\] \?\? SALES_CLOSED_DEFAULT/.test(CHECKOUT_CODE));
  // REMEDIATION L-1: a plain object literal inherits `constructor`/`__proto__`/
  // `toString`, so those product strings resolved to a truthy non-string, the
  // `?? DEFAULT` never fired, and the 410 body carried an unusable `error`.
  ok("the closed-sales map has no prototype, so inherited keys cannot be looked up",
    /const SALES_CLOSED: Record<string, string> = Object\.assign\(Object\.create\(null\), \{/.test(CHECKOUT_CODE));
  // REMEDIATION L-2, and the condition on keeping the dormant sell machinery:
  // the nullable return type is what keeps that machinery type-reachable, which
  // means a CONDITIONAL refusal would compile silently. Pin totality: one
  // unconditional return, no branch of any kind.
  const refuseBody = CHECKOUT_CODE.slice(
    CHECKOUT_CODE.indexOf("function refuseSale("),
    CHECKOUT_CODE.indexOf("export async function POST(")
  );
  ok("refuseSale is TOTAL — exactly one return", (refuseBody.match(/\breturn\b/g) ?? []).length === 1,
    refuseBody);
  ok("…reached unconditionally — no branch can let a request past it",
    !/\bif\s*\(/.test(refuseBody) && !/\?\s*NextResponse/.test(refuseBody) && !/\bswitch\s*\(/.test(refuseBody));
  ok("…and the call site returns on anything it produces",
    /const refusal = refuseSale\(body\);\n\s*if \(refusal\) return refusal;/.test(CHECKOUT_CODE));
  const copy = CHECKOUT.slice(CHECKOUT.indexOf("const SALES_CLOSED"), CHECKOUT.indexOf("const SALES_CLOSED_DEFAULT"));
  ok("the refusal copy quotes no price and offers nothing to buy",
    !/\$\d|\d+\/mo|pricing page|upgrade/i.test(copy), copy);
  ok("existing Agency accounts are told they are unaffected (D-4 is a pause)",
    /Existing Agency accounts are unaffected/.test(copy));
  // Fulfilment and servicing for people who already paid are NOT this slice's to
  // touch, and must still exist.
  ok("the webhook still fulfils legacy purchases",
    /creditLetters|LETTER_PACK_CREDITS/.test(read("app/api/stripe/webhook/route.ts")));
  ok("the billing portal is still reachable",
    /billingPortal\.sessions\.create/.test(read("app/api/stripe/portal/route.ts")));
  ok("a suspended payer can still cancel",
    /cancel_at_period_end/.test(read("app/api/billing/self-cancel/route.ts")));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. BILLING STATUS TELLS THE TRUTH ABOUT HISTORY (S-18)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 9. billing status reports history as history —");
{
  ok("a frozen credit balance is labelled frozen", /letterCreditsFrozen: true/.test(STATUS_CODE));
  ok("a retired consumer plan is labelled historical", /planIsHistorical:/.test(STATUS_CODE));
  ok("the route states that consumer sales are closed", /consumerSalesClosed: true/.test(STATUS_CODE));
  ok("no upgrade framing anywhere in the payload", !/upgrade/i.test(STATUS_CODE));
  ok("the plan of record is read from the row, not from the entitlement",
    /user\.plan === "premium" \? "premium"/.test(STATUS_CODE) && !/entitlement\.premium/.test(STATUS_CODE));
  ok("the Agency capacity input is preserved (B2B display must not regress)",
    /user\.plan === "agency_pro"/.test(STATUS_CODE) && /isAgency: Boolean\(user\.isAgency\)/.test(STATUS_CODE));
  ok("the uniform entitlement is still returned for the UI to render",
    /\bentitlement,/.test(STATUS_CODE));
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. THE SIGNED-LETTER BAR AT BOTH COMPOSE SITES (S5 handoff L-11)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 10. anything printed and signed answers to the letter bar —");
{
  const gen = codeOnly(SURFACES["app/api/letters/generate/route.ts"]);
  const identity = codeOnly(SURFACES["app/api/identity/letter/route.ts"]);
  ok("the shared composer applies the signed-letter bar",
    /applyCompliance\(body, \{ bar: "signed-letter" \}\)/.test(gen));
  ok("the identity correction letter applies the signed-letter bar",
    /applyCompliance\(draft, \{ bar: "signed-letter" \}\)/.test(identity));
  ok("no letter body is left on the base bar",
    !/applyCompliance\((body|draft)\)/.test(gen + identity));
  ok("round 2 already held the bar and still does",
    /applyCompliance\(body, \{ bar: "signed-letter" \}\)/.test(codeOnly(SURFACES["app/api/letters/[id]/round2/route.ts"])));
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. AI REFINEMENT STAYS OFF FOR EVERYONE (D-2)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 11. no plan can turn AI refinement on —");
{
  ok("the resolver hardcodes aiRefinement false, with no branch",
    (ENT_CODE.match(/aiRefinement: false/g) ?? []).length === 1 && !/aiRefinement: true/.test(ENT_CODE));
  ok("the flag survives as a dormant switch the letter routes still read",
    /entitlement\.aiRefinement/.test(codeOnly(SURFACES["app/api/letters/generate/route.ts"])) &&
      /entitlement\.aiRefinement/.test(codeOnly(SURFACES["app/api/letters/[id]/round2/route.ts"])));
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. IDENTICAL PIECE, IDENTICAL QUOTE (review M-3 · S11 C-1 · B report S-26)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 12. the mail quote is the same price for everyone —");
{
  // Behavioural, executed: computePrice is pure. This was the LAST surface where
  // a consumer could SEE that paying bought a better deal — a legacy
  // Professional's quote came out 10% lower and their breakdown carried a
  // literal "Premium discount" line item on the send page.
  const estimate = { providerCostCents: 100, currency: "USD" as const, breakdown: [] };
  const quote = (plan: "free" | "premium" | "agency_pro", isAgency = false) =>
    computePrice({ estimate, plan, isAgency });

  const free = quote("free");
  const legacyPro = quote("premium");
  const legacyProPlus = quote("agency_pro");
  ok("a legacy Professional is quoted exactly what a free consumer is quoted",
    legacyPro.totalCents === free.totalCents,
    `free=${free.totalCents} premium=${legacyPro.totalCents}`);
  ok("…and so is a legacy Agency Pro consumer",
    legacyProPlus.totalCents === free.totalCents);
  ok("no plan produces a discount at all",
    free.discountCents === 0 && legacyPro.discountCents === 0 && legacyProPlus.discountCents === 0);
  ok("the whole breakdown is byte-identical, not just the total",
    JSON.stringify(legacyPro.lines) === JSON.stringify(free.lines),
    JSON.stringify(legacyPro.lines));
  ok("no discount line item can render on the send page",
    !legacyPro.lines.some((l) => /discount/i.test(l.label)));
  ok("the platform policy carries no plan rates",
    Object.keys(DEFAULT_PRICING_POLICY.planDiscountRate).length === 0);
  // The ENGINE is intact — a white-label reseller policy may still express one.
  ok("the pricing engine still honours an explicitly supplied policy",
    computePrice({
      estimate, plan: "premium", isAgency: false,
      policy: { ...DEFAULT_PRICING_POLICY, planDiscountRate: { premium: 0.5 } },
    }).discountCents > 0);
  // ── S11 · C-1 · THE FIVE PERSONAS, ON THE IDENTICAL PIECE ─────────────────
  //
  // §12 previously exempted the agency markup here ("a B2B cost input,
  // deliberately untouched") while its own headline claimed the quote was the
  // same for everyone. It was not: `agencyMarkupRate: 0.05` against
  // `markupRate: 0.15` quoted an account flagged isAgency 1149c where a free
  // consumer was quoted 1249c for the identical piece. There is no
  // agency-facing mail surface — /api/mail/prepare is the CONSUMER self-serve
  // flow, and an Agency owner mailing their own dispute letter is a consumer of
  // it. The exemption was the finding, so it is gone.
  const PIECE = { providerCostCents: 1000, currency: "USD" as const, breakdown: [] };
  const PERSONAS: Array<[string, "free" | "premium" | "agency" | "agency_pro", boolean]> = [
    ["a free consumer", "free", false],
    ["a legacy Professional", "premium", false],
    ["a letterCredits holder", "free", false],
    ["an Agency-managed consumer", "free", false],
    ["an Agency payer", "agency", true],
    ["a legacy Agency Pro payer", "agency_pro", true],
  ];
  const quotes = PERSONAS.map(([label, plan, isAgency]) =>
    [label, computePrice({ estimate: PIECE, plan, isAgency })] as const);
  for (const [label, q] of quotes) {
    ok(`${label} is quoted the same as everyone else for the identical piece`,
      q.totalCents === quotes[0][1].totalCents,
      `${label}=${q.totalCents} free=${quotes[0][1].totalCents}`);
  }
  ok("every persona's whole breakdown is byte-identical, not just the total",
    new Set(quotes.map(([, q]) => JSON.stringify(q.lines))).size === 1);
  ok("no persona gets a different markup",
    new Set(quotes.map(([, q]) => q.markupCents)).size === 1);
  // The fix must not have been made by raising the CONSUMER to meet the agency:
  // parity is at the consumer's pre-existing rate, so no consumer's quote moved.
  ok("parity was reached WITHOUT making any consumer's quote higher",
    quotes[0][1].totalCents === 1249 && quotes[0][1].markupCents === 150);
  // Structural: the platform policy must not configure a reseller markup at all.
  // `!= null` is the branch condition in computePrice, so ABSENT (not 0) is what
  // makes the branch unreachable.
  ok("the platform policy configures no reseller markup",
    DEFAULT_PRICING_POLICY.agencyMarkupRate == null);
  // …and the consumer quote path must not feed the engine an account at all.
  {
    const prepare = codeOnly(read("app/api/mail/prepare/route.ts"));
    ok("the consumer quote path reads no account type or plan",
      /const isAgency = false;/.test(prepare) &&
      !/user\.isAgency/.test(prepare) &&
      !/user\.plan/.test(prepare));
  }
  // The ENGINE is intact — a white-label channel supplying its own policy can
  // still express a reseller markup; the platform simply does not.
  ok("the pricing engine still honours a reseller markup when a policy supplies one",
    computePrice({
      estimate: PIECE, plan: "free", isAgency: true,
      policy: { ...DEFAULT_PRICING_POLICY, agencyMarkupRate: 0.05 },
    }).markupCents === 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12b. MAIL SPEND IS DERIVED, NOT ASSERTED (S11 C-5)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 12b. /mail does not claim a spend it cannot know —");
{
  const mailPage = read("app/mail/page.tsx");
  ok("the hardcoded $0.00 spend tile is gone", !/label="Mail spend" value="\$0\.00"/.test(mailPage));
  ok("the figure is derived from the manifest ledger",
    /const mailSpendCents = manifests\.reduce\(/.test(mailPage) && /formatCents\(mailSpendCents\)/.test(mailPage));
  // A manifest reaches PAID even with MAIL_LIVE off (confirm records
  // "authorized:no-charge"), so a naive sum over PAID would report money nobody
  // was asked for. The derivation must exclude the no-charge marker.
  ok("a no-charge authorization is excluded from spend",
    /no-charge/i.test(mailPage) && /toStatus === "PAID"/.test(mailPage));
  ok("when nothing was charged it says so plainly instead of quoting a total",
    /Nothing has been charged/.test(mailPage) && /mailSpendCents > 0 \? formatCents/.test(mailPage));
  ok("the explanation reaches assistive technology, not only a hover title",
    /aria-label=\{hint \?/.test(mailPage));
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. NO ROUTE PAYLOAD POINTS A CONSUMER AT A DEAD PURCHASE (review M-2)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n— 13. the portal serves history, it does not pitch —");
{
  const portal = codeOnly(read("app/api/stripe/portal/route.ts"));
  ok("the portal no longer tells a consumer to press the Upgrade button",
    !/Upgrade button/.test(portal));
  ok("…and says something true instead",
    /No subscription is associated with this account\./.test(portal));
  ok("no route payload in app/api pitches an upgrade except the B2B capacity gate",
    !/upgrade/i.test(portal) && !/upgrade/i.test(CHECKOUT_CODE.replace(/UPGRADE_PRORATION_BEHAVIOR|upgraded/g, "")));
  // The portal itself must still work — legacy payers need invoices and cancel.
  ok("the portal still opens a Stripe-hosted session for a real customer",
    /billingPortal\.sessions\.create/.test(portal));
}

console.log(
  failures === 0
    ? "\nAll no-paid-advantage guards passed."
    : `\n${failures} no-paid-advantage guard(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
