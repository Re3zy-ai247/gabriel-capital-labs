// Run: npx tsx scripts/dashboard-ranking.test.ts
//
// RC1 S7 — DASHBOARD TRUTH + CXOS POSTURE (Founder Decision D-6, 2026-08-23).
//
// Two kinds of guard live here, deliberately in one file, because they are one
// property: the room must give the consumer ONE answer, and the product must
// not put ceremony in front of it.
//
//   RUNTIME  — over lib/missionControl.ts's pure assembler, so the engine's
//              answers are exercised, not merely grepped.
//   SOURCE   — over the mount points (app/dashboard/page.tsx, app/page.tsx,
//              components/cxos/*), because "which surfaces exist on this
//              screen" is a composition fact with no runtime to observe here.
//
// WHAT THIS HOLDS:
//   1. ONE ranking at consumer altitude (C-04). The dashboard composed five
//      independently-ranked "what to do next" lists; two provably disagreed.
//   2. The split-brain is unified (A1-04). Report on file, zero tradelines
//      extracted: every surface says the same thing, and it is the truth.
//   3. "unstarted" is a real state (C-05). Zero rows is not health, and it is
//      never "ALL SYSTEMS GREEN".
//   4. No unearned watcher claims (C-06). Nothing watches a §611 window while
//      the consumer is away, so nothing may say it does.
//   5. D-6 posture: task-first by default; the cinematic entrance is opt-in
//      through a control that actually exists on a reachable surface (C-01),
//      bounded when taken (C-02/C-03/C-13), and reduced motion is untouched.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments, stripCommentsSelfTest } from "./_source";
import { assembleMission, type MissionInputs } from "../lib/missionControl";
import { assembleOperatorSession, type OperatorSessionInputs } from "../lib/operatorSession";
import { assembleMissions } from "../lib/missionEngine";
import { letterAuthorization } from "../lib/letter";
import type { KaiHomeData } from "../lib/kaiHome";
import { pickRecommendation } from "../lib/kaiHome";
import type { ComposedCampaign } from "../lib/campaign";
import { DEFAULT_CAMPAIGN_POLICY } from "../lib/campaign";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

// S11 addendum 2: the local line-based stripper this guard used to carry was
// BLIND. It filtered ` * ` continuation lines before pairing `/* … */`, so a
// JSDoc's closing delimiter was deleted, its `/**` was left dangling, and the
// block pass then ate every line down to the next `*/` anywhere later in the
// file — silently removing real code from what these assertions inspect. An
// absence assertion over code the guard never saw is a vacuous pass. It is one
// correct tokenizer pass now, shared with the other guards that need it, and
// section 0 below proves it is not blind before anything else runs.

const dash = stripComments(read("app/dashboard/page.tsx"));
const landing = read("app/page.tsx");
const gate = stripComments(read("components/cxos/ThresholdGate.tsx"));
const threshold = stripComments(read("components/cxos/Threshold.tsx"));
const toggle = stripComments(read("components/cxos/CinematicToggle.tsx"));
const footer = stripComments(read("components/marketing/SiteFooter.tsx"));
const shell = stripComments(read("components/AppShell.tsx"));
const capability = stripComments(read("lib/cxos/capability.ts"));
const header = stripComments(read("components/cxos/mission/CommandHeader.tsx"));
const presence = stripComments(read("components/kai/KaiPresence.tsx"));
const mcEngine = stripComments(read("lib/missionControl.ts"));
const mcView = stripComments(read("components/mission/MissionControl.tsx"));
const journeyRuntime = read("components/cxos/journey/JourneyRuntime.tsx");
const gxlRoom = stripComments(read("app/gxl/[room]/page.tsx"));
const kaiHome = stripComments(read("lib/kaiHome.ts"));
const globals = read("app/globals.css");
const gxlLobby = read("app/gxl/page.tsx");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

// ══ 0 · PROVE THE INSTRUMENT ═════════════════════════════════════════════════
// Every absence assertion below is only as good as the strip that feeds it, so
// the strip is tested first, on the exact shapes that fooled the line-based
// version: a JSDoc followed by code containing `*/` in a string, a `//`
// comment whose prose contains `/*`, a URL in a string literal, and a JSX
// comment. See scripts/_source.ts.
for (const failure of stripCommentsSelfTest()) {
  check(`stripComments self-test: ${failure}`, false);
}
check("stripComments self-test: the strip is not blind", stripCommentsSelfTest().length === 0);
// Belt and braces against gross over-deletion: every stripped source must
// still contain an anchor only real code can provide. If a future comment ever
// swallows a file again, these fail loudly instead of passing silently.
for (const [name, src, anchor] of [
  ["dashboard", dash, "export default async function DashboardPage()"],
  ["missionControl engine", mcEngine, "export function assembleMission("],
  ["MissionControl view", mcView, "export function MissionControl("],
  ["CommandHeader", header, "export function CommandHeader("],
  ["CinematicToggle", toggle, "export function CinematicToggle("],
  ["capability policy", capability, "export function detectTier()"],
  ["ThresholdGate", gate, "export function ThresholdGate()"],
  ["Threshold", threshold, "export function Threshold("],
  ["KaiPresence", presence, "export function KaiPresence()"],
  ["SiteFooter", footer, "export function SiteFooter()"],
  ["AppShell", shell, "export function AppShell("],
] as const) {
  check(`stripComments did not eat ${name} (anchor survives the strip)`, src.includes(anchor));
}

const NOW = new Date("2026-07-14T00:00:00.000Z").getTime();
const emptyKai: KaiHomeData = { overnight: [], recommendation: null, deadlines: [], recentEvents: [], responsesReceived: 0, lettersMailed: 0 };
const emptyComposed: ComposedCampaign = { strategyFamily: "mixed", items: [], rationale: "", warnings: [], nextUnlock: [], hasRecommendation: false };
function inputs(over: Partial<MissionInputs> = {}): MissionInputs {
  return {
    user: { fullName: "Rey Gabriel" }, kai: emptyKai, caseMemory: null, campaigns: [], composed: emptyComposed,
    tradelines: [{ id: "t1", resolved: false, accountType: "CHARGE_OFF", dateOfFirstDelinquency: new Date(NOW - 1000 * 86400000) }],
    // S11 NEW-3: the ACTIVE-confirmation counts letterAuthorization() needs.
    // Required, so no fixture can silently skip the question the server asks
    // before it 409s. The default fixture's letters are authorized.
    letters: [], scoreEntries: [], nextSeq: 1, reportCount: 1, activeAssertionCounts: { "t1": 1, "tl-default": 1 }, policy: DEFAULT_CAMPAIGN_POLICY, now: NOW, ...over,
  };
}

// ══ 1 · ONE ranking at consumer altitude (C-04) ═══════════════════════════════
// The five, verbatim from the finding: MissionEntry's "KAI Executive brief",
// PriorityList "Today's priorities", MissionControl "Today's mission" + "Kai's
// next action", ExecutiveQueue "Kai's one-list of what to do next", and
// MissionQueue "Priority queue". Exactly one survives at consumer altitude.
{
  const consumerRoom = dash.slice(dash.indexOf("const user = client ?? account;"));
  check("C-04: MissionControl is the ONE ranking rendered at consumer altitude",
    /<MissionControl data=\{data\} \/>/.test(consumerRoom));
  for (const dup of ["<MissionEntry", "<PriorityList", "<ExecutiveQueue", "<MissionQueue", "<AccomplishmentPanel", "<SessionCloseBlock"]) {
    check(`C-04: ${dup}> is not composed at consumer altitude (duplicate ranking / contradicting summary)`,
      !consumerRoom.includes(dup));
  }
  // The agency-owner altitude is a DIFFERENT room with no case of its own —
  // there the session blocks are the whole room, and removing them would be a
  // regression, not a fix. Guard that they survived.
  const agencyRoom = dash.slice(dash.indexOf('if (altitude === "agency-owner")'), dash.indexOf("const user = client ?? account;"));
  for (const kept of ["<PriorityList", "<AccomplishmentPanel", "<SessionCloseBlock", "<SessionHeader"]) {
    check(`C-04: ${kept}> is KEPT at agency-owner altitude (its own room, not a duplicate)`,
      agencyRoom.includes(kept));
  }
  check("C-04: the components themselves are kept in the tree, not deleted (CXOS unmounted, not abandoned)",
    dash.includes("SessionHeader, AccomplishmentPanel, ContinueWhereYouLeftOff, PriorityList, SessionCloseBlock"));
}

// ══ 2 · the split-brain state, unified (A1-04) ════════════════════════════════
// Report uploaded, extraction produced nothing. On the pre-fix engine this
// single state produced "Upload your credit report to get started" (Mission
// Control, keyed on tradelines) beside a null Kai recommendation, which the
// session blocks rendered as "Nothing needs your attention right now."
{
  const rec = pickRecommendation([], [], [{ id: "r1" } as never]);
  check("A1-04: Kai Home NAMES the report-with-no-accounts state instead of returning null",
    rec !== null && /could not read any accounts/i.test(rec.title));
  check("A1-04: …and its receipt states the rule truthfully",
    /a report is on file with no accounts extracted/i.test(rec?.basis ?? ""));
  check("A1-04: …and it promises nothing about what a re-run will find",
    !/(will|guarantee|remove|delete|improve)\b.*(remov|delet|score)/i.test(`${rec?.title} ${rec?.body}`));

  const kai: KaiHomeData = { ...emptyKai, recommendation: rec };
  const m = assembleMission(inputs({ tradelines: [], reportCount: 1, kai }));
  check("A1-04: hasReport keys on REPORTS, so a report that parsed to nothing still counts as uploaded",
    m.hasReport === true && m.reportWithoutTradelines === true);
  check("A1-04: the consumer is NOT told to upload a report they already uploaded",
    !m.tasks.some((t) => /upload your credit report to get started/i.test(t.text)));
  check("A1-04: exactly one task — one answer, not a list", m.tasks.length === 1);
  check("A1-04: Mission Control's task and Kai's next action are the SAME answer (no disagreement)",
    m.nextAction !== null && m.nextAction.href === m.tasks[0].href);
  // Review L-2: the line above is true for a file with no letters. State the
  // FULL precedence rather than leaving the guard narrower than the code:
  // when a letter is still open on a zero-tradeline file, kaiHome branches 1/2
  // (respond / escalate) outrank 4b, and the more urgent answer SHOULD win —
  // but the two surfaces then legitimately differ, and that is by design, not
  // a residual split-brain.
  const urgentRec = {
    title: "The Equifax response window has passed.", body: "…",
    cta: "Log the response", href: "/letters",
    basis: "Rule: past the window with no response on file.",
  };
  const withOpenLetter = assembleMission(inputs({
    tradelines: [], reportCount: 1,
    kai: { ...emptyKai, recommendation: urgentRec },
  }));
  check("A1-04/L-2: an urgent open-window recommendation still outranks the re-upload prompt",
    withOpenLetter.nextAction?.href === "/letters");
  check("A1-04/L-2: …and the room still names the unread report, so neither fact is suppressed",
    withOpenLetter.tasks.some((t) => /no accounts were read/i.test(t.text)));
  check("A1-04: the room does not read as quiet — timeline health is amber",
    m.health.find((h) => h.key === "timeline")?.status === "amber");
  check("A1-04: …and the case roll-up is not green", m.standing !== "green" && m.caseHealth !== "green");
  // The re-derivation of hasReport must not leak into the panels that
  // summarise EXTRACTED accounts — an account with no rows must not be shown
  // five empty summaries of a case that has none.
  check("A1-04: the analysis panels ask about extraction, not about upload",
    /const hasAnalysis = data\.hasReport && !data\.reportWithoutTradelines;/.test(dash));
  // <CommandCenter> is deliberately NOT in this list any more: S11 AD-4 gives
  // it a wider gate (`showCaseSummary`) so the header's "#health" anchor
  // resolves for a case whose report row is gone. Pinned in section 3b.
  for (const panel of ["<RoadmapView", "<KnowledgeJourney", "<BuilderView", "<ReadinessStrip"]) {
    check(`A1-04: ${panel}> renders only when there is analysis to summarise`,
      new RegExp(`\\{hasAnalysis && ${panel}`).test(dash));
  }
}

// ══ 3 · "unstarted" is a real state (C-05) ════════════════════════════════════
{
  const m = assembleMission(inputs({ tradelines: [], reportCount: 0 }));
  check("C-05: an account that has done nothing reads 'unstarted', never green", m.standing === "unstarted");
  check("C-05: the case signal says so in words too",
    /nothing has started/i.test(m.health.find((h) => h.key === "case")?.message ?? ""));
  check("C-05: the old all-green sentence is gone from the empty account",
    !m.health.some((h) => /everything.s green/i.test(h.message)));
  check("C-05: the band renders NOT STARTED rather than inferring green from an empty queue",
    /"unstarted"/.test(header) && /NOT STARTED/.test(header));
  check("C-05: the dashboard actually passes the engine's standing to the band",
    /standing=\{data\.standing\}/.test(dash));
  check("C-05: the contradicting 'Done today: 0 · Still open: 1' summary is not composed at consumer altitude",
    !dash.slice(dash.indexOf("const user = client ?? account;")).includes("<SessionCloseBlock"));
  // A started, healthy account must still be able to be green — the fix adds a
  // state, it does not blanket-suppress the good news.
  // Uses a clean tradeline: the default fixture's row is an unresolved
  // charge-off, which S11 HIGH-1 correctly stops calling green.
  const healthyAcct = assembleMission(inputs({
    tradelines: [{ id: "t1", resolved: false, accountType: "STUDENT_LOAN", dateOfFirstDelinquency: null }],
  }));
  check("C-05: a started account with nothing outstanding is still green", healthyAcct.standing === "green");
}

// ══ 3b · THE STANDING BAND ACROSS THE WHOLE LIFECYCLE ════════════════════════
// S11 AD-4 + HIGH-1. This band is the product's loudest single claim, and it
// has now been caught being wrong in BOTH directions: green over an empty
// account (C-05), NOT STARTED over a live overdue case (AD-4), and ALL SYSTEMS
// GREEN over a file with four unresolved derogatories and three responses that
// all came back verified (HIGH-1). One state table, every arm pinned, so the
// next wrong direction has to break a test to ship.
{
  const derogatory = { id: "t1", resolved: false, accountType: "CHARGE_OFF" as const, dateOfFirstDelinquency: new Date(NOW - 900 * 86400000) };
  const clean = { id: "t2", resolved: false, accountType: "STUDENT_LOAN" as const, dateOfFirstDelinquency: null };
  const mailed = (over: Partial<MissionInputs["letters"][number]> = {}) => ({
    id: "L1", tradelineId: "t1", recipientName: "Equifax", parentLetterId: null,
    responseAt: null, responseOutcome: null, mailedAt: new Date(NOW - 10 * 86400000), ...over,
  });

  // (a) nothing at all on file → NOT STARTED is the honest read.
  const empty = assembleMission(inputs({ tradelines: [], reportCount: 0 }));
  check("AD-4/a: an account with nothing on file reads NOT STARTED", empty.standing === "unstarted");

  // (b) report uploaded, zero accounts read → started, and not green.
  const unread = assembleMission(inputs({ tradelines: [], reportCount: 1 }));
  check("AD-4/b: report-with-zero-tradelines is started, not NOT STARTED", unread.standing !== "unstarted");
  check("AD-4/b: …and is not green — something needs doing", unread.standing !== "green");

  // (c) started, current, nothing overdue, nothing derogatory → green is legitimate.
  const healthy = assembleMission(inputs({ tradelines: [clean] }));
  check("AD-4/c: a started, current file with no unresolved derogatory account IS green", healthy.standing === "green");

  // (d) started with unresolved derogatories and all-verified responses → not green.
  //
  // Fixture shape matters here, and this is the exact shape the runtime journey
  // hit: the verified response has ALREADY been followed up (L2 is its round-2
  // child), so `escalatable` is empty and response health is green; the child
  // is generated but unmailed, so mail health is green too. Every workflow
  // signal is legitimately green while the consumer's file is entirely
  // unresolved and nothing they logged changed anything. Build it any other way
  // and the case rolls up amber on the OLD code, and the guard proves nothing.
  const goingBadly = assembleMission(inputs({
    tradelines: [derogatory, { ...clean, id: "t3", accountType: "COLLECTION", dateOfFirstDelinquency: new Date(NOW - 800 * 86400000) }],
    letters: [
      mailed({ id: "L1", mailedAt: new Date(NOW - 45 * 86400000), responseAt: new Date(NOW - 2 * 86400000), responseOutcome: "verified" }),
      mailed({ id: "L2", recipientName: "Equifax", parentLetterId: "L1", mailedAt: null }),
    ],
  }));
  check("HIGH-1/d: an active file with unresolved derogatories is NOT green", goingBadly.standing !== "green");
  check("HIGH-1/d: …and never reads NOT STARTED either", goingBadly.standing !== "unstarted");
  check("HIGH-1/d: …and the roll-up names the file, not just the workflow",
    /derogatory status/.test(goingBadly.health.find((h) => h.key === "file")?.message ?? ""));
  check("HIGH-1/d: …and reports that nothing the consumer logged actually changed",
    /None of the 1 logged response changed one/.test(goingBadly.health.find((h) => h.key === "file")?.message ?? ""));
  // The pure "every response came back verified" case, with a clean file.
  const allVerified = assembleMission(inputs({
    tradelines: [clean],
    letters: [
      mailed({ id: "L1", mailedAt: new Date(NOW - 45 * 86400000), responseAt: new Date(NOW - 2 * 86400000), responseOutcome: "verified" }),
      mailed({ id: "L2", recipientName: "Equifax", parentLetterId: "L1", mailedAt: null }),
    ],
  }));
  check("HIGH-1/d: responses that all came back verified are not a green case on their own",
    allVerified.standing !== "green");

  // (e) AD-4's exact scenario: letters mailed, report row deleted, window blown.
  const overdueNoReport = assembleMission(inputs({
    tradelines: [], reportCount: 0,
    kai: { ...emptyKai, lettersMailed: 2, deadlines: [{ letterId: "L1", recipient: "Equifax", round: 1, daysElapsed: 40, daysLeft: -10 }] },
    letters: [mailed({ id: "L1", mailedAt: new Date(NOW - 45 * 86400000) }), mailed({ id: "L2", recipientName: "Experian", mailedAt: new Date(NOW - 45 * 86400000) })],
  }));
  check("AD-4/e: a case with overdue windows NEVER reads NOT STARTED, even with no report row on file",
    overdueNoReport.standing !== "unstarted");
  check("AD-4/e: …it reads red, the loudest true thing", overdueNoReport.standing === "red");
  check("AD-4/e: …and the mission list leads with the overdue window, not an onboarding prompt",
    /window has passed/i.test(overdueNoReport.tasks[0]?.text ?? ""));
  check("AD-4/e: …while still asking for the report it genuinely needs",
    overdueNoReport.tasks.some((t) => /upload your credit report to get started/i.test(t.text)));
  check("AD-4/e: caseOnFile is the fact the band asks about, and it is true here",
    overdueNoReport.caseOnFile === true && overdueNoReport.hasReport === false);
  // The header's "N urgent" link targets #health inside the case summary, so
  // the summary has to be on the page in exactly this state.
  check("AD-4/e: the dashboard renders the case summary when letters exist without a report row (the #health anchor must resolve)",
    /const showCaseSummary = hasAnalysis \|\| \(data\.caseOnFile && !data\.hasReport\);/.test(dash) &&
    /\{showCaseSummary && <CommandCenter data=\{data\} \/>\}/.test(dash));

  // The band can never be quieter than its own signals — the structural
  // invariant, independent of which state anyone thought of.
  for (const [name, m] of [["empty", empty], ["unread", unread], ["healthy", healthy], ["goingBadly", goingBadly], ["overdueNoReport", overdueNoReport]] as const) {
    const worst = m.health.some((h) => h.status === "red") ? "red" : m.health.some((h) => h.status === "amber") ? "amber" : "green";
    check(`STANDING INVARIANT (${name}): "unstarted" never masks a non-green signal`,
      !(m.standing === "unstarted" && worst !== "green"));
  }
}

// ══ 3b2 · ONE date derivation, read by the roll-up too (S11 addendum 3) ══════
// Adopting S3's rc1/s3-s11-fix. A report that prints "03/2019" has a real date
// of first delinquency, but the persisted column cannot hold a month-precision
// value, so it is null. S3 made `reportedDofd()` the one derivation and taught
// `factualCondition` to read it. These assertions prove the S7 roll-up inherits
// that automatically — because HIGH-1's report-health signal asks
// `factualCondition`, the shared truth source, instead of reimplementing the
// fact test. A roll-up with its own private idea of "derogatory" would have
// gone on calling this file green.
{
  const monthPrecision = {
    id: "t1", resolved: false, accountType: "REVOLVING" as const,
    dateOfFirstDelinquency: null,
    bureauData: { EQUIFAX: { dofd: "03/2019" } },
  };
  const m = assembleMission(inputs({ tradelines: [monthPrecision] }));
  check("ADDENDUM-3: a month-precision DOFD the column cannot hold still counts as derogatory in report health",
    m.health.find((h) => h.key === "file")?.status === "amber");
  check("ADDENDUM-3: …so the case does not roll up green on a file the report says is delinquent",
    m.standing !== "green" && m.caseHealth !== "green");
  check("ADDENDUM-3: the roll-up reads the SHARED condition model rather than its own fact test",
    /factualCondition\(t\) === "DEROGATORY"/.test(mcEngine));
  // Kai's §605 sentence must not disagree with the engine that produced it.
  check("ADDENDUM-3: Kai's obsolescence copy derives its age from reportedDofd, not the raw column",
    /reportedDofd\(obsolete!\)/.test(kaiHome) &&
    !/yearsSince\(obsolete!\.dateOfFirstDelinquency\)/.test(kaiHome));
  check("ADDENDUM-3: …and when no date is readable it says so instead of asserting '0 years'",
    /not readable from your report/.test(kaiHome));
}

// ══ 3c · the mission engine states the read, not the misnomer (S11 MEDIUM-1) ══
{
  const unread = assembleMission(inputs({ tradelines: [], reportCount: 1 }));
  const intel = { hasReport: false, opportunities: [], profile: { confidence: "insufficient" } };
  const today = assembleMissions(intel as never, unread).today;
  check("MEDIUM-1: a report that parsed to zero accounts is never called 'No report on file.'",
    today !== null && !/no report on file/i.test(today.evidence));
  check("MEDIUM-1: …the evidence states what actually happened",
    /report is on file; no accounts were read/i.test(today?.evidence ?? ""));
  check("MEDIUM-1: …and the mission asks for a readable report rather than implying nothing was uploaded",
    /read/i.test(today?.title ?? "") && today?.title !== "Upload your credit reports");
  // A genuinely empty account keeps the original, correct sentence.
  const none = assembleMission(inputs({ tradelines: [], reportCount: 0 }));
  const noneToday = assembleMissions(intel as never, none).today;
  check("MEDIUM-1: an account with no report at all still says exactly that",
    noneToday?.evidence === "No report on file." && noneToday?.title === "Upload your credit reports");
}

// ══ 4 · no unearned watcher claims (C-06) ═════════════════════════════════════
{
  const kai: KaiHomeData = { ...emptyKai, lettersMailed: 1, deadlines: [{ letterId: "L1", recipient: "TransUnion", round: 1, daysElapsed: 12, daysLeft: 18 }] };
  const m = assembleMission(inputs({ kai }));
  const rendered = [
    ...m.automatic.map((a) => a.text),
    ...m.tasks.map((t) => t.text),
    ...m.health.map((h) => h.message),
    m.nextAction?.body ?? "", m.nextAction?.title ?? "",
  ].join(" ");
  check("C-06: no engine-rendered copy claims Kai is watching anything", !/watching/i.test(rendered));
  check("C-06: no engine-rendered copy claims windows are tracked/unlocked 'automatically'",
    !/automatically/i.test(rendered));
  check("C-06: the honest derivation is stated instead — counted, and shown when you open it",
    m.automatic.some((a) => /shown here each time you open/i.test(a.text)));
  check("C-06: lib/missionControl.ts carries no 'watching'/'automatically' claim in its copy",
    !/watching the clocks|tracked automatically|unlocks them automatically/i.test(mcEngine));
  // M-1: the ENGINE being clean is not the claim a consumer can read. This
  // sentence rendered for every consumer with an open §611 window — the
  // ordinary steady state of an active user — on the one surface D-6 just
  // made THE ranking. C-06 cannot be closed while it is on the screen.
  check("C-06: the rendered Mission Control surface claims no watcher either",
    !/watching/i.test(mcView));
  check("C-06: …and does not frame view-time derivations as background activity",
    !/Happening automatically/.test(mcView));
  check("C-06: …and still states the honest derivation in its place",
    /counted from the date you logged and shown here whenever you open CreditVector/.test(mcView));
  check("C-06: KaiPresence no longer tells a quiet-file consumer that it is being watched",
    !/I'm watching it/.test(presence) && !/Watching the \$\{ctx\.deadline\.recipient\}/.test(presence));
  check("C-06: …and no notification promise replaced it (D-12 is deferred — no watcher exists to promise)",
    !/(we|I|Kai)('| wi)?ll (alert|notify|email|text|remind)/i.test(presence));
}

// ══ 4b · continuity survives every unfinished letter state (S5 addendum) ═════
// "Continue where you left off" keyed on status === "GENERATED", which was
// complete when that was the only pre-mail state. S5 added a DRAFT edit state
// and made PRINTED mean approved, so a letter DISAPPEARED from the consumer's
// continuity block the moment they edited or approved it — the block dropped
// work at exactly the two moments the consumer had just touched it.
{
  const account = { id: "u1", fullName: "Rey Gabriel", name: null, isAgency: false, agencyName: null };
  // S11 NEW-3: these cases exercise the unfinished-STATUS vocabulary, so every
  // letter here is authorized — a real tradeline with a confirmation standing
  // behind it. The blocked shape is exercised in its own section below.
  const letter = (id: string, status: string, recipientName: string) => ({
    id, recipientName, status, mailedAt: null, createdAt: "2026-07-10T00:00:00.000Z",
    tradelineId: `tl-${id}`, activeAssertionCount: 1,
  });
  const session = assembleOperatorSession({
    account, client: null, kai: emptyKai, events: [], manifests: [],
    letters: [letter("l-draft", "DRAFT", "Equifax"), letter("l-gen", "GENERATED", "Experian"), letter("l-appr", "PRINTED", "TransUnion")],
    now: NOW,
  } as unknown as OperatorSessionInputs);
  const kinds = session.interruptedWork.map((w) => w.kind);
  check("S5: a DRAFT letter still appears in Continue-where-you-left-off", kinds.includes("letter_draft"));
  check("S5: a GENERATED letter still appears (unchanged)", kinds.includes("letter_unmailed"));
  check("S5: an approved (PRINTED) letter still appears", kinds.includes("letter_approved"));
  check("S5: all three unfinished letters are counted — none silently dropped", session.interruptedWork.length === 3);
  check("S5: each state gets its OWN words — a draft is never called 'generated and ready to mail'",
    session.interruptedWork.every((w) => {
      if (w.kind === "letter_draft") return /draft you were still editing/i.test(w.label) && !/ready to mail/i.test(w.label);
      if (w.kind === "letter_approved") return /approved and ready to print/i.test(w.label);
      return /generated and ready to mail/i.test(w.label);
    }));
  check("S5: every resume link is per-letter — sessionCloseOf de-dupes by href, so shared hrefs would undercount open work",
    new Set(session.interruptedWork.map((w) => w.resumeHref)).size === session.interruptedWork.length);
  check("S5: the session close counts all three as still open (no dishonest quiet state)",
    session.sessionClose.remaining.count === 3);
  // A mailed letter is progress, not interrupted work — the §611 clock owns it.
  const mailed = assembleOperatorSession({
    account, client: null, kai: emptyKai, events: [], manifests: [],
    letters: [{ ...letter("l-mail", "MAILED", "Equifax"), mailedAt: "2026-07-11T00:00:00.000Z" },
              letter("l-res", "RESOLVED", "Experian")],
    now: NOW,
  } as unknown as OperatorSessionInputs);
  check("S5: mailed and resolved letters are NOT continuity items", mailed.interruptedWork.length === 0);
}

// ══ 4c · a letter the SERVER refuses is never offered, and never green ═══════
// S11 NEW-3. Mission Control described drafts as "generated and ready to mail"
// for letters that approve/print/mail all 409, and then summarised the account
// as "ALL SYSTEMS GREEN … no action needed". Two populations reach that state:
// a consumer who WITHDREW the confirmation their letter was drafted from, and
// every letter drafted before confirmations existed (or whose report has since
// been deleted, orphaning it). Both are pinned, in both engines.
{
  const account = { id: "u1", fullName: "Rey Gabriel", name: null, isAgency: false, agencyName: null };
  const draft = (over: Record<string, unknown>) => ({
    id: "L1", recipientName: "Equifax Information Services LLC", status: "GENERATED",
    mailedAt: null, createdAt: "2026-07-10T00:00:00.000Z", tradelineId: "t1", activeAssertionCount: 1, ...over,
  });
  const session = (letters: unknown[]) => assembleOperatorSession({
    account, client: null, kai: emptyKai, events: [], manifests: [], letters, now: NOW,
  } as unknown as OperatorSessionInputs);

  // (a) WITHDRAWN — the tradeline is still there, the confirmation is not.
  const withdrawn = session([draft({ activeAssertionCount: 0 })]);
  check("NEW-3/a: a withdrawn-authorization letter is NOT described as ready to mail",
    !withdrawn.interruptedWork.some((w) => /ready to mail/i.test(w.label)));
  check("NEW-3/a: …it is described as on hold, and says why",
    withdrawn.interruptedWork[0]?.kind === "letter_blocked" &&
    /on hold until you confirm the facts/i.test(withdrawn.interruptedWork[0]?.label ?? ""));
  check("NEW-3/a: …and its next step is the page that can actually unblock it",
    withdrawn.interruptedWork[0]?.resumeHref === "/tradelines");
  check("NEW-3/a: …and it is still counted as open work, not silently dropped",
    withdrawn.sessionClose.remaining.count === 1);

  // (b) LEGACY — drafted before confirmations existed, so it never had one to
  // withdraw. Its tradeline is still on file; what is missing is any ACTIVE
  // assertion. Same arm of the rule as (a), different population, and the
  // refusal message is deliberately worded for both.
  const legacy = session([draft({ id: "L2", activeAssertionCount: 0 })]);
  check("NEW-3/b: a legacy letter that never had a confirmation is NOT described as ready to mail",
    !legacy.interruptedWork.some((w) => /ready to mail/i.test(w.label)));
  check("NEW-3/b: …it is on hold and names the confirmation as what is missing, without claiming one was withdrawn",
    legacy.interruptedWork[0]?.kind === "letter_blocked" &&
    /on hold until you confirm the facts/i.test(legacy.interruptedWork[0]?.label ?? "") &&
    !/withdrew|withdrawn/i.test(legacy.interruptedWork[0]?.label ?? ""));
  check("NEW-3/b: …and it is counted as open work", legacy.sessionClose.remaining.count === 1);

  // (c) ORPHANED — no tradeline at all (report deleted, or a letter that is not
  // about a tradeline). Whether that is REVOKED is S4/S5's rule to state, not
  // this guard's to assume: S5 is moving identity-correction letters, which
  // legitimately carry a null tradelineId, to AUTHORIZED. So the expectation is
  // DERIVED from letterAuthorization() rather than hardcoded — the property
  // being pinned is that the surface agrees with the server, whichever way the
  // rule reads. It still fails on the candidate, where the surface consults
  // nothing at all.
  const orphanInput = { mailedAt: null, tradelineId: null, activeAssertionCount: 0 };
  const orphanBlocked = letterAuthorization(orphanInput) === "REVOKED";
  const orphan = session([draft({ id: "L3", tradelineId: null, activeAssertionCount: 0 })]);
  const orphanItem = orphan.interruptedWork[0];
  check("NEW-3/c: a letter with no tradeline is presented exactly as letterAuthorization rules it",
    orphanBlocked
      ? orphanItem?.kind === "letter_blocked" && !/ready to mail/i.test(orphanItem?.label ?? "")
      : orphanItem?.kind === "letter_unmailed" && /generated and ready to mail/i.test(orphanItem?.label ?? ""));
  check("NEW-3/c: …and when it IS blocked, it does not send the consumer to a /tradelines page that has nothing to confirm",
    !orphanBlocked || (/no longer on your report/i.test(orphanItem?.label ?? "") && orphanItem?.resumeHref === "/upload"));

  // An authorized draft is untouched — the change is a refusal-aware split, not
  // a blanket downgrade of every draft.
  const fine = session([draft({})]);
  check("NEW-3: an authorized draft is still offered exactly as before",
    fine.interruptedWork[0]?.kind === "letter_unmailed" &&
    /generated and ready to mail/i.test(fine.interruptedWork[0]?.label ?? ""));
  // A MAILED letter is a RECORD and is never re-judged, whatever happened to
  // its confirmation afterwards (lib/letter.ts's HISTORICAL is terminal).
  const mailedAfterWithdrawal = session([draft({ id: "L3", status: "MAILED", mailedAt: "2026-07-11T00:00:00.000Z", activeAssertionCount: 0 })]);
  check("NEW-3: a MAILED letter is never re-judged as blocked",
    mailedAfterWithdrawal.interruptedWork.length === 0);

  // ── the roll-up ─────────────────────────────────────────────────────────
  const mcLetter = (over: Record<string, unknown>) => ({
    id: "L1", tradelineId: "t1", recipientName: "Equifax Information Services LLC",
    parentLetterId: null, responseAt: null, responseOutcome: null, mailedAt: null, ...over,
  });
  // Two blocked drafts under the rule as it stands: one confirmable (tradeline
  // on file, zero ACTIVE assertions) and one orphaned. The orphaned one is
  // included only for the roll-up assertions below, all of which hold whichever
  // way the orphan rule reads, because the confirmable one alone already makes
  // the account non-green.
  const blockedRollup = assembleMission(inputs({
    tradelines: [], reportCount: 0,
    letters: [mcLetter({}), mcLetter({ id: "L2", tradelineId: null })],
    activeAssertionCounts: {},
  }));
  check("NEW-3: an account holding only blocked letters is NOT summarised as green",
    blockedRollup.standing !== "green" && blockedRollup.caseHealth !== "green");
  check("NEW-3: …and never as NOT STARTED either — the drafts are on file",
    blockedRollup.standing !== "unstarted");
  check("NEW-3: …the roll-up names what is actually wrong",
    blockedRollup.health.find((h) => h.key === "authorization")?.status === "amber" &&
    /no confirmation standing behind/i.test(blockedRollup.health.find((h) => h.key === "authorization")?.message ?? ""));
  check("NEW-3: …the case signal no longer says no action is needed",
    !/no action needed/i.test(blockedRollup.health.find((h) => h.key === "case")?.message ?? ""));
  check("NEW-3: …the consumer is given the true next step for the confirmable draft",
    blockedRollup.tasks.some((t) => /Confirm the facts behind 1 dispute letter/.test(t.text) && t.href === "/tradelines"));
  check("NEW-3: …and for the orphaned one, a step that exists (only while the rule blocks it)",
    !orphanBlocked || blockedRollup.tasks.some((t) => /no longer on your report/.test(t.text) && t.href === "/upload"));
  check("NEW-3: no blocked draft is ever left without a next step",
    blockedRollup.tasks.filter((t) => t.href === "/tradelines" || t.href === "/upload").length > 0);
  check("NEW-3: both engines ask lib/letter.ts's letterAuthorization, never a second predicate",
    /letterAuthorization\(/.test(mcEngine) && /letterAuthorization\(/.test(stripComments(read("lib/operatorSession.ts"))));
  check("NEW-3: Kai's historical event line no longer asserts a letter is ready to mail now",
    !/generated and is ready to mail/.test(kaiHome));

  // A fully authorized case is still allowed to be green.
  const okRollup = assembleMission(inputs({
    tradelines: [{ id: "t1", resolved: false, accountType: "STUDENT_LOAN", dateOfFirstDelinquency: null }],
    letters: [mcLetter({})],
    activeAssertionCounts: { t1: 1 },
  }));
  check("NEW-3: a case whose drafts are all confirmed is still green", okRollup.standing === "green");
}

// ══ 5 · D-6 · task-first is the default; the entrance is opt-in ═══════════════
{
  // C-01 — the control exists on surfaces a real visitor reaches. Its only
  // mount used to be inside the founder walkthrough, behind a route that
  // 404s in production, so the documented opt-out was unreachable.
  check("C-01: the cinematic control is mounted in the public site footer",
    /<CinematicToggle \/>/.test(footer) && /from "@\/components\/cxos\/CinematicToggle"/.test(footer));
  check("C-01: …and inside the authenticated app shell",
    /<CinematicToggle\b/.test(shell) && /from "\.\/cxos\/CinematicToggle"/.test(shell));
  check("C-01/L-7: the in-app control is reachable at every viewport, not desktop-only",
    !/hidden sm:inline["\s]*>\s*<CinematicToggle/.test(shell) && !/hidden sm:inline/.test(shell));
  check("C-01: the AppShell mount did not displace the S2 session-conditional header work",
    /<NewDisputeCta \/>/.test(shell) && /import \{ NewDisputeCta \}/.test(shell));

  // D-6 — the persisted default is OFF. An entrance is a request the visitor
  // makes, never a toll the product charges.
  check("D-6: the capability policy exposes an explicit opt-IN predicate",
    /export function cinematicEntranceOptIn\(\)/.test(capability) &&
    /localStorage\.getItem\(CINEMATIC_PREF_KEY\) === "on"/.test(capability));
  check("D-6: the opt-in fails CLOSED — unreadable storage means no entrance",
    /catch \{\s*return false;\s*\}/.test(capability.slice(capability.indexOf("export function cinematicEntranceOptIn"))));
  check("D-6: the toggle persists the visitor's own choice through the policy's own writer",
    /setCinematicPreference\(next\)/.test(toggle) &&
    /localStorage\.setItem\(CINEMATIC_PREF_KEY, pref\)/.test(capability));
  // ── E-3 · the control renders the model it stores ────────────────────────
  // The preference has three meanings and the control rendered two, showing
  // "absent" (the RC1 task-first default, the ONLY state in which the
  // non-blocking tier ladder runs without an entrance) as "off" — and once
  // touched, "absent" was unreachable forever.
  check("E-3: all three stored states are offered",
    /value: "default"/.test(toggle) && /value: "on"/.test(toggle) && /value: "off"/.test(toggle));
  check("E-3: the RC1 default is a reachable CHOICE, labelled as the default",
    /Default \(task-first\)/.test(toggle));
  check("E-3: choosing the default REMOVES the key rather than storing a third literal — the stored vocabulary the rest of the policy reads is unchanged",
    /if \(pref === "default"\) localStorage\.removeItem\(CINEMATIC_PREF_KEY\)/.test(capability));
  check("E-3: the control is a labelled form control, not an unlabelled press-state",
    /<label htmlFor=\{id\}>/.test(toggle) && /<select/.test(toggle));
  check("E-3: reading and writing both go through the policy, so the control cannot invent a fourth state",
    /cinematicPreference\(\)/.test(toggle) && !/localStorage\./.test(toggle));
  // ── H-1 · the toggle must never stamp a tier it cannot drive ─────────────
  // `data-cxjourney` only SELECTS the tier-A/B choreography rules; `--cxp`
  // DRIVES them, and only JourneyRuntime writes it — from an effect that has
  // already returned early for a tier-D visitor. Stamping from the toggle made
  // those rules match at --cxp: 0, which is the START of the choreography, not
  // its rest state: the three classification chips computed to opacity 0, the
  // evidence spine stayed undrawn, and the alignment chapter froze mis-aligned
  // until a full page load. Absence is the guard, because the defect is the
  // presence of a stamp with no runtime behind it.
  check("H-1: the toggle never stamps data-cxjourney — it cannot set a tier it does not drive",
    !/setAttribute\(\s*"data-cxjourney"/.test(toggle));
  check("H-1: exactly ONE writer of data-cxjourney exists, and it is the runtime that owns --cxp",
    /html\.setAttribute\("data-cxjourney", active\)/.test(journeyRuntime) &&
    ![
      ["CinematicToggle.tsx", toggle], ["AppShell.tsx", shell], ["SiteFooter.tsx", footer],
      ["ThresholdGate.tsx", gate], ["Threshold.tsx", threshold], ["dashboard/page.tsx", dash],
    ].some(([, src]) => /setAttribute\(\s*"data-cxjourney"/.test(src)));
  check("H-1: the OFF direction still applies live — removing the stamp can only fall content back to rest",
    /removeAttribute\("data-cxjourney"\)/.test(toggle));
  check("H-1: any non-OFF choice discloses that it takes effect on the next visit, rather than silently requiring a reload",
    /setPending\(true\)/.test(toggle) && /Applies on your next visit/.test(toggle) && /role="status"/.test(toggle));
  check("H-1: OFF is still the ONLY choice that touches the DOM, and it only ever removes",
    (toggle.match(/document\.documentElement\./g) ?? []).length === 1 &&
    /next === "off"/.test(toggle));
  check("H-1: the toggle no longer imports the tier detector at all (it has no reason to know the tier)",
    !/detectTier/.test(toggle));

  // C-02 — the pre-paint blackout is IMPOSSIBLE without the opt-in, and the
  // opt-in is still subject to the same downgrade signals detectTier() uses.
  const inline = landing.slice(landing.indexOf("dangerouslySetInnerHTML"), landing.indexOf("<ThresholdGate"));
  check("C-02: the pre-paint blackout script requires the persisted opt-in",
    /localStorage\.getItem\("cx-cinematic"\)==="on"/.test(inline));
  check("C-02: …and honours Data Saver, the device-memory floor and the narrow-viewport downgrade",
    /saveData/.test(inline) && /deviceMemory/.test(inline) && /max-width: 768px/.test(inline));
  check("C-02: …and reduced motion still short-circuits it before anything is painted",
    /prefers-reduced-motion: reduce/.test(inline));
  check("C-02: the gate consults the SAME capability policy rather than its own signals",
    /detectTier\(\) !== "A"/.test(gate) && /!cinematicEntranceOptIn\(\)/.test(gate));
  check("C-02: the darkness is bounded in the gate, not only by the 12s CSS safety fade",
    /setTimeout\(lift, 1500\)/.test(gate));
  check("C-02: …and the CSS safety fade is still there beneath it",
    /cx-enter-safety/.test(globals));

  // C-03 / C-07 / C-13 — when the entrance IS taken, it is bounded and escapable.
  // ── C-03 / M-2 · measure the DURATION, not the constant ──────────────────
  // The earlier form of this check read `/const DUR = 3;/` and its label said
  // "capped at 3s". That constant is the RATE at which `target` reaches 1, not
  // the life of the overlay: `actual` follows `target` through an exponential
  // smoother, dismissal fires at actual > 0.999, and a fade runs after that.
  // The real observed life was ~4.5 s at 60 fps and past 5 s at 15 fps. So the
  // guard now replays the component's own advance model from the component's
  // own constants and asserts the PROPERTY the label claims.
  const num = (k: string) => {
    const m = threshold.match(new RegExp(`const ${k} = ([\\d.]+)`));
    return m ? Number(m[1]) : NaN;
  };
  const TOTAL_S = num("TOTAL_S"), FADE_S = num("FADE_S"), ALLOW_S = num("FRAME_ALLOWANCE_S"), WALK_S = num("WALK_S");
  const DUR_S = num("DUR");
  const CAP_S = TOTAL_S - FADE_S - ALLOW_S;
  check("C-03: the bound and the constants it derives from are all declared",
    [TOTAL_S, FADE_S, ALLOW_S, WALK_S, DUR_S].every((n) => Number.isFinite(n)) && TOTAL_S === 3);
  // Exact replay of the frame loop: `dt` clamped at 50 ms drives the walk, the
  // budget takes real elapsed time bounded at 2 frames, dismissal at
  // actual > 0.999 OR budget spent, then the fade.
  const modelOverlayLife = (fps: number): number => {
    const step = 1 / fps;
    let t = 0, target = 0, actual = 0, visible = 0;
    while (t < 30) {
      const dt = Math.min(0.05, step);
      visible += Math.min(step, ALLOW_S * 2);
      target = Math.min(1, target + dt / WALK_S);
      actual += (target - actual) * Math.min(1, dt * 4.5);
      t += step;
      if (actual > 0.999 || visible >= CAP_S) return t + FADE_S;
    }
    return Infinity;
  };
  const rates = [120, 60, 30, 20, 15, 10];
  check(`C-03: the MODELLED overlay life (walk + inertia tail + fade) is ≤ ${TOTAL_S}s at every frame rate from 10 to 120 fps — measured, not asserted`,
    rates.every((f) => modelOverlayLife(f) <= TOTAL_S + 1e-9));
  check("C-03: …and the freeze watchdog sits clear of every healthy dismissal (no console.warn on a merely slow device)",
    rates.every((f) => modelOverlayLife(f) < DUR_S + 2));
  check("C-03: the bound is ENFORCED in the loop, not merely implied by the rate",
    /visible >= VISIBLE_CAP_S/.test(threshold) && /const VISIBLE_CAP_S = TOTAL_S - FADE_S - FRAME_ALLOWANCE_S/.test(threshold));
  check("C-03: the budget counts VISIBLE time — a backgrounded tab is not charged to the visitor",
    /if \(!document\.hidden\) \{\s*visible \+=/.test(threshold));
  check("C-03: no code path re-lengthens the walk for mobile",
    !/mobile \? 8 : DUR/.test(threshold));
  check("C-03: the skip control is painted at t=0, not faded in over the first second",
    !/\.to\(q\("\.cxt-skip"\)/.test(threshold) && !/cxt-skip[^"]*opacity-0/.test(threshold));
  check("C-07: the overlay declares itself modal", /aria-modal="true"/.test(threshold));
  check("C-07: …and contains focus, so the painted-over landing is not tabbable behind it",
    /e\.key === "Tab"/.test(threshold) && /root\.contains\(active\)/.test(threshold));
  check("C-07: …the trap collects every focusable, not only buttons",
    /a\[href\], button:not\(\[disabled\]\)/.test(threshold));
  check("C-07: …and the page beneath is INERT, so AT that ignores aria-modal cannot reach it either",
    /el\.setAttribute\("inert", ""\)/.test(threshold) && /el\.contains\(root\)/.test(threshold));
  check("C-07: …and inert is lifted on every teardown path",
    (threshold.match(/removeAttribute\("inert"\)/g) ?? []).length >= 2);
  check("C-13: the 'already entered' memory is durable, not per-tab",
    /localStorage\.setItem\(THRESHOLD_SEEN_KEY, "1"\)/.test(threshold) &&
    /thresholdAlreadySeen\(\)/.test(gate));

  // C-10 / C-14
  check("C-10: the permanent rAF ambient field is not mounted on the primary authenticated screen",
    !dash.includes("<GxlField"));
  check("C-14: NEITHER /gxl route shows a non-admin a founder-only wall inside the app shell (lobby AND the URL-reachable room)",
    /if \(!\(await gxlGalleryAllowed\(\)\)\) notFound\(\);/.test(stripComments(gxlLobby)) &&
    /if \(!\(await gxlGalleryAllowed\(\)\)\) notFound\(\);/.test(gxlRoom) &&
    !/founder-only validation gallery/.test(stripComments(gxlLobby)) &&
    !/founder-only validation gallery/.test(gxlRoom));
}

// ══ 6 · reduced motion is UNCHANGED — the strongest path stays strongest ══════
// The reduced-motion consumer already had the better product: a complete,
// legible document instantly, with zero WebGL bytes fetched. D-6 gives every
// consumer that time-to-task; it must not cost the PRM consumer anything.
{
  check("PRM: reduced motion is tier D absolutely, ahead of every other signal including the opt-in",
    /if \(window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\) return "D";/.test(capability));
  const detect = capability.slice(capability.indexOf("export function detectTier"));
  check("PRM: …and nothing added below it can upgrade past it",
    detect.indexOf('prefers-reduced-motion') < detect.indexOf("cinematicDisabled()") &&
    detect.indexOf('prefers-reduced-motion') < detect.indexOf("saveData"));
  check("PRM: the gate returns before a single WebGL byte is fetched",
    gate.indexOf("prefers-reduced-motion") < gate.indexOf('import("./Threshold")'));
  check("PRM: the opt-in check is placed AFTER the reduced-motion return, never before it",
    gate.indexOf("prefers-reduced-motion") < gate.indexOf("cinematicEntranceOptIn()"));
  check("PRM: the toggle cannot override the browser preference (it writes a key detectTier reads AFTER PRM)",
    !/prefers-reduced-motion/.test(toggle));
  check("PRM: the landing's rest-state block is intact (reveal/aurora/cx-* neutralised)",
    /\.reveal \{[^}]*opacity: 1/.test(globals) &&
    /prefers-reduced-motion: reduce/.test(globals));
  check("PRM: the veil/entrance CSS backstops are still declared",
    /\.cx-mc-veil, \.cx-mc-leave \{ animation: none !important; display: none !important; \}/.test(globals));
}

console.log(`\ndashboard-ranking.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

export {};
