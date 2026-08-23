import Link from "next/link";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ArrowLeft, LayoutDashboard, LogIn } from "lucide-react";

// RC1 S2 (P0-5 / A1-01). "Go to dashboard" was the single primary action here,
// and Next.js renders this page for signed-out visitors as readily as signed-in
// ones — a 404 arriving from search or a stale link led a stranger to a room
// that could only show them nothing. The primary action is now the one that is
// true for everybody, and both onward paths are named honestly beside it.
//
// This page cannot resolve the session itself: the App Router renders the root
// not-found for unmatched routes without a request context, so any session read
// here is either a build-time error or a lie. Naming both destinations is the
// honest form — and since RC1 S2 the dashboard link is no longer a dead end for
// a signed-out visitor either: middleware.ts sends it to /login and back.
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
            The link may be outdated or the page may have moved. Nothing in your file changed.
            Here are the ways back.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="btn-primary btn-lg">
              <ArrowLeft className="h-4 w-4" /> Back home
            </Link>
            <Link href="/dashboard" className="btn-ghost btn-lg">
              <LayoutDashboard className="h-4 w-4" /> Go to dashboard
            </Link>
            <Link href="/login" className="btn-ghost btn-lg">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          </div>
          <p className="relative mt-4 text-xs text-slate-500">
            Signed out? &ldquo;Go to dashboard&rdquo; will ask you to sign in first.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
