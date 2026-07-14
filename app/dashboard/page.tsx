import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { currentUserOrDemo } from "@/lib/session";
import { getMissionControl } from "@/lib/missionControl";
import { MissionControl } from "@/components/mission/MissionControl";
import { CommandCenter } from "@/components/mission/CommandCenter";

export const dynamic = "force-dynamic";

// Mission Control (Sprint XIII) — the first screen after login and Kai's operating
// dashboard. It ORCHESTRATES the existing engines (Kai Home, Campaign, Mail, Case
// Memory, the §611 clock, scores) into one answer to: what should I do today, what
// am I waiting on, what's happening automatically, what happens next. Zero AI,
// zero fabricated data — every line is a receipt from the deterministic engines.
export default async function DashboardPage() {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Mission Control"><p className="text-slate-400">Please sign in.</p></AppShell>;

  const data = await getMissionControl(user.id, user);

  return (
    <AppShell title="/ Mission Control">
      <EduBanner />
      <MissionControl data={data} />
      {/* The full operating-system summary appears once there's a case to summarize —
          a first-time user (no report yet) sees only the single upload mission. */}
      {data.hasReport && <CommandCenter data={data} />}
      <Disclaimer />
    </AppShell>
  );
}
