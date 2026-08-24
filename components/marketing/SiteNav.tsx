"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";
import { Menu, X } from "lucide-react";

// Absolute-hash hrefs so the nav works from any page (lands on "/" then scrolls).
const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#platform", label: "Platform" },
  { href: "/#agencies", label: "For agencies" },
  { href: "/#community", label: "Operator Network" },
  // RC1-S6b: the route is unchanged (sitemap, walkthrough guard and inbound
  // links all point at /pricing), but "Pricing" promises a price list on a
  // product that has no consumer price. The label now describes what the page
  // actually answers.
  { href: "/pricing", label: "What it costs" },
  { href: "/#faq", label: "FAQ" },
];

// Marketing top nav. Transparent over the hero, then condenses to a blurred navy
// bar once the page scrolls. Collapses to a slide-down sheet on mobile.
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="container-x flex h-16 items-center justify-between" aria-label="Primary">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandLogo className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight text-white">
            {BRAND.product}
            <span className="text-brand-400">™</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-slate-300 transition hover:text-white">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-sm font-medium text-slate-300 transition hover:text-white">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary shine">
            Get started
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-ink-700/60 hover:text-white md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-ink-700/60 bg-ink-950/95 px-6 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-slate-300 transition hover:bg-ink-700/60 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-ink-700/60 pt-3">
              <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost w-full">
                Sign in
              </Link>
              <Link href="/register" onClick={() => setOpen(false)} className="btn-primary w-full">
                Get started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
