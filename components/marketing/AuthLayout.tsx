import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";
import { ArrowLeft, ShieldCheck, ScanSearch, Mails } from "lucide-react";

const PANEL_POINTS = [
  { icon: ScanSearch, text: "AI reads all three bureau reports and flags inaccuracies" },
  { icon: Mails, text: "FCRA-grounded dispute letters, compliance-checked before you send" },
  { icon: ShieldCheck, text: "Your reports encrypted at rest — never shared, never sold" },
];

// Split-screen auth shell: the form on the left, a brand/value panel on the right
// (collapses to just the form on small screens). Shared by sign-in and sign-up.
export function AuthLayout({
  heading,
  subheading,
  children,
}: {
  heading: string;
  subheading: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo className="h-9 w-9" />
            <span className="text-base font-semibold tracking-tight">
              {BRAND.product}
              <span className="text-brand-400">™</span>
            </span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm py-10">
            <h1 className="h-display text-2xl text-white md:text-3xl">{heading}</h1>
            <p className="mt-2 text-sm text-slate-400">{subheading}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>

      {/* Brand panel */}
      <div className="relative hidden overflow-hidden border-l border-ink-700/60 bg-ink-900/60 lg:block">
        <div className="grid-texture pointer-events-none absolute inset-0" />
        <div className="aurora left-[10%] top-[-10%] h-[420px] w-[420px] bg-brand-500/25" />
        <div className="aurora bottom-[-12%] right-[-6%] h-[380px] w-[380px] bg-ocean-500/20" style={{ animationDelay: "4s" }} />
        <div className="relative flex h-full flex-col justify-center px-14">
          <span className="eyebrow">{BRAND.tagline}</span>
          <h2 className="h-display mt-6 max-w-md text-3xl leading-tight text-white text-balance">
            Take control of your credit, <span className="text-gradient">one line at a time.</span>
          </h2>
          <ul className="mt-10 space-y-5">
            {PANEL_POINTS.map((p) => (
              <li key={p.text} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300">
                  <p.icon className="h-5 w-5" />
                </span>
                <span className="max-w-xs pt-1.5 text-sm text-slate-300">{p.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-12 max-w-md text-xs leading-relaxed text-slate-500">
            {BRAND.product} is an educational tool, not a credit-repair organization, and does not provide legal advice.
            No outcome is guaranteed.
          </p>
        </div>
      </div>
    </div>
  );
}
