import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { getKaiHomeData } from "@/lib/kaiHome";
import {
  buildMailCenter, pickMailBand, HEALTH_LABEL, HEALTH_TONE, STAGE_STATE_LABEL,
  type MailLetter, type MailPackage, type StageState,
} from "@/lib/mailCenter";
import { PrismaMailStore, MAIL_STATUS_LABEL, type MailStatus } from "@/lib/mail";
import { CheckCircle2, Circle, Clock, Download, Lock, Mail, Target } from "lucide-react";

export const dynamic = "force-dynamic";

// Mail Center (Sprint IX; Dispute Packages + "Do this first" band, Phase 1A) —
// the source of truth for "did my dispute go out, and what happens next?"
// Server-rendered, deterministic, zero AI, zero network. Reads real Letter
// data and renders it in the canonical mail vocabulary, grouped into derived
// Dispute Packages (lib/mailCenter.ts's groupIntoPackages) — no schema change,
// nothing persisted. Provider-mailed stages are honestly reserved until
// Sprint X.
export default async function MailCenterPage() {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Mail Center"><p className="text-slate-400">Please sign in.</p></AppShell>;

  const [rawLetters, kai, manifests] = await Promise.all([
    prisma.letter.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { tradeline: { select: { creditorName: true } } },
    }),
    // Reused, not recomputed — the "Do this first" band below defers entirely
    // to this engine's own recommendation (SIM-REVIEW finding 13's law: never
    // a second, independently-ranked ladder).
    getKaiHomeData(user.id),
    // Real CreditVector-Mail manifests (Sprint XI): join by mailId = mail_<letterId>
    // so a queued "mail for me" dispute shows its manifest status honestly.
    new PrismaMailStore().listByUser(user.id, 200).catch(() => []),
  ]);

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
    tradelineId: l.tradelineId,
    strategy: l.strategy,
  }));

  const { packages, stats } = buildMailCenter(letters);
  const band = pickMailBand(kai);

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

      {/* "Do this first" — ONE recommended-action band, deferring entirely to
          the same engine Mission Control uses (getKaiHomeData recommendation).
          Never a second ranking (SIM-REVIEW finding 13). */}
      <div className="card mb-5 p-4">
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <Target className="h-3.5 w-3.5 text-brand-300" aria-hidden />
          {band.scopeLabel ? `${band.scopeLabel} Do this first` : "Do this first"}
        </div>
        <div className="text-base font-semibold text-slate-100">{band.title}</div>
        {band.sub && <p className="mt-1 text-sm text-slate-400">{band.sub}</p>}
        {!band.quiet && band.href && (
          <Link href={band.href} className="btn-primary mt-3 inline-flex min-h-[44px] text-xs">
            {band.cta || "Review"} →
          </Link>
        )}
      </div>

      {/* The work queue, grouped into Dispute Packages. */}
      <div className="space-y-3">
        {packages.length === 0 ? (
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
          packages.map((pkg) => <PackageRow key={pkg.packageId} pkg={pkg} manifestByLetter={manifestByLetter} />)
        )}
      </div>

      {/* Metrics — demoted to a compact context strip below the queue (Room
          Constitution: metrics provide context, they never lead the room).
          Same CommandCenter.tsx pill idiom, same underlying numbers. */}
      <div className="mt-6 flex flex-wrap gap-1.5" role="list" aria-label="Context strip">
        <StatPill label="Generated" value={stats.generated} />
        <StatPill label="Mailed" value={stats.mailed} />
        <StatPill label="Waiting" value={stats.waiting} />
        <StatPill label="Responses" value={stats.responses} />
        <StatPill label="Avg response" value={stats.avgResponseDays != null ? `${stats.avgResponseDays}d` : "—"} />
        <StatPill label="Delivered" value="—" />
        <StatPill label="Mail spend" value="$0.00" />
        {stats.roundDistribution.map((r) => (
          <StatPill key={r.round} label={`Round ${r.round}`} value={r.count} />
        ))}
      </div>

      <Disclaimer />
    </AppShell>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <span
      role="listitem"
      className="inline-flex items-center gap-1.5 rounded-full border border-ink-700/70 bg-ink-900/40 px-2.5 py-1 text-[11px]"
    >
      <span className="font-semibold text-slate-300">{label}</span>
      <span className="tnum font-semibold text-slate-100">{value}</span>
    </span>
  );
}

function PackageRow({ pkg, manifestByLetter }: { pkg: MailPackage; manifestByLetter: Map<string, MailStatus> }) {
  const multi = pkg.members.length > 1;
  return (
    <details className="card group overflow-hidden p-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-4 transition hover:bg-ink-800/40 focus-visible:bg-ink-800/40 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{pkg.recipientSummary}</span>
            <span className="pill border border-ink-600 bg-ink-700/60 text-slate-400">Round {pkg.round}</span>
            {/* The "2 of 3 mailed" fraction — honest when a package's letters
                diverge (SIM-REVIEW finding 10) — only shown when there is a
                fraction to report (a solo package needs none). */}
            {multi && (
              <span className="pill border border-ink-600 bg-ink-700/60 text-slate-400">
                {pkg.mailedFraction.done} of {pkg.mailedFraction.total} mailed
              </span>
            )}
          </div>
          {pkg.tradeline && <div className="mt-0.5 truncate text-xs text-slate-500">{pkg.tradeline}</div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`pill border ${HEALTH_TONE[pkg.health]}`}>{HEALTH_LABEL[pkg.health]}</span>
        </div>
        <span className="ml-auto shrink-0 text-[10px] font-medium text-brand-400 sm:ml-0">
          <span className="group-open:hidden">Details ▾</span>
          <span className="hidden group-open:inline">Close ▴</span>
        </span>
      </summary>

      <div className="border-t border-ink-700/60 p-4">
        {/* Per-letter detail — every member of the package, expandable via this
            one package-level disclosure. Kai's intel + the 12-stage timeline
            are unchanged from the per-row rendering (C's watching-the-clock
            line stays intact per row). */}
        <div className="space-y-4">
          {pkg.members.map((m) =>
            m.row ? (
              <div key={m.letterId} className="border-b border-ink-700/40 pb-4 last:border-0 last:pb-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{m.row.recipient}</span>
                  {m.row.bureau && <span className="pill border border-ink-600 bg-ink-700/60 text-slate-300">{m.row.bureau}</span>}
                  {multi && <span className={`pill border ${HEALTH_TONE[m.row.health]}`}>{HEALTH_LABEL[m.row.health]}</span>}
                  {manifestByLetter.has(m.letterId) ? (
                    <span className="pill border border-ocean-500/30 bg-ocean-500/10 text-ocean-300">
                      CreditVector Mail · {MAIL_STATUS_LABEL[manifestByLetter.get(m.letterId)!]}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 tnum">
                      {m.row.dateSent ? `Sent ${new Date(m.row.dateSent).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Not mailed"}
                    </span>
                  )}
                </div>

                {/* Kai mail intelligence — deterministic, from the §611 clock + own history. */}
                <div className="mb-3 rounded-lg border border-brand-500/25 bg-brand-500/[0.04] p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="rounded bg-brand-500/15 px-1 py-px text-[9px] font-bold tracking-widest text-brand-300">KAI</span>
                    <span className="text-xs font-semibold text-slate-200">Where this stands</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-400">
                    {m.row.kaiIntel.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>

                {/* The timeline. */}
                <ol className="relative ml-1 space-y-3 border-l border-ink-700 pl-5">
                  {m.row.timeline.map((s) => (
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
              </div>
            ) : (
              // A package member that hasn't been generated into mail yet — the
              // still-open part of the "N of M mailed" fraction, never hidden.
              <div key={m.letterId} className="rounded-lg border border-dashed border-ink-700 p-3 text-xs text-slate-400">
                <span className="font-medium text-slate-300">{m.recipient}</span> — not mailed yet.{" "}
                <Link href="/letters" className="font-semibold text-brand-400 hover:underline">Mail it →</Link>
              </div>
            )
          )}
        </div>

        {/* Evidence drawer — what ACTUALLY exists for this package: generated
            letters, self-attested mailing dates, logged responses. Send-only
            artifacts render as labeled-unavailable, never faked. */}
        <details className="mt-4 rounded-lg border border-ink-700 bg-ink-900/30 p-3">
          <summary className="cursor-pointer list-none text-xs font-semibold text-slate-300 [&::-webkit-details-marker]:hidden">
            Evidence
          </summary>
          <div className="mt-2 space-y-3 text-xs">
            {pkg.evidence.selfMailNote && <p className="text-slate-400">{pkg.evidence.selfMailNote}</p>}
            <div>
              <div className="mb-1 font-semibold text-slate-300">Letters</div>
              <ul className="space-y-1">
                {pkg.evidence.letters.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-slate-400">
                    <span>{e.label} — {e.detail}</span>
                    {e.href && <Link href={e.href} target="_blank" className="shrink-0 font-semibold text-brand-400 hover:underline">Preview →</Link>}
                  </li>
                ))}
              </ul>
            </div>
            {pkg.evidence.mailingAttestations.length > 0 && (
              <div>
                <div className="mb-1 font-semibold text-slate-300">Your mailing record</div>
                <ul className="space-y-1 text-slate-400">
                  {pkg.evidence.mailingAttestations.map((e, i) => <li key={i}>{e.detail}</li>)}
                </ul>
              </div>
            )}
            {pkg.evidence.responses.length > 0 && (
              <div>
                <div className="mb-1 font-semibold text-slate-300">Responses logged</div>
                <ul className="space-y-1 text-slate-400">
                  {pkg.evidence.responses.map((e, i) => <li key={i}>{e.detail}</li>)}
                </ul>
              </div>
            )}
            <div>
              <div className="mb-1 font-semibold text-slate-300">Send-only evidence</div>
              <ul className="space-y-1 text-slate-500">
                {pkg.evidence.sendOnly.map((e, i) => (
                  <li key={i}><span className="font-medium">{e.label}:</span> <span className="italic">{e.detail}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </details>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/mail/download/${encodeURIComponent(pkg.packageId)}`} className="btn-primary min-h-[44px] text-xs">
            <Download className="h-3.5 w-3.5" aria-hidden /> Download package
          </Link>
          <Link href="/letters" className="btn-ghost min-h-[44px] text-xs">Open in Dispute Letters →</Link>
          <Link href="/journey" className="btn-ghost min-h-[44px] text-xs">See the full case timeline →</Link>
        </div>
      </div>
    </details>
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
