import type { Metadata } from "next";
import Link from "next/link";
import { Info, Bookmark } from "lucide-react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { BriefFeed } from "@/components/brief/BriefFeed";
import { listPublishedArticles, toCardData } from "@/lib/brief";
import { currentAccount } from "@/lib/session";
import { BRIEF_DISCLAIMER } from "@/lib/briefShared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CreditVector Brief — Consumer-Credit News & Intelligence",
  description:
    "Educational news summaries on FCRA, CFPB, FTC, credit-bureau and bank lawsuits, debt collection, identity theft, and consumer-rights developments — curated by CreditVector, every source linked.",
  alternates: { canonical: "/brief" },
  openGraph: {
    title: "CreditVector Brief — Consumer-Credit News & Intelligence",
    description: "Educational news summaries on FCRA, CFPB, FTC actions, lawsuits, and consumer-rights developments.",
    url: "/brief",
    type: "website",
  },
};

export default async function BriefPage() {
  const [rows, account] = await Promise.all([listPublishedArticles(), currentAccount()]);
  const articles = rows.map(toCardData);

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 text-white">
      <SiteNav />
      <main id="main" className="container-x section">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">CreditVector Brief</span>
          <h1 className="h-display mt-4 text-3xl text-white md:text-5xl text-balance">Consumer-credit news, read every morning</h1>
          <p className="lede mt-4">
            <span className="mr-2 inline-block align-middle rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            I read the CFPB and FTC wires every morning — enforcement actions, new rules, and consumer-credit
            developments. Here&apos;s what matters, in plain English, every source linked.
          </p>
        </div>

        <div className="mx-auto mt-6 flex max-w-2xl items-start gap-2 rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-3 text-xs text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>{BRIEF_DISCLAIMER}</p>
        </div>

        {account && (
          <div className="mx-auto mt-4 flex max-w-2xl justify-end">
            <Link href="/brief/saved" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-brand-300">
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" /> Saved articles
            </Link>
          </div>
        )}

        <div className="mt-10">
          <BriefFeed initial={articles} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
