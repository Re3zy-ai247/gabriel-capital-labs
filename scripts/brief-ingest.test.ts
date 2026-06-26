// Run: npx tsx scripts/brief-ingest.test.ts
// Guards the pure RSS-parsing helpers behind the Phase 3 ingest: item extraction,
// CDATA/entity decoding, and HTML stripping. (Network fetch + drafting are covered
// by manual/admin "Fetch latest news" runs against the live feeds.)
import { parseRssItems, stripHtml, extractMainText, findEmbeddedYouTube } from "../lib/briefIngest";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const SAMPLE = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Newsroom | Consumer Financial Protection Bureau</title>
  <link>https://www.consumerfinance.gov/about-us/newsroom/</link>
  <item>
    <title>CFPB Takes Action on Credit Reporting &amp; Accuracy</title>
    <link>https://www.consumerfinance.gov/about-us/newsroom/cfpb-action-credit-reporting/</link>
    <description><![CDATA[<p>The Bureau <strong>announced</strong> a new rule.</p>]]></description>
    <pubDate>Tue, 24 Jun 2026 13:00:00 +0000</pubDate>
  </item>
  <item>
    <title>FTC&#39;s Latest Settlement</title>
    <link>https://www.ftc.gov/news-events/news/press-releases/ftc-settlement/</link>
    <description>Short &amp; plain summary &lt;b&gt;here&lt;/b&gt;.</description>
    <pubDate>Mon, 23 Jun 2026 09:00:00 +0000</pubDate>
  </item>
</channel></rss>`;

const items = parseRssItems(SAMPLE);
check("parses exactly the 2 <item> entries (channel title excluded)", items.length === 2);
check("decodes &amp; in a title", items[0].title === "CFPB Takes Action on Credit Reporting & Accuracy");
check("captures the item link", items[0].link === "https://www.consumerfinance.gov/about-us/newsroom/cfpb-action-credit-reporting/");
check("unwraps CDATA in description", items[0].description.includes("<p>") && items[0].description.includes("announced"));
check("decodes numeric entity &#39;", items[1].title === "FTC's Latest Settlement");

check("stripHtml removes tags from CDATA html", stripHtml(items[0].description) === "The Bureau announced a new rule.");
check("stripHtml on decoded entities yields plain text", stripHtml(items[1].description) === "Short & plain summary here.");

check("empty xml -> no items", parseRssItems("<rss></rss>").length === 0);
check("garbage -> no items, no throw", parseRssItems("not xml at all").length === 0);

// --- extractMainText: pull readable body, drop noise ---
const PAGE = `<!doctype html><html><head><title>x</title><style>.a{color:red}</style></head>
<body>
  <header><nav>Home About <a href="/x">Menu</a></nav></header>
  <main>
    <h1>CFPB Issues Final Rule</h1>
    <p>The Bureau finalized a rule on <strong>medical debt</strong> reporting.</p>
    <script>tracker('noise');</script>
    <p>It takes effect in 2026 &amp; affects roughly 15 million consumers.</p>
    <aside>Related: sign up for our newsletter</aside>
  </main>
  <footer>Privacy policy · contact us</footer>
</body></html>`;
const body = extractMainText(PAGE);
check("extracts the main body sentences", body.includes("finalized a rule on medical debt reporting") && body.includes("15 million consumers"));
check("decodes entities in body (&amp; -> &)", body.includes("2026 & affects"));
check("drops <script> noise", !body.includes("tracker") && !body.includes("noise"));
check("drops <nav> chrome", !body.includes("Menu") && !body.toLowerCase().includes("home about"));
check("drops <footer>", !body.toLowerCase().includes("privacy policy"));
check("drops <aside>", !body.toLowerCase().includes("newsletter"));

// --- findEmbeddedYouTube: only real YouTube embeds, validated ---
const ID = "dQw4w9WgXcQ";
check("finds a youtube iframe embed", findEmbeddedYouTube(`<iframe src="https://www.youtube.com/embed/${ID}?rel=0" allowfullscreen></iframe>`) === `https://www.youtube.com/watch?v=${ID}`);
check("finds a nocookie iframe embed", findEmbeddedYouTube(`<iframe src="https://www.youtube-nocookie.com/embed/${ID}"></iframe>`) === `https://www.youtube.com/watch?v=${ID}`);
check("finds a youtu.be link in markup", findEmbeddedYouTube(`<a href="https://youtu.be/${ID}">watch</a>`) === `https://www.youtube.com/watch?v=${ID}`);
check("decodes &amp; in an embed URL", findEmbeddedYouTube(`<iframe src="https://www.youtube.com/embed/${ID}?rel=0&amp;start=5"></iframe>`) === `https://www.youtube.com/watch?v=${ID}`);
check("ignores a non-YouTube (vimeo) iframe", findEmbeddedYouTube(`<iframe src="https://player.vimeo.com/video/123"></iframe>`) === null);
check("returns null when no video", findEmbeddedYouTube(PAGE) === null);

console.log(`\nbrief-ingest.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
