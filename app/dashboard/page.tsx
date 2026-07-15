import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { currentUserOrDemo } from "@/lib/session";
import { getMissionControl } from "@/lib/missionControl";
import { loadSnapshot, assembleIntelligence } from "@/lib/intelligence";
import { assembleMissions } from "@/lib/missionEngine";
import { buildRoadmap } from "@/lib/roadmap";
import { buildBuilder } from "@/lib/builder";
import { financialGraph } from "@/lib/knowledge";
import { assembleExecution } from "@/lib/execution";
import { MissionControl } from "@/components/mission/MissionControl";
import { ExecutiveQueue } from "@/components/mission/ExecutiveQueue";
import { CommandCenter } from "@/components/mission/CommandCenter";
import { ReadinessStrip } from "@/components/mission/ReadinessStrip";
import { MissionQueue } from "@/components/mission/MissionQueue";
import { RoadmapView } from "@/components/mission/RoadmapView";
import { BuilderView } from "@/components/mission/BuilderView";
import { KnowledgeJourney } from "@/components/mission/KnowledgeJourney";

export const dynamic = "force-dynamic";

// Mission Control (Sprint XIII) — the first screen after login and Kai's operating
// dashboard. It ORCHESTRATES the existing engines (Kai Home, Campaign, Mail, Case
// Memory, the §611 clock, scores) into one answer to: what should I do today, what
// am I waiting on, what's happening automatically, what happens next. Zero AI,
// zero fabricated data — every line is a receipt from the deterministic engines.
export default async function DashboardPage() {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Mission Control"><p className="text-slate-400">Please sign in.</p></AppShell>;

  // Load the CVI snapshot ONCE (Sprint XVIII) — CVI, the Mission Engine, the
  // Roadmap, and the Credit Builder all compose from it, so nothing is queried
  // twice. Mission Control loads its own view in parallel.
  const [data, snap, knowledge] = await Promise.all([
    getMissionControl(user.id, user),
    loadSnapshot(user.id),
    financialGraph(user.id),                          // the Knowledge Graph (link-only rows)
  ]);
  const intel = assembleIntelligence(snap);
  const mission = assembleMissions(intel, data);   // prioritized queue
  const roadmap = buildRoadmap(intel, mission, data); // the journey
  const builder = buildBuilder(snap, intel);          // the Credit Builder OS
  // The Execution Engine (Sprint XX) orchestrates all of the above into ONE
  // Executive Queue — pure, no new query, composed from the already-loaded engines.
  const execution = assembleExecution({ intel, mission, roadmap, builder, knowledge, mc: data, snap });

  return (
    <AppShell title="/ Mission Control">
      <EduBanner />
      <MissionControl data={data} />
      {/* The full operating-system summary appears once there's a case to summarize —
          a first-time user (no report yet) sees only the single upload mission. */}
      {data.hasReport && <ExecutiveQueue execution={execution} />}
      {data.hasReport && <MissionQueue mission={mission} />}
      {data.hasReport && <RoadmapView roadmap={roadmap} />}
      {data.hasReport && <KnowledgeJourney knowledge={knowledge} />}
      {data.hasReport && <BuilderView builder={builder} />}
      {data.hasReport && <ReadinessStrip intel={intel} />}
      {data.hasReport && <CommandCenter data={data} />}
      <Disclaimer />
    </AppShell>
  );
}
