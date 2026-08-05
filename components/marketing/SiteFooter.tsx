import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";
import { DISCLAIMER } from "@/lib/compliance";
import { CinematicToggle } from "@/components/cxos/CinematicToggle";
import { COMPANY_LEGAL_NAME } from "@/lib/companyIdentity.server";

const COLS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Platform", href: "/#platform" },
      { label: "Pricing", href: "/pricing" },
      { label: "For agencies", href: "/#agencies" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/register" },
      { label: "Support", href: "/support" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-700/60 bg-ink-950/60">
      <div className="container-x py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <BrandLogo className="h-9 w-9" />
              <span className="text-lg font-semibold tracking-tight text-white">
                {BRAND.product}
                <span className="text-brand-400">™</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-slate-400 pretty">{BRAND.tagline}. {BRAND.byline}.</p>
          </div>

          {COLS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{col.heading}</div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-slate-300 transition hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 border-t border-ink-700/60 pt-8">
          <p className="max-w-4xl text-xs leading-relaxed text-slate-500 pretty">{DISCLAIMER}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} {COMPANY_LEGAL_NAME}. All rights reserved.
            </p>
            <div className="flex items-center gap-5 text-xs text-slate-500">
              <Link href="/legal/privacy" className="transition hover:text-slate-300">Privacy</Link>
              <Link href="/legal/terms" className="transition hover:text-slate-300">Terms</Link>
              <CinematicToggle />
              <span>Educational tool · Not legal advice</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
