// Guards for the Kai Experience surface (Phase 1A, Agent E). Covers:
//   1. The KaiPresence cache fix (SIM-REVIEW finding 4) — clear-on-switch at
//      every workspace/account transition, and excluded routes neither fetch
//      nor cache (the fetch-before-guard ordering fix).
//   2. The round2 emoji/range-law fix (SIM-REVIEW finding 14).
//   3. Onboarding truth (ROOM-RECOMMENDATIONS row 7) — completion derives from
//      the same real signals each step's target page already uses, the old
//      visited-as-completed client state is gone, and the front door
//      (registration redirect + Sidebar nav entry) is wired.
//   4. The everyday on-behalf-of + time-of-day greeting register (min-set 3)
//      and the session-close voice.
//   5. The Kai Package Summary digest (fills D's reserved slot) — zero AI,
//      reuses the strategy table and the existing windowText()/forecast helper.
//   6. The receipt-anchor reconcile — journey/page.tsx, lib/intelligence/
//      snapshot.ts (and lib/missionEngine/engine.ts, verified already clean)
//      no longer feed operator copy from a bare mailedAt diff.
// Run: npx tsx scripts/kai-experience.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveOnboardingStatus, profileIsComplete, ONBOARDING_STEP_COUNT } from "../lib/onboarding";
import { greetingPeriod, assembleOperatorSession, type OperatorSessionInputs, type OperatorAccount, type WorkspaceClient } from "../lib/operatorSession";
import { buildPackageSummary, type MailLetter } from "../lib/mailCenter";
import type { KaiHomeData } from "../lib/kaiHome";

let pass = 0, fail = 0;
function ok(label: string, cond: boolean) { if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); } }

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// ==== 1. Cache fix — clear-on-switch wired at every subject-change site =====
// Mechanism chosen (of the brief's two options): the workspace cookie is
// httpOnly (unreadable client-side, by design), so this component cannot
// itself derive a scope token without a network round trip that would defeat
// the cache's purpose — clearing at the three known transition points is the
// mechanism the component's data actually supports.
{
  const KAI_PRESENCE_SRC = read("components/kai/KaiPresence.tsx");
  ok("KaiPresence exports clearKaiPresenceCache for the switch paths to call", /export function clearKaiPresenceCache/.test(KAI_PRESENCE_SRC));
  ok("clearKaiPresenceCache removes exactly the unscoped key (kai-presence-ctx-v1), not the dismiss key", /sessionStorage\.removeItem\(CACHE_KEY\)/.test(KAI_PRESENCE_SRC) && !/sessionStorage\.removeItem\(DISMISS_KEY\)/.test(KAI_PRESENCE_SRC));

  const AGENCY_PAGE_SRC = read("app/agency/page.tsx");
  ok("openClient() (agency → client workspace) clears the Kai cache before navigating", /clearKaiPresenceCache\(\);\s*\n\s*clearOnboardingStatusCache\(\);\s*\n\s*router\.push\("\/dashboard"\)/.test(AGENCY_PAGE_SRC));

  const AGENCY_BAR_SRC = read("components/AgencyBar.tsx");
  ok("AgencyBar.exit() (client workspace → agency) clears the Kai cache before navigating", /clearKaiPresenceCache\(\);\s*\n\s*clearOnboardingStatusCache\(\);\s*\n\s*router\.push\("\/agency"\)/.test(AGENCY_BAR_SRC));

  const SIDEBAR_SRC = read("components/Sidebar.tsx");
  const signOutCalls = [...SIDEBAR_SRC.matchAll(/onClick=\{[^}]*signOut\(/g)];
  ok("both sign-out handlers exist (desktop Sidebar + MobileNav) — sanity, the check below isn't vacuous", signOutCalls.length === 2);
  ok("every sign-out handler clears the Kai cache first (a different account may sign in on the same tab)", signOutCalls.every((m) => /clearKaiPresenceCache\(\)/.test(m[0])));
}

// ==== 2. Excluded routes neither fetch nor cache (fetch-before-guard fix) ===
{
  const KAI_PRESENCE_SRC = read("components/kai/KaiPresence.tsx");
  const effectStart = KAI_PRESENCE_SRC.indexOf("useEffect(() => {");
  const excludedCheckIdx = KAI_PRESENCE_SRC.indexOf("EXCLUDED_PATHS.has(pathname)) return;");
  const cacheReadIdx = KAI_PRESENCE_SRC.indexOf("sessionStorage.getItem(CACHE_KEY)");
  const fetchIdx = KAI_PRESENCE_SRC.indexOf('fetch("/api/kai/context")');
  ok("the mount effect, the excluded-route check, the cache read, and the fetch are all found (sanity)", [effectStart, excludedCheckIdx, cacheReadIdx, fetchIdx].every((i) => i > -1));
  ok("the excluded-route check sits INSIDE the mount effect", excludedCheckIdx > effectStart);
  ok("...and BEFORE the cache read (excluded routes never read a stale cache either)", excludedCheckIdx < cacheReadIdx);
  ok("...and BEFORE the fetch (excluded routes never populate the cache — the exact finding-4 mechanism: 'openClient() lands on /dashboard, so every ordinary switch populates the unscoped cache')", excludedCheckIdx < fetchIdx);
  ok("both excluded paths are still /dashboard and /journey (Kai Home + the Kai-narrated Timeline)", /EXCLUDED_PATHS = new Set\(\["\/dashboard", "\/journey"\]\)/.test(KAI_PRESENCE_SRC));
}

// ==== 3. round2 emoji / range-law fix (finding 14) ==========================
{
  const ROUND2_SRC = read("app/api/letters/[id]/round2/route.ts");
  ok("no emoji anywhere in the file (the swept surface's one shipped 🎉 breach)", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(ROUND2_SRC));
  ok("the deleted-item response states the fact, then the guidance, factually — no celebration", /"This item was already reported deleted — no escalation needed\."/.test(ROUND2_SRC));
}

// ==== 4. Onboarding — completion derives from real signals (static) ========
{
  const ONBOARDING_LIB_SRC = read("lib/onboarding.ts");
  ok("profile completion reads the mail-ready fields (name + full address) — the SAME check lib/letter.ts's consumerComplete uses", /Boolean\(u\.fullName && u\.addressLine1 && u\.city && u\.state && u\.zip\)/.test(ONBOARDING_LIB_SRC));
  ok("step 2 (Upload) reads a real Report count", /prisma\.report\.count/.test(ONBOARDING_LIB_SRC));
  ok("step 3 (Tradelines) reads a real Tradeline count", /prisma\.tradeline\.count/.test(ONBOARDING_LIB_SRC));
  ok("steps 4/5 (Letters/Track) read real Letter rows (count + mailedAt), not a synthesized value", /prisma\.letter\.findMany/.test(ONBOARDING_LIB_SRC));

  const PAGE_SRC = read("app/onboarding/page.tsx");
  ok("the onboarding page is a server component now (no \"use client\")", !/"use client"/.test(PAGE_SRC));
  ok("the page loads the real derivation (lib/onboarding.ts), not a local click-tracked array", /loadOnboardingStatus/.test(PAGE_SRC));
  ok("the old fabricated-progress state is gone (no completedSteps client state, no per-click completion)", !/useState<number\[\]>/.test(PAGE_SRC) && !/setCompletedSteps/.test(PAGE_SRC) && !/completedSteps\.length === 0/.test(PAGE_SRC));

  const STEPS_SRC = read("app/onboarding/OnboardingSteps.tsx");
  ok("the interactive step list never touches the database itself (no prisma import — client/server split, CLAUDE.md gotcha 2)", !/from ["']@\/lib\/prisma["']/.test(STEPS_SRC) && !/from ["']\.\.\/\.\.\/lib\/prisma["']/.test(STEPS_SRC));
  ok("the completion checkmark's aria-label is now truthful ('Step completed', not 'Step visited')", /aria-label="Step completed"/.test(STEPS_SRC) && !/Step visited/.test(STEPS_SRC));
  ok("the progress bar's aria-label states completion, not visits", /steps completed/.test(PAGE_SRC) && !/steps visited/i.test(PAGE_SRC));
}

// ==== 5. Onboarding — logic: deriveOnboardingStatus / profileIsComplete ====
{
  const zero = deriveOnboardingStatus({ profileComplete: false, reportCount: 0, tradelineCount: 0, letterCount: 0, anyMailed: false });
  ok("zero-data account → zero completed steps (no fabricated progress)", zero.completedSteps.length === 0);

  const all = deriveOnboardingStatus({ profileComplete: true, reportCount: 2, tradelineCount: 10, letterCount: 3, anyMailed: true });
  ok("every real signal true → all 5 steps complete, in order", JSON.stringify(all.completedSteps) === JSON.stringify([1, 2, 3, 4, 5]));
  ok(`ONBOARDING_STEP_COUNT matches the 5-step catalog`, ONBOARDING_STEP_COUNT === 5);

  // Independence: a report existing does not imply tradelines were parsed
  // from it, and letters existing does not imply any was mailed — each step
  // is its OWN signal, never inferred from a neighbor.
  const reportOnly = deriveOnboardingStatus({ profileComplete: false, reportCount: 1, tradelineCount: 0, letterCount: 0, anyMailed: false });
  ok("a report on file with nothing parsed yet → step 2 done, steps 3/4/5 honestly not", JSON.stringify(reportOnly.completedSteps) === JSON.stringify([2]));

  const generatedNotMailed = deriveOnboardingStatus({ profileComplete: true, reportCount: 1, tradelineCount: 1, letterCount: 1, anyMailed: false });
  ok("a generated-but-unmailed letter → step 4 done, step 5 honestly not (letters.some(mailedAt) is false)", generatedNotMailed.completedSteps.includes(4) && !generatedNotMailed.completedSteps.includes(5));

  ok("profileIsComplete requires every one of the 5 mail-ready fields", profileIsComplete({ fullName: "Marcus Chen", addressLine1: "1 Main St", city: "Austin", state: "TX", zip: "78701" }) === true);
  ok("...missing any single field → false (a partial profile is not complete)", profileIsComplete({ fullName: "Marcus Chen", addressLine1: null, city: "Austin", state: "TX", zip: "78701" }) === false);
}

// ==== 6. Onboarding — the front door (static) ================================
{
  const REGISTER_SRC = read("app/register/page.tsx");
  ok("registration redirects new accounts to /onboarding", /router\.push\("\/onboarding"\)/.test(REGISTER_SRC));
  ok("...and no longer to /dashboard (that redirect belonged to the old front door)", !/router\.push\("\/dashboard"\)/.test(REGISTER_SRC));

  const LOGIN_SRC = read("app/login/page.tsx");
  ok("sign-in (an EXISTING account, not a new one) still lands on /dashboard, unchanged", /router\.push\("\/dashboard"\)/.test(LOGIN_SRC));

  const SIDEBAR_SRC = read("components/Sidebar.tsx");
  ok("the Sidebar nav entry is gated on the real /api/onboarding/status probe", /useOnboardingStatus/.test(SIDEBAR_SRC) && /onboarding\?\.incomplete/.test(SIDEBAR_SRC));
  ok("no manual dismiss affordance was added for the onboarding entry — it is derived-only (dismissible by completion, never a dismiss button)", !/dismissOnboarding|onboardingDismissed/i.test(SIDEBAR_SRC));

  const STATUS_ROUTE_SRC = read("app/api/onboarding/status/route.ts");
  ok("the status probe is auth-gated (401 with no account)", /Unauthorized/.test(STATUS_ROUTE_SRC) && /401/.test(STATUS_ROUTE_SRC));
  ok("an agency owner with no workspace open never reads 'incomplete' (no case of their own to onboard through — the same altitude law Mission Control applies)", /isAgency && !client/.test(STATUS_ROUTE_SRC));
}

// ==== 7. Greeting register — deterministic time-of-day (logic) ==============
{
  const AT = (h: number) => Date.UTC(2026, 6, 20, h, 30, 0); // 2026-07-20, minute/second fixed
  ok("00:00 UTC → morning", greetingPeriod(AT(0)) === "morning");
  ok("11:59 UTC → still morning (upper boundary)", greetingPeriod(Date.UTC(2026, 6, 20, 11, 59, 59)) === "morning");
  ok("12:00 UTC → afternoon (lower boundary)", greetingPeriod(AT(12)) === "afternoon");
  ok("17:59 UTC → still afternoon (upper boundary)", greetingPeriod(Date.UTC(2026, 6, 20, 17, 59, 59)) === "afternoon");
  ok("18:00 UTC → evening (lower boundary)", greetingPeriod(AT(18)) === "evening");
  ok("23:59 UTC → still evening", greetingPeriod(Date.UTC(2026, 6, 20, 23, 59, 59)) === "evening");
  // Same input, called twice → identical output (deterministic, no clock/randomness).
  ok("pure function: identical `now` always yields identical output", greetingPeriod(AT(9)) === greetingPeriod(AT(9)));
}

// ==== 8. Greeting register — identity composition + on-behalf-of (logic) ====
{
  const EMPTY_KAI: KaiHomeData = { overnight: [], recommendation: null, deadlines: [], recentEvents: [], responsesReceived: 0, lettersMailed: 0 };
  const ACCOUNT: OperatorAccount = { id: "u1", fullName: "Marcus Chen", name: null, isAgency: true, agencyName: "Chen Credit Services" };
  const CLIENT: WorkspaceClient = { id: "c1", fullName: "Elena Ruiz", name: null };
  const base = (over: Partial<OperatorSessionInputs> = {}): OperatorSessionInputs => ({
    account: ACCOUNT, client: null, kai: EMPTY_KAI, events: [], manifests: [], letters: [], now: Date.UTC(2026, 6, 20, 9, 0, 0), ...over,
  });

  const consumer = assembleOperatorSession(base({ account: { ...ACCOUNT, isAgency: false } }));
  ok("identity.timeOfDay is present and matches greetingPeriod(now)", consumer.identity.timeOfDay === "morning");
  ok("consumer altitude → no onBehalfOf (the 'plain' variant)", consumer.identity.onBehalfOf === undefined);

  const workspace = assembleOperatorSession(base({ client: CLIENT }));
  ok("workspace altitude → onBehalfOf names the client, for the natural 'you're in X's workspace' phrasing", workspace.identity.onBehalfOf?.clientName === "Elena Ruiz");
  ok("the SAME now, a different hour, yields a different timeOfDay (not hardcoded 'morning')", assembleOperatorSession(base({ now: Date.UTC(2026, 6, 20, 20, 0, 0) })).identity.timeOfDay === "evening");
}

// ==== 9. Greeting register — rendered copy (static) ==========================
{
  const SESSION_BLOCKS_SRC = read("components/mission/SessionBlocks.tsx");
  ok("SessionHeader renders the derived time-of-day, not a hardcoded 'Good morning'", /Good \{identity\.timeOfDay\}/.test(SESSION_BLOCKS_SRC) && !/Good morning, \{identity\.greetingName\}/.test(SESSION_BLOCKS_SRC));
  ok("the workspace variant reads naturally ('you're in', per the brief's own example) — the consumer variant stays plain (no change inside the ternary's null branch)", /you&apos;re in \{identity\.onBehalfOf\.clientName\}/.test(SESSION_BLOCKS_SRC));
  ok("the session-close block uses Kai's register ('Still open', 'Quiet is allowed') — the old bureaucratic 'Remaining:' wording is gone", /Still open: \$\{close\.remaining\.count\}/.test(SESSION_BLOCKS_SRC) && !/Remaining: \$\{close\.remaining\.count\}/.test(SESSION_BLOCKS_SRC));
  ok("the quiet-state line names no celebration — pleased-and-bounded, honest about nothing having happened", /Quiet is allowed — nothing needed you today\./.test(SESSION_BLOCKS_SRC));
}

// ==== 10. Kai Package Summary — zero AI (static) =============================
{
  const DOWNLOAD_PAGE_SRC = read("app/mail/download/[packageId]/page.tsx");
  const MAILCENTER_SRC = read("lib/mailCenter.ts");
  for (const [name, src] of [["download page", DOWNLOAD_PAGE_SRC], ["lib/mailCenter.ts", MAILCENTER_SRC]] as const) {
    ok(`${name} makes no AI call to build the package summary (no meteredMessage import)`, !/meteredMessage/.test(src));
    ok(`${name} imports no askKai/Anthropic client`, !/askKai|@anthropic-ai\/sdk/.test(src));
  }
  ok("the placeholder 'not generated yet' copy is gone from the Download page", !/isn&apos;t generated yet/.test(DOWNLOAD_PAGE_SRC));
  ok("buildPackageSummary is exported for the Download page to call", /export function buildPackageSummary/.test(MAILCENTER_SRC));
  ok("the strategy line reuses lib/strategies.ts's existing table (STRATEGY_BY_ID), never a re-authored label/blurb literal", /STRATEGY_BY_ID\[first\.strategy\]/.test(MAILCENTER_SRC));
  ok("the window line reuses this file's OWN windowText() (the same function the per-letter timeline stage already calls) — not a second implementation", /afterMailing = windowText\(/.test(MAILCENTER_SRC));

  // mail-download.test.ts's own structural laws must still hold — belt and
  // suspenders, since this agent edited the same panel D's guard pins.
  ok("the KAI-PANEL-BOUNDARY marker is still present (Approve control stays outside the Kai panel)", DOWNLOAD_PAGE_SRC.indexOf("KAI-PANEL-BOUNDARY") > -1);
  ok("the evidence-asymmetry disclosure sentence is still present verbatim on the Download page", /Evidence differs by path: self-mail leaves your own mailing record as proof/.test(DOWNLOAD_PAGE_SRC));
}

// ==== 11. Kai Package Summary — logic (buildPackageSummary) ==================
{
  function letter(over: Partial<MailLetter> & { id: string }): MailLetter {
    return {
      targetBureau: "EQUIFAX", mailedAt: null, responseAt: null, round: 1, status: "GENERATED",
      recipientName: "Equifax", recipientType: "bureau", creditorName: "Capital One",
      createdAt: new Date("2026-07-01T00:00:00.000Z"), hasResponse: false, responseOutcome: null,
      tradelineId: "t1", strategy: "fcra_611",
      ...over,
    };
  }

  const empty = buildPackageSummary([]);
  ok("an empty package never fabricates content", /no letters on file/.test(empty.contains));

  const unmailedBureau = buildPackageSummary([letter({ id: "l1" })]);
  ok("1 unmailed bureau letter → 'contains' names the count and recipient", /1 letter/.test(unmailedBureau.contains) && /Equifax/.test(unmailedBureau.contains));
  ok("known strategyId → the real label + blurb from lib/strategies.ts (fcra_611)", /FCRA §611/.test(unmailedBureau.strategyBasis));
  ok("not-yet-mailed → the forward-looking rule (§611 language), not a live elapsed-days read", /§611/.test(unmailedBureau.afterMailing));

  const unknownStrategy = buildPackageSummary([letter({ id: "l2", strategy: "not_a_real_strategy_id" })]);
  ok("an unrecognized strategyId is disclosed honestly, never a fabricated label", /isn't on file/.test(unknownStrategy.strategyBasis));

  const collector = buildPackageSummary([letter({ id: "l3", recipientType: "collector", strategy: "validation" })]);
  ok("a collector-recipient package cites FDCPA §1692g, not §611 (recipient-correct statute)", /FDCPA §1692g/.test(collector.afterMailing));

  const NOW = Date.parse("2026-07-20T00:00:00.000Z");
  const mixed = buildPackageSummary([
    letter({ id: "l4", mailedAt: new Date("2026-07-10T00:00:00.000Z") }),
    letter({ id: "l5", recipientName: "Experian", mailedAt: null }),
  ], NOW);
  ok("a partially-mailed package discloses the honest mailed fraction (1 of 2)", /1 of 2 already mailed/.test(mixed.contains));

  const allMailed = buildPackageSummary([letter({ id: "l6", mailedAt: new Date("2026-07-10T00:00:00.000Z") })], NOW);
  ok("a fully-mailed package's 'after mailing' line is receipt-anchored (mentions the bureau receiving it, not a bare mailing-date claim)", /receives your dispute, not when you mail it/.test(allMailed.afterMailing));
}

// ==== 12. Receipt-anchor reconcile (static) ===================================
{
  const JOURNEY_SRC = read("app/journey/page.tsx");
  const SNAPSHOT_SRC = read("lib/intelligence/snapshot.ts");
  const ENGINE_SRC = read("lib/missionEngine/engine.ts");

  ok("app/journey/page.tsx imports the receipt-anchored helper from lib/forecast", /import\s*\{[^}]*\bdaysElapsedSinceEstimatedReceipt\b[^}]*\}\s*from\s*["']@\/lib\/forecast["']/.test(JOURNEY_SRC));
  ok("...and REINVESTIGATION_DAYS now comes from lib/forecast too (one canonical source), not lib/kaiHome", /from\s*["']@\/lib\/forecast["']/.test(JOURNEY_SRC) && !/import\s*\{[^}]*REINVESTIGATION_DAYS[^}]*\}\s*from\s*["']@\/lib\/kaiHome["']/.test(JOURNEY_SRC));
  ok("app/journey/page.tsx's upcoming-windows map no longer does a bare mailedAt diff (Math.floor((now - ...mailedAt...) / 86_400_000))", !/Math\.floor\(\(now - new Date\(l\.mailedAt as Date\)\.getTime\(\)\) \/ 86_400_000\)/.test(JOURNEY_SRC));
  ok("app/journey/page.tsx's 'next review' close-date no longer adds REINVESTIGATION_DAYS onto raw mailedAt (the exact `mailedAt + window` pattern)", !/mailedAt as Date\)\.getTime\(\) \+ REINVESTIGATION_DAYS \* 86_400_000/.test(JOURNEY_SRC));
  ok("...it derives the close date from now + the already-receipt-anchored daysLeft instead", /new Date\(now \+ nearest\.daysLeft \* 86_400_000\)/.test(JOURNEY_SRC));

  ok("lib/intelligence/snapshot.ts imports the receipt-anchored helper from lib/forecast", /import\s*\{[^}]*\bdaysElapsedSinceEstimatedReceipt\b[^}]*\}\s*from\s*["']@\/lib\/forecast["']/.test(SNAPSHOT_SRC));
  ok("lib/intelligence/snapshot.ts's openWindows no longer does a bare mailedAt diff", !/Math\.floor\(\(now - new Date\(l\.mailedAt as Date\)\.getTime\(\)\) \/ 86_400_000\)/.test(SNAPSHOT_SRC));
  ok("...it now calls the shared helper instead", /daysElapsedSinceEstimatedReceipt\(new Date\(l\.mailedAt as Date\)\.getTime\(\), now\)/.test(SNAPSHOT_SRC));

  // engine.ts has no local elapsed-day computation at all (it only formats a
  // daysLeft number computed upstream) — verified clean rather than edited,
  // so this pins that it stays that way and already sources REINVESTIGATION_DAYS
  // from the canonical file.
  ok("lib/missionEngine/engine.ts has no mailedAt reference of its own (nothing to reconcile locally)", !/mailedAt/.test(ENGINE_SRC));
  ok("lib/missionEngine/engine.ts sources REINVESTIGATION_DAYS from lib/forecast (the canonical constant), not a local literal 30", /import\s*\{\s*REINVESTIGATION_DAYS\s*\}\s*from\s*["']@\/lib\/forecast["']/.test(ENGINE_SRC));
}

console.log(`\nkai-experience.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
