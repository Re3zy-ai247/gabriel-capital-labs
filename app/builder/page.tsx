import { AppShell } from "@/components/AppShell";
import { Disclaimer } from "@/components/Disclaimer";
import { currentUserOrDemo } from "@/lib/session";
import { loadSnapshot, assembleIntelligence } from "@/lib/intelligence";
import { buildBuilder } from "@/lib/builder";
import { builderPlanners } from "@/lib/builder/education";
import { ReadinessStrip } from "@/components/mission/ReadinessStrip";
import { BuilderView } from "@/components/mission/BuilderView";
import { BuilderPlanners } from "@/components/mission/BuilderPlanners";

export const dynamic = "force-dynamic";

// Credit Builder OS (Sprint XXI, Phase 2) — the restored, dedicated Credit Builder
// page: readiness + the Builder Engine's data-driven recommendations + the
// educational planning tools. Reuses the CVI snapshot loader once (no new query);
// every module composes from it.
export default async function BuilderPage() {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Credit Builder"><p className="text-slate-400">Please sign in.</p></AppShell>;

  const snap = await loadSnapshot(user.id);
  const intel = assembleIntelligence(snap);
  const builder = buildBuilder(snap, intel);
  const planners = builderPlanners(snap);

  return (
    <AppShell title="/ Credit Builder">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Credit Builder</h2>
        <p className="mt-1 text-sm text-slate-400">Repair is only half the journey. This is where you build — readiness, the moves that strengthen your file, and how each factor works.</p>
      </div>
      {snap.hasReport && <ReadinessStrip intel={intel} />}
      <BuilderView builder={builder} />
      <BuilderPlanners planners={planners} />
      <Disclaimer />
    </AppShell>
  );
}
