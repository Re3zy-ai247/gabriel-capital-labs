import Link from "next/link";
import { BRAND, MODULES } from "@/lib/brand";
import { SiteNav } from "@/components/marketing/SiteNav";
import { ThresholdGate } from "@/components/cxos/ThresholdGate";
import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
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
import { JourneyRuntime } from "@/components/cxos/journey/JourneyRuntime";
import { ProblemChamber } from "@/components/cxos/journey/ProblemChamber";
import { IntelligenceAwakens } from "@/components/cxos/journey/IntelligenceAwakens";
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
  MessagesSquare,
} from "lucide-react";

// Fully static — middleware.ts handles the signed-in → /dashboard redirect, so
// no session read (and no dynamic rendering) is needed here.
const STEPS = [
  { icon: Upload, title: "Upload your reports", body: "Pull your free reports from AnnualCreditReport.com. Kai reads all three bureaus in seconds." },
  { icon: ScanSearch, title: "See what can be disputed", body: "Potential inaccuracies, inconsistencies, and unverifiable items are flagged and explained across Equifax, Experian, and TransUnion." },
  // RC1-S6b: "Professional, FCRA-grounded letters … refine with Kai" carried a
  // retired tier name AND a capability no consumer has — AI letter refinement is
  // off for every account (lib/entitlements.ts, aiRefinement: false), so letters
  // are rendered from reviewed templates and the facts the consumer confirms.
  { icon: FileText, title: "Draft dispute letters", body: "FCRA-grounded letters built from reviewed templates and the facts you confirm. Read them, edit them, print them, and mail them yourself." },
  { icon: Activity, title: "Track every dispute", body: "Follow each dispute through the bureaus' response windows and watch your progress in one dashboard." },
];

const FAQ: [string, string][] = [
  ["Will this remove negative items or raise my score?", "No one can legally promise that, and we never will. CreditVector helps you find and dispute information you believe is inaccurate — the bureaus decide each outcome, and accurate items can't be removed by disputing them."],
  ["Is CreditVector a credit-repair company?", "No. CreditVector is software plus education. You review and mail your own letters and stay in control the whole way. We don't act on your behalf or charge for results."],
  ["How is my credit data protected?", "Uploaded reports and documents are encrypted at rest with AES-256 and are only ever served back to you over an authenticated, access-checked connection — never a public link."],
  ["Do I need all three bureau reports?", "No — you can start with one. CreditVector works with whatever you upload, and cross-bureau comparison gets stronger as you add Equifax, Experian, and TransUnion."],
  // RC1-S6b: the two commercial rows described a subscription with a
  // cancellation policy and a $99/$399 price list, on the product's
  // highest-traffic page. Neither is true of the consumer product.
  ["What does it cost?", "Nothing. The consumer product is free to use today — there is no plan to choose, no card to enter, and no feature held back behind a paid tier."],
  ["Is there a paid version with more in it?", "Not for consumers. Every consumer account gets the same product. A separate product for agencies and businesses exists, but it is a different product with different users, and new signups for it are paused."],
];

// RC1-S6b: this was three priced tier cards ($0 "forever" / $99 / $399) with
// checkout CTAs. There are no consumer tiers to compare, so there is nothing to
// lay out in three columns — the section below states the one fact and lists
// what "everything" means, with the detail on /pricing.
const INCLUDED = [
  "Upload all three bureau reports — never a credit pull",
  "Every account read and compared across bureaus, explained plainly",
  "An identity check against the names, addresses, and employers on your file",
  "Dispute letters drafted from reviewed templates and the facts you confirm",
  "Follow-up rounds when a bureau responds",
  "Mission Control, a full timeline, and a score tracker you keep yourself",
];

const AGENCY_POINTS = [
  { icon: Users, title: "A workspace per client", body: "Open any client and the whole platform operates inside their file — reports, letters, and tracking, isolated and secure." },
  { icon: ClipboardList, title: "Roster at a glance", body: "Every client's stage, open disputes, and next action in one view, so nothing falls through the cracks." },
  { icon: Clock, title: "Follow-up clock", body: "Bureau response windows are tracked per client, surfacing who needs a next round and when." },
];

const KAI_POINTS = [
  "Strategy on demand for any client — collections, charge-offs, reinvestigations, escalations",
  "Grounded in the FCRA/FDCPA and reviewed for CROA compliance",
  "Part of CreditVector — extended across a whole client roster in the agency workspace",
];

// RC1-S6b: these three lines sold the Operator Network as a live member benefit
// ("compare notes with other members"). The network is switched off (S6a), so
// the section below describes what it is and states that it is not open, rather
// than inviting a consumer to join something they cannot.
const COMMUNITY_POINTS = [
  "Built for comparing notes on dispute strategy and bureau timelines",
  "Kai's answers there are grounded in the FCRA and reviewed for compliance",
  "Not currently open — nothing to join, and nothing is being sold",
];

export default function Home() {
  const soon = MODULES.filter((m) => m.status === "soon");

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 text-white [&_section]:scroll-mt-20">
      {/* CXOS Phase 2 — the Threshold, RC1 posture (Founder Decision D-6).
          TASK-FIRST IS THE DEFAULT: the entrance is OPT-IN. A visitor who has
          not pressed "Cinematic entrance: on" (the control in the footer and
          in the app header) never reaches this branch, so the pre-paint
          blackout is IMPOSSIBLE for them — finding C-02's worst case (a black
          screen over fully-painted LCP content, floored only by a 12 s CSS
          fade) cannot occur on the default path at all.

          When the visitor HAS opted in, this script still runs before the hero
          is parsed and drops the page into darkness, so the Hero is never
          glimpsed before it is earned — but only under the same conservative
          signals lib/cxos/capability.ts's detectTier() calls tier A:
          reduced-motion off, Data Saver off, ≥4 GB device memory, a viewport
          wider than 768 px, and WebGL present. C-13: the "already entered"
          memory is durable (localStorage), not per-tab. ThresholdGate arms a
          1.5 s lift on top of this, and the CSS safety fade remains beneath
          both, so no failure mode can strand a black screen. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            'try{var R=' +
            (reviewBuildAllowed() ? "1" : "0") +
            '&&/[?&](director|cxos|review)(=|&|$)/.test(location.search);' +
            'var O=false,S=false;try{O=localStorage.getItem("cx-cinematic")==="on";S=localStorage.getItem("cx-threshold")==="1"||sessionStorage.getItem("cx-threshold")==="1"}catch(e){S=true}' +
            'var n=navigator;' +
            'var A=!(n.connection&&n.connection.saveData)&&!(typeof n.deviceMemory==="number"&&n.deviceMemory<4)&&!matchMedia("(max-width: 768px)").matches;' +
            'if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&(R||(O&&A))&&(R||!S)){var c=document.createElement("canvas");if(c.getContext("webgl2")||c.getContext("webgl"))document.documentElement.setAttribute("data-cxenter","1")}}catch(e){}',
        }}
      />
      <ThresholdGate />
      {/* CXOS Phase 3 — the landing-journey runtime. Stamps the capability
          tier and drives each chapter's --cxp; tier D (reduced motion or the
          footer toggle) mounts nothing and the page is its server-rendered
          self. Native scroll stays authoritative — no wheel handlers exist. */}
      <JourneyRuntime />
      <SiteNav />

      <main id="main">
        {/* ---------- Hero ---------- */}
        {/* CXOS Scene 1 — the Arrival (screenplay Scene 1, motion board M1-M3).
            cx-arrival scopes the 2.0s choreography to this section only; the page
            below it is untouched. Content is complete in the server-rendered HTML
            at t=0 — the choreography plays OVER painted content, never instead
            of it, and reduced-motion lands this exact layout instantly. */}
        <section className="cx-arrival relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="grid-texture absolute inset-0" />
            <div className="aurora left-[-8%] top-[-12%] h-[460px] w-[460px] bg-brand-500/30" />
            <div className="aurora aurora-late right-[-10%] top-[2%] h-[420px] w-[420px] bg-ocean-500/25" />
          </div>

          <div className="container-x relative grid items-center gap-14 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
            <div>
              <span className="eyebrow animate-rise">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> {BRAND.tagline}
              </span>
              <h1 className="h-display animate-rise cx-d1 mt-6 text-balance text-5xl leading-[1.05] md:text-6xl">
                Stop guessing what&apos;s on your credit report.
                <br />
                <span className="text-gradient">Dispute what&apos;s inaccurate — yourself.</span>
              </h1>
              <p className="lede animate-rise cx-d2 mt-6 max-w-xl">
                {BRAND.product} reads all three bureau reports, flags inaccuracies, drafts FCRA-grounded dispute
                letters, and tracks every dispute — one platform for consumers and the agencies that serve them.
              </p>
              <div className="animate-rise cx-d3 mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary btn-lg shine w-full sm:w-auto">
                  Start free — no card required <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a href="#how" className="btn-ghost btn-lg w-full sm:w-auto">See how it works</a>
              </div>
              <p className="animate-rise cx-d4 mt-5 text-sm font-medium text-slate-300">
                We promise the process, never the outcome.
              </p>
              {/* RC1-S6b: was "Free plan includes full report analysis and 3
                  dispute letters a month. Cancel anytime." — a quota that no
                  longer exists and a cancellation promise for a subscription
                  that does not exist. */}
              <p className="animate-rise cx-d4 mt-2 text-sm text-slate-500">
                Free to use today — no card required, and nothing held back behind a paid tier.
              </p>

              {/* Kai's introduction */}
              <div className="animate-rise cx-d4 mt-8 flex items-start gap-3.5 border-l-2 border-brand-500/40 pl-4">
                {/* TODO(kai-portrait): when the portrait ships at /kai/kai-master-sq.png, replace this
                    avatar with <img src="/kai/kai-master-sq.png" alt="" width={44} height={44}
                    className="h-11 w-11 shrink-0 rounded-xl border border-brand-500/30 object-cover" />.
                    Server component — no onError fallback available, so enable only once the file exists. */}
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-ocean-500 text-white">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                    <span className="text-xs font-semibold text-slate-300">Your Credit Intelligence Officer</span>
                  </div>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-300 pretty">
                    &ldquo;I read credit reports so you don&apos;t have to. Every recommendation comes with its receipt — the rule it fired on and, where the law applies, the statute.&rdquo;
                  </p>
                </div>
              </div>
            </div>

            <div className="animate-rise cx-d4 relative">
              <DashboardPreview />
              <span aria-hidden className="cx-sheen-overlay rounded-2xl" />
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

        {/* ---------- CXOS Phase 3 · Chapters 1–2 of the landing journey ----------
            The Problem Chamber (#problem) makes fragmentation felt; Intelligence
            Awakens (#awakens) aligns the same facts into classified evidence.
            Both are server components with the full copy in HTML at t=0. */}
        <ProblemChamber />
        <IntelligenceAwakens />

        {/* ---------- How it works ---------- */}
        <section id="how" className="container-x section">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">How it works</span>
              <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">From upload to mailed dispute in four steps</h2>
              <p className="lede mt-4">You have the right to dispute inaccurate information yourself — for free. We make exercising it easier.</p>
            </div>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="group h-full rounded-2xl border border-ink-700/70 bg-ink-800/50 p-6 transition hover:-translate-y-1 hover:border-brand-500/40">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 transition group-hover:bg-brand-500/20">
                      <s.icon className="h-5 w-5" aria-hidden />
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
                body="Kai reads Equifax, Experian, and TransUnion side by side, surfacing the dates, balances, and statuses that don't match — the inconsistencies a manual read misses."
                points={["Spot cross-bureau discrepancies in minutes", "Plain-English explanation of each item", "Unverifiable and outdated items flagged"]}
                visual={<BureauVisual />}
              />
            </Reveal>
            <Reveal>
              <FeatureSplit
                flip
                eyebrow="Dispute letter generation"
                title="FCRA-grounded letters, drafted and compliance-checked"
                body="Every letter cites your actual rights under the Fair Credit Reporting Act and is run through a compliance check before you ever see it — no deletion myths, no false promises."
                points={["Cites the specific rights that apply", "Compliance-scrubbed automatically", "Edit it yourself, print, and mail"]}
                visual={<LetterVisual />}
              />
            </Reveal>
            <Reveal>
              <FeatureSplit
                eyebrow="Know what to do next"
                title="Reads each bureau response and plans your next move"
                body="When a bureau responds, the engine reads the outcome, scores what actually happened, and suggests the most appropriate next round — so you're never guessing what to do next."
                points={["Outcome detection from raw responses", "Suggested next-round strategy", "Response-window deadlines tracked automatically"]}
                visual={<ResponseVisual />}
              />
            </Reveal>
            <Reveal>
              <FeatureSplit
                flip
                eyebrow="Escalation, done right"
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
              <div>
                <h3 className="text-lg font-semibold text-white">More of the platform is rolling out</h3>
                <p className="mt-1 text-sm text-slate-400">CreditVector is built as a suite — here&apos;s what&apos;s next.</p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {soon.map((m) => (
                  <div key={m.key} className="rounded-xl border border-ink-600 bg-ink-800/60 p-4">
                    <div className="text-sm font-semibold text-slate-200">{m.name}</div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{m.tagline}</p>
                  </div>
                ))}
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
                  <span className="eyebrow"><Building2 className="h-3.5 w-3.5" aria-hidden /> For credit-repair agencies</span>
                  <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">Run your whole client roster from one workspace</h2>
                  <p className="lede mt-4">The same intelligence consumers use, scaled for the teams that serve them — a dedicated, isolated workspace for every client.</p>
                  <div className="mt-8 space-y-5">
                    {AGENCY_POINTS.map((p) => (
                      <div key={p.title} className="flex items-start gap-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                          <p.icon className="h-5 w-5" aria-hidden />
                        </span>
                        <div>
                          <div className="font-semibold text-white">{p.title}</div>
                          <p className="mt-1 text-sm text-slate-400 pretty">{p.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* RC1-S6b: was "Explore Agency plans → /pricing". The agency
                      product is separate from the consumer one and its new
                      signups are paused, so there is no plan to explore and no
                      price to quote. Stated rather than linked. */}
                  <p className="mt-9 text-sm text-slate-400">
                    This is a separate product from the free consumer one, used by existing operators. New signups for
                    it are paused.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <AgencyRosterVisual />
              </Reveal>
            </div>

            {/* Kai — CreditVector's Credit Intelligence Officer; Agency extends it across the roster + Community Hub */}
            <Reveal>
              <div className="mt-16 grid items-center gap-10 rounded-3xl border border-brand-500/25 bg-gradient-to-br from-brand-500/10 via-ink-900/40 to-ocean-700/20 p-8 md:grid-cols-2 md:p-10">
                <div>
                  <span className="eyebrow"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Kai for your team</span>
                  <h3 className="h-display mt-4 text-2xl text-white md:text-3xl text-balance">Your Credit Intelligence Officer, across every client</h3>
                  <p className="mt-4 text-slate-300 pretty">
                    Kai works every CreditVector file. In the agency workspace, Kai extends across a whole roster —
                    ready with dispute strategy, FCRA rights, and the strongest supported next move on any client.
                    Grounded in the law and reviewed for compliance.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {KAI_POINTS.map((p) => (
                      <li key={p} className="flex items-start gap-3 text-sm text-slate-300">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-300">
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <KaiChatVisual />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- Community ---------- */}
        <section id="community" className="container-x section">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <Reveal>
              <CommunityVisual />
            </Reveal>
            <Reveal delay={120}>
              <div>
                <span className="eyebrow"><MessagesSquare className="h-3.5 w-3.5" aria-hidden /> Operator Network</span>
                <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">Learn from people working on the same thing</h2>
                {/* RC1-S6b: was "included with every paid plan … where members
                    compare notes" — a paid-membership benefit for a feature
                    that is switched off. */}
                <p className="lede mt-4">
                  The Operator Network is where people working the same process compare notes: dispute strategy, bureau
                  timelines, and hard-won lessons, with Kai in the room to keep answers grounded in the FCRA. It is not
                  open at the moment.
                </p>
                <ul className="mt-6 space-y-3">
                  {COMMUNITY_POINTS.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm text-slate-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-300">
                        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                {/* RC1-S6b: the "See plans → /pricing" CTA is gone — there is
                    no plan that opens this, and it is not open to anyone. */}
                <p className="mt-8 text-xs leading-relaxed text-slate-500">
                  Operator Network posts are their authors&apos; own opinions — not CreditVector or legal advice, and no
                  outcome is guaranteed. Only Kai&apos;s answers are reviewed for compliance.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- What it costs ---------- */}
        {/* RC1-S6b. The section id stays "pricing": it is an in-page anchor
            target and S7's chapter wiring keys off section order, not off copy.
            Everything inside it changed — the three priced cards, the
            "Upgrade when you're ready" headline and the $19 pack CTA all
            described a consumer product that is not sold any more. */}
        <section id="pricing" className="container-x section">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">What it costs</span>
              <h2 className="h-display mt-4 text-3xl text-white md:text-4xl text-balance">Free to use today.</h2>
              <p className="lede mt-4">
                No plan to choose, no card required, and nothing held back behind a paid tier. Every account gets the
                same product.
              </p>
            </div>
          </Reveal>
          <Reveal>
            <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-ink-700/70 bg-ink-800/50 p-8">
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand-300/90">What that includes</h3>
              <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                {INCLUDED.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" strokeWidth={2.5} aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary shine w-full sm:w-auto">
                  Create a free account <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/pricing" className="btn-ghost w-full sm:w-auto">See exactly what it costs</Link>
              </div>
            </div>
          </Reveal>
          <Reveal>
            <p className="mt-8 text-center text-sm text-slate-500">
              You review, print, and mail your own letters — CreditVector never sends one for you, and postage is
              yours.
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
                <p className="mx-auto mt-6 max-w-xl text-sm text-slate-400">We promise the process, never the outcome.</p>
                <Link href="/register" className="btn-primary btn-lg shine mt-8 inline-flex w-full sm:w-auto">
                  Create your free account <ArrowRight className="h-4 w-4" aria-hidden />
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

// Kai chat mock for the agency section — illustrative; Kai gives educational
// guidance grounded in the FCRA and never guarantees an outcome.
function KaiChatVisual() {
  return (
    <div aria-hidden className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-5 shadow-card backdrop-blur">
      <div className="mb-4 flex items-center gap-3 border-b border-ink-700/60 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-ocean-500 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-semibold text-white">Kai</div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-success-400" /> Credit Intelligence Officer · online
          </div>
        </div>
      </div>
      <div className="mb-3 ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-ink-700/60 px-3.5 py-2.5 text-xs text-slate-200">
        A client&apos;s collection was &ldquo;verified&rdquo; twice. What&apos;s the strongest next round?
      </div>
      <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-brand-500/25 bg-brand-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-slate-200">
        Request the bureau&apos;s <span className="text-brand-200">method of verification</span> under FCRA §611(a)(7) — who they
        spoke to and what records they checked. If it stays unverifiable, escalate with a CFPB complaint. I can draft both for this client.
      </div>
      <p className="mt-3 text-[10px] text-slate-500">Illustrative. Kai gives educational guidance grounded in the FCRA — never a guaranteed outcome.</p>
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

// Compact community mock for the community section — illustrative threads.
function CommunityVisual() {
  const threads = [
    { title: "Bureau “verified” a collection twice — next step?", replies: 7, kai: true },
    { title: "How long did your reinvestigation actually take?", replies: 12, kai: false },
    { title: "Method-of-verification request — anyone have a template?", replies: 5, kai: true },
    { title: "Agency tip: tracking response windows at scale", replies: 9, kai: false },
  ];
  return (
    <div aria-hidden className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-5 shadow-card backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Operator Network</div>
          <div className="text-sm font-semibold text-white">Recent discussions</div>
        </div>
        <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-brand-300">Kai in the room</span>
      </div>
      <div className="space-y-2">
        {threads.map((t) => (
          <div key={t.title} className="flex items-start gap-3 rounded-lg border border-ink-700/50 bg-ink-800/40 px-3 py-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-slate-300">
              <MessagesSquare className="h-3.5 w-3.5" />
            </span>
            <div>
              <div className="text-xs font-medium text-slate-200">{t.title}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                <span className="tabular-nums">{t.replies} replies</span>
                {t.kai && <span className="rounded bg-brand-500/15 px-1.5 py-0.5 font-semibold text-brand-300">Kai answered</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-500">Illustrative example.</p>
    </div>
  );
}
