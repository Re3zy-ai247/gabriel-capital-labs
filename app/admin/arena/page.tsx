import { AppShell } from "@/components/AppShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { readAllOutcomeRows } from "@/lib/arena/read";
import { aggregateStats } from "@/lib/arena/project";
import { ARENA_CLASSES, ARENA_POLICY_VERSION, REFUSED_V1, PROHIBITED_XP_SOURCES } from "@/lib/arena/policy";
import { arenaEnabled } from "@/lib/arena/flags";
import { Trophy, ShieldCheck, Ban } from "lucide-react";

export const dynamic = "force-dynamic";

// Arena admin inspector (Wave 3). Admin-only — the /admin layout gates the whole
// area fail-closed. It demonstrates the pure XP engine on REAL production outcome
// data, but exposes ONLY aggregate integers: counts, never people, never a ranking,
// never an outcome detail. That is deliberate — a per-user ranking of dispute
// outcomes is a CROA/FTC implied-results surface and is refused until display
// consent + CCO sign-off exist. This page proves the engine works without becoming
// the surface the engine's own policy forbids.

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tnum text-slate-100">{value}</div>
    </div>
  );
}

export default async function ArenaAdminPage() {
  const rows = await readAllOutcomeRows();
  const agg = aggregateStats(rows);
  const live = Object.values(ARENA_CLASSES).filter((c) => c.live);
  const pending = Object.values(ARENA_CLASSES).filter((c) => !c.live);

  return (
    <AppShell title="/ Arena (admin inspector)">
      <AdminTabs />
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-100">
            <Trophy className="h-5 w-5 text-brand-300" aria-hidden /> Arena — policy v{ARENA_POLICY_VERSION}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            The XP engine, run on real verified-outcome data. Aggregate integers only — no ranking, no identity, no outcome detail.
            User-facing surface is <span className="font-mono">{arenaEnabled() ? "ENABLED" : "flag OFF (dormant)"}</span>.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Qualifying operators" value={agg.qualifyingUsers} />
          <Stat label="Total awards" value={agg.totalAwards} />
          <Stat label="Favorable awards" value={agg.favorableAwards} />
          <Stat label="Total XP (platform)" value={agg.totalXp} />
        </div>

        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-200">Live contribution classes (evidence-backed)</h2>
          </div>
          <ul className="space-y-2">
            {live.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-ink-700/60 p-3 text-xs">
                <span className="font-mono font-semibold text-slate-200">{c.id}</span>
                <span className="text-slate-300">{c.label}</span>
                <span className="rounded bg-ink-700/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">{c.baseXp} XP · {c.evidenceClass}</span>
                <span className="ml-auto w-full text-[11px] text-slate-500 sm:w-auto sm:max-w-[60%]">{c.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Ban className="h-4 w-4 text-slate-500" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-200">Pending / refused (never scored in v1)</h2>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-400">
            {pending.map((c) => (
              <li key={c.id}><span className="font-mono text-slate-300">{c.id}</span> — {c.note}</li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-slate-500">
            Refused surfaces (v1): {REFUSED_V1.join(" · ")}. Prohibited XP sources: {PROHIBITED_XP_SOURCES.length} declared and asserted (login, message-count, page-open, kai_event, …).
          </p>
        </section>

        <p className="text-[11px] text-slate-500">
          Every number derives from the existing outcome ledger via a pure fold. No new table, no writer, no ranking — reconcile-on-read, so a revised outcome is reflected automatically.
        </p>
      </div>
    </AppShell>
  );
}
