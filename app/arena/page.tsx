import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { currentUser } from "@/lib/session";
import { arenaAccessible } from "@/lib/arena/cohort";
import { readOwnProgress } from "@/lib/arena/ownProgress";
import { REFUSED_V1 } from "@/lib/arena/policy";
import { Trophy, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

// Arena — a member's OWN progression. Own-data only: it reads only this user's
// verified outcomes (gate-free, like their own track record), and shows no other
// user, no ranking, no cross-user comparison. Gated by the internal cohort — the
// flag being ON is not enough; the account must be in the cohort, checked
// server-side here. Outside the cohort (or flag OFF) redirects away, so there is no
// UI-visibility-only gate and no hidden data path.

function Meter({ into, span }: { into: number; span: number }) {
  const pct = span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100;
  return (
    <div className="mt-2">
      <div className="h-2 overflow-hidden rounded-full bg-ink-700/60">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-slate-500 tnum">{into} / {span} XP to next level</div>
    </div>
  );
}

export default async function ArenaPage() {
  const user = await currentUser();
  // Server-authoritative gate. Not in cohort (or flag OFF) => not here.
  if (!arenaAccessible(user)) redirect("/dashboard");

  const p = await readOwnProgress(user!.id);
  const s = p.standing;

  return (
    <AppShell title="/ Arena">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-brand-300" aria-hidden />
                <h1 className="text-lg font-semibold text-slate-100">Your progression</h1>
              </div>
              <p className="mt-1 text-sm capitalize text-slate-400">{s.rank} · Level {s.level}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold tnum text-slate-100">{s.totalXp}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">total XP</div>
            </div>
          </div>
          <Meter into={p.xpIntoLevel} span={p.xpForNextLevel} />
          {s.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {s.badges.map((b) => (
                <span key={b} className="rounded-full bg-brand-500/15 px-2.5 py-1 text-[11px] font-semibold text-brand-300">{b}</span>
              ))}
            </div>
          )}
        </div>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Award history</h2>
          {p.awards.length === 0 ? (
            <div className="rounded-lg border border-ink-700/60 p-5 text-center">
              <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-slate-600" aria-hidden />
              <p className="text-sm text-slate-400">
                No XP yet. Only <strong>evidenced activity</strong> counts — logging a real bureau
                response to a dispute earns XP. Nothing is awarded for signing in, posting, or opening pages.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-ink-700/40">
              {p.awards.map((a) => (
                <li key={a.letterId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-slate-300">{a.classLabel}</span>
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-ink-700/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{a.evidenceClass}</span>
                    <span className="tnum font-semibold text-slate-100">+{a.xp}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-[11px] leading-relaxed text-slate-500">
          Policy v{p.policyVersion}. XP is derived from your own verified evidence and updates automatically if an
          outcome is revised. Evidence from AI-classified responses is <strong>documented</strong>, not verified — a
          higher tier would need independent confirmation the platform does not collect today. Not shown here (v1):{" "}
          {REFUSED_V1.join(", ").replace(/_/g, " ")}. This is your own record, not a prediction of results.
        </p>
      </div>
    </AppShell>
  );
}
