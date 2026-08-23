import Link from "next/link";
import { GraduationCap, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { currentUser, currentUserOrDemo, currentWorkspace } from "@/lib/session";
import { redirectToLogin } from "@/lib/requireSession";
import { getMissionControl } from "@/lib/missionControl";
import { loadSnapshot, assembleIntelligence } from "@/lib/intelligence";
import { assembleMissions } from "@/lib/missionEngine";
import { buildRoadmap } from "@/lib/roadmap";
import { buildBuilder } from "@/lib/builder";
import { financialGraph } from "@/lib/knowledge";
import { buildAcademy } from "@/lib/academy";
import { buildOperatorSession, type Altitude, type OperatorAccount, type WorkspaceClient } from "@/lib/operatorSession";
import { getAgencyRoster } from "@/lib/agencyRoster";
import { MissionControl } from "@/components/mission/MissionControl";
import { ArenaDoor } from "@/components/cxos/arena/ArenaDoor";
import { arenaAccessible } from "@/lib/arena/cohort";
import { readOwnProgress } from "@/lib/arena/ownProgress";
import { CommandHeader } from "@/components/cxos/mission/CommandHeader";
import { CommandCenter } from "@/components/mission/CommandCenter";
import { ReadinessStrip } from "@/components/mission/ReadinessStrip";
import { RoadmapView } from "@/components/mission/RoadmapView";
import { BuilderView } from "@/components/mission/BuilderView";
import { KnowledgeJourney } from "@/components/mission/KnowledgeJourney";
import { GxlPull } from "@/components/gxl/GxlPull";
import {
  SessionHeader, AccomplishmentPanel, ContinueWhereYouLeftOff, PriorityList, SessionCloseBlock,
} from "@/components/mission/SessionBlocks";
import gxl from "@/components/mission/mc.module.css";

export const dynamic = "force-dynamic";

// Mission Control (Sprint XIII; session-aware + altitude-routed as of Phase 1A,
// Agent B). The first screen after login and Kai's operating dashboard. It
// ORCHESTRATES the existing engines (Kai Home, Campaign, Mail, Case Memory, the
// §611 clock, scores, the Execution Engine) into one answer to: what should I
// do today, what am I waiting on, what's happening automatically, what happens
// next — PLUS the Operator Session Runtime (lib/operatorSession.ts), which
// makes the room know the PERSON doing the work, not only the case
// (SIM-REVIEW.md's verdict: "no room knows the person doing the work or the
// work itself as a unit").
//
// RC1 / Founder Decision D-6 (2026-08-23) — TASK-FIRST AT CONSUMER ALTITUDE.
// This screen used to compose FIVE independently-ranked answers to "what
// should I do next" (finding C-04), two of which provably disagreed: the
// Operator Session always puts kai.recommendation first, while Mission Control
// prefers an approved-but-unmailed campaign over it. Each surface was worded
// as THE one answer. There is now exactly one ranking at this altitude -
// MissionControl's "Today's mission" plus its single "Kai's next action",
// both read from the same `data` object - and the duplicates below are
// unmounted rather than reworded:
//
//   MissionEntry ....... the 7.3 s full-screen veil. Nothing in it is
//                        information the room beneath does not already show,
//                        and it also carried the over-claiming
//                        CLEARANCE/SYSTEMS register (C-05).
//   GxlField ........... a permanent rAF loop for a decorative field no task
//                        depends on (C-10).
//   PriorityList ....... ranking #2, and the one that disagrees with
//                        "Kai's next action" (C-04).
//   AccomplishmentPanel  } together these produced "Done today: 0 · Still
//   SessionCloseBlock .. } open: 1" beside "ALL SYSTEMS GREEN" (C-05).
//   ExecutiveQueue ..... ranking #3 ("Kai's one-list of what to do next").
//   MissionQueue ....... ranking #4.
//
// Every one of these components is KEPT and still compiles; CXOS is not
// abandoned. This is a mount-point decision, reversible by restoring the JSX -
// see the re-enable notes in the RC1 S7 report.
//
// Three renders by altitude, never mixed (SIM-REVIEW finding: Mission Control
// at agency altitude was 0/6 presentations, zero `isAgency` anywhere in the
// room or its engine — an owner was told to upload HER OWN report):
//   consumer     — today's case room, evolved with the session blocks below.
//   agency-owner — an agency has no case of its own: the session blocks + the
//                  Executive-Queue idiom over the roster ladder, NEVER the
//                  consumer's upload prompts / empty-states.
//   workspace    — the SAME case room as consumer, scoped to the open client
//                  (AgencyBar already names whose workspace this is — the
//                  greeting echoes it in words, it does not duplicate the bar).
export default async function DashboardPage() {
  const principal = await resolveDashboardPrincipal();
  // P0-5: an unresolved principal used to render the full shell around the
  // words "Please sign in." — no link, no redirect — and Mission Control is the
  // page a returning consumer lands on first. Leave for /login and come back.
  if (!principal) redirectToLogin("/dashboard");
  const { account, client } = principal;
  const altitude: Altitude = client ? "workspace" : account.isAgency ? "agency-owner" : "consumer";

  if (altitude === "agency-owner") {
    const roster = await getAgencyRoster(account.id);
    const session = await buildOperatorSession(account, { roster });
    return (
      <AppShell title="/ Mission Control">
        <div className={`${gxl.room} relative isolate -mx-5 -my-6 px-5 py-6`}>
          <EduBanner />
          <SessionHeader identity={session.identity} />
          <AccomplishmentPanel yesterday={session.yesterdayCompleted} today={session.todayCompleted} />
          <ContinueWhereYouLeftOff items={session.interruptedWork} />
          <PriorityList heading="Today's priorities" priorities={session.todaysPriorities} />
          <SessionCloseBlock close={session.sessionClose} />
          <Disclaimer />
        </div>
      </AppShell>
    );
  }

  // consumer or workspace altitude — the case room. `user` is the effective
  // data subject: the open client's own case in a workspace, otherwise the
  // account itself (identical to what currentUserOrDemo() resolved before this
  // change — see resolveDashboardPrincipal below).
  const user = client ?? account;

  // Load the CVI snapshot ONCE (Sprint XVIII) — CVI, the Mission Engine, the
  // Roadmap, and the Credit Builder all compose from it, so nothing is queried
  // twice. Mission Control and the Operator Session load their own views in
  // parallel.
  const [session, data, snap, knowledge] = await Promise.all([
    buildOperatorSession(account, { client }),
    getMissionControl(user.id, user),
    loadSnapshot(user.id),
    financialGraph(user.id),                          // the Knowledge Graph (link-only rows)
  ]);
  const intel = assembleIntelligence(snap);
  const mission = assembleMissions(intel, data);   // prioritized queue
  const roadmap = buildRoadmap(intel, mission, data); // the journey
  const builder = buildBuilder(snap, intel);          // the Credit Builder OS
  const academy = buildAcademy(snap); // pure over the already-loaded snapshot

  // D-6: the Execution Engine's assembleExecution() was called here purely to
  // feed the Executive Queue and the ambient GXL field, both of which this
  // altitude no longer mounts. It is not called, rather than called and
  // discarded — a per-request fold over every engine's output is real work,
  // and computing an answer nobody reads is how a second ranking quietly
  // grows back. lib/execution is untouched and its guard suite still runs;
  // restoring <ExecutiveQueue> means restoring this one line with it.

  // CXOS presentation layer needs a few identity fields (role, isAgency,
  // username, email) that the Operator Session runtime's OperatorAccount /
  // WorkspaceClient types intentionally omit — lib/operatorSession.ts's own
  // least-privilege view (frozen; not altered here). currentUser() /
  // currentWorkspace() (lib/session.ts) resolve unselected Prisma User rows,
  // so these fields are present on `user` at runtime; this reflects that real
  // shape for the CX layer only — no new query, no change to what
  // resolveDashboardPrincipal derives above.
  const cxUser = user as unknown as { role: string; isAgency: boolean; username: string | null; email: string; plan: string };

  // CXOS Phase 5 — the call: the Arena door renders ONLY when the real
  // server-side gate passes (flag + cohort). Outside the cohort: nothing.
  const cxArena = arenaAccessible(user) ? await readOwnProgress(user.id) : null;

  // CXOS Phase 4 — the command header runs on REAL resolved state only: the
  // user row, the deterministic health signals, and the engine's own standing.
  // Auth already succeeded (this render IS the proof).
  const cxRole = cxUser.role === "ADMIN" ? "ADMIN" : cxUser.isAgency ? "AGENCY" : "OPERATOR";
  const cxIdentity = cxUser.username ?? cxUser.email.split("@")[0];
  const cxHealth = data.health.map((h) => ({ label: h.label, status: h.status }));

  // RC1 S7 (A1-04): `data.hasReport` now answers "has a report been uploaded",
  // keyed on report rows the way lib/kaiHome.ts keys it — it used to be a
  // stand-in for "did extraction produce anything", which is a different
  // question. The panels below summarise EXTRACTED accounts, so they ask the
  // second question explicitly. This is the exact predicate they carried
  // before (`tradelines.length > 0`); nothing about when they render changes,
  // and an account whose report parsed to nothing is not shown five empty
  // summaries of a case that has no rows.
  const hasAnalysis = data.hasReport && !data.reportWithoutTradelines;

  return (
    <AppShell title="/ Mission Control">
      <div className={`${gxl.room} relative isolate -mx-5 -my-6 px-5 py-6`}>
        <GxlPull />
        <EduBanner />
        <SessionHeader identity={session.identity} />
        {/* Resumable work is not a ranking — it names work already in flight,
            and it is the one session block that says something MissionControl
            does not. It stays. */}
        <ContinueWhereYouLeftOff items={session.interruptedWork} />
        <CommandHeader
          firstName={data.firstName}
          identity={cxIdentity}
          role={cxRole}
          plan={cxUser.plan}
          health={cxHealth}
          standing={data.standing}
          capacity={data.capacity}
          isAgency={cxUser.isAgency}
        />
        {cxArena && <ArenaDoor totalXp={cxArena.standing.totalXp} level={cxArena.standing.level} />}
        {/* THE one ranking at consumer altitude: "Today's mission" + a single
            "Kai's next action", both derived from `data` in one place. */}
        <MissionControl data={data} />
        {/* The full operating-system summary appears once there's a case to
            summarize — a first-time user (no report yet), and a user whose
            report produced no accounts, both see only the single mission that
            actually helps them. */}
        {hasAnalysis && academy.nextLesson && (
          <Link href="/academy" className="mb-4 block">
            <div className="card flex items-center gap-3 p-4 transition-colors hover:bg-ink-800/40">
              <GraduationCap className="h-5 w-5 shrink-0 text-brand-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-brand-300">Continue learning · Academy</div>
                <div className="text-sm font-semibold text-slate-100">Level {academy.nextLesson.level} — {academy.nextLesson.title}</div>
                <div className="truncate text-[12px] text-slate-400">{academy.nextLesson.connection ?? academy.nextLesson.summary}</div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            </div>
          </Link>
        )}
        {hasAnalysis && <RoadmapView roadmap={roadmap} />}
        {hasAnalysis && <KnowledgeJourney knowledge={knowledge} />}
        {hasAnalysis && <BuilderView builder={builder} />}
        {hasAnalysis && <ReadinessStrip intel={intel} />}
        {hasAnalysis && <CommandCenter data={data} />}
        <Disclaimer />
      </div>
    </AppShell>
  );
}

// ---- principal resolution (altitude routing) -------------------------------------

// Resolves the SAME effective account/client every other authenticated route
// resolves (lib/session.ts) — but returns the real signed-in `account` even
// when a workspace client is open, because Mission Control needs BOTH:
// `account` for isAgency/greeting/altitude, `client` for the case scope.
// Reuses currentWorkspace()/currentUser()/currentUserOrDemo() verbatim; this
// function never re-derives auth, agency ownership, or admin impersonation —
// it only distinguishes WHICH of those three already-verified resolutions
// applies, by comparing the ids they returned.
async function resolveDashboardPrincipal(): Promise<{ account: OperatorAccount; client: WorkspaceClient | null } | null> {
  const [{ account, client }, resolvedUser] = await Promise.all([currentWorkspace(), currentUser()]);
  if (account) {
    if (resolvedUser && resolvedUser.id !== account.id && resolvedUser.id !== client?.id) {
      // Admin impersonation is active — currentUser()'s own precedence already
      // resolved and verified the target, overriding the agency/workspace
      // branch entirely (mirrors lib/session.ts currentUser() exactly). Render
      // Mission Control AS the impersonated user, same as every other page.
      return { account: resolvedUser, client: null };
    }
    return { account, client };
  }
  const demo = await currentUserOrDemo(); // no-op in production; dev-only fallback
  return demo ? { account: demo, client: null } : null;
}
