"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { FaqList } from "@/components/marketing/Showcase";

type Plan = "premium" | "agency" | "agency_pro";
type Interval = "month" | "year";

interface Tier {
  plan: Plan | "free";
  name: string;
  monthly: number;
  yearly: number;
  blurb: string;
  popular?: boolean;
  features: string[];
  accent: string; // check-mark color
  cardClass: string; // card container styling
  buttonClass: string; // CTA styling (non-free tiers use a button)
}

const TIERS: Tier[] = [
  {
    plan: "free", name: "Free", monthly: 0, yearly: 0, blurb: "Explore your report",
    features: ["Upload all three bureaus", "See every inaccuracy", "3 dispute letters / month"],
    accent: "text-slate-400", cardClass: "border-ink-700/70 bg-ink-800/50", buttonClass: "btn-ghost",
  },
  {
    plan: "premium", name: "Premium", monthly: 99, yearly: 990, blurb: "Unlimited disputes", popular: true,
    features: ["Everything in Free", "Unlimited dispute letters", "AI letter refinement", "Dispute strategist", "90-day tracking"],
    accent: "text-brand-400", cardClass: "border-brand-500/60 bg-gradient-to-b from-brand-500/10 to-ink-800/40 shadow-glow",
    buttonClass: "btn-primary shine",
  },
  {
    plan: "agency", name: "Agency", monthly: 399, yearly: 3990, blurb: "Run your own practice",
    features: ["Everything in Premium", "Up to 50 managed clients", "A workspace per client", "Roster KPIs + follow-up clock"],
    accent: "text-ocean-300", cardClass: "border-ocean-500/50 bg-ink-800/50",
    buttonClass: "btn bg-ocean-500 text-white keep-white hover:bg-ocean-400",
  },
  {
    plan: "agency_pro", name: "Agency Pro", monthly: 799, yearly: 7990, blurb: "For high-volume teams",
    features: ["Everything in Agency", "Unlimited managed clients", "Priority support"],
    accent: "text-ocean-200", cardClass: "border-ocean-600/40 bg-ink-800/50",
    buttonClass: "btn bg-ocean-600 text-white keep-white hover:bg-ocean-500",
  },
];

const FAQ: [string, string][] = [
  ["Can I cancel anytime?", "Yes — no contracts. Cancel from your billing dashboard; access continues to the end of the period."],
  ["What does Agency Pro add?", "The Agency plan includes up to 50 managed clients. Agency Pro removes that cap for high-volume teams."],
  ["Do letter-pack credits expire?", "No. Purchased letters are used automatically once your free monthly allowance runs out, and they carry over month to month."],
  ["Do you handle disputes for me?", "We generate professional, FCRA-grounded letters you review and mail yourself. You stay in control — we never act on your behalf."],
];

export function PricingTiers() {
  const { data: session } = useSession();
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(payload: Record<string, unknown>, signedOutNext: string, key: string) {
    setError(null);
    if (!session) {
      router.push(`/register?next=${signedOutNext}`);
      return;
    }
    setBusy(key);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else {
        setError(data.error || "We couldn't start checkout. Please try again.");
        setBusy(null);
      }
    } catch {
      setError("Network error. Please try again.");
      setBusy(null);
    }
  }

  return (
    <>
      {/* Interval toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-800/60 p-1">
          <button
            onClick={() => setInterval("month")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${interval === "month" ? "bg-ink-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval("year")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${interval === "year" ? "bg-brand-500 text-brand-ink" : "text-slate-400 hover:text-slate-200"}`}
          >
            Annual <span className="ml-1 text-[11px] opacity-90">save 2 months</span>
          </button>
        </div>
      </div>

      {/* Tiers */}
      <div className="mx-auto mt-12 grid max-w-6xl items-stretch gap-6 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((t) => {
          const price = interval === "year" ? t.yearly : t.monthly;
          const isFree = t.plan === "free";
          return (
            <div key={t.plan} className={`relative flex flex-col rounded-2xl border p-7 ${t.cardClass}`}>
              {t.popular && (
                <span className="absolute -top-3 left-7 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-bold text-brand-ink">
                  Most popular
                </span>
              )}
              {/* Fixed-height title/price block so feature lists align across columns */}
              <div className="min-h-[112px]">
                <h3 className="text-xl font-semibold text-white">{t.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{t.blurb}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="h-display text-4xl text-white tabular-nums">
                    ${interval === "year" && !isFree ? price.toLocaleString() : price}
                  </span>
                  {!isFree && <span className="text-sm text-slate-400">/{interval === "year" ? "yr" : "mo"}</span>}
                </div>
                <div className="mt-1 h-4 text-[11px] text-slate-500">
                  {!isFree && interval === "year" ? `≈ $${Math.round(price / 12)}/mo, billed annually` : isFree ? "Forever free" : "Billed monthly"}
                </div>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${t.accent}`} strokeWidth={2.5} />
                    <span className="text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>

              {isFree ? (
                <Link href={session ? "/dashboard" : "/register"} className={`${t.buttonClass} mt-7 w-full`}>
                  {session ? "Go to dashboard" : "Get started free"}
                </Link>
              ) : (
                <button
                  onClick={() => checkout({ plan: t.plan, interval }, t.plan === "premium" ? "/pricing" : "/agency", t.plan)}
                  disabled={busy !== null}
                  className={`${t.buttonClass} mt-7 w-full`}
                >
                  {busy === t.plan ? (<><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>) : `Get ${t.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-5 text-center text-sm text-rose-300">{error}</p>}

      {/* One-time letter pack */}
      <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center justify-between gap-4 rounded-2xl border border-ink-700/70 bg-ink-800/40 px-6 py-5 sm:flex-row">
        <div>
          <div className="font-semibold text-white">Just need a few more letters?</div>
          <p className="text-sm text-slate-400">Buy a one-time pack of 5 dispute letters — no subscription required.</p>
        </div>
        <button
          onClick={() => checkout({ product: "letters_5" }, "/letters", "letters_5")}
          disabled={busy !== null}
          className="btn-ghost shrink-0 px-6 py-2.5"
        >
          {busy === "letters_5" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>) : "Buy 5 letters — $19"}
        </button>
      </div>

      {/* FAQ */}
      <div className="mx-auto mt-20 max-w-4xl">
        <h2 className="h-display mb-10 text-center text-2xl text-white md:text-3xl">Common questions</h2>
        <FaqList items={FAQ} />
      </div>
    </>
  );
}
