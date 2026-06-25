import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, Info } from "lucide-react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Markdown } from "@/components/Markdown";
import { EngagementBar } from "@/components/brief/EngagementBar";
import { prisma } from "@/lib/prisma";
import { getPublishedArticleBySlug, getUserReactions } from "@/lib/brief";
import { currentAccount } from "@/lib/session";
import { briefCategoryLabel, briefCoverUrl, youtubeVideoId, youtubeEmbedUrl, BRIEF_DISCLAIMER } from "@/lib/briefShared";

export const dynamic = "force-dynamic";

function plain(md: string, n: number): string {
  return md.replace(/[#>*`_]+/g, "").replace(/\s+/g, " ").trim().slice(0, n);
}

// Per-article SEO + Open Graph so shared links render rich previews and rank.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = await getPublishedArticleBySlug(params.slug);
  if (!a) return { title: "Article not found — CreditVector Brief" };
  const description = plain(a.summary, 160);
  const url = `/brief/${a.slug}`;
  const cover = briefCoverUrl(a.title, briefCategoryLabel(a.category));
  return {
    title: `${a.title} — CreditVector Brief`,
    description,
    alternates: { canonical: url },
    openGraph: { title: a.title, description, url, type: "article", images: [{ url: cover, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: a.title, description, images: [cover] },
  };
}

export default async function BriefArticlePage({ params }: { params: { slug: string } }) {
  const a = await getPublishedArticleBySlug(params.slug);
  if (!a) notFound();

  // Fire-and-forget view counter — never blocks the render.
  prisma.briefArticle.update({ where: { id: a.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const when = a.publishedAt
    ? new Date(a.publishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";

  // Optional official YouTube embed. videoUrl is validated on write, but re-parse
  // here so a stored value can only ever resolve to a YouTube id (never an arbitrary src).
  const videoId = youtubeVideoId(a.videoUrl);

  // Engagement state for the engagement bar (likes/bookmarks need a signed-in user).
  const account = await currentAccount();
  const reactions = account
    ? await getUserReactions(a.id, account.id)
    : { liked: false, bookmarked: false };

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <SiteNav />
      <main id="main" className="container-x py-12">
        <article className="mx-auto max-w-3xl">
          <Link href="/brief" className="mb-5 inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-slate-200">
            <ArrowLeft className="h-3.5 w-3.5" /> CreditVector Brief
          </Link>

          {/* Official YouTube player when a video is attached, else the branded,
              auto-generated cover (no external/licensed imagery). */}
          {videoId ? (
            <div className="mb-6">
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-ink-700/60 bg-black">
                <iframe
                  src={youtubeEmbedUrl(videoId)}
                  title={a.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Video hosted on YouTube by its original publisher, embedded for educational context. See the disclaimer below.
              </p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={briefCoverUrl(a.title, briefCategoryLabel(a.category))}
              alt=""
              className="mb-6 aspect-[1200/630] w-full rounded-2xl border border-ink-700/60 object-cover"
            />
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 font-semibold text-brand-300">
              {briefCategoryLabel(a.category)}
            </span>
            {when && <span className="text-slate-500">{when}</span>}
          </div>

          <h1 className="h-display text-3xl text-white md:text-4xl text-balance">{a.title}</h1>

          <a
            href={a.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-300 transition hover:text-brand-200"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Source: {a.sourceName}
          </a>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-3 text-xs text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{BRIEF_DISCLAIMER}</p>
          </div>

          <EngagementBar
            slug={a.slug}
            shareText={a.socialCaption || a.title}
            isAuthed={!!account}
            initialLiked={reactions.liked}
            initialBookmarked={reactions.bookmarked}
            initialLikeCount={a.likeCount}
          />

          <div className="mt-6 leading-relaxed text-slate-200">
            <Markdown source={a.summary} />
          </div>

          {a.tags?.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {a.tags.map((t) => (
                <span key={t} className="rounded-full bg-ink-700/60 px-2.5 py-0.5 text-[11px] text-slate-300">#{t}</span>
              ))}
            </div>
          )}

          <div className="mt-10 rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-500/10 to-ocean-700/15 p-6">
            <h2 className="text-lg font-semibold text-white">Put this to work on your own credit</h2>
            <p className="mt-1 text-sm text-slate-300">
              CreditVector reads your three bureau reports, flags inaccuracies, and drafts FCRA-grounded dispute letters
              you review and mail yourself.
            </p>
            <Link href="/register" className="btn-primary mt-4 inline-flex">Start free <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <p className="mt-8 text-center text-[11px] text-slate-500">{BRIEF_DISCLAIMER}</p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
