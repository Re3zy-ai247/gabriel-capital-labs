import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DISCLAIMER } from "@/lib/compliance";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { Reveal } from "@/components/landing/Reveal";
import { BRAND, MODULES } from "@/lib/brand";
import {
  Upload,
  ScanSearch,
  FileText,
  LineChart,
  Brain,
  Scale,
  Compass,
  Activity,
  ShieldCheck,
  Building2,
  Check,
  Mails,
  Radar,
  Gavel,
  TrendingUp,
  Landmark,
  Briefcase,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

// Resolve module icon names (from lib/brand.ts) to components.
const MODULE_ICONS: Record<string, LucideIcon> = {
  ScanSearch, Mails, Radar, Scale, Gavel, Compass, TrendingUp, Landmark, Briefcase,
};

const steps = [
  {
    icon: Upload,
    title: "Upload Your Reports",
    description:
      "Pull your free reports from AnnualCreditReport.com and upload them. Our AI reads all three bureaus in seconds.",
  },
  {
    icon: ScanSearch,
    title: "See What Can Be Disputed",
    description:
      "Every inaccuracy, inconsistency, and unverifiable item is flagged and explained — across Equifax, Experian, and TransUnion.",
  },
  {
    icon: FileText,
    title: "Generate Dispute Letters",
    description:
      "Professional, FCRA-grounded dispute letters written for you. Review, refine with AI, print, and mail.",
  },
  {
    icon: LineChart,
    title: "Track Your 90-Day Journey",
    description:
      "Follow every dispute through the bureaus' response windows and watch your progress in one dashboard.",
  },
];

const features = [
  {
    icon: Brain,
    title: "AI Report Analysis",
    description:
      "Cross-bureau comparison finds inconsistencies a manual read would miss — dates, balances, statuses that don't match.",
  },
  {
    icon: Scale,
    title: "FCRA-Grounded Letters",
    description:
      "Letters cite your actual rights under the Fair Credit Reporting Act. Compliance-checked before you ever see them.",
  },
  {
    icon: Compass,
    title: "Dispute Strategist",
    description:
      "Not sure where to start? The AI strategist prioritizes which items to dispute first for the clearest path forward.",
  },
  {
    icon: Activity,
    title: "Progress Tracking",
    description:
      "Bureau response deadlines, dispute statuses, and resolved items — tracked automatically so nothing slips.",
  },
];

const stats = [
  { value: "3", label: "Bureaus analyzed at once" },
  { value: "AI", label: "Reads every line of your report" },
  { value: "FCRA", label: "Every letter grounded in law" },
  { value: "90-day", label: "Journey tracked end to end" },
];

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      {/* Aurora background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora left-[-10%] top-[-10%] h-[480px] w-[480px] bg-emerald-600/40" />
        <div className="aurora right-[-12%] top-[6%] h-[420px] w-[420px] bg-teal-500/30" style={{ animationDelay: "4s" }} />
        <div className="aurora bottom-[-10%] left-[20%] h-[400px] w-[400px] bg-emerald-500/20" style={{ animationDelay: "8s" }} />
      </div>

      <div className="relative">
        {/* Nav */}
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="flex items-center gap-2 text-xl font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-900">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="leading-none">
              {BRAND.product}<span className="text-emerald-400">™</span>
              <span className="ml-2 hidden text-xs font-normal text-slate-500 sm:inline">{BRAND.byline}</span>
            </span>
          </span>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-slate-300 transition hover:text-white">
              Pricing
            </Link>
            <Link href="/login" className="text-slate-300 transition hover:text-white">
              Sign In
            </Link>
            <Link
              href="/register"
              className="shine rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white keep-white transition hover:bg-emerald-600"
            >
              Get Started Free
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-16 lg:grid-cols-2 lg:pt-24">
          <div className="animate-rise text-center lg:text-left">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              <Brain className="h-3.5 w-3.5" /> {BRAND.tagline}
            </p>
            <h1 className="mb-6 text-5xl font-bold leading-tight md:text-6xl">
              Understand your credit reports.
              <br />
              <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                Dispute what&apos;s wrong.
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400 lg:mx-0">
              Upload your reports from all three bureaus and let AI find the inaccuracies, draft professional FCRA
              dispute letters, and track every dispute through your 90-day journey — all in one place.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <Link
                href="/register"
                className="shine rounded-lg bg-emerald-500 px-8 py-3 text-lg font-semibold text-white keep-white transition hover:bg-emerald-600"
              >
                Start Free — No Card Required
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg border border-slate-600 px-8 py-3 text-lg font-semibold text-white transition hover:border-slate-400"
              >
                View Pricing
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Free plan includes report analysis and 3 dispute letters per month. Premium is $99/month — cancel
              anytime, 30-day money-back guarantee.
            </p>
          </div>

          <div className="animate-fadein">
            <HeroVisual />
          </div>
        </div>

        {/* Stats strip */}
        <Reveal>
          <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur md:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-3xl font-bold text-emerald-400">{s.value}</div>
                  <div className="mt-1 text-xs text-slate-400">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* How it works */}
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-4">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 100}>
                <div className="group h-full rounded-2xl border border-slate-700 bg-slate-800/70 p-6 transition duration-200 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-glow">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white transition group-hover:scale-110">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div className="mb-1 text-xs font-semibold text-emerald-400">STEP {i + 1}</div>
                  <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
                  <p className="text-sm text-slate-400">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <h2 className="mb-4 text-center text-3xl font-bold">Built for People Doing It Themselves</h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-slate-400">
              You have the legal right to dispute inaccurate information on your credit reports — for free, yourself.
              We make exercising that right dramatically easier.
            </p>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="group flex h-full items-start gap-4 rounded-2xl border border-slate-700 bg-slate-800/70 p-6 transition duration-200 hover:-translate-y-1 hover:border-emerald-500/50">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 transition group-hover:bg-emerald-500/25">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-bold text-emerald-400">{f.title}</h3>
                    <p className="text-sm text-slate-400">{f.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Platform suite — the CreditVector modules */}
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-emerald-400">
              The {BRAND.product} Platform
            </p>
            <h2 className="mb-4 text-center text-3xl font-bold">One platform. Your whole credit journey.</h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-slate-400">
              {BRAND.product}™ is built as a suite of intelligence modules. Start with the dispute stack today —
              the rest of the platform is rolling out.
            </p>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {MODULES.map((m, i) => {
              const Icon = MODULE_ICONS[m.icon] ?? Brain;
              const live = m.status === "live";
              const card = (
                <div
                  className={`group flex h-full flex-col rounded-2xl border p-6 transition duration-200 ${
                    live
                      ? "border-slate-700 bg-slate-800/70 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-glow"
                      : "border-dashed border-slate-700/70 bg-slate-800/40"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                        live ? "bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25" : "bg-slate-700/40 text-slate-400"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {live ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        Live
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <h3 className={`mb-2 text-lg font-bold ${live ? "" : "text-slate-300"}`}>{m.name}</h3>
                  <p className="text-sm text-slate-400">{m.tagline}</p>
                  {live && m.href && (
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 opacity-0 transition group-hover:opacity-100">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              );
              return (
                <Reveal key={m.key} delay={(i % 3) * 80}>
                  {live && m.href ? (
                    <Link href={m.href} className="block h-full">
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Pricing teaser — three tiers */}
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <h2 className="mb-4 text-center text-3xl font-bold">Start free. Upgrade when you&apos;re ready.</h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-slate-400">
              From a single report to running your own credit-repair business — there&apos;s a plan for where you are.
            </p>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            <Reveal>
              <div className="flex h-full flex-col rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
                <h3 className="text-xl font-bold">Free</h3>
                <div className="my-3 text-4xl font-bold">$0</div>
                <ul className="mb-6 space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Report analysis</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Inaccuracy review</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> 3 dispute letters / month</li>
                </ul>
                <Link href="/register" className="mt-auto rounded-lg border border-slate-600 py-2.5 text-center font-semibold transition hover:border-slate-400">
                  Get Started Free
                </Link>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="relative flex h-full flex-col rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-900/40 to-slate-800 p-7 shadow-glow">
                <div className="absolute -top-3 left-7 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-bold text-slate-900">
                  MOST POPULAR
                </div>
                <h3 className="text-xl font-bold">Premium</h3>
                <div className="my-3 text-4xl font-bold">
                  $99<span className="text-base font-normal text-slate-300">/mo</span>
                </div>
                <ul className="mb-6 space-y-2 text-sm text-slate-200">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Unlimited dispute letters</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> AI letter refinement</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Dispute strategist</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> 90-day progress tracking</li>
                </ul>
                <Link href="/pricing" className="shine mt-auto rounded-lg bg-emerald-500 py-2.5 text-center font-semibold text-white keep-white transition hover:bg-emerald-600">
                  Get Premium
                </Link>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="flex h-full flex-col rounded-2xl border border-indigo-500/50 bg-gradient-to-br from-indigo-900/40 to-slate-800 p-7">
                <h3 className="flex items-center gap-2 text-xl font-bold">
                  <Building2 className="h-5 w-5 text-indigo-300" /> Agency
                </h3>
                <div className="my-3 text-4xl font-bold">
                  $399<span className="text-base font-normal text-slate-300">/mo</span>
                </div>
                <ul className="mb-6 space-y-2 text-sm text-slate-200">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-300" /> Everything in Premium</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-300" /> Unlimited managed clients</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-300" /> A workspace per client</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-300" /> Roster KPIs + follow-up clock</li>
                </ul>
                <Link href="/pricing" className="mt-auto rounded-lg bg-indigo-500 py-2.5 text-center font-semibold text-white keep-white transition hover:bg-indigo-600">
                  Explore Agency
                </Link>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Final CTA */}
        <Reveal>
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-900/40 to-teal-900/30 p-10 text-center">
              <h2 className="mb-4 text-3xl font-bold">Your credit report. Your rights. Your move.</h2>
              <p className="mb-8 text-slate-300">
                Create a free account and see what&apos;s on your reports in minutes — no card required.
              </p>
              <Link
                href="/register"
                className="shine inline-block rounded-lg bg-emerald-500 px-8 py-3 text-lg font-semibold text-white keep-white transition hover:bg-emerald-600"
              >
                Create Your Free Account
              </Link>
            </div>
          </div>
        </Reveal>

        {/* Footer / Disclaimer */}
        <footer className="border-t border-slate-800">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <p className="max-w-4xl text-xs leading-relaxed text-slate-500">{DISCLAIMER}</p>
            <p className="mt-4 text-xs text-slate-600">
              © {new Date().getFullYear()} Gabriel Capital Labs. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
