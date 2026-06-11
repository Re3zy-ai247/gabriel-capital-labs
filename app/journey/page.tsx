import { AppShell } from "@/components/AppShell";
import { Disclaimer, EduBanner } from "@/components/Disclaimer";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { CheckCircle2, Circle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function JourneyPage() {
  const user = await currentUserOrDemo();
  const [reports, tradelines, letters] = user
    ? await Promise.all([
        prisma.report.count({ where: { userId: user.id } }),
        prisma.tradeline.count({ where: { userId: user.id } }),
        prisma.letter.findMany({ where: { userId: user.id } }),
      ])
    : [0, 0, []];

  const phases = [
    {
      title: "Month 1 — Initial Disputes",
      steps: [
        { label: "Upload your credit report", done: reports > 0 },
        { label: "Review analyzed tradelines", done: tradelines > 0 },
        { label: "Generate first dispute letters", done: letters.length > 0 },
        { label: "Mail letters via certified mail", done: letters.some((l) => l.status === "MAILED") },
      ],
    },
    {
      title: "Month 2 — Responses & Escalations",
      steps: [
        { label: "Log bureau responses", done: letters.some((l) => l.status === "RESPONSE_RECEIVED") },
        { label: "Escalate unverified items (Round 2)", done: letters.some((l) => l.round >= 2) },
      ],
    },
    {
      title: "Month 3 — Resolution & Results",
      steps: [
        { label: "Confirm corrections/deletions", done: false },
        { label: "File CFPB complaint if unresolved", done: false },
      ],
    },
  ];

  const allSteps = phases.flatMap((p) => p.steps);
  const completion = Math.round((allSteps.filter((s) => s.done).length / allSteps.length) * 100);

  return (
    <AppShell title="/ 90-Day Journey">
      <EduBanner />
      <h2 className="mb-1 text-xl font-semibold">Your 90-Day Journey</h2>
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-ink-700">
        <div className="h-full bg-gradient-to-r from-brand-500 to-gold-400" style={{ width: `${completion}%` }} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {phases.map((p) => (
          <div key={p.title} className="card p-4">
            <div className="mb-3 text-sm font-semibold">{p.title}</div>
            <ul className="space-y-2">
              {p.steps.map((s) => (
                <li key={s.label} className="flex items-start gap-2 text-sm">
                  {s.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-400" /> : <Circle className="mt-0.5 h-4 w-4 text-slate-600" />}
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
