import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { BriefCard } from "@/components/brief/BriefCard";
import { currentAccount } from "@/lib/session";
import { listBookmarkedArticles, toCardData } from "@/lib/brief";

export const dynamic = "force-dynamic";

// Per-user, private — keep it out of search indexes.
export const metadata: Metadata = {
  title: "Saved — CreditVector Brief",
  robots: { index: false, follow: false },
};

export default async function SavedBriefPage() {
  const account = await currentAccount();
  const articles = account ? (await listBookmarkedArticles(account.id)).map(toCardData) : [];

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <SiteNav />
      <main id="main" className="container-x section">
        <div className="mx-auto max-w-5xl">
          <Link href="/brief" className="mb-5 inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-slate-200">
            <ArrowLeft className="h-3.5 w-3.5" /> CreditVector Brief
          </Link>

          <h1 className="h-display flex items-center gap-2 text-3xl text-white md:text-4xl">
            <Bookmark className="h-6 w-6 text-brand-400" /> Saved articles
          </h1>

          {!account ? (
            <div className="mt-8 rounded-2xl border border-ink-700/70 bg-ink-800/40 p-10 text-center">
              <p className="text-sm text-slate-300">Sign in to see the articles you&apos;ve saved.</p>
              <Link href="/login" className="btn-primary mt-4 inline-flex">Sign in</Link>
            </div>
          ) : articles.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-ink-700/70 bg-ink-800/40 p-10 text-center text-sm text-slate-400">
              You haven&apos;t saved any articles yet. Tap <span className="text-slate-200">Save</span> on any Brief article to keep it here.
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <BriefCard key={a.slug} a={a} />
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
