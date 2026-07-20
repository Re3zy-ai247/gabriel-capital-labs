"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Check, X, Loader2, Sparkles, Clock, ArrowRight } from "lucide-react";
import { FaqList } from "@/components/marketing/Showcase";

type Status = "live" | "soon" | "contact";

interface Tier {
  id: string;
  name: string;
  kai: string;          // Kai capability tier
  kaiLine: string;      // one line on what Kai does at this level
  monthly: number | null; // null = custom
  yearly: number | null;
  blurb: string;
  status: Status;
  plan?: "premium" | "agency"; // live-checkout plan id (only for live paid tiers)
  freeRegister?: boolean;
  popular?: boolean;
  group: "consumer" | "agency";
  inherits?: string;
  features: string[];    // honest for LIVE tiers; future spec for SOON tiers (the card is badged)
  accent: string;
  cardClass: string;
  buttonClass: string;
}

// LIVE tiers list only what exists today. SOON tiers describe the future spec and can
// never be purchased — they show "Coming soon" / "Join the waitlist", never Buy Now.
const TIERS: Tier[] = [
  {
    id: "explorer", name: "Explorer", kai: "Kai Lite", kaiLine: "Kai reads your report and explains what it found.",
    monthly: 0, yearly: 0, blurb: "Meet your Credit Intelligence Officer", status: "live", freeRegister: true, group: "consumer",
    features: [
      "Upload your three bureau reports and see them in one place — never a credit pull",
      "Kai reads every account and flags what doesn't match",
      "Mission Control — your whole case on one screen",
      "Academy: know your FCRA rights in plain English",
      "3 professional dispute letters every month, free",
      "Ask Kai what any item on your report means — plain English, any time",
    ],
    accent: "text-slate-300", cardClass: "border-ink-700/70 bg-ink-800/50", buttonClass: "btn-ghost",
  },
  {
    id: "professional", name: "Professional", kai: "Kai Professional", kaiLine: "Kai works your active disputes, end to end.",
    monthly: 99, yearly: 990, blurb: "Your credit analyst, working every day", status: "live", plan: "premium", popular: true, group: "consumer",
    inherits: "Everything in Explorer, plus Kai goes to work:",
    features: [
      "Unlimited analysis — re-run Kai after every bureau update",
      "Kai reads every bureau response and tells you what it actually says",
      "Always know your strongest supported next move (method-of-verification built in)",
      "Unlimited letters, refined by Kai and grounded in the FCRA",
      "Credit Builder guidance for the rebuild phase",
      "Readiness intelligence (funding & mortgage — not a lending decision)",
      "Every 30-day window tracked — see where each dispute clock stands",
      "Operator Network — the member intelligence network, with Kai in the room",
    ],
    accent: "text-brand-300", cardClass: "border-brand-500/60 bg-gradient-to-b from-brand-500/10 to-ink-800/40 shadow-glow", buttonClass: "btn-primary shine",
  },
  {
    id: "professional_plus", name: "Professional+", kai: "Kai Pro", kaiLine: "Kai remembers your whole strategy over time.",
    monthly: 149, yearly: 1490, blurb: "Your strategy, compounding over time", status: "soon", group: "consumer",
    inherits: "Everything in Professional, plus:",
    features: [
      "Kai remembers every dispute, response, and outcome — your whole history",
      "Funding Hub — funding-readiness intelligence (not a lending decision)",
      "Business Credit OS — intelligence for your business file",
      "Priority AI + advanced analytics on your own progress",
      "Every future module included as it ships",
    ],
    accent: "text-brand-200", cardClass: "border-brand-500/25 bg-ink-800/40", buttonClass: "btn-ghost",
  },
  {
    id: "agency", name: "Agency", kai: "Kai Agency", kaiLine: "Kai analyzes every client's file independently.",
    monthly: 399, yearly: 3990, blurb: "Built for solo operators", status: "live", plan: "agency", group: "agency",
    inherits: "Everything in Professional — for every client, plus:",
    features: [
      "Manage up to 15 active clients, each in a private workspace",
      "Your entire roster on one dashboard",
      "A follow-up clock on every client's §611 window — tracked automatically",
      "The full dispute engine on every client file",
      "Kai analyzes each client independently — files never mix",
      "Professional+ modules roll out to your roster as they launch",
    ],
    accent: "text-ocean-300", cardClass: "border-ocean-500/50 bg-ink-800/50", buttonClass: "btn bg-ocean-500 text-white keep-white hover:bg-ocean-400",
  },
  {
    id: "agency_pro", name: "Agency Pro", kai: "Kai Agency", kaiLine: "Kai for a growing team.",
    monthly: 699, yearly: 6990, blurb: "Built for growing teams", status: "soon", group: "agency",
    inherits: "Everything in Agency, plus room to grow:",
    features: [
      "Grow to 30 active clients without changing how you work",
      "Bring on staff — grow beyond a solo practice",
      "See your practice's performance at a glance",
      "Bulk actions — finish roster-wide tasks in one pass",
      "Your brand on the client experience",
      "Priority support — answers when clients are waiting",
    ],
    accent: "text-ocean-200", cardClass: "border-ocean-600/30 bg-ink-800/40", buttonClass: "btn-ghost",
  },
  {
    id: "scale", name: "Scale", kai: "Kai Agency", kaiLine: "Kai across your whole operation.",
    monthly: 1299, yearly: 12990, blurb: "Built for established agencies", status: "soon", group: "agency",
    inherits: "Everything in Agency Pro — at operating scale:",
    features: [
      "Run up to 50 active clients across your whole team",
      "Unlimited team members — your org chart, your rules",
      "Automation handles the repetitive work between rounds",
      "API & webhooks — plug CreditVector into your stack",
      "Manager visibility across every desk and every client",
      "White-glove onboarding + recurring strategy reviews",
    ],
    accent: "text-ocean-200", cardClass: "border-ocean-600/30 bg-ink-800/40", buttonClass: "btn-ghost",
  },
  {
    id: "enterprise", name: "Enterprise", kai: "Kai Enterprise", kaiLine: "Kai, deployed to your standard.",
    monthly: null, yearly: null, blurb: "Built for complex organizations", status: "contact", group: "agency",
    inherits: "Everything in Scale, plus a true partnership:",
    features: [
      "Capacity, controls, and terms shaped around your organization",
      "SSO & advanced security controls",
      "White-label — CreditVector under your brand",
      "A named account team and a real SLA",
      "Custom integrations, training, and rollout support",
      "Private deployment where supported",
    ],
    accent: "text-slate-200", cardClass: "border-ink-600/60 bg-gradient-to-b from-ink-800/60 to-ink-900/40", buttonClass: "btn-ghost",
  },
];

// Comparison matrix. Cell values: "y" available now · "s" coming with that plan · "n"
// not included · "-" not applicable · or a literal string. LIVE columns only show "y"
// for what genuinely exists today; everything future is "s" (or lives under a column
// already badged "Coming soon"). Order matches TIERS.
const COLS = ["Explorer", "Professional", "Professional+", "Agency", "Agency Pro", "Scale", "Enterprise"];
// Grouped for scan speed. "@group" rows render as full-width section headers.
// Cell truth values are unchanged from the flat matrix (API access + Webhooks
// merged into one row — their values were identical).
const MATRIX: [string, ...string[]][] = [
  ["@group", "Kai intelligence"],
  ["Credit report analysis", "y", "y", "y", "y", "y", "y", "y"],
  ["Cross-bureau intelligence", "y", "y", "y", "y", "y", "y", "y"],
  ["Unlimited reports", "n", "y", "y", "y", "y", "y", "y"],
  ["Kai capability", "Lite", "Professional", "Pro", "Agency", "Agency", "Agency", "Enterprise"],
  ["Conversational Kai", "s", "s", "Unlimited", "s", "Unlimited", "Unlimited", "Unlimited"],
  ["Persistent Kai memory", "n", "Case", "Long-term", "Case", "Long-term", "Long-term", "Long-term"],
  ["@group", "Dispute engine"],
  ["Dispute letters", "3/mo", "Unlimited", "Unlimited", "Unlimited", "Unlimited", "Unlimited", "Unlimited"],
  ["Letter refinement", "n", "y", "y", "y", "y", "y", "y"],
  ["Bureau response intelligence", "n", "y", "y", "y", "y", "y", "y"],
  ["Strategy & next-round planning", "n", "y", "y", "y", "y", "y", "y"],
  ["Method-of-verification guidance", "n", "y", "y", "y", "y", "y", "y"],
  ["@group", "Guidance & growth"],
  ["CFPB guidance", "Edu", "y", "y", "y", "y", "y", "y"],
  ["Credit Builder", "Edu", "y", "y", "y", "y", "y", "y"],
  ["Funding Hub", "n", "n", "y", "s", "y", "y", "y"],
  ["Business Credit OS", "n", "n", "y", "s", "y", "y", "y"],
  ["Operator Network", "n", "y", "y", "y", "y", "y", "y"],
  ["@group", "Agency operations"],
  ["Active client workspaces", "-", "-", "-", "15", "30", "50", "Custom"],
  ["Team members", "-", "-", "-", "n", "s", "Unlimited", "Unlimited"],
  ["Agency dashboard", "-", "-", "-", "y", "y", "y", "y"],
  ["Bulk actions", "-", "-", "-", "n", "s", "s", "y"],
  ["Automation", "-", "-", "-", "n", "n", "s", "y"],
  ["@group", "Platform & partnership"],
  ["API access & webhooks", "-", "-", "-", "n", "n", "s", "y"],
  ["Custom branding", "-", "-", "-", "n", "s", "s", "y"],
  ["Priority support", "n", "n", "s", "n", "s", "s", "y"],
  ["SSO", "-", "-", "-", "-", "-", "-", "s"],
  ["White-label", "-", "-", "-", "-", "-", "-", "s"],
  ["Dedicated account manager", "-", "-", "-", "-", "-", "s", "s"],
];
const SOON_COLS = new Set([2, 4, 5, 6]); // Professional+, Agency Pro, Scale, Enterprise (0-indexed among the 7)

const FAQ: [string, string][] = [
  ["Am I buying dispute letters?", "No — you're getting Kai, your Credit Intelligence Officer. Kai reads your reports, recommends the strongest supported next step, drafts compliant letters you review and mail yourself, and tracks every deadline. Letters are one output of the intelligence, not the product."],
  ["What does “Coming soon” mean?", "Explorer, Professional, and Agency are live today. Professional+, Agency Pro, Scale, and Enterprise are on our roadmap — you can start free now and grow into them, but you can't be charged for a plan that isn't available yet. When a plan ships, its checkout goes live."],
  ["Does Kai guarantee results?", "No, and no one legally can. Kai provides educational guidance grounded in the FCRA and helps you exercise rights you already have. The bureaus decide each outcome; accurate items can't be removed by disputing them. You stay in control — Kai recommends, you approve, and you mail your own letters."],
  ["Can I cancel anytime?", "Yes — no contracts. Cancel from your billing dashboard; access continues to the end of your billing period."],
  ["What happens when I outgrow my plan?", "You upgrade in place — your data, clients, letters, and history move with you, nothing is re-imported and nothing is lost. Reaching a plan's client capacity never locks existing work; it only pauses adding new client workspaces until you upgrade."],
];

export function PricingTiers() {
  const { data: session } = useSession();
  const router = useRouter();
  const [interval, setIntervalState] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(payload: Record<string, unknown>, signedOutNext: string, key: string) {
    setError(null);
    if (!session) { router.push(`/register?next=${signedOutNext}`); return; }
    setBusy(key);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else { setError(data.error || "We couldn't start checkout. Please try again."); setBusy(null); }
    } catch { setError("The connection dropped mid-request. Try again — nothing was lost."); setBusy(null); }
  }

  const consumer = TIERS.filter((t) => t.group === "consumer");
  const agency = TIERS.filter((t) => t.group === "agency");

  return (
    <>
      {/* Kai thesis band */}
      <div className="mx-auto max-w-3xl rounded-2xl border border-brand-500/25 bg-brand-500/[0.06] p-5 text-center">
        <div className="mb-1 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-300"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Everyone gets Kai</div>
        <p className="text-sm text-slate-300">One intelligence runs every plan — your tier decides how much of Kai you unlock. <span className="text-slate-400">Kai Lite → Professional → Pro → Agency → Enterprise.</span></p>
      </div>

      {/* Interval toggle */}
      <div className="mt-8 flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-800/60 p-1">
          <button onClick={() => setIntervalState("month")} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${interval === "month" ? "bg-ink-700 text-white" : "text-slate-400 hover:text-slate-200"}`}>Monthly</button>
          <button onClick={() => setIntervalState("year")} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${interval === "year" ? "bg-brand-500 text-brand-ink" : "text-slate-400 hover:text-slate-200"}`}>Annual <span className="ml-1 text-[11px] opacity-90">save 2 months</span></button>
        </div>
      </div>

      {/* Consumer */}
      <h2 className="mt-12 text-center text-sm font-bold uppercase tracking-widest text-slate-400">For consumers</h2>
      <div className="mx-auto mt-6 grid max-w-5xl items-stretch gap-6 md:grid-cols-3">
        {consumer.map((t) => <TierCard key={t.id} t={t} interval={interval} busy={busy} onCheckout={checkout} signedIn={!!session} />)}
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">No contracts · Cancel anytime · Uploading reports never triggers a credit pull</p>

      {/* Agency */}
      <h2 className="mt-14 text-center text-sm font-bold uppercase tracking-widest text-slate-400">For agencies</h2>
      <div className="mx-auto mt-6 grid max-w-6xl items-stretch gap-6 md:grid-cols-2 lg:grid-cols-4">
        {agency.map((t) => <TierCard key={t.id} t={t} interval={interval} busy={busy} onCheckout={checkout} signedIn={!!session} />)}
      </div>
      {error && <p role="alert" className="mt-5 text-center text-sm text-rose-300">{error}</p>}

      {/* One-time letter pack (live) */}
      <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center justify-between gap-4 rounded-2xl border border-ink-700/70 bg-ink-800/40 px-6 py-5 sm:flex-row">
        <div>
          <div className="font-semibold text-white">Just need a few more letters?</div>
          <p className="text-sm text-slate-400">Buy a one-time pack of 5 dispute letters — no subscription required.</p>
        </div>
        <button onClick={() => checkout({ product: "letters_5" }, "/letters", "letters_5")} disabled={busy !== null} className="btn-ghost shrink-0 px-6 py-2.5">
          {busy === "letters_5" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>) : "Buy 5 letters — $19"}
        </button>
      </div>

      {/* Comparison matrix */}
      <div className="mx-auto mt-20 max-w-6xl">
        <h2 className="h-display mb-2 text-center text-2xl text-white md:text-3xl">Compare every plan</h2>
        <div className="mb-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-brand-400" strokeWidth={3} aria-hidden /> available now</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-gold-400" aria-hidden /> coming with that plan</span>
          <span className="inline-flex items-center gap-1"><X className="h-3.5 w-3.5 text-slate-600" aria-hidden /> not included</span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-ink-700/60">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-700/60 bg-ink-900/60">
                <th className="sticky left-0 z-10 bg-ink-900/90 p-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">Feature</th>
                {COLS.map((c, i) => (
                  <th key={c} className="p-3 text-center text-xs font-semibold text-white">
                    {c}
                    {SOON_COLS.has(i) && <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-gold-400">Coming soon</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row, ri) =>
                row[0] === "@group" ? (
                  // Label lives in the sticky first cell (same pinning as feature names)
                  // so it stays visible during horizontal scroll on mobile.
                  <tr key={`g-${row[1]}`} className="border-b border-ink-700/40">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-ink-900 px-3 pb-2 pt-5 text-left text-[10px] font-bold uppercase tracking-widest text-brand-300/90">
                      {row[1]}
                    </td>
                    <td colSpan={COLS.length} className="bg-ink-900" aria-hidden />
                  </tr>
                ) : (
                  <tr key={`${row[0]}-${ri}`} className="border-b border-ink-700/40 last:border-0">
                    <td className="sticky left-0 z-10 bg-ink-900/90 p-3 text-left text-[13px] font-medium text-slate-300">{row[0]}</td>
                    {row.slice(1).map((cell, i) => (
                      <td key={i} className="p-3 text-center">{renderCell(cell)}</td>
                    ))}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance line */}
      <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-slate-500 pretty">
        CreditVector is educational software, not a credit-repair organization, and does not provide legal advice.
        Kai provides educational guidance grounded in the Fair Credit Reporting Act; no deletion, correction, or score
        improvement is guaranteed. You review and mail your own letters and stay in control.
      </p>

      {/* FAQ */}
      <div className="mx-auto mt-16 max-w-4xl">
        <h2 className="h-display mb-10 text-center text-2xl text-white md:text-3xl">Common questions</h2>
        <FaqList items={FAQ} />
      </div>
    </>
  );
}

function renderCell(cell: string) {
  if (cell === "y") return <Check className="mx-auto h-4 w-4 text-brand-400" strokeWidth={3} aria-label="available now" />;
  if (cell === "s") return <Clock className="mx-auto h-4 w-4 text-gold-400" aria-label="coming soon" />;
  if (cell === "n") return <X className="mx-auto h-4 w-4 text-slate-600" aria-label="not included" />;
  if (cell === "-") return <span className="text-slate-600" aria-label="not applicable">—</span>;
  return <span className="text-[13px] font-medium text-slate-200">{cell}</span>;
}

function TierCard({ t, interval, busy, onCheckout, signedIn }: {
  t: Tier; interval: "month" | "year"; busy: string | null;
  onCheckout: (p: Record<string, unknown>, next: string, key: string) => void; signedIn: boolean;
}) {
  const custom = t.monthly === null;
  const price = interval === "year" ? t.yearly : t.monthly;
  const soon = t.status === "soon";
  return (
    <div className={`relative flex flex-col rounded-2xl border p-7 ${t.cardClass} ${soon ? "opacity-95" : ""}`}>
      {t.popular && <span className="absolute -top-3 left-7 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-bold text-brand-ink">Most popular</span>}
      {soon && <span className="absolute -top-3 right-7 inline-flex items-center gap-1 rounded-full bg-gold-500/20 px-3 py-0.5 text-xs font-bold text-gold-300"><Clock className="h-3 w-3" aria-hidden /> Coming soon</span>}

      {/* Kai tier + title/price */}
      <div className="min-h-[150px]">
        <span className="inline-flex items-center gap-1 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-300"><Sparkles className="h-2.5 w-2.5" aria-hidden /> {t.kai}</span>
        <h3 className="mt-2 text-xl font-semibold text-white">{t.name}</h3>
        <p className="mt-1 text-[13px] text-slate-400">{t.blurb}</p>
        <div className="mt-3 flex items-baseline gap-1">
          {custom ? <span className="h-display text-3xl text-white">Custom</span> : (
            <>
              <span className="h-display text-4xl text-white tabular-nums">${interval === "year" ? (price as number).toLocaleString() : price}</span>
              {(price as number) > 0 && <span className="text-sm text-slate-400">/{interval === "year" ? "yr" : "mo"}</span>}
            </>
          )}
        </div>
        <div className="mt-1 h-4 text-[11px] text-slate-500">
          {custom ? "Tailored to your organization" : (price as number) === 0 ? "Forever free" : interval === "year" ? `≈ $${Math.round((price as number) / 12)}/mo, billed annually` : "Billed monthly"}
        </div>
      </div>

      <p className="mt-3 text-[12px] italic leading-snug text-slate-400">{t.kaiLine}</p>

      <ul className="mt-5 flex-1 space-y-2.5 text-sm">
        {t.inherits && <li className="text-[13px] font-semibold text-slate-300">{t.inherits}</li>}
        {t.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            {soon ? <Clock className={`mt-0.5 h-4 w-4 shrink-0 text-gold-400/80`} aria-hidden /> : <Check className={`mt-0.5 h-4 w-4 shrink-0 ${t.accent}`} strokeWidth={2.5} aria-hidden />}
            <span className="text-slate-300">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA — live tiers only expose checkout; future tiers never can */}
      <div className="mt-7">
        {t.status === "live" && t.freeRegister && (
          <Link href={signedIn ? "/dashboard" : "/register"} className={`${t.buttonClass} w-full`}>{signedIn ? "Go to dashboard" : "Start free"}</Link>
        )}
        {t.status === "live" && t.plan && (
          <button onClick={() => onCheckout({ plan: t.plan, interval }, t.plan === "premium" ? "/pricing" : "/agency", t.id)} disabled={busy !== null} className={`${t.buttonClass} w-full`}>
            {busy === t.id ? (<><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>) : `Get ${t.name}`}
          </button>
        )}
        {t.status === "soon" && (
          // Coming-soon tiers never expose a Buy button. Honest CTA: start on the free
          // tier today (real waitlist capture is a Phase 2 task — no unbacked promise).
          <Link href="/register" className="btn-ghost w-full">Start free <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        )}
        {t.status === "contact" && (
          <Link href="/support" className="btn-ghost w-full">Talk to our team <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        )}
      </div>
    </div>
  );
}
