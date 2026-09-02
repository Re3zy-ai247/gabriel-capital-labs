// CONSUMER COPY SWEEP — RC1-S6b (B §S-28…S-38 + G's seven additions · A1-16 ·
// S-32 · Founder D-2 / D-3 / D-4 / D-8 / D-9).
// Run: npx --no-install tsx scripts/consumer-copy-sweep.test.ts
//
// THE INVARIANT, EXECUTABLE:
//   No consumer-facing surface quotes a consumer price, names a retired
//   consumer tier as something to get, offers a purchase, confirms a purchase,
//   meters a letter quota, promises a subscription cancellation, or gates a
//   feature on membership — AND each swept surface positively states the
//   truthful thing that replaced it.
//
// COVERAGE (M-1). The absence half runs over the WHOLE consumer tree, walked
// from disk at run time — every .ts/.tsx under app/ and components/ minus the
// business, staff and content areas listed in EXCLUDED below. It is not a
// hand-maintained file list: a new consumer page is covered the moment it
// exists, which is the only version of this guard worth having. The first cut
// of this file scanned sixteen named files while its header claimed to be
// tree-wide, and a live "Payment received" banner on an owned, supposedly
// scanned page survived it (H-1). The presence half is necessarily per-page and
// names its files.
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

import { readFileSync, readdirSync } from "node:fs";
import { stripComments, stripCommentsSelfTest } from "./_source";
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
 * RC1-S11 CLOSING (CE2-1) — THIS USED TO BE A REGEX AND IT WAS BLIND.
 *
 * The previous implementation opened with `.replace(/\/\*[\s\S]*?\*\//g, "")`,
 * which pairs `/*` with the next `*\/` ANYWHERE, with no idea what a string
 * literal is. Replayed over `components/Attachments.tsx` it deleted L88-L121 —
 * 1713 characters, 29% of a live consumer component — because the `/*` it
 * latched onto was inside the attribute value `accept="image/*,application/pdf"`
 * and the first `*\/` after it belonged to a `{/* eslint-disable-next-line *\/}`
 * thirty-three lines later. The file input, its error paragraph, the file-chip
 * markup, the size labels, the remove control and the image thumbnail anchor
 * were all inside that span. Every absence rule "passed" over them, and the
 * coverage line counted the file as scanned.
 *
 * That is the exact failure this suite exists to prevent — a protection that
 * quietly stops protecting — so the guard no longer carries its own stripper.
 * It uses the shared tokenizer in scripts/_source.ts, which walks the source
 * once and treats a comment marker inside a string literal as DATA. The
 * tokenizer's own self-test is run below as a gate: if the instrument this
 * suite measures with is unhealthy, this suite fails rather than reporting
 * numbers it cannot stand behind.
 *
 * KNOWN RESIDUAL, disclosed rather than assumed away (CE2-2, S7's open item):
 * the version of the tokenizer adopted here is string-literal-aware but not
 * REGEX-literal-aware — `grep -ci regex scripts/_source.ts` is 0 on this
 * candidate. A regex literal containing a quote (`/["']/`) can desync its
 * string state. The likely direction of that failure is UNDER-stripping, which
 * surfaces as an absence rule matching comment prose — a loud, self-announcing
 * failure rather than a silent pass. The dangerous direction, a desync that
 * over-strips, is the CE2-1 class returning through a different door.
 *
 * This suite does not paper over that: it gates on stripCommentsSelfTest()
 * above rather than on a private copy of the stripper, so when S7 lands the
 * regex-literal state and extends that self-test, this suite inherits the
 * stronger instrument and the stronger gate on the same day, with no edit here.
 */
const codeOnly = stripComments;

/** Whitespace-normalised source, for presence checks on copy that line-wraps. */
const flat = (s: string) => s.replace(/\s+/g, " ");

// ── The surfaces this slice REWROTE. Named, because the presence checks in §2-§6
// ── ask each one for its own specific sentence. The absence scan below runs
// ── over a superset: the whole consumer tree, walked from disk.
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

// ── THE CONSUMER TREE ───────────────────────────────────────────────────────
// Walked from disk, so nothing is covered only because someone remembered to
// add it. Exclusions are areas that are legitimately NOT consumer surfaces, and
// each says why — an exclusion is how a paywall hides, so none is silent.
const EXCLUDED: [RegExp, string][] = [
  // RC1-S11 (C-2/C-3). This exclusion was written to the brief's scoping and it
  // was WRONG in one specific way: the release review found /agency is reachable
  // by an ordinary consumer (middleware requires only a session), so the branch
  // rendered to a NON-agency visitor is a consumer surface — and a live $399/mo
  // Subscribe control plus a "🎉 Payment received" banner survived there purely
  // because this line skipped the whole directory.
  //
  // The exclusion stays, because a genuine agency-facing surface may legitimately
  // quote agency prices. It is no longer a free pass: §1b below scans the file
  // anyway, targeting exactly what a consumer can reach.
  [/^app\/agency\//, "the agency product is a real business surface and may quote its own prices to its own users — but NOT on a branch a consumer can reach; §1b scans that branch"],
  [/^app\/admin\//, "staff-only tooling, never rendered to a consumer"],
  [/^app\/api\//, "route layer; the money invariants there are guarded by no-paid-advantage + the S6a runtime suite"],
  [/^app\/academy\//, "educational content about credit, not about CreditVector's commercials"],
  [/^app\/brief\//, "editorial news content; quotes third-party figures by its nature"],
  [/^app\/review\//, "the Founder walkthrough rooms — deliberately synthetic fixture data, gated behind reviewBuildAllowed(), unreachable in a consumer build"],
  [/^app\/gxl\//, "same review-room family as app/review"],
  [/^components\/(admin|brief|academy)\//, "the component halves of the three excluded areas above"],
  // RC1-S6b r2 (N-2): `journey` was wrongly bundled in here. Only `review` is
  // review-room internals — components/cxos/journey/* is imported by
  // app/page.tsx:18-20 (JourneyRuntime, ProblemChamber, IntelligenceAwakens) and
  // renders on the PUBLIC landing page, so it is a consumer surface and is now
  // scanned. Its illustrative bureau balances are allowlisted below, pinned the
  // same way Showcase.tsx's are.
  [/^components\/cxos\/review\//, "fixture + choreography internals of the review rooms"],
];

function consumerTree(): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  walk("app");
  walk("components");
  return out.filter((p) => !EXCLUDED.some(([re]) => re.test(p))).sort();
}

const TREE = consumerTree();
const treeCode = new Map(TREE.map((p) => [p, codeOnly(read(p))] as const));

// ── 1 · ABSENCE SCANS OVER THE WHOLE CONSUMER TREE ──────────────────────────
// Each rule names WHAT it forbids and lists the exceptions it tolerates, with
// the reason. An unexplained allowlist entry is how a paywall comes back.

interface Rule {
  label: string;
  re: RegExp;
  /** Paths where a match is legitimate, each pinned to the exact permitted shape. */
  allow?: Record<string, RegExp>;
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
      // Same class: the paste-your-report placeholder shows what a report line
      // looks like. Pinned to the whole placeholder string.
      "app/upload/page.tsx": /placeholder=\{"Paste your credit report's accounts section here…[\s\S]*?XXXX1477"\}/,
      // A regex REPLACEMENT BACKREFERENCE, not money. Pinned to the whole call.
      "components/community/AmbientGrid.tsx": /\.replace\(\/rgba\?\\\(\(\[\^\)\]\+\)\\\)\/, "\$1"\)/,
      // The consumer's own POSTAGE total, not a CreditVector price — so it is
      // not this slice's rule to enforce. It is, separately, hardcoded and
      // therefore asserts $0.00 whatever the consumer actually spent: reviewer
      // L-4, an S11/mail truthfulness item, outside S6b's owned paths. Pinned
      // to the exact tile so this exception cannot shelter a real price.
      "app/mail/page.tsx": /<StatPill label="Mail spend" value="\$0\.00" \/>/,
      // The landing journey's illustrative auto-loan balances — the same class
      // as Showcase.tsx's demo table: what a consumer's own report shows, not
      // an amount CreditVector charges. One pin per file, each spanning both
      // rows in that file.
      "components/cxos/journey/IntelligenceAwakens.tsx": /fact="Balance \$8,214 · May 12"[\s\S]*?fact="Balance \$7,940 · Apr 28"/,
      "components/cxos/journey/ProblemChamber.tsx": /detail="Balance \$8,214"[\s\S]*?detail="Balance \$7,940"/,
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
    allow: {
      // "always free to send more" is free in the sense of AT LIBERTY, not price.
      // Pinned to the exact sentence rather than narrowed by regex sense, so no
      // permanence PRICING claim ("always free to use") can ride the exemption.
      //
      // The narrowing this replaces — `always free(?! to\b)` — was the one
      // exemption in this file that broadened tree-wide instead of naming its
      // single case, and it let the whole "always free to use / to keep" family
      // through. The product's own house phrasing is "free to use today", so
      // "always free to use" sat one word from shipping past the guard.
      "app/campaigns/page.tsx": /You&apos;re always free to send more; this is guidance, not a limit\./,
    },
  },
  {
    // RC1-S6b REMEDIATION (H-1). The rule that was missing. A success-green
    // "🎉 Payment received — your letter pack is being added" banner on
    // app/letters/page.tsx fired on `?purchase=success` — a URL that lives on in
    // historical Stripe receipts and is trivially typed — and it passed all nine
    // preceding rules: no `$`, no "Upgrade to", no `letters_5`, no quota phrase.
    // The regex deliberately catches the CODE SHAPE as well as the copy, because
    // a surviving `purchase === "success"` branch is one edit away from being a
    // banner again.
    label: 'no purchase-confirmation or fulfilment banner ("Payment received", purchase=success, "letter pack is being added")',
    re: /Payment received|purchase["']?\s*\)?\s*===?\s*["']success|letter pack is being added|credits? (are|is) being added/i,
  },
  {
    // RC1-S11 (journey MEDIUM-4). Mission Control rendered the raw `plan` column
    // in a chip — the literal text "OPERATOR premium" for a legacy payer — while
    // getEntitlement returned plan:"free", premium:false for that same row. Two
    // faults at once: an internal enum used as consumer copy, and a tier signal
    // on a product whose law is that there is no tier to report.
    //
    // The rule targets the RENDER position specifically — `>{plan}`, `>{u.role}`
    // — not the identifier, so a component may still hold and branch on these
    // values (CommandHeader keeps `role` and maps it to written English at :82).
    // What it may not do is print the enum. Passing one down as a prop is caught
    // in effect too: a prop that is never rendered has nothing left to do, and
    // the S11 fix removed the prop for exactly that reason.
    label: "no raw plan/role/subscription enum rendered as consumer copy (e.g. the \"OPERATOR premium\" chip)",
    re: />\s*\{\s*(?:[A-Za-z_$][\w$]*\s*\.\s*)*(?:plan|role|subscriptionStatus)\s*\}/,
  },
];

for (const rule of RULES) {
  for (const p of TREE) {
    const body = treeCode.get(p)!;
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
// A suite that silently scanned nothing is the failure mode this whole section
// exists to prevent, so the coverage itself is an assertion. The floor is a
// floor, not the current count: it fails if the walker starts returning far less
// than the tree really holds, without breaking every time a page is added.
// ── COVERAGE, MEASURED RATHER THAN CLAIMED (CE2-1) ──────────────────────────
// The old line printed a file count and asserted a floor. Both were true and
// both were beside the point: the suite was counting a file as covered while
// 29% of it had been deleted before any rule ran. A coverage claim has to be
// about the text actually scanned, so it is now reported in characters as well
// as files, and the instrument that produces those characters is gated first.
{
  const selfTestFailures = stripCommentsSelfTest();
  ok(
    "the comment stripper this suite measures with passes its own self-test",
    selfTestFailures.length === 0,
    selfTestFailures.join("; "),
  );
}

const totalChars = TREE.reduce((n, p) => n + read(p).length, 0);
const scannedChars = TREE.reduce((n, p) => n + treeCode.get(p)!.length, 0);
ok(
  `absence scan covered ${TREE.length} consumer files x ${RULES.length} rules — ${scannedChars} of ${totalChars} characters after comment removal (excludes: ${EXCLUDED.length} documented areas)`,
  TREE.length >= 120 && RULES.length === 11 && scannedChars > 0,
);

// The CE2-1 regression, on the real file that was blind. These landmarks all sat
// inside the deleted span; if any of them stops being scanned, the hole is back.
{
  const attachments = treeCode.get("components/Attachments.tsx") ?? "";
  ok("components/Attachments.tsx is in the scanned tree", TREE.includes("components/Attachments.tsx"));
  for (const landmark of [
    'accept="image/*,application/pdf"',   // the string literal that opened the fake comment
    "{err && <p",                          // the error paragraph, 4 lines after it
    "{formatBytes(f.size)}",               // a size label mid-span
    'aria-label="Remove"',                 // the remove control, near the end of the span
  ]) {
    ok(
      `CE2-1: the formerly-blind span of components/Attachments.tsx is scanned — ${JSON.stringify(landmark)} survives comment removal`,
      attachments.includes(landmark),
    );
  }
}

// THE PROOF THE COORDINATOR ASKED FOR, as an executable fixture rather than a
// claim: the CE2-1 shape — a `/*` inside a quoted attribute value, then a
// violating line, then a JSX comment carrying the `*\/` that used to close the
// fake block. Under the old regex stripper the violating line vanished and every
// rule passed. It must now be seen, and it must FIRE.
{
  const fixture = [
    '<input accept="image/*,application/pdf" />',
    '<p>Upgrade to Professional — $99/mo</p>',
    "{/* eslint-disable-next-line @next/next/no-img-element */}",
    "<img />",
  ].join("\n");
  const strippedFixture = codeOnly(fixture);
  ok(
    "CE2-1 fixture: a `/*` inside a string literal does not open a comment",
    strippedFixture.includes('accept="image/*,application/pdf"'),
  );
  ok(
    "CE2-1 fixture: the JSX comment after it is still removed",
    !strippedFixture.includes("eslint-disable-next-line"),
  );
  ok(
    "CE2-1 fixture: code between the two is scanned, and markup after them survives",
    strippedFixture.includes("Upgrade to Professional") && strippedFixture.includes("<img />"),
  );
  const fired = RULES.filter((r) => r.re.test(strippedFixture)).map((r) => r.label);
  ok(
    `CE2-1 fixture: the planted violation FIRES (${fired.length} rule(s): price + purchase control)`,
    fired.length >= 2,
    `fired: ${fired.join(" | ") || "none — the span is still blind"}`,
  );
  // And the counter-proof: under the old regex stripper the same fixture is silent.
  const oldStripper = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  ok(
    "CE2-1 counter-proof: the OLD regex stripper hid that same violation entirely",
    !RULES.some((r) => r.re.test(oldStripper(fixture))),
  );
}
// The 16 rewritten surfaces must all be INSIDE the scanned tree — a presence
// check on a file the absence scan never reads would be half a guard.
for (const p of SURFACES) {
  ok(`${p} is inside the scanned consumer tree`, TREE.includes(p));
}

// ── 1b · app/agency/page.tsx — the branch AN ORDINARY CONSUMER CAN REACH ────
// RC1-S11 (C-2, C-3). /agency needs only a session (middleware.ts), and
// /api/agency/context answers isAgency:false for a free account, which selects
// the `!ctx?.isAgency` gate. That gate is therefore a consumer surface however
// the directory is classified, and it is scanned as one here.
//
// The slice is deliberately EXTRACTED rather than the whole file scanned: an
// agency's own workspace may quote its own prices to its own users, and this
// must not become a reason to strip that. The extraction failing is itself a
// failure — a guard that silently scans an empty string is worse than no guard.
{
  const agencySrc = read("app/agency/page.tsx");
  const agencyCode = codeOnly(agencySrc);

  const gateStart = agencyCode.indexOf("!ctx?.isAgency ? (");
  const gateEnd = gateStart >= 0 ? agencyCode.indexOf("\n      ) : (", gateStart) : -1;
  ok(
    "the non-agency gate on app/agency/page.tsx can still be located (extraction is not silently empty)",
    gateStart >= 0 && gateEnd > gateStart && gateEnd - gateStart > 200,
    `gateStart=${gateStart} gateEnd=${gateEnd}`,
  );
  const gate = gateStart >= 0 && gateEnd > gateStart ? agencyCode.slice(gateStart, gateEnd) : "";

  const gateRules: [string, RegExp][] = [
    ["quotes no price to a non-agency visitor", /\$\s?\d[\d,]*(\.\d{2})?/],
    ["renders no purchase control", /Subscribe to|onClick=\{subscribe\}|Get Agency\b|>\s*Buy\b|Buy \d|Start (my |your )?subscription/i],
    ["makes no checkout-processor reassurance", /card never touches|Secure checkout/i],
    ["makes no cancellation promise for a sale that is paused", /cancel anytime|no contracts|no lock-in/i],
    ["initiates no checkout", /\/api\/stripe\/checkout/],
  ];
  for (const [label, re] of gateRules) {
    const hit = re.exec(gate);
    ok(`app/agency/page.tsx gate — ${label}`, !hit, hit ? `matched ${JSON.stringify(hit[0])}` : undefined);
  }

  // Rule 10 (payment confirmation) runs over the WHOLE file, agency side
  // included. A fabricated "payment received" is never acceptable to anyone —
  // there is no reader for whom a false confirmation about their own money is
  // fine, so this one is not scoped to the consumer branch.
  const confirmRule = RULES.find((r) => /purchase-confirmation/.test(r.label))!;
  const confirmHit = confirmRule.re.exec(agencyCode);
  ok(
    "app/agency/page.tsx (whole file) — no purchase-confirmation or fulfilment banner",
    !confirmHit,
    confirmHit ? `matched ${JSON.stringify(confirmHit[0])}` : undefined,
  );

  // Presence: the gate must state the truth it was given instead of the pitch.
  const gateFlat = agencySrc.replace(/\s+/g, " ");
  ok(
    "the gate states that the agency workspace is a separate product with signups paused",
    /separate product/.test(gateFlat) && /New signups are paused/.test(gateFlat),
  );
  ok(
    "the gate does not name a business product as an offering (D-4)",
    !/CreditVector Business/.test(agencySrc),
  );
  ok(
    "the gate is not a dead end — it routes back into the product the consumer does have",
    /href="\/dashboard"/.test(gate),
  );
  // CE2-4: this used to read "nothing in the product produces the
  // /agency?checkout=success URL" while testing a single file. The claim was
  // wider than the measurement, and it was also false: the URL is still built
  // server-side at app/api/stripe/checkout/route.ts as a Stripe `success_url`.
  // That line is dormant — refuseSale() returns before any Stripe client is
  // constructed, so no session and no redirect can ever be produced from it —
  // and app/api/ is outside this suite's consumer tree by design. So the check
  // now scans every file the suite actually reads, and says exactly that.
  const producers = TREE.filter((f) => /\/agency\?checkout=success/.test(treeCode.get(f)!));
  ok(
    `no file in the scanned consumer tree produces the /agency?checkout=success URL (${TREE.length} files; the dormant server-side success_url in app/api/stripe/checkout is out of tree and unreachable behind refuseSale())`,
    producers.length === 0,
    producers.join(", "),
  );
}

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
