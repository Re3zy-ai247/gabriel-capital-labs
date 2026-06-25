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
          <h1 className="h-display mt-4 text-3xl text-white md:text-5xl text-balance">Consumer-credit news, explained</h1>
          <p className="lede mt-4">
            Educational summaries of the FCRA, CFPB, FTC, lawsuits, and consumer-rights developments that affect your
            credit — every source linked.
          </p>
        </div>

        <div className="mx-auto mt-6 flex max-w-2xl items-start gap-2 rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-3 text-xs text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{BRIEF_DISCLAIMER}</p>
        </div>

        {account && (
          <div className="mx-auto mt-4 flex max-w-2xl justify-end">
            <Link href="/brief/saved" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-brand-300">
              <Bookmark className="h-3.5 w-3.5" /> Saved articles
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
