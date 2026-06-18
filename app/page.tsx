import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { BRAND, MODULES } from "@/lib/brand";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import {
  FeatureSplit,
  BureauVisual,
  LetterVisual,
  ResponseVisual,
  EscalationVisual,
  TrustBar,
  FaqList,
} from "@/components/marketing/Showcase";
import { Reveal } from "@/components/landing/Reveal";
import {
  Sparkles,
  Upload,
  ScanSearch,
  FileText,
  Activity,
  ArrowRight,
  Check,
  Building2,
  Users,
  ClipboardList,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Upload, title: "Upload your reports", body: "Pull your free reports from AnnualCreditReport.com. The AI reads all three bureaus in seconds." },
  { icon: ScanSearch, title: "See what can be disputed", body: "Every inaccuracy, inconsistency, and unverifiable item is flagged and explained across Equifax, Experian, and TransUnion." },
  { icon: FileText, title: "Generate dispute letters", body: "Professional, FCRA-grounded letters drafted for you. Review, refine with AI, print, and mail them yourself." },
  { icon: Activity, title: "Track every dispute", body: "Follow each dispute through the bureaus' response windows and watch your progress in one dashboard." },
];

const FAQ: [string, string][] = [
  ["Will this remove negative items or raise my score?", "No one can legally promise that, and we never will. CreditVector helps you find and dispute information you believe is inaccurate — the bureaus decide each outcome, and accurate items can't be removed by disputing them."],
  ["Is CreditVector a credit-repair company?", "No. CreditVector is software plus education. You review and mail your own letters and stay in control the whole way. We don't act on your behalf or charge for results."],
  ["How is my credit data protected?", "Uploaded reports and documents are encrypted at rest with AES-256 and are only ever served back to you over an authenticated, access-checked connection — never a public link."],
  ["Do I need all three bureau reports?", "No — you can start with one. CreditVector works with whatever you upload, and cross-bureau comparison gets stronger as you add Equifax, Experian, and TransUnion."],
  ["Can I cancel anytime?", "Yes. There are no contracts. Cancel from your billing settings and access continues to the end of your billing period."],
  ["What does it cost?", "The Free plan includes full report analysis and 3 dispute letters a month. Premium is $99/month for unlimited letters and AI tools. Agencies start at $399/month."],
];

const PRICING = [
  {
    name: "Free", price: "$0", cadence: "forever", href: "/register", cta: "Get started free", featured: false,
    features: ["Full report analysis", "Cross-bureau inaccuracy review", "3 dispute letters / month"],
  },
  {
    name: "Premium", price: "$99", cadence: "/mo", href: "/pricing", cta: "Get Premium", featured: true,
    features: ["Unlimited dispute letters", "AI letter refinement", "Dispute strategist", "90-day progress tracking"],
  },
  {
    name: "Agency", price: "$399", cadence: "/mo", href: "/pricing", cta: "Explore Agency", featured: false,
    features: ["Everything in Premium", "A workspace per client", "Roster KPIs + follow-up clock", "Up to 50 managed clients"],
  },
];

const AGENCY_POINTS = [
  { icon: Users, title: "A workspace per client", body: "Open any client and the whole platform operates inside their file — reports, letters, and tracking, isolated and secure." },
  { icon: ClipboardList, title: "Roster at a glance", body: "Every client's stage, open disputes, and next action in one view, so nothing falls through the cracks." },
  { icon: Clock, title: "Follow-up clock", body: "Bureau response windows are tracked per client, surfacing who needs a next round and when." },
];

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  const soon = MODULES.filter((m) => m.status === "soon");

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 text-white [&_section]:scroll-mt-20">
      <SiteNav />

      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="grid-texture absolute inset-0" />
            <div className="aurora left-[-8%] top-[-12%] h-[460px] w-[460px] bg-brand-500/30" />
            <div className="aurora right-[-10%] top-[2%] h-[420px] w-[420px] bg-ocean-500/25" style={{ animationDelay: "5s" }} />
          </div>

          <div className="container-x relative grid items-center gap-14 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
            <div className="animate-rise">
              <span className="eyebrow">
                <Sparkles className="h-3.5 w-3.5" /> {BRAND.tagline}
              </span>
              <h1 className="h-display mt-6 text-balance text-5xl leading-[1.05] md:text-6xl">
                Understand your credit.
                <br />
                <span className="text-gradient">Dispute what&apos;s inaccurate.</span>
              </h1>
              <p className="lede mt-6 max-w-xl">
                {BRAND.product} reads all three bureau reports with AI, flags inaccuracies, drafts FCRA-grounded dispute
                letters, and tracks every dispute — one platform for consumers and the agencies that serve them.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary btn-lg shine">
                  Start free — no card required <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#how" className="btn-ghost btn-lg">See how it works</a>
              </div>
              <p className="mt-6 text-sm text-slate-400">
                Free plan includes full report analysis and 3 dispute letters a month. Cancel anytime.
              </p>
            </div>

            <div className="animate-fadein">
              <DashboardPreview />
            </div>
          </div>
        </section>

        {/* ---------- Trust / compliance band ---------- */}
        <section className="container-x pb-8">
          <Reveal>
            <TrustBar />
          </Reveal>
          <Reveal>
            <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-slate-500 pretty">
              {BRAND.product} is an educational tool, not a credit-repair organization, and does not provide legal advice.
              We help you exercise rights you already have under the Fair Credit Reporting Act. No outcome is guaranteed.
            </p>
          </Reveal>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="container-x section">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">How it works</span>
              <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">From upload to mailed dispute in four steps</h2>
              <p className="lede mt-4">You have the right to dispute inaccurate information yourself — for free. We make exercising it dramatically easier.</p>
            </div>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="group h-full rounded-2xl border border-ink-700/70 bg-ink-800/50 p-6 transition hover:-translate-y-1 hover:border-brand-500/40">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 transition group-hover:bg-brand-500/20">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-600">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400 pretty">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- Platform capabilities (zig-zag) ---------- */}
        <section id="platform" className="container-x section">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">The platform</span>
              <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">Four engines working your reports</h2>
              <p className="lede mt-4">Each module is grounded in the Fair Credit Reporting Act and built to keep you in control.</p>
            </div>
          </Reveal>

          <div className="mt-16 space-y-24">
            <Reveal>
              <FeatureSplit
                eyebrow="Bureau report analysis"
                title="See every account across all three bureaus at once"
                body="The AI reads Equifax, Experian, and TransUnion side by side, surfacing the dates, balances, and statuses that don't match — the inconsistencies a manual read misses."
                points={["Cross-bureau discrepancy detection", "Plain-English explanation of each item", "Unverifiable and outdated items flagged"]}
                visual={<BureauVisual />}
              />
            </Reveal>
            <Reveal>
              <FeatureSplit
                flip
                eyebrow="Dispute letter generation"
                title="FCRA-grounded letters, drafted and compliance-checked"
                body="Every letter cites your actual rights under the Fair Credit Reporting Act and is run through a compliance check before you ever see it — no deletion myths, no false promises."
                points={["Cites the specific rights that apply", "Compliance-scrubbed automatically", "Edit, refine with AI, print, and mail"]}
                visual={<LetterVisual />}
              />
            </Reveal>
            <Reveal>
              <FeatureSplit
                eyebrow="Response Intelligence Engine"
                title="Reads each bureau response and plans your next move"
                body="When a bureau responds, the engine reads the outcome, scores what actually happened, and suggests the most appropriate next round — so you're never guessing what to do next."
                points={["Outcome detection from raw responses", "Suggested next-round strategy", "Nothing slips past a deadline"]}
                visual={<ResponseVisual />}
              />
            </Reveal>
            <Reveal>
              <FeatureSplit
                flip
                eyebrow="CFPB escalation workflow"
                title="When bureaus stall, escalate with regulator-grade framing"
                body="If a reinvestigation goes nowhere, CreditVector helps you escalate through the proper channels — Consumer Financial Protection Bureau complaints and state Attorney General pathways."
                points={["Structured CFPB complaint drafting", "State Attorney General pathway", "Every step documented in your timeline"]}
                visual={<EscalationVisual />}
              />
            </Reveal>
          </div>

          {/* Roadmap strip */}
          <Reveal>
            <div className="mt-20 rounded-2xl border border-ink-700/60 bg-ink-900/50 p-6 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">More of the platform is rolling out</h3>
                  <p className="mt-1 text-sm text-slate-400">CreditVector is built as a suite — here&apos;s what&apos;s next.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {soon.map((m) => (
                    <span key={m.key} className="rounded-full border border-ink-600 bg-ink-800/60 px-3 py-1 text-xs font-medium text-slate-300">
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------- Agency ---------- */}
        <section id="agencies" className="relative overflow-hidden border-y border-ink-700/50 bg-ink-900/40">
          <div className="container-x section">
            <div className="grid items-center gap-14 lg:grid-cols-2">
              <Reveal>
                <div>
                  <span className="eyebrow"><Building2 className="h-3.5 w-3.5" /> For credit-repair agencies</span>
                  <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">Run your whole client roster from one workspace</h2>
                  <p className="lede mt-4">The same intelligence consumers use, scaled for the teams that serve them — a dedicated, isolated workspace for every client.</p>
                  <div className="mt-8 space-y-5">
                    {AGENCY_POINTS.map((p) => (
                      <div key={p.title} className="flex items-start gap-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                          <p.icon className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="font-semibold text-white">{p.title}</div>
                          <p className="mt-1 text-sm text-slate-400 pretty">{p.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/pricing" className="btn-ghost btn-lg mt-9">Explore Agency plans <ArrowRight className="h-4 w-4" /></Link>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <AgencyRosterVisual />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------- Pricing ---------- */}
        <section id="pricing" className="container-x section">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Pricing</span>
              <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">Start free. Upgrade when you&apos;re ready.</h2>
              <p className="lede mt-4">From a single report to running your own practice — there&apos;s a plan for where you are.</p>
            </div>
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-5xl items-stretch gap-6 md:grid-cols-3">
            {PRICING.map((t, i) => (
              <Reveal key={t.name} delay={i * 90}>
                <div className={`relative flex h-full flex-col rounded-2xl border p-7 ${t.featured ? "border-brand-500/60 bg-gradient-to-b from-brand-500/10 to-ink-800/40 shadow-glow" : "border-ink-700/70 bg-ink-800/50"}`}>
                  {t.featured && (
                    <span className="absolute -top-3 left-7 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-bold text-brand-ink">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-white">{t.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="h-display text-4xl text-white tabular-nums">{t.price}</span>
                    <span className="text-sm text-slate-400">{t.cadence}</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" strokeWidth={2.5} /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={t.href} className={`mt-8 ${t.featured ? "btn-primary shine" : "btn-ghost"} w-full`}>{t.cta}</Link>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mt-8 text-center text-sm text-slate-500">
              Need only a few more letters? <Link href="/pricing" className="font-medium text-brand-300 hover:text-brand-200">Buy a one-time 5-letter pack for $19</Link>.
            </p>
          </Reveal>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="container-x section">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">FAQ</span>
              <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">Questions, answered plainly</h2>
            </div>
          </Reveal>
          <div className="mx-auto mt-12 max-w-4xl">
            <Reveal>
              <FaqList items={FAQ} />
            </Reveal>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="container-x pb-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-gradient-to-br from-ocean-700/40 via-ink-900 to-brand-900/40 px-6 py-16 text-center md:py-20">
              <div className="grid-texture pointer-events-none absolute inset-0" />
              <div className="relative">
                <h2 className="h-display mx-auto max-w-2xl text-3xl text-white md:text-4xl text-balance">Your credit report. Your rights. Your move.</h2>
                <p className="mx-auto mt-4 max-w-xl text-slate-300">Create a free account and see what&apos;s on your reports in minutes — no card required.</p>
                <Link href="/register" className="btn-primary btn-lg shine mt-9 inline-flex">
                  Create your free account <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

// Compact agency roster mock for the agency section — illustrative client list.
function AgencyRosterVisual() {
  const clients = [
    { name: "Marcus Bellamy", stage: "Round 2", open: 4, tone: "text-gold-400" },
    { name: "Priya Raghunathan", stage: "Resolved", open: 0, tone: "text-success-400" },
    { name: "Dominic Alvarez", stage: "Awaiting bureau", open: 2, tone: "text-brand-300" },
    { name: "Yelena Cho", stage: "Round 1", open: 6, tone: "text-slate-300" },
  ];
  return (
    <div aria-hidden className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-5 shadow-card backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Agency roster</div>
          <div className="text-sm font-semibold text-white">12 active clients</div>
        </div>
        <span className="rounded-full bg-ocean-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-ocean-300">3 need follow-up</span>
      </div>
      <div className="space-y-2">
        {clients.map((c) => (
          <div key={c.name} className="flex items-center justify-between rounded-lg border border-ink-700/50 bg-ink-800/40 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-700 text-[10px] font-semibold text-slate-300">
                {c.name.split(" ").map((n) => n[0]).join("")}
              </span>
              <div>
                <div className="text-xs font-medium text-slate-200">{c.name}</div>
                <div className={`text-[10px] ${c.tone}`}>{c.stage}</div>
              </div>
            </div>
            <span className="text-[11px] tabular-nums text-slate-400">{c.open} open</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-500">Illustrative example.</p>
    </div>
  );
}
