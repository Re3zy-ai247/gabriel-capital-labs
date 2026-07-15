import { AppShell } from "@/components/AppShell";
import { Disclaimer } from "@/components/Disclaimer";
import { currentUserOrDemo } from "@/lib/session";
import { loadSnapshot } from "@/lib/intelligence";
import { financialGraph } from "@/lib/knowledge";
import { buildAcademy } from "@/lib/academy";
import { AcademyView } from "@/components/academy/AcademyView";
import { KnowledgeJourney } from "@/components/mission/KnowledgeJourney";

export const dynamic = "force-dynamic";

// CreditVector Academy (Sprint XXI, Phase 3) — the progressive learning path and the
// restored, elevated Knowledge Journey. Reuses the CVI snapshot + Knowledge Graph
// loaders (no new query); the Academy engine is pure over the snapshot.
export default async function AcademyPage() {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Academy"><p className="text-slate-400">Please sign in.</p></AppShell>;

  const [snap, knowledge] = await Promise.all([loadSnapshot(user.id), financialGraph(user.id)]);
  const academy = buildAcademy(snap);

  return (
    <AppShell title="/ Academy">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">CreditVector Academy</h2>
        <p className="mt-1 text-sm text-slate-400">Understand your credit, your rights, and your dispute process — one level at a time, connected to your own file.</p>
      </div>
      <AcademyView academy={academy} />
      {academy.hasReport && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-slate-400">Your connected journey</h3>
          <p className="mb-3 text-[12px] text-slate-500">How your recommendations, campaigns, letters, responses, and outcomes link together — built from your real records.</p>
          <KnowledgeJourney knowledge={knowledge} />
        </div>
      )}
      <Disclaimer />
    </AppShell>
  );
}
