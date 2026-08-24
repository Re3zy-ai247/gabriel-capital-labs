import type { ReactNode } from "react";
import { Check, ShieldCheck, Lock, Scale, BadgeCheck } from "lucide-react";

// ---- Zig-zag feature row -------------------------------------------------
// Alternating text / visual split. `flip` puts the visual on the left so a stack
// of these reads as a woven layout instead of a generic equal-card grid.
export function FeatureSplit({
  eyebrow,
  title,
  body,
  points,
  visual,
  flip = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <span className="eyebrow">{eyebrow}</span>
        <h3 className="h-display mt-4 text-2xl text-white md:text-3xl">{title}</h3>
        <p className="mt-4 max-w-xl text-slate-300 pretty">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-300">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{visual}</div>
    </div>
  );
}

function VisualFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-ink-700/70 bg-ink-900/70 p-5 shadow-card backdrop-blur">
      {children}
    </div>
  );
}

// ---- Capability visuals --------------------------------------------------
export function BureauVisual() {
  const rows = [
    { label: "Account opened", values: ["Mar 2019", "Mar 2019", "Mar 2019"], flag: false },
    { label: "Balance", values: ["$2,410", "$2,410", "$3,180"], flag: true },
    { label: "Status", values: ["Current", "Current", "30 days late"], flag: true },
  ];
  return (
    <VisualFrame>
      <div className="mb-3 grid grid-cols-[1.3fr_repeat(3,1fr)] gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Field</span>
        <span className="text-center">Equifax</span>
        <span className="text-center">Experian</span>
        <span className="text-center">TransUnion</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1.3fr_repeat(3,1fr)] items-center gap-2 text-xs">
            <span className="text-slate-400">{r.label}</span>
            {r.values.map((v, i) => {
              const mismatch = r.flag && i === 2;
              return (
                <span
                  key={i}
                  className={`rounded-md px-1.5 py-1 text-center tabular-nums ${
                    mismatch
                      ? "bg-brand-500/15 font-semibold text-brand-200 ring-1 ring-brand-500/40"
                      : "text-slate-200"
                  }`}
                >
                  {v}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-200">
        <ShieldCheck className="h-4 w-4" /> 2 cross-bureau discrepancies flagged for review
      </div>
    </VisualFrame>
  );
}

export function LetterVisual() {
  return (
    <VisualFrame>
      <div className="rounded-xl border border-ink-700/60 bg-ink-800/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dispute letter — draft</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-success-500/15 px-2 py-0.5 text-[10px] font-semibold text-success-300">
            <BadgeCheck className="h-3 w-3" /> Compliance checked
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-2/3 rounded bg-slate-600/50" />
          <div className="h-2 w-full rounded bg-slate-700/50" />
          <div className="h-2 w-11/12 rounded bg-slate-700/50" />
          <div className="my-2 rounded-md border-l-2 border-brand-400 bg-brand-500/5 px-2.5 py-1.5 text-[11px] text-brand-200">
            Cites FCRA §611 — your right to dispute and have inaccurate items reinvestigated.
          </div>
          <div className="h-2 w-full rounded bg-slate-700/50" />
          <div className="h-2 w-4/5 rounded bg-slate-700/50" />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Drafted by Kai, grounded in your rights — you review, print, and mail it.</p>
    </VisualFrame>
  );
}

export function ResponseVisual() {
  return (
    <VisualFrame>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bureau response — parsed</div>
      <div className="mt-3 rounded-xl border border-ink-700/60 bg-ink-800/50 p-3 text-xs text-slate-300">
        &ldquo;…the disputed item was <span className="text-slate-100">verified as accurate</span> and will remain…&rdquo;
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-ink-700/60 bg-ink-800/50 p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Outcome read</div>
          <div className="mt-1 text-sm font-semibold text-gold-400">Verified — no change</div>
        </div>
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-3">
          <div className="text-[10px] uppercase tracking-wide text-brand-300">Suggested next move</div>
          <div className="mt-1 text-sm font-semibold text-brand-100">Method-of-verification round</div>
        </div>
      </div>
    </VisualFrame>
  );
}

export function EscalationVisual() {
  const steps = [
    { label: "Dispute filed with bureau", state: "done" },
    { label: "Reinvestigation window (30 days)", state: "done" },
    { label: "CFPB complaint drafted", state: "active" },
    { label: "State Attorney General pathway", state: "next" },
  ];
  return (
    <VisualFrame>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Escalation pathway</div>
      <ol className="relative space-y-4 pl-6">
        <span className="absolute left-[7px] top-1 h-[calc(100%-0.5rem)] w-px bg-ink-700" />
        {steps.map((s) => (
          <li key={s.label} className="relative text-sm">
            <span
              className={`absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ${
                s.state === "done"
                  ? "bg-success-500"
                  : s.state === "active"
                  ? "bg-brand-400 ring-4 ring-brand-500/20"
                  : "border border-ink-600 bg-ink-800"
              }`}
            >
              {s.state === "done" && <Check className="h-2 w-2 text-brand-ink" strokeWidth={4} />}
            </span>
            <span className={s.state === "next" ? "text-slate-500" : "text-slate-200"}>{s.label}</span>
          </li>
        ))}
      </ol>
    </VisualFrame>
  );
}

// ---- Trust band ----------------------------------------------------------
export function TrustBar() {
  const items = [
    { icon: Lock, label: "AES-256 encryption", sub: "Your reports, encrypted at rest" },
    { icon: Scale, label: "FCRA-grounded", sub: "Every letter cites real rights" },
    { icon: ShieldCheck, label: "Software + education", sub: "Not a credit-repair organization" },
    // RC1-S6b: "Cancel anytime / No contracts, no lock-in" is a subscription
    // promise, on a shared band rendered on / and /pricing, for a consumer
    // product that has no subscription to cancel. Replaced with a fact about
    // the product as it is rather than about a billing relationship that does
    // not exist. Kept deliberately about TODAY — a "free forever" badge would
    // be a commitment nobody authorised.
    { icon: BadgeCheck, label: "Free to use today", sub: "No card, no plan to choose" },
  ];
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-700/40 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="flex items-start gap-3 bg-ink-900/80 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-300">
            <it.icon className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="text-sm font-semibold text-white">{it.label}</div>
            <div className="text-xs text-slate-400">{it.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- FAQ (side-by-side list, not an accordion) ---------------------------
export function FaqList({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
      {items.map(([q, a]) => (
        <div key={q}>
          <h3 className="text-base font-semibold text-white">{q}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400 pretty">{a}</p>
        </div>
      ))}
    </div>
  );
}
