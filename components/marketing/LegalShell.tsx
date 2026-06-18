import type { ReactNode } from "react";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";

// Shared chrome + typography for the plain-language legal pages. Child <h2>/<p>/<ul>
// are styled via the wrapper so each page only writes semantic content.
export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <SiteNav />
      <main id="main" className="container-x py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="h-display text-3xl text-white md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated {updated}</p>
          <article className="mt-10 space-y-8 [&_a]:text-brand-300 [&_a:hover]:text-brand-200 [&_h2]:h-display [&_h2]:text-lg [&_h2]:text-white [&_li]:text-sm [&_li]:text-slate-400 [&_p]:mt-2 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-slate-400 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            {children}
          </article>
          <p className="mt-12 rounded-xl border border-ink-700/60 bg-ink-800/40 p-4 text-xs leading-relaxed text-slate-500">
            This page summarizes how CreditVector currently operates in plain language. Questions? Reach us anytime through{" "}
            <a href="/support">in-app support</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
