import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { StatCard } from "@/components/ui/StatCard";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { decryptText } from "@/lib/docCrypto";
import { buildMailCenter, HEALTH_LABEL, HEALTH_TONE, STAGE_STATE_LABEL, type MailLetter, type StageState } from "@/lib/mailCenter";
import { PrismaMailStore, MAIL_STATUS_LABEL, type MailStatus } from "@/lib/mail";
import { CheckCircle2, Circle, Clock, Lock, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

// Mail Center (Sprint IX) — the source of truth for "did my dispute go out, and
// what happens next?" Server-rendered, deterministic, zero AI, zero network.
// Reads real Letter data and renders it in the canonical mail vocabulary;
// provider-mailed stages are honestly reserved until Sprint X.
export default async function MailCenterPage() {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Mail Center"><p className="text-slate-400">Please sign in.</p></AppShell>;

  const rawLetters = await prisma.letter.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { tradeline: { select: { creditorName: true } } },
  });

  const letters: MailLetter[] = rawLetters.map((l) => ({
    id: l.id,
    targetBureau: l.targetBureau,
    mailedAt: l.mailedAt,
    responseAt: l.responseAt,
    round: l.round,
    status: l.status,
    recipientName: l.recipientName,
    recipientType: l.recipientType,
    creditorName: l.tradeline?.creditorName ?? null,
    createdAt: l.createdAt,
    hasResponse: Boolean(l.responseText),
    responseOutcome: l.responseOutcome,
  }));

  const { rows, stats } = buildMailCenter(letters);

  // Real CreditVector-Mail manifests (Sprint XI): join by mailId = mail_<letterId>
  // so a queued "mail for me" dispute shows its manifest status honestly.
  const manifests = await new PrismaMailStore().listByUser(user.id, 200).catch(() => []);
  const manifestByLetter = new Map<string, MailStatus>();
  for (const m of manifests) if (m.letterId) manifestByLetter.set(m.letterId, m.status);

  return (
    <AppShell title="/ Mail Center">
      <EduBanner />
      <div className="mb-4 flex items-center gap-2 animate-rise">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        <h2 className="text-xl font-semibold">Mail Center</h2>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-slate-400">
        Every dispute you&apos;ve mailed, its §611 reinvestigation window, and exactly what I recommend next.
        You mail your letters yourself today — send-on-your-behalf tracking arrives when provider mailing goes live.
      </p>

      {/* Dashboard stats — real numbers, or explicitly reserved. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Generated" value={stats.generated} />
        <StatCard label="Mailed" value={stats.mailed} accent="brand" />
        <StatCard label="Waiting" value={stats.waiting} accent="gold" />
        <StatCard label="Responses" value={stats.responses} accent="brand" />
        <StatCard label="Avg response" value={stats.avgResponseDays != null ? `${stats.avgResponseDays}d` : "—"} hint={stats.avgResponseDays == null ? "once responses log" : "your logged history"} />
        <StatCard label="Delivered" value="—" hint="after provider mailing" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Mail spend" value="$0.00" hint="self-mail today" />
        {stats.roundDistribution.map((r) => (
          <StatCard key={r.round} label={`Round ${r.round}`} value={r.count} />
        ))}
      </div>

      {/* The disputes. */}
      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <div className="card p-8 text-center">
            <Mail className="mx-auto mb-2 h-7 w-7 text-slate-600" aria-hidden />
            <div className="text-sm font-semibold text-slate-200">Nothing mailed yet.</div>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
              Generate a dispute letter, mail it, and mark it mailed — it lands here with its §611 clock and my
              read on what happens next.
            </p>
            <Link href="/letters" className="btn-primary mt-4 inline-flex min-h-[44px]">Go to Dispute Letters</Link>
          </div>
        ) : (
          rows.map((row) => (
            <details key={row.letterId} className="card group overflow-hidden p-0">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-4 transition hover:bg-ink-800/40 focus-visible:bg-ink-800/40 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{row.recipient}</span>
                    {row.bureau && <span className="pill border border-ink-600 bg-ink-700/60 text-slate-300">{row.bureau}</span>}
                    <span className="pill border border-ink-600 bg-ink-700/60 text-slate-400">Round {row.round}</span>
                    {row.selfMailed && <span className="pill border border-ink-600 bg-ink-700/60 text-slate-400">Self-mailed</span>}
                  </div>
                  {row.tradeline && <div className="mt-0.5 truncate text-xs text-slate-500">{row.tradeline}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`pill border ${HEALTH_TONE[row.health]}`}>{HEALTH_LABEL[row.health]}</span>
                  {manifestByLetter.has(row.letterId) ? (
                    <span className="pill border border-ocean-500/30 bg-ocean-500/10 text-ocean-300">CreditVector Mail · {MAIL_STATUS_LABEL[manifestByLetter.get(row.letterId)!]}</span>
                  ) : (
                    <span className="text-[11px] text-slate-500 tnum">
                      {row.dateSent ? `Sent ${new Date(row.dateSent).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Not mailed"}
                    </span>
                  )}
                </div>
                <span className="ml-auto shrink-0 text-[10px] font-medium text-brand-400 sm:ml-0">
                  <span className="group-open:hidden">Timeline ▾</span>
                  <span className="hidden group-open:inline">Close ▴</span>
                </span>
              </summary>

              <div className="border-t border-ink-700/60 p-4">
                {/* Kai mail intelligence — deterministic, from the §611 clock + own history. */}
                <div className="mb-4 rounded-lg border border-brand-500/25 bg-brand-500/[0.04] p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="rounded bg-brand-500/15 px-1 py-px text-[9px] font-bold tracking-widest text-brand-300">KAI</span>
                    <span className="text-xs font-semibold text-slate-200">Where this stands</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-400">
                    {row.kaiIntel.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>

                {/* The timeline. */}
                <ol className="relative ml-1 space-y-3 border-l border-ink-700 pl-5">
                  {row.timeline.map((s) => (
                    <li key={s.key} className="relative">
                      <span className="absolute -left-[26px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-ink-900 ring-1 ring-ink-600">
                        <StageIcon state={s.state} />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className={`text-sm ${s.state === "placeholder" ? "text-slate-400" : s.state === "pending" ? "text-slate-400" : "text-slate-200"}`}>
                          <span className="sr-only">{STAGE_STATE_LABEL[s.state]}: </span>{s.label}
                        </span>
                        {s.at && (
                          <span className="text-[11px] text-slate-400 tnum">
                            {new Date(s.at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </span>
                        )}
                        {s.state === "pending" && <span className="pill border border-ink-600 bg-ink-700/60 text-[10px] text-slate-400" aria-hidden>Pending</span>}
                        {s.state === "placeholder" && <span className="pill border border-ink-600 bg-ink-700/60 text-[10px] text-slate-400" aria-hidden>Coming soon</span>}
                      </div>
                      <p className={`mt-0.5 text-xs ${s.state === "placeholder" ? "italic text-slate-400" : "text-slate-400"}`}>{s.description}</p>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/letters`} className="btn-ghost min-h-[44px] text-xs">Open in Dispute Letters →</Link>
                  <Link href={`/journey`} className="btn-ghost min-h-[44px] text-xs">See the full case timeline →</Link>
                </div>
              </div>
            </details>
          ))
        )}
      </div>

      <Disclaimer />
    </AppShell>
  );
}

function StageIcon({ state }: { state: StageState }) {
  // Icons are decorative — the state word is announced via an sr-only span next
  // to each stage label, so state never depends on color or svg-role quirks.
  if (state === "done") return <CheckCircle2 className="h-3 w-3 text-success-400" aria-hidden />;
  if (state === "current") return <Clock className="h-3 w-3 text-brand-400" aria-hidden />;
  if (state === "placeholder") return <Lock className="h-3 w-3 text-slate-500" aria-hidden />;
  return <Circle className="h-3 w-3 text-slate-500" aria-hidden />;
}
