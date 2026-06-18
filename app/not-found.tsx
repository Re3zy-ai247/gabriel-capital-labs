import Link from "next/link";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ArrowLeft, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-white">
      <SiteNav />
      <main id="main" className="container-x flex flex-1 items-center justify-center py-24">
        <div className="relative w-full max-w-lg text-center">
          <div className="aurora left-1/2 top-0 h-72 w-72 -translate-x-1/2 bg-brand-500/20" />
          <p className="relative h-display text-7xl text-gradient md:text-8xl">404</p>
          <h1 className="relative mt-4 h-display text-2xl text-white md:text-3xl text-balance">
            We couldn&apos;t find that page
          </h1>
          <p className="relative mx-auto mt-3 max-w-sm text-slate-400 pretty">
            The link may be outdated or the page may have moved. Here&apos;s the way back.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="btn-ghost btn-lg">
              <ArrowLeft className="h-4 w-4" /> Back home
            </Link>
            <Link href="/dashboard" className="btn-primary btn-lg">
              <LayoutDashboard className="h-4 w-4" /> Go to dashboard
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
