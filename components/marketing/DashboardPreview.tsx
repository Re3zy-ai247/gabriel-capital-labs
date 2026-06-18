import { LayoutDashboard, Mails, ListTree, Target, CalendarRange } from "lucide-react";

// A faithful, in-product dashboard mockup for the hero — built from real markup
// (not a screenshot) so it stays sharp and on-palette. Decorative: the figure is
// aria-hidden and the numbers are an illustrative example, never a promised result.
const NAV = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: ListTree, label: "Tradelines" },
  { icon: Mails, label: "Dispute Letters" },
  { icon: Target, label: "AI Strategist" },
  { icon: CalendarRange, label: "90-Day Journey" },
];

const TILES = [
  { label: "Active disputes", value: "7", tone: "text-brand-300" },
  { label: "In review", value: "5", tone: "text-gold-400" },
  { label: "Resolved", value: "23", tone: "text-success-400" },
];

const ROWS = [
  { name: "Capital One — late payment", bureau: "Experian", status: "Resolved", tone: "bg-success-500/15 text-success-300" },
  { name: "Midland Funding — balance mismatch", bureau: "TransUnion", status: "In review", tone: "bg-gold-500/15 text-gold-400" },
  { name: "Unknown inquiry — 03/14", bureau: "Equifax", status: "Sent", tone: "bg-brand-500/15 text-brand-300" },
];

export function DashboardPreview() {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/80 shadow-lift backdrop-blur">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-ink-700/60 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-rose-400/70" />
        <span className="h-3 w-3 rounded-full bg-gold-400/70" />
        <span className="h-3 w-3 rounded-full bg-success-400/70" />
        <span className="ml-3 text-xs text-slate-500">app.creditvector.app/dashboard</span>
      </div>

      <div className="grid grid-cols-[132px_1fr]">
        {/* Mini sidebar */}
        <nav className="hidden flex-col gap-1 border-r border-ink-700/60 p-3 sm:flex">
          {NAV.map((n) => (
            <span
              key={n.label}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
                n.active ? "bg-brand-500/10 text-white ring-1 ring-inset ring-brand-500/25" : "text-slate-400"
              }`}
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </span>
          ))}
        </nav>

        {/* Panel */}
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Welcome back</div>
              <div className="text-sm font-semibold text-white">Your dispute overview</div>
            </div>
            <span className="rounded-full bg-success-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-success-300">
              On track
            </span>
          </div>

          {/* Stat tiles */}
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            {TILES.map((t) => (
              <div key={t.label} className="rounded-xl border border-ink-700/60 bg-ink-800/60 p-3">
                <div className={`text-2xl font-bold tabular-nums ${t.tone}`}>{t.value}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-slate-400">{t.label}</div>
              </div>
            ))}
          </div>

          {/* Trend chart */}
          <div className="mb-4 rounded-xl border border-ink-700/60 bg-ink-800/40 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-300">Items resolved over time</span>
              <span className="text-[10px] text-slate-500">last 90 days</span>
            </div>
            <svg viewBox="0 0 320 72" className="h-16 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cv-prev-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5c4" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#0ea5c4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                points="0,64 46,58 92,52 138,42 184,38 230,26 276,18 320,9"
                fill="none"
                stroke="#28c2db"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polygon points="0,64 46,58 92,52 138,42 184,38 230,26 276,18 320,9 320,72 0,72" fill="url(#cv-prev-fill)" />
            </svg>
          </div>

          {/* Dispute rows */}
          <div className="space-y-2">
            {ROWS.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-lg border border-ink-700/50 bg-ink-800/40 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-slate-200">{r.name}</div>
                  <div className="text-[10px] text-slate-500">{r.bureau}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.tone}`}>{r.status}</span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] text-slate-500">Illustrative example. Individual results vary; no outcome is guaranteed.</p>
        </div>
      </div>
    </div>
  );
}
