import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DISCLAIMER } from "@/lib/compliance";

export const dynamic = "force-dynamic";

const steps = [
  {
    number: 1,
    title: "Upload Your Reports",
    description:
      "Pull your free reports from AnnualCreditReport.com and upload them. Our AI reads all three bureaus in seconds.",
  },
  {
    number: 2,
    title: "See What Can Be Disputed",
    description:
      "Every inaccuracy, inconsistency, and unverifiable item is flagged and explained — across Equifax, Experian, and TransUnion.",
  },
  {
    number: 3,
    title: "Generate Dispute Letters",
    description:
      "Professional, FCRA-grounded dispute letters written for you. Review, refine with AI, print, and mail.",
  },
  {
    number: 4,
    title: "Track Your 90-Day Journey",
    description:
      "Follow every dispute through the bureaus' response windows and watch your progress in one dashboard.",
  },
];

const features = [
  {
    title: "AI Report Analysis",
    description:
      "Cross-bureau comparison finds inconsistencies a manual read would miss — dates, balances, statuses that don't match.",
  },
  {
    title: "FCRA-Grounded Letters",
    description:
      "Letters cite your actual rights under the Fair Credit Reporting Act. Compliance-checked before you ever see them.",
  },
  {
    title: "Dispute Strategist",
    description:
      "Not sure where to start? The AI strategist prioritizes which items to dispute first for the clearest path forward.",
  },
  {
    title: "Progress Tracking",
    description:
      "Bureau response deadlines, dispute statuses, and resolved items — tracked automatically so nothing slips.",
  },
];

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      {/* Nav */}
      <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <span className="text-xl font-bold">Gabriel Capital Labs</span>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-slate-300 hover:text-white transition">
            Pricing
          </Link>
          <Link href="/login" className="text-slate-300 hover:text-white transition">
            Sign In
          </Link>
          <Link
            href="/register"
            className="bg-emerald-500 hover:bg-emerald-600 text-white keep-white px-4 py-2 rounded-lg font-semibold transition"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <p className="text-emerald-400 font-semibold mb-4 uppercase tracking-wide text-sm">
          AI-Powered Credit Dispute Education
        </p>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Understand your credit reports.
          <br />
          <span className="text-emerald-400">Dispute what&apos;s wrong.</span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
          Upload your reports from all three bureaus and let AI find the inaccuracies,
          draft professional FCRA dispute letters, and track every dispute through your
          90-day journey — all in one place.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="bg-emerald-500 hover:bg-emerald-600 text-white keep-white px-8 py-3 rounded-lg font-semibold text-lg transition"
          >
            Start Free — No Card Required
          </Link>
          <Link
            href="/pricing"
            className="border border-slate-600 hover:border-slate-400 text-white px-8 py-3 rounded-lg font-semibold text-lg transition"
          >
            View Pricing
          </Link>
        </div>
        <p className="text-slate-500 text-sm mt-6">
          Free plan includes report analysis and 3 dispute letters per month. Premium is
          $99/month — cancel anytime, 30-day money-back guarantee.
        </p>
      </div>

      {/* How it works */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6"
            >
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 w-10 h-10 rounded-full flex items-center justify-center mb-4">
                <span className="font-bold">{step.number}</span>
              </div>
              <h3 className="text-lg font-bold mb-2">{step.title}</h3>
              <p className="text-slate-400 text-sm">{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">
          Built for People Doing It Themselves
        </h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          You have the legal right to dispute inaccurate information on your credit
          reports — for free, yourself. We make exercising that right dramatically easier.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6"
            >
              <h3 className="text-lg font-bold mb-2 text-emerald-400">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing teaser */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border border-slate-700 rounded-lg p-10 text-center">
          <h2 className="text-3xl font-bold mb-4">Start free. Upgrade when you&apos;re ready.</h2>
          <p className="text-slate-400 mb-2">
            Free: report analysis, inaccuracy review, and 3 dispute letters per month.
          </p>
          <p className="text-slate-400 mb-8">
            Premium: <span className="text-white font-semibold">$99/month</span> for
            unlimited letters, AI refinement, and the dispute strategist.
          </p>
          <Link
            href="/register"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white keep-white px-8 py-3 rounded-lg font-semibold text-lg transition"
          >
            Create Your Free Account
          </Link>
        </div>
      </div>

      {/* Footer / Disclaimer */}
      <footer className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-slate-500 text-xs leading-relaxed max-w-4xl">{DISCLAIMER}</p>
          <p className="text-slate-600 text-xs mt-4">
            © {new Date().getFullYear()} Gabriel Capital Labs. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
