import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { StatCard } from "@/components/ui/StatCard";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { BUREAU_LABEL } from "@/lib/bureaus";
import { yearsSince } from "@/lib/utils";
import type { Bureau } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Dashboard"><p className="text-slate-400">Please sign in.</p></AppShell>;

  const [tradelines, letters, reports] = await Promise.all([
    prisma.tradeline.findMany({ where: { userId: user.id } }),
    prisma.letter.findMany({ where: { userId: user.id } }),
    prisma.report.findMany({ where: { userId: user.id } }),
  ]);

  // Single source of truth — every metric derives from these arrays so they reconcile.
  const negative = tradelines.length;
  const resolved = tradelines.filter((t) => t.resolved).length;
  const disputedIds = new Set(letters.map((l) => l.tradelineId).filter(Boolean));
  const disputed = disputedIds.size;
  const active = tradelines.filter((t) => disputedIds.has(t.id) && !t.resolved).length;
  const completion = negative ? Math.round((resolved / negative) * 100) : 0;

  // Quick wins: items past the 7-year FCRA §605 reporting window are the cleanest
  // removals (must drop off), so they should be attacked first. Computed from the
  // date of first delinquency on each unresolved item.
  const aged = tradelines
    .filter((t) => !t.resolved)
    .map((t) => ({ t, yrs: yearsSince(t.dateOfFirstDelinquency) }))
    .filter((x): x is { t: (typeof tradelines)[number]; yrs: number } => x.yrs != null);
  const obsolete = aged.filter((x) => x.yrs >= 7).sort((a, b) => b.yrs - a.yrs);
  const nearObsolete = aged.filter((x) => x.yrs >= 6 && x.yrs < 7);

  // Follow-up clock (same logic the agency roster uses, for the user's own
  // disputes): a mailed letter triggers the ~30-day FCRA reinvestigation window,
  // after which it's time to escalate to the next round.
  const DAY = 86_400_000;
  const nowMs = Date.now();
  const followUps = letters
    .filter((l) => l.mailedAt)
    .map((l) => ({ l, days: Math.floor((nowMs - new Date(l.mailedAt as Date).getTime()) / DAY) }))
    .filter((x) => x.days >= 20)
    .sort((a, b) => b.days - a.days);
  const firstName = (user.fullName || user.name || "").trim().split(" ")[0] || "there";

  const byBureau = (b: Bureau) => {
    const inB = tradelines.filter((t) => {
      const d = t.bureauData as Record<string, { presence?: string }>;
      return d?.[b]?.presence === "PRESENT";
    });
    const res = inB.filter((t) => t.resolved).length;
    return { total: inB.length, resolved: res };
  };

  return (
    <AppShell title="/ Dashboard">
      <EduBanner />
      <div className="mb-4 animate-rise">
        <h2 className="text-2xl font-bold">Welcome back, {firstName} 👋</h2>
        <p className="text-sm text-slate-400">Here&apos;s where your disputes stand today.</p>
      </div>

      {followUps.length > 0 && (
        <div className="card animate-rise mb-4 border-gold-500/30 bg-gold-500/[0.05] p-5">
          <div className="text-sm font-semibold text-gold-300">⏱ Disputes awaiting follow-up</div>
          <p className="mt-1 text-xs text-slate-400">
            The bureau has ~30 days to reinvestigate after a dispute is mailed. When that passes, escalate to the next round.
          </p>
          <div className="mt-3 space-y-2">
            {followUps.slice(0, 6).map(({ l, days }) => {
              const due = days >= 30 && !l.responseText;
              return (
                <div
                  key={l.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                    due ? "border-rose-500/40 bg-rose-500/[0.05]" : "border-ink-700/70"
                  }`}
                >
                  <div className="min-w-0 text-sm">
                    <span className="font-medium">{l.recipientName}</span>
                    <span className="ml-2 text-[11px] text-slate-500">Round {l.round} · day {days}</span>
                  </div>
                  <Link
                    href="/letters"
                    className={`shrink-0 text-xs font-semibold ${due ? "text-rose-300" : "text-slate-400"} hover:underline`}
                  >
                    {due ? "Ready for next round →" : `Due in ${Math.max(0, 30 - days)}d`}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reports.length === 0 && (
        <div className="card mb-4 flex flex-col items-start gap-3 border-brand-500/30 bg-brand-500/5 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-semibold">Let&apos;s get started 👋</div>
            <p className="mt-1 text-sm text-slate-400">
              Upload your credit report and we&apos;ll analyze every account, flag what can be disputed, and draft your letters.
            </p>
          </div>
          <Link href="/upload" className="btn-primary shrink-0">Upload your report</Link>
        </div>
      )}

      {obsolete.length > 0 && (
        <div className="card mb-4 border-emerald-500/30 bg-emerald-500/[0.06] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            ⚡ Quick Wins — easiest deletions first
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            {obsolete.length} item{obsolete.length === 1 ? " is" : "s are"} past the 7-year FCRA reporting window (§605)
            and must drop off your report. These are the cleanest removals — dispute them first for the fastest visible
            improvement.
          </p>
          <div className="mt-3 space-y-2">
            {obsolete.slice(0, 6).map(({ t, yrs }) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700/70 bg-ink-900/40 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.creditorName}</div>
                  <div className="text-[11px] text-slate-500">
                    First delinquency ~{Math.floor(yrs)} years ago · obsolete under FCRA §605
                  </div>
                </div>
                <Link
                  href={`/letters?tradeline=${t.id}&strategy=fcra_605`}
                  className="btn-primary shrink-0 !py-1.5 text-xs"
                >
                  Dispute as obsolete →
                </Link>
              </div>
            ))}
          </div>
          {(obsolete.length > 6 || nearObsolete.length > 0) && (
            <p className="mt-3 text-[11px] text-slate-500">
              {obsolete.length > 6 ? `+ ${obsolete.length - 6} more obsolete item(s). ` : ""}
              {nearObsolete.length > 0
                ? `${nearObsolete.length} item(s) are approaching the window (6+ years) — queue these next.`
                : ""}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Negative Items" value={negative} accent="rose" />
        <StatCard label="Items Disputed" value={disputed} accent="slate" />
        <StatCard label="Active Disputes" value={active} accent="gold" />
        <StatCard label="Letters Generated" value={letters.length} accent="brand" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400">Dispute Completion</div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-3xl font-bold text-brand-400">{completion}%</div>
            <div className="pb-1 text-xs text-slate-500">{resolved} of {negative} items resolved</div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full bg-brand-500" style={{ width: `${completion}%` }} />
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400">Est. Points Recovered</div>
          <div className="mt-2 text-3xl font-bold text-gold-400">~ estimate</div>
          <p className="mt-1 text-[11px] text-slate-500">
            Estimated impact only — actual results vary by profile, utilization, and scoring model. Not a prediction.
          </p>
        </div>
      </div>

      <div className="card mt-3 p-5">
        <div className="mb-3 text-sm font-semibold">Dispute Progress by Bureau</div>
        {(["EQUIFAX", "EXPERIAN", "TRANSUNION"] as Bureau[]).map((b) => {
          const s = byBureau(b);
          const pct = s.total ? Math.round((s.resolved / s.total) * 100) : 0;
          return (
            <div key={b} className="mb-3 last:mb-0">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{BUREAU_LABEL[b]}</span>
                <span>{s.resolved} of {s.total} resolved</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <StatCard label="Reports Uploaded" value={reports.length} />
        <StatCard label="Analyzed" value={reports.filter((r) => r.analyzedAt).length} />
        <StatCard label="Items Resolved" value={resolved} accent="brand" />
      </div>

      <Disclaimer />
    </AppShell>
  );
}
