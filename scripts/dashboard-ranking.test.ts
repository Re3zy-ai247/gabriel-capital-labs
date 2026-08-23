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
import { assembleMission, type MissionInputs } from "../lib/missionControl";
import type { KaiHomeData } from "../lib/kaiHome";
import { pickRecommendation } from "../lib/kaiHome";
import type { ComposedCampaign } from "../lib/campaign";
import { DEFAULT_CAMPAIGN_POLICY } from "../lib/campaign";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
// Comment-stripped, because every absence assertion below is otherwise
// defeated by the comment that explains the absence.
const stripComments = (src: string) =>
  src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

// Every source read below is comment-stripped. This is not tidiness: an
// absence assertion measured on raw source is DEFEATED by the comment that
// explains the absence (the removed copy is quoted in the note that records
// why it was removed), and an ordering assertion is defeated by a doc block
// that names the thing it orders. The one exception is the landing's inline
// entry script, which is a string literal inside JSX and carries no comments.
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
const globals = read("app/globals.css");
const gxlLobby = read("app/gxl/page.tsx");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const NOW = new Date("2026-07-14T00:00:00.000Z").getTime();
const emptyKai: KaiHomeData = { overnight: [], recommendation: null, deadlines: [], recentEvents: [], responsesReceived: 0, lettersMailed: 0 };
const emptyComposed: ComposedCampaign = { strategyFamily: "mixed", items: [], rationale: "", warnings: [], nextUnlock: [], hasRecommendation: false };
function inputs(over: Partial<MissionInputs> = {}): MissionInputs {
  return {
    user: { fullName: "Rey Gabriel" }, kai: emptyKai, caseMemory: null, campaigns: [], composed: emptyComposed,
    tradelines: [{ id: "t1", resolved: false, accountType: "CHARGE_OFF", dateOfFirstDelinquency: new Date(NOW - 1000 * 86400000) }],
    letters: [], scoreEntries: [], nextSeq: 1, reportCount: 1, policy: DEFAULT_CAMPAIGN_POLICY, now: NOW, ...over,
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
  check("A1-04: the room does not read as quiet — timeline health is amber",
    m.health.find((h) => h.key === "timeline")?.status === "amber");
  check("A1-04: …and the case roll-up is not green", m.standing !== "green" && m.caseHealth !== "green");
  // The re-derivation of hasReport must not leak into the panels that
  // summarise EXTRACTED accounts — an account with no rows must not be shown
  // five empty summaries of a case that has none.
  check("A1-04: the analysis panels ask about extraction, not about upload",
    /const hasAnalysis = data\.hasReport && !data\.reportWithoutTradelines;/.test(dash));
  for (const panel of ["<RoadmapView", "<KnowledgeJourney", "<BuilderView", "<ReadinessStrip", "<CommandCenter"]) {
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
  const healthy = assembleMission(inputs());
  check("C-05: a started account with nothing outstanding is still green", healthy.standing === "green");
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
  check("C-06: KaiPresence no longer tells a quiet-file consumer that it is being watched",
    !/I'm watching it/.test(presence) && !/Watching the \$\{ctx\.deadline\.recipient\}/.test(presence));
  check("C-06: …and no notification promise replaced it (D-12 is deferred — no watcher exists to promise)",
    !/(we|I|Kai)('| wi)?ll (alert|notify|email|text|remind)/i.test(presence));
}

// ══ 5 · D-6 · task-first is the default; the entrance is opt-in ═══════════════
{
  // C-01 — the control exists on surfaces a real visitor reaches. Its only
  // mount used to be inside the founder walkthrough, behind a route that
  // 404s in production, so the documented opt-out was unreachable.
  check("C-01: the cinematic control is mounted in the public site footer",
    /<CinematicToggle \/>/.test(footer) && /from "@\/components\/cxos\/CinematicToggle"/.test(footer));
  check("C-01: …and inside the authenticated app shell",
    /<CinematicToggle \/>/.test(shell) && /from "\.\/cxos\/CinematicToggle"/.test(shell));
  check("C-01: the AppShell mount did not displace the S2 session-conditional header work",
    /<NewDisputeCta \/>/.test(shell) && /import \{ NewDisputeCta \}/.test(shell));

  // D-6 — the persisted default is OFF. An entrance is a request the visitor
  // makes, never a toll the product charges.
  check("D-6: the capability policy exposes an explicit opt-IN predicate",
    /export function cinematicEntranceOptIn\(\)/.test(capability) &&
    /localStorage\.getItem\(CINEMATIC_PREF_KEY\) === "on"/.test(capability));
  check("D-6: the opt-in fails CLOSED — unreadable storage means no entrance",
    /catch \{\s*return false;\s*\}/.test(capability.slice(capability.indexOf("export function cinematicEntranceOptIn"))));
  check("D-6: the toggle persists the visitor's own choice in both directions",
    /localStorage\.setItem\(CINEMATIC_PREF_KEY, next \? "on" : "off"\)/.test(toggle));
  check("C-11: the choice applies LIVE in the 'on' direction too (no silent reload requirement)",
    /setAttribute\("data-cxjourney", detectTier\(\)\)/.test(toggle));

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
  check("C-03: the entrance is capped at 3s", /const DUR = 3;/.test(threshold));
  check("C-03: no code path re-lengthens the walk for mobile",
    !/mobile \? 8 : DUR/.test(threshold));
  check("C-03: the skip control is painted at t=0, not faded in over the first second",
    !/\.to\(q\("\.cxt-skip"\)/.test(threshold) && !/cxt-skip[^"]*opacity-0/.test(threshold));
  check("C-07: the overlay declares itself modal", /aria-modal="true"/.test(threshold));
  check("C-07: …and contains focus, so the painted-over landing is not tabbable behind it",
    /e\.key === "Tab"/.test(threshold) && /root\.contains\(active\)/.test(threshold));
  check("C-13: the 'already entered' memory is durable, not per-tab",
    /localStorage\.setItem\(THRESHOLD_SEEN_KEY, "1"\)/.test(threshold) &&
    /thresholdAlreadySeen\(\)/.test(gate));

  // C-10 / C-14
  check("C-10: the permanent rAF ambient field is not mounted on the primary authenticated screen",
    !dash.includes("<GxlField"));
  check("C-14: /gxl does not show a non-admin a founder-only wall inside the app shell",
    /notFound\(\)/.test(gxlLobby) && !/founder-only validation gallery/.test(stripComments(gxlLobby)));
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
