// CONSUMER COPY SWEEP — RC1-S6b (B §S-28…S-38 + G's seven additions · A1-16 ·
// S-32 · Founder D-2 / D-3 / D-4 / D-8 / D-9).
// Run: npx --no-install tsx scripts/consumer-copy-sweep.test.ts
//
// THE INVARIANT, EXECUTABLE:
//   No consumer-facing surface quotes a consumer price, names a retired
//   consumer tier as something to get, offers a purchase, meters a letter
//   quota, promises a subscription cancellation, or gates a feature on
//   membership — AND each swept surface positively states the truthful thing
//   that replaced it.
//
// TWO HALVES, BOTH REQUIRED. An absence scan alone passes on a blank file, so
// every removal below is paired with a presence check on the same surface. A
// presence check alone passes with the old pitch still sitting beside the new
// sentence, so every presence check is paired with an absence scan.
//
// SCANNING RULE. Absence scans run over `codeOnly()`, which strips comments
// first. These files deliberately NARRATE the copy they removed ("this used to
// say $99/mo"), and a guard that could be defeated by writing a comment — or
// satisfied by deleting one — would be worthless. Presence checks run over the
// raw source: the sentences they look for are rendered strings, and a comment
// cannot accidentally satisfy a full sentence of shipped copy.
//
// SCOPE. Consumer surfaces only. `app/agency/*`, `app/admin/*`, `app/academy`,
// `app/brief` and the API layer are out of scope by design: the agency product
// is a real, separately-identifiable business surface and its pricing copy is
// not this slice's to erase (Founder: "legitimate future-Business surfaces stay
// separately identifiable").
//
// NON-VACUITY. Every absence scan below was measured against this worktree's
// branch base `a6ea947` — each pre-change file restored one at a time with
// `git show`, the guard run, the file reverted immediately, never committed.
// The failure table is in the slice report.

export {};

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

let failures = 0;
function ok(label: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures++;
    console.error(`✗ ${label}${detail ? `\n    ${detail}` : ""}`);
  } else console.log(`✓ ${label}`);
}

/**
 * Source with comments removed, so no absence scan can be defeated by prose.
 *
 * Block comments are stripped FIRST and as spans, not line by line. These files
 * are JSX: the narration of removed copy lives in `{/* … *\/}` blocks whose
 * lines begin with `{` or with ordinary prose, so a line-prefix filter alone
 * leaves most of it standing — which is how a guard ends up reporting its own
 * documentation as a live paywall.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .map((l) => l.replace(/\s\/\/.*$/, ""))
    .join("\n");
}

/** Whitespace-normalised source, for presence checks on copy that line-wraps. */
const flat = (s: string) => s.replace(/\s+/g, " ");

// ── The swept consumer surfaces ─────────────────────────────────────────────
const SURFACES = [
  "app/page.tsx",
  "app/pricing/page.tsx",
  "app/pricing/PricingTiers.tsx",
  "app/help/page.tsx",
  "app/onboarding/page.tsx",
  "app/letters/page.tsx",
  "app/billing/page.tsx",
  "app/identity/page.tsx",
  "app/strategist/AiPlan.tsx",
  "app/community/page.tsx",
  "app/legal/terms/page.tsx",
  "app/legal/privacy/page.tsx",
  "app/sitemap.ts",
  "components/marketing/Showcase.tsx",
  "components/marketing/SiteNav.tsx",
  "components/Sidebar.tsx",
] as const;

const src = new Map(SURFACES.map((p) => [p, read(p)] as const));
const code = new Map(SURFACES.map((p) => [p, codeOnly(read(p))] as const));
const get = (p: (typeof SURFACES)[number]) => src.get(p)!;
const bare = (p: (typeof SURFACES)[number]) => code.get(p)!;

// ── 1 · TREE-WIDE ABSENCE SCANS ─────────────────────────────────────────────
// Each rule names WHAT it forbids and lists the exceptions it tolerates, with
// the reason. An unexplained allowlist entry is how a paywall comes back.

interface Rule {
  label: string;
  re: RegExp;
  /** Surfaces where a match is legitimate, each with the reason it is legitimate. */
  allow?: Partial<Record<(typeof SURFACES)[number], RegExp>>;
}

const RULES: Rule[] = [
  {
    // Every consumer price point that appeared on a consumer surface, plus the
    // shape of any future one. Dollar-and-digits is the whole rule: there is no
    // amount a consumer surface has a reason to quote.
    label: "no consumer price point ($19 / $99 / $149 / $399 / $699 / $1,299 or any other)",
    re: /\$\s?\d[\d,]*(\.\d{2})?/,
    allow: {
      // Illustrative BUREAU BALANCES inside the cross-bureau demo table — the
      // amounts a consumer's own report shows, not an amount CreditVector
      // charges. Pinned to the exact demo row so a real price cannot hide here.
      "components/marketing/Showcase.tsx": /\{ label: "Balance", values: \["\$2,410", "\$2,410", "\$3,180"\], flag: true \},/,
    },
  },
  {
    label: 'no purchase or upgrade control ("Upgrade to", "Buy N letters", "Get Professional", letters_5)',
    re: /Upgrade to |Buy \d+ letters|Get Professional|Get Agency|letters_5|Explore Agency plans|View Pricing/i,
  },
  {
    label: "no consumer checkout call (/api/stripe/checkout POST from a consumer surface)",
    re: /\/api\/stripe\/checkout/,
  },
  {
    // The retired consumer tiers, as OFFERS. `app/billing/page.tsx` keeps the
    // word for the one legitimate reason — labelling the plan a consumer
    // PREVIOUSLY paid for — and the historical-truth presence checks in §3
    // pin that it is rendered as history and never as a live tier.
    label: "no retired consumer tier presented as something to get (Explorer / Professional / Professional+)",
    re: /\bProfessional\+?\b|\bExplorer\b/,
    allow: {
      // Historical plan label only. §3 pins the "Past plan" badge beside it.
      "app/billing/page.tsx": /^\s*const historicalPlanLabel = 'Professional';$/m,
    },
  },
  {
    label: 'no subscription-cancellation promise ("Cancel anytime", "No contracts", "no lock-in")',
    re: /Cancel anytime|No contracts|no lock-in/i,
  },
  {
    label: 'no letter quota or monthly allowance ("3 letters a month", "N free letters left", "resets on the 1st")',
    re: /\d+\s+(free\s+)?(dispute\s+)?letters?\s*(\/|per|a)\s*month|letters left this month|resets on the 1st|3 letters\/month/i,
  },
  {
    label: 'no tier-gated support promise ("priority support", "priority email support")',
    re: /priority (email )?support/i,
  },
  {
    // Membership framing — a feature that is switched off must not be described
    // as something membership buys.
    label: 'no member-only framing ("is for members", "paid membership", "every paid plan", "members get")',
    re: /is for members|paid (CreditVector )?membership|every paid plan|members get|Members only/i,
  },
  {
    label: 'no permanence promise ("free forever", "forever free", "always free")',
    re: /free forever|forever free|always free/i,
  },
];

for (const rule of RULES) {
  for (const p of SURFACES) {
    const body = bare(p);
    const hit = rule.re.exec(body);
    if (!hit) continue;
    const exempt = rule.allow?.[p];
    // An allowlist entry excuses ONLY the exact line it describes: strip the
    // permitted shape and re-scan, so a second, unexcused match still fails.
    const residue = exempt ? body.replace(exempt, "") : body;
    const still = rule.re.exec(residue);
    ok(
      `${p} — ${rule.label}`,
      !still,
      still ? `matched ${JSON.stringify(still[0])} at offset ${still.index}` : undefined,
    );
  }
}
// Report the clean surfaces too, so a suite that scanned nothing is visible.
ok(`all ${SURFACES.length} consumer surfaces scanned against ${RULES.length} absence rules`, SURFACES.length === 16 && RULES.length === 9);

// ── 2 · PER-PAGE PRESENCE: the truthful statement that replaced the pitch ────

ok(
  "/pricing states the product is free to use today, without promising it forever",
  /free to use today/.test(get("app/pricing/PricingTiers.tsx")) &&
    /free to use today/.test(get("app/pricing/page.tsx")),
);
ok(
  "/pricing says there is nothing to choose and nothing to buy",
  /no plan to choose/i.test(get("app/pricing/PricingTiers.tsx")) &&
    /nothing to buy/i.test(get("app/pricing/PricingTiers.tsx")),
);
ok(
  "/pricing names the agency/business direction as a SEPARATE product with signups paused, and never names it as an offering",
  /separate product for agencies and businesses/.test(get("app/pricing/PricingTiers.tsx")) &&
    /signups for it are paused/.test(get("app/pricing/PricingTiers.tsx")) &&
    !/CreditVector Business/.test(get("app/pricing/PricingTiers.tsx")),
);
ok(
  "/pricing keeps the CROA compliance line (software + education, no guaranteed outcome)",
  /not a credit-repair organization/.test(flat(get("app/pricing/PricingTiers.tsx"))) &&
    /no deletion, correction, or score improvement is guaranteed/.test(flat(get("app/pricing/PricingTiers.tsx"))),
);
ok(
  "the landing page answers the cost question with 'Nothing' and no tier list",
  /"What does it cost\?", "Nothing\./.test(get("app/page.tsx")) && !/const PRICING = \[/.test(bare("app/page.tsx")),
);
ok(
  "the landing hero says free to use today rather than quoting a letter quota",
  /Free to use today/.test(get("app/page.tsx")),
);
ok(
  "the help page states support is one queue with no faster lane to buy",
  /no\s*\n?\s*faster lane to buy/.test(get("app/help/page.tsx")) && /same queue/.test(get("app/help/page.tsx")),
);
ok(
  "onboarding tells the consumer they already have everything instead of selling an upgrade",
  /already have the full engine/i.test(get("app/onboarding/page.tsx")) &&
    /held back behind a paid tier/.test(get("app/onboarding/page.tsx")),
);
const communityFlat = flat(get("app/community/page.tsx"));
ok(
  "the community gate says the network is closed for everyone and is not a purchase decision",
  /closed right now/.test(communityFlat) &&
    /switched off for everyone/.test(communityFlat) &&
    /nothing to buy that would open it/.test(communityFlat),
);
ok(
  "the community gate reassures the author that their own posts stay under their control (S6a's author carve-out, stated to the human)",
  /delete anything you wrote/.test(get("app/community/page.tsx")),
);
ok(
  "the shared TrustBar badge states a fact about today, not a cancellation policy",
  /Free to use today/.test(get("components/marketing/Showcase.tsx")),
);
ok(
  "the marketing nav labels /pricing by what it answers, and keeps the route",
  /label: "What it costs"/.test(get("components/marketing/SiteNav.tsx")) &&
    /href: "\/pricing"/.test(get("components/marketing/SiteNav.tsx")),
);
ok(
  "/pricing stays in the sitemap but is demoted from a 0.9 conversion page",
  /"\/pricing", priority: 0\.5/.test(get("app/sitemap.ts")) && !/"\/pricing", priority: 0\.9/.test(get("app/sitemap.ts")),
);

// ── 3 · HISTORICAL TRUTH: preserved, labelled, never spendable ──────────────
// D-3. The record must survive AND must never read as a live benefit.

const billing = get("app/billing/page.tsx");
ok(
  "billing renders the past plan as history (planIsHistorical) and badges it 'Past plan'",
  /planIsHistorical/.test(billing) && /Past plan/.test(billing),
);
ok(
  "billing says in words that the past plan grants nothing and takes nothing away",
  /grants nothing/.test(flat(billing)) && /takes nothing away/.test(flat(billing)),
);
ok(
  "billing states letter credits from a past purchase are PRESERVED",
  /Letter credits from a past purchase are preserved on your account/.test(billing),
);
const billingFlat = flat(billing);
ok(
  "billing states those credits are not spent and nothing decrements them",
  /not spent when you generate a letter/.test(billingFlat) && /nothing decrements them/.test(billingFlat),
);
ok(
  "billing keeps the Stripe portal and self-cancellation reachable for a historical payer",
  /openBillingPortal/.test(billing) && /Open Billing Portal/.test(billing) && /cancellation live/.test(billing),
);
ok(
  "billing no longer claims a monthly allowance or a reset date",
  !/allotment/.test(bare("app/billing/page.tsx")) && !/resets on the 1st/.test(bare("app/billing/page.tsx")),
);
ok(
  "billing hardcodes no workspace-capacity integer (still resolved by lib/agencyCapacity)",
  /resolveAgencyCapacity/.test(billing) &&
    (bare("app/billing/page.tsx").match(/\b\d+\s*(active\s+)?(client\s+)?(workspaces|clients)\b/gi) ?? []).length === 0,
);
ok(
  "the Terms restate letter-pack credits as frozen rather than 'do not expire and carry over month to month'",
  /credits you hold are frozen/.test(get("app/legal/terms/page.tsx")) &&
    !/carry over month to month/.test(bare("app/legal/terms/page.tsx")),
);
ok(
  "the Terms state plainly that consumers are not charged, and preserve the historical record",
  /does not charge consumers/.test(get("app/legal/terms/page.tsx")) &&
    /that record is preserved on your account/.test(get("app/legal/terms/page.tsx")),
);
ok(
  "the Privacy policy no longer tells every reader to 'Cancel your subscription whenever you like'",
  !/Cancel your subscription whenever you like/.test(bare("app/legal/privacy/page.tsx")),
);
ok(
  "the Privacy policy states the consumer product has no subscription, while keeping the portal path for anyone who has one",
  /the consumer product does not have one/.test(get("app/legal/privacy/page.tsx")) &&
    /Stripe billing portal/.test(get("app/legal/privacy/page.tsx")),
);

// ── 4 · A1-16 · the Agency entry is gated, not a consumer upsell ────────────

const sidebar = get("components/Sidebar.tsx");
ok(
  "the Agency link is out of the unconditional ACCOUNT_NAV",
  !/ACCOUNT_NAV = \[\s*\n\s*\{ href: "\/agency"/.test(sidebar),
);
ok(
  "the Agency link renders only for an account that actually has an agency workspace",
  /const AGENCY_LINK = \{ href: "\/agency"/.test(sidebar) &&
    /isAgency \? \[AGENCY_LINK\] : \[\]/.test(sidebar),
);
ok(
  "the agency probe fails CLOSED — an unknown or failed probe hides the business surface",
  /useState<boolean>\(agencyCached \?\? false\)/.test(sidebar) && /if \(!cancelled && d !== null\) setIsAgency\(d\)/.test(sidebar),
);
ok(
  "both shells (Sidebar and MobileNav) use the same gate — one cannot leak while the other hides",
  (sidebar.match(/accountNavFor\(ctx\?\.isAdmin, isAgencyAccount\)/g) ?? []).length === 2,
);

// ── 5 · S4's identity confirmation, closed ─────────────────────────────────
// The route refuses to draft unless the consumer confirmed EACH item. Until
// this control existed, the refusal was the only reachable outcome.

const identity = get("app/identity/page.tsx");
ok(
  "each detected discrepancy renders an unchecked per-item confirmation control",
  /type="checkbox"/.test(identity) && /checked=\{Boolean\(confirmed\[i\]\)\}/.test(identity),
);
const identityFlat = flat(identity);
ok(
  "the confirmation is worded as the consumer's own statement of fact",
  /I confirm my correct \{d\.category\.toLowerCase\(\)\} is/.test(identity) &&
    /and that what the report shows is wrong/.test(identityFlat),
);
ok(
  "the POST sends confirmed: true on exactly the ticked items",
  /confirmed\[i\] \? \{ \.\.\.d, confirmed: true \} : d/.test(identity),
);
ok(
  "the submit control is disabled until at least one item on the selected bureau is confirmed",
  /disabled=\{letterBusy \|\| forBureauCount === 0\}/.test(identity) &&
    /\(!d\.bureaus\?\.length \|\| d\.bureaus\.includes\(bureau\)\) && confirmed\[i\]/.test(identity),
);
ok(
  "the route's 400 nextStep is surfaced to the consumer instead of being swallowed",
  /j\.nextStep/.test(identity) && /setUnconfirmed\(j\.unconfirmed as number\[\]\)/.test(identity),
);
ok(
  "the identity page carries no paywall message and no upgrade link",
  !/Professional feature/.test(bare("app/identity/page.tsx")) && !/\/pricing/.test(bare("app/identity/page.tsx")),
);

// ── 6 · the Strategy Desk and the letters desk carry no upsell ─────────────

ok(
  "AiPlan has no upgrade state, no 402 branch, and no /pricing link",
  !/setUpgrade/.test(bare("app/strategist/AiPlan.tsx")) &&
    !/402/.test(bare("app/strategist/AiPlan.tsx")) &&
    !/\/pricing/.test(bare("app/strategist/AiPlan.tsx")),
);
const aiPlanFlat = flat(get("app/strategist/AiPlan.tsx"));
ok(
  "AiPlan's stale banner states what is known (the queue changed) and that regenerating costs nothing",
  /Regenerating is free/.test(aiPlanFlat) && /may no longer describe your file/.test(aiPlanFlat),
);
ok(
  "the letters desk has no quota meter, no upgrade state and no pack purchase",
  !/setRemaining/.test(bare("app/letters/page.tsx")) &&
    !/setUpgrade/.test(bare("app/letters/page.tsx")) &&
    !/letters_5/.test(bare("app/letters/page.tsx")),
);
ok(
  "S5's letter editor and approval flow on that page are untouched by this sweep",
  /setEditing/.test(get("app/letters/page.tsx")) && /setApproved/.test(get("app/letters/page.tsx")),
);

console.log(`\nconsumer-copy-sweep.test.ts: ${failures === 0 ? "all guards passed" : `${failures} failed`}`);
if (failures) process.exit(1);
