import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { listKaiEvents } from "@/lib/kaiEvents";
import { REINVESTIGATION_DAYS } from "@/lib/kaiHome";
import { CheckCircle2, Circle, FileText, Mail, MailOpen, Search, Sparkles, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

// THE timeline (ADR-0007 E1 consumer; CX-3 merged the old static journey into
// this page). Sources, deduped: live KaiEvents + history synthesized from the
// user's own rows (reports/letters created before the event stream existed) +
// derived upcoming deadlines. One timeline — never two.
type Entry = {
  key: string;
  ts: Date;
  icon: "upload" | "search" | "file" | "mail" | "mailopen" | "done";
  text: string;
  sub?: string; // what it means / what happens next — rule-based, never invented
  href: string;
};

// Every event answers "what does it mean, what happens next" — one calm line,
// derived from the event type (and outcome where one exists).
function meaningFor(icon: Entry["icon"], outcome?: string): string {
  switch (icon) {
    case "upload": return "This file is the evidence base — everything I flag traces back to it.";
    case "search": return "Every account now carries a classification and my dispute-priority read.";
    case "file": return "Drafted and grounded in the statutes — it becomes real when you mail it.";
    case "mail": return `The bureau owes a reinvestigation within ~${REINVESTIGATION_DAYS} days of receiving it (§611).`;
    case "mailopen":
      if (outcome === "deleted") return "Watch your next report to confirm it stays gone — reinsertion requires notice (§611(a)(5)).";
      if (outcome === "verified") return "“Verified” is a claim, not the end — the method-of-verification demand is the counter.";
      if (outcome === "no_response") return "A non-answer doesn't satisfy §611 — that failure is the basis for escalation.";
      if (outcome === "updated") return "Compare the changed fields — a partial fix can still leave inaccurate data.";
      return "I read the response and lined up the next move on the letter.";
    case "done": return "One less negative item working against your file.";
  }
}

const ICONS = {
  upload: Upload,
  search: Search,
  file: FileText,
  mail: Mail,
  mailopen: MailOpen,
  done: CheckCircle2,
} as const;

export default async function JourneyPage() {
  const user = await currentUserOrDemo();
  if (!user) return <AppShell title="/ Timeline"><p className="text-slate-400">Please sign in.</p></AppShell>;

  const [reports, tradelines, letters, events] = await Promise.all([
    prisma.report.findMany({ where: { userId: user.id }, orderBy: { uploadedAt: "desc" } }),
    prisma.tradeline.count({ where: { userId: user.id } }),
    prisma.letter.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    listKaiEvents(user.id, 200),
  ]);

  // --- Live events → entries -------------------------------------------------
  const entries: Entry[] = [];
  const seen = new Set<string>(); // dedupe key: `${type}:${refId}` vs synthesized history
  for (const e of events) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    const key = `${e.type}:${e.refId ?? e.id}`;
    seen.add(key);
    const base = { key: e.id, ts: new Date(e.occurredAt) };
    switch (e.type) {
      case "report.uploaded":
        entries.push({ ...base, icon: "upload", text: "Credit report uploaded", sub: meaningFor("upload"), href: "/tradelines" });
        break;
      case "report.analyzed":
        entries.push({ ...base, icon: "search", text: `Kai analyzed the report — ${String(p.tradelines ?? "")} accounts reviewed`, sub: meaningFor("search"), href: "/tradelines" });
        break;
      case "letter.generated":
        entries.push({ ...base, icon: "file", text: `Dispute letter generated${p.strategy ? ` (${String(p.strategy)})` : ""}`, sub: meaningFor("file"), href: "/letters" });
        break;
      case "letter.mailed":
        entries.push({ ...base, icon: "mail", text: `Round ${String(p.round ?? "")} mailed to ${String(p.recipient ?? "the bureau")} — §611 clock started`, sub: meaningFor("mail"), href: "/letters" });
        break;
      case "response.received":
        entries.push({ ...base, icon: "mailopen", text: `Bureau response logged — outcome: ${String(p.outcome ?? "recorded")}`, sub: meaningFor("mailopen", String(p.outcome ?? "")), href: "/letters" });
        break;
      case "dispute.resolved":
        entries.push({ ...base, icon: "done", text: "Item marked resolved", sub: meaningFor("done"), href: "/tradelines" });
        break;
      default:
        break;
    }
  }

  // --- History predating the event stream (synthesized, deduped) --------------
  for (const r of reports) {
    if (!seen.has(`report.uploaded:${r.id}`)) {
      entries.push({ key: `hist-r-${r.id}`, ts: r.uploadedAt, icon: "upload", text: `Credit report uploaded (${r.fileName || "report"})`, sub: meaningFor("upload"), href: "/tradelines" });
    }
  }
  for (const l of letters) {
    if (!seen.has(`letter.generated:${l.id}`)) {
      entries.push({ key: `hist-lg-${l.id}`, ts: l.createdAt, icon: "file", text: `Round ${l.round} letter generated for ${l.recipientName}`, sub: meaningFor("file"), href: "/letters" });
    }
    if (l.mailedAt && !seen.has(`letter.mailed:${l.id}`)) {
      entries.push({ key: `hist-lm-${l.id}`, ts: l.mailedAt, icon: "mail", text: `Round ${l.round} mailed to ${l.recipientName} — §611 clock started`, sub: meaningFor("mail"), href: "/letters" });
    }
    if (l.responseAt && !seen.has(`response.received:${l.id}`)) {
      entries.push({ key: `hist-lr-${l.id}`, ts: l.responseAt, icon: "mailopen", text: `${l.recipientName} responded — outcome: ${l.responseOutcome ?? "recorded"}`, sub: meaningFor("mailopen", l.responseOutcome ?? ""), href: "/letters" });
    }
  }
  entries.sort((a, b) => b.ts.getTime() - a.ts.getTime());

  // --- Upcoming (derived — hollow nodes: due, not done) ------------------------
  const now = Date.now();
  const upcoming = letters
    .filter((l) => l.mailedAt && !l.responseAt)
    .map((l) => {
      const daysElapsed = Math.floor((now - new Date(l.mailedAt as Date).getTime()) / 86_400_000);
      return { l, daysLeft: REINVESTIGATION_DAYS - daysElapsed };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 4);

  // --- The 90-day phase checklist (kept from the original journey page) -------
  const phases = [
    { title: "Month 1 — Initial Disputes", steps: [
      { label: "Upload your credit report", done: reports.length > 0 },
      { label: "Review analyzed tradelines", done: tradelines > 0 },
      { label: "Generate first dispute letters", done: letters.length > 0 },
      { label: "Mail letters via certified mail", done: letters.some((l) => l.mailedAt) },
    ]},
    { title: "Month 2 — Responses & Escalations", steps: [
      { label: "Log bureau responses", done: letters.some((l) => l.responseAt) },
      { label: "Escalate unverified items (Round 2)", done: letters.some((l) => l.round >= 2) },
    ]},
    { title: "Month 3 — Resolution & Results", steps: [
      { label: "Confirm corrections/deletions", done: letters.some((l) => l.status === "RESOLVED") },
      { label: "File CFPB complaint if unresolved", done: false },
    ]},
  ];
  const allSteps = phases.flatMap((p) => p.steps);
  const completion = Math.round((allSteps.filter((s) => s.done).length / allSteps.length) * 100);

  // Group entries by day for rendering.
  const byDay = new Map<string, Entry[]>();
  for (const e of entries.slice(0, 60)) {
    const day = e.ts.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    if (!byDay.has(day)) byDay.set(day, []);
    (byDay.get(day) as Entry[]).push(e);
  }

  return (
    <AppShell title="/ Timeline">
      <EduBanner />
      <div className="mb-1 flex items-center gap-2 animate-rise">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        <h2 className="text-xl font-semibold">Your dispute timeline</h2>
      </div>
      <p className="mb-3 text-sm text-slate-400">Everything that has happened on your file, and what's coming next. {completion}% of the 90-day journey complete.</p>
      <div
        className="mb-6 h-2 overflow-hidden rounded-full bg-ink-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion}
        aria-label={`90-day journey: ${completion}% complete`}
      >
        <div className="h-full bg-gradient-to-r from-brand-500 to-gold-400" style={{ width: `${completion}%` }} />
      </div>

      {upcoming.length > 0 && (
        <div className="card mb-5 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Coming up</div>
          <div className="space-y-2">
            {upcoming.map(({ l, daysLeft }) => (
              <div key={l.id} className="flex items-center gap-3 text-sm">
                <Circle className="h-4 w-4 shrink-0 text-gold-400" aria-hidden />
                <span className="min-w-0 flex-1 text-slate-300">
                  {/* Hollow node = due, not done — say so for screen readers. */}
                  <span className="sr-only">Due: </span>
                  {l.recipientName} response window {daysLeft <= 0 ? "has closed" : `closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`} (Round {l.round})
                </span>
                <Link href="/letters" className="shrink-0 text-xs font-semibold text-brand-400 hover:underline">
                  {daysLeft <= 0 ? "act →" : "view →"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="card p-6 text-center">
          <div className="text-sm font-semibold">Your timeline starts with one upload.</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            Upload your credit report and I&apos;ll read every account, flag what can be disputed,
            and draft the letters. Each step lands here as it happens.
          </p>
          <Link href="/upload" className="btn-primary mt-4 inline-block">Upload your report</Link>
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(byDay.entries()).map(([day, dayEntries], groupIndex) => (
            // Only the first day group animates in — one entrance per viewport, not a cascade.
            <div key={day} className={groupIndex === 0 ? "animate-rise" : undefined}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</div>
              {/* Tighter rail on small screens so icons + copy don't cramp at 375px. */}
              <div className="relative ml-1 space-y-3 border-l border-ink-700 pl-4 sm:ml-2 sm:pl-5">
                {dayEntries.map((e) => {
                  const Icon = ICONS[e.icon];
                  return (
                    <div key={e.key} className="relative">
                      <span className="absolute -left-[25px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-ink-900 ring-1 ring-ink-600 sm:-left-[27px]">
                        <Icon className={`h-3 w-3 ${e.icon === "done" ? "text-success-400" : "text-brand-400"}`} aria-hidden />
                      </span>
                      <Link href={e.href} className="group block">
                        <span className="text-sm text-slate-300 group-hover:text-slate-100">{e.text}</span>
                        {e.sub && <span className="mt-0.5 block text-xs text-slate-500">{e.sub}</span>}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {phases.map((p) => (
          <div key={p.title} className="card p-4">
            <div className="mb-3 text-sm font-semibold">{p.title}</div>
            <ul className="space-y-2">
              {p.steps.map((s) => (
                <li key={s.label} className="flex items-start gap-2 text-sm">
                  {s.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-400" aria-hidden /> : <Circle className="mt-0.5 h-4 w-4 text-slate-600" aria-hidden />}
                  <span className={s.done ? "text-slate-200" : "text-slate-400"}>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Disclaimer />
    </AppShell>
  );
}
