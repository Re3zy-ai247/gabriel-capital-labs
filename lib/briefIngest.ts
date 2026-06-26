import { prisma } from "./prisma";
import { ensureBriefTables, slugify, summarizeArticle } from "./brief";
import { BRIEF_LIMITS } from "./briefShared";
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

export interface IngestResult {
  scanned: number;
  created: number;
  skipped: number;
  drafts: { title: string; sourceName: string }[];
}

// Run the ingest. maxPerRun caps how many NEW drafts (and thus AI calls) a single
// run creates, bounding cost and keeping the review queue manageable.
export async function ingestBriefFeeds(opts: { maxPerRun?: number } = {}): Promise<IngestResult> {
  await ensureBriefTables();
  const maxPerRun = opts.maxPerRun ?? 5;
  const result: IngestResult = { scanned: 0, created: 0, skipped: 0, drafts: [] };

  const candidates: { title: string; link: string; description: string; sourceName: string }[] = [];
  for (const feed of BRIEF_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": BRIEF_FETCH_UA, Accept: "application/rss+xml, application/xml, text/xml" },
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("Brief feed fetch failed", feed.url, res.status);
        continue;
      }
      const xml = await res.text();
      for (const item of parseRssItems(xml)) {
        if (!item.title || !isHttpUrl(item.link)) continue;
        candidates.push({ title: item.title, link: item.link, description: item.description, sourceName: feed.name });
      }
    } catch (e) {
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

    const sourceText = `${c.title}\n\n${stripHtml(c.description)}`.trim();
    const suggestion = await summarizeArticle({ title: c.title, sourceText });
    if (!suggestion.usedAI || !suggestion.summary) {
      // No AI provider configured or the model returned nothing usable — skip.
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
