import { prisma } from "./prisma";
import { ensureBriefTables, slugify, summarizeArticle } from "./brief";
import { BRIEF_LIMITS, youtubeVideoId } from "./briefShared";
import { extractPdfText } from "./pdf";
import { sendAdminEmail } from "./email";
import { sendPushToAdmins } from "./push";

// CreditVector Brief — Phase 3 automated ingest.
//
// Pulls recent items from a curated set of OFFICIAL .gov news feeds (public-domain
// US-government works), summarizes each NEW item through the same compliance-bound
// summarizer used by the admin paste flow (BRIEF_SYSTEM + applyCompliance scrub),
// and saves them as DRAFTS only. It NEVER publishes — the admin approval-before-
// publish gate remains the sole publication control. Official-source-only sourcing
// (vs. open-web scraping) is the deliberate, lower-risk editorial posture.

export interface BriefFeed {
  name: string;
  url: string;
}

// Curated, official sources. Add/trim here — the ingest fails safe per feed, so a
// temporarily unreachable feed is skipped, not fatal.
export const BRIEF_FEEDS: BriefFeed[] = [
  { name: "CFPB Newsroom", url: "https://www.consumerfinance.gov/about-us/newsroom/feed/" },
  { name: "FTC Press Releases", url: "https://www.ftc.gov/feeds/press-release.xml" },
];

// Identify ourselves politely; some .gov WAFs 403 a bare client.
const BRIEF_FETCH_UA = "CreditVectorBriefBot/1.0 (+https://www.creditvector.app)";

// We only ever fetch full article bodies from the SAME trusted hosts our feeds live
// on — so an unexpected/foreign link in a feed item can never make us fetch an
// arbitrary URL (SSRF guard). Derived from BRIEF_FEEDS.
const ALLOWED_ARTICLE_HOSTS = BRIEF_FEEDS.map((f) => {
  try {
    return new URL(f.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}).filter(Boolean);
function isAllowedArticleHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return ALLOWED_ARTICLE_HOSTS.some((d) => h === d || h.endsWith("." + d));
  } catch {
    return false;
  }
}

function isHttpUrl(u: string): boolean {
  return /^https?:\/\/\S+/i.test(u);
}

// Decode the small set of XML/HTML entities that show up in RSS titles/summaries,
// after unwrapping any CDATA. Intentionally minimal — feeds here are well-formed.
function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
function safeCodePoint(n: number): string {
  try {
    return String.fromCodePoint(n);
  } catch {
    return "";
  }
}

function tagText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1]).trim() : "";
}

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

// Minimal RSS 2.0 item parser (pure — unit-tested). Only reads inside <item>…</item>
// blocks, so the channel-level <title>/<link> are naturally excluded.
export function parseRssItems(xml: string): RssItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block) => ({
    title: tagText(block, "title"),
    link: tagText(block, "link"),
    description: tagText(block, "description"),
    pubDate: tagText(block, "pubDate"),
  }));
}

// Strip tags + collapse whitespace from an (already entity-decoded) RSS summary so
// the model receives clean plain text.
export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1") // tags become spaces; don't strand punctuation
    .trim();
}

// Pull the readable body text out of a full article HTML page. Heuristic (no DOM
// dependency): prefer the <main>/<article> region, drop scripts/nav/header/footer/
// aside/forms, turn block tags into newlines, then strip + decode. Tuned for the
// clean semantic markup of the curated .gov sources. Pure — unit-tested.
export function extractMainText(html: string): string {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i) || html.match(/<article\b[\s\S]*?<\/article>/i);
  let region = main ? main[0] : html;
  region = region
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // Preserve paragraph structure: block-closing tags become newlines.
  region = region.replace(/<\/(p|div|li|h[1-6]|section|tr|br)\s*\/?>/gi, "\n");
  const text = decodeEntities(region.replace(/<[^>]+>/g, " "));
  return text
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

// Find an embedded official YouTube video on the source page, if any — prefer real
// <iframe> embeds (an actual player in the article), then explicit youtube URLs.
// Validates every candidate through the host-allowlisted parser, so it can only
// ever return a real YouTube video. Returns a canonical watch URL or null. Pure.
export function findEmbeddedYouTube(html: string): string | null {
  const iframes = html.match(/<iframe\b[^>]*?\ssrc=["']([^"']+)["'][^>]*>/gi) || [];
  for (const tag of iframes) {
    const m = tag.match(/\ssrc=["']([^"']+)["']/i);
    const id = m ? youtubeVideoId(decodeEntities(m[1])) : null;
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  }
  const urls = html.match(/https?:\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/[^\s"'<>\\]+|youtu\.be\/[^\s"'<>\\]+)/gi) || [];
  for (const u of urls) {
    const id = youtubeVideoId(decodeEntities(u));
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  }
  return null;
}

interface FetchedPage {
  text: string;
  videoUrl: string | null;
}

// Find the first linked PDF on a TRUSTED host — many CFPB/FTC "newsroom" items are
// report pages whose substance lives in a linked PDF, not the HTML body. Pure;
// SSRF-safe (same host allowlist as article fetches).
export function findPdfLink(html: string): string | null {
  const links = html.match(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi) || [];
  for (const l of links) {
    const m = l.match(/href=["']([^"']+)["']/i);
    if (!m) continue;
    const url = decodeEntities(m[1]);
    if (/^https?:\/\//i.test(url) && isAllowedArticleHost(url)) return url;
  }
  return null;
}

// Download + extract text from a report PDF (size-capped, timed out). Reuses the
// app's existing pdf-parse helper. Fails safe to "".
async function fetchPdfText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BRIEF_FETCH_UA },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return "";
    const declared = Number(res.headers.get("content-length") || "0");
    if (declared > 15_000_000) return ""; // don't pull huge reports (15MB cap)
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 15_000_000) return "";
    const text = await extractPdfText(buf);
    return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 18000);
  } catch (e) {
    console.error("Brief PDF fetch failed", url, e);
    return "";
  }
}

// Fetch the full article page (with a timeout) and return its readable body text +
// any embedded official YouTube video. When the HTML body is thin (a report page),
// fall back to a linked PDF's text. Fails safe to empty so the caller can fall back
// to the RSS snippet.
async function fetchArticlePage(url: string): Promise<FetchedPage> {
  if (!isAllowedArticleHost(url)) return { text: "", videoUrl: null };
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BRIEF_FETCH_UA, Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { text: "", videoUrl: null };
    const html = await res.text();
    let text = extractMainText(html);
    const videoUrl = findEmbeddedYouTube(html);
    // Report-style page (substance is in a linked PDF) — pull the PDF text.
    if (text.length < 500) {
      const pdfUrl = findPdfLink(html);
      if (pdfUrl) {
        const pdfText = await fetchPdfText(pdfUrl);
        if (pdfText.length > text.length) text = pdfText;
      }
    }
    return { text, videoUrl };
  } catch (e) {
    console.error("Brief article fetch failed", url, e);
    return { text: "", videoUrl: null };
  }
}

export interface IngestResult {
  scanned: number;
  created: number;
  skipped: number;
  drafts: { title: string; sourceName: string }[];
  // Official sources that could not be read this run. A feed failure is survivable
  // (the run continues with the remaining feeds) but it is NOT success: without this
  // counter every source could be down, zero articles ingested, and the cron would
  // still answer ok:true. The caller decides what to do; this makes it decidable.
  feedErrors: number;
}

// Run the ingest. maxPerRun caps how many NEW drafts (and thus AI calls) a single
// run creates, bounding cost and keeping the review queue manageable.
export async function ingestBriefFeeds(opts: { maxPerRun?: number } = {}): Promise<IngestResult> {
  await ensureBriefTables();
  const maxPerRun = opts.maxPerRun ?? 5;
  const result: IngestResult = { scanned: 0, created: 0, skipped: 0, drafts: [], feedErrors: 0 };

  const candidates: { title: string; link: string; description: string; sourceName: string }[] = [];
  for (const feed of BRIEF_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": BRIEF_FETCH_UA, Accept: "application/rss+xml, application/xml, text/xml" },
        cache: "no-store",
      });
      if (!res.ok) {
        result.feedErrors++;
        console.error("Brief feed fetch failed", feed.url, res.status);
        continue;
      }
      const xml = await res.text();
      for (const item of parseRssItems(xml)) {
        if (!item.title || !isHttpUrl(item.link)) continue;
        candidates.push({ title: item.title, link: item.link, description: item.description, sourceName: feed.name });
      }
    } catch (e) {
      result.feedErrors++;
      console.error("Brief feed error", feed.url, e);
    }
  }
  result.scanned = candidates.length;
  if (candidates.length === 0) return result;

  // Dedup against anything we've already ingested for that source URL (any status),
  // so re-runs never re-draft the same article.
  const links = candidates.map((c) => c.link);
  const seen = new Set(
    (await prisma.briefArticle.findMany({ where: { sourceUrl: { in: links } }, select: { sourceUrl: true } })).map((a) => a.sourceUrl)
  );

  for (const c of candidates) {
    if (result.created >= maxPerRun) break;
    if (seen.has(c.link)) {
      result.skipped++;
      continue;
    }
    seen.add(c.link); // guard against duplicate links within this same run

    // Fetch the FULL article body (+ scan the page for an embedded official video)
    // so the brief is substantive — not a "the source was only a title" stub.
    const page = await fetchArticlePage(c.link);
    const rss = stripHtml(c.description);
    const body = (page.text.length >= rss.length ? page.text : rss).trim();
    // Too thin to brief meaningfully — skip rather than draft a hollow article.
    if (body.length < 400) {
      result.skipped++;
      continue;
    }

    const sourceText = `${c.title}\n\n${body}`.slice(0, 18000);
    const suggestion = await summarizeArticle({ title: c.title, sourceText });
    // usedAI:false = no key; empty summary = the model judged there was no real
    // substance to brief. Either way, don't create a hollow draft.
    if (!suggestion.usedAI || !suggestion.summary) {
      result.skipped++;
      continue;
    }

    await prisma.briefArticle.create({
      data: {
        slug: slugify(c.title),
        title: c.title.slice(0, BRIEF_LIMITS.title),
        summary: suggestion.summary,
        sourceUrl: c.link.slice(0, BRIEF_LIMITS.source),
        sourceName: c.sourceName,
        category: suggestion.category,
        tags: suggestion.tags,
        socialCaption: suggestion.socialCaption || null,
        videoUrl: page.videoUrl, // auto-attached official embed (admin still approves)
        status: "draft",
      },
    });
    result.created++;
    result.drafts.push({ title: c.title, sourceName: c.sourceName });
  }

  // One batched nudge per run if anything new landed in the review queue. Fire-safe.
  if (result.created > 0) {
    try {
      const base = process.env.NEXTAUTH_URL || "https://www.creditvector.app";
      const list = result.drafts.map((d) => `• ${d.title} (${d.sourceName})`).join("\n");
      const plural = result.created > 1 ? "s" : "";
      await sendAdminEmail({
        subject: `${result.created} new Brief draft${plural} await your review`,
        text:
          `CreditVector Brief auto-drafted ${result.created} new article${plural} from official sources:\n\n${list}\n\n` +
          `Review, edit, and approve before publishing: ${base}/admin/brief\n\nNothing is public until you approve it.`,
      });
      await sendPushToAdmins({ title: `${result.created} new Brief draft${plural}`, body: "Tap to review and approve.", url: "/admin/brief" });
    } catch (e) {
      console.error("brief ingest alert failed (non-fatal)", e);
    }
  }

  return result;
}

export interface ResummarizeResult {
  ok: boolean;
  error?: string;
}

// Re-fetch an existing article's source (full body + video) and regenerate its
// summary/category/tags/caption in place — the one-click fix for an old draft that
// was created from a thin RSS snippet. Admin-triggered; reuses the same scrubbed,
// hedged summarizer. Leaves the article's status alone and never clears an existing
// video. On a fetch/substance failure it changes NOTHING and reports why.
export async function resummarizeArticle(articleId: string): Promise<ResummarizeResult> {
  await ensureBriefTables();
  const article = await prisma.briefArticle.findUnique({
    where: { id: articleId },
    select: { id: true, title: true, sourceUrl: true, videoUrl: true },
  });
  if (!article) return { ok: false, error: "Article not found." };

  const page = await fetchArticlePage(article.sourceUrl);
  const body = page.text.trim();
  if (body.length < 400) {
    return { ok: false, error: "Couldn't fetch enough article text from the source to re-summarize — edit the summary manually instead." };
  }

  const sourceText = `${article.title}\n\n${body}`.slice(0, 18000);
  const suggestion = await summarizeArticle({ title: article.title, sourceText });
  if (!suggestion.usedAI) return { ok: false, error: "The AI summarizer is not available right now." };
  if (!suggestion.summary) return { ok: false, error: "The source didn't yield a substantive summary." };

  await prisma.briefArticle.update({
    where: { id: article.id },
    data: {
      summary: suggestion.summary,
      category: suggestion.category,
      tags: suggestion.tags,
      socialCaption: suggestion.socialCaption || null,
      videoUrl: page.videoUrl || article.videoUrl, // attach a found video, never clear one
    },
  });
  return { ok: true };
}
