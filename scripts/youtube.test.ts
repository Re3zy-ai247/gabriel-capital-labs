// Run: npx tsx scripts/youtube.test.ts
// Guards the Brief YouTube embed: parsing must be host-allowlisted so a stored
// videoUrl can only ever produce an iframe pointed at YouTube — never an arbitrary
// origin (the value is re-parsed at render time, so this is the security boundary).
import { youtubeVideoId, normalizeYouTubeUrl, youtubeEmbedUrl } from "../lib/briefShared";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const ID = "dQw4w9WgXcQ"; // canonical 11-char id

// --- Accepts the common official URL shapes, all yielding the same id ---
check("watch URL", youtubeVideoId(`https://www.youtube.com/watch?v=${ID}`) === ID);
check("watch URL w/ extra params", youtubeVideoId(`https://www.youtube.com/watch?v=${ID}&t=42s&list=abc`) === ID);
check("youtu.be short", youtubeVideoId(`https://youtu.be/${ID}`) === ID);
check("youtu.be w/ query", youtubeVideoId(`https://youtu.be/${ID}?si=xyz`) === ID);
check("embed URL", youtubeVideoId(`https://www.youtube.com/embed/${ID}`) === ID);
check("shorts URL", youtubeVideoId(`https://www.youtube.com/shorts/${ID}`) === ID);
check("no-www host", youtubeVideoId(`https://youtube.com/watch?v=${ID}`) === ID);
check("m. mobile host", youtubeVideoId(`https://m.youtube.com/watch?v=${ID}`) === ID);
check("nocookie embed host", youtubeVideoId(`https://www.youtube-nocookie.com/embed/${ID}`) === ID);

// --- Rejects non-YouTube / malformed / hostile input ---
check("rejects empty", youtubeVideoId("") === null);
check("rejects non-string", youtubeVideoId(null) === null);
check("rejects plain text", youtubeVideoId("not a url") === null);
check("rejects non-YouTube host", youtubeVideoId("https://vimeo.com/123456") === null);
check("rejects javascript: scheme", youtubeVideoId("javascript:alert(1)") === null);
check("rejects data: scheme", youtubeVideoId("data:text/html,<script>1</script>") === null);
check("rejects lookalike subdomain", youtubeVideoId(`https://youtube.com.evil.test/watch?v=${ID}`) === null);
check("rejects evil host w/ youtube path", youtubeVideoId(`https://evil.test/youtube.com/watch?v=${ID}`) === null);
check("rejects @-userinfo host spoof", youtubeVideoId(`https://www.youtube.com@evil.test/watch?v=${ID}`) === null);
check("rejects too-short id", youtubeVideoId("https://www.youtube.com/watch?v=short") === null);
check("rejects too-long id", youtubeVideoId(`https://www.youtube.com/watch?v=${ID}EXTRA`) === null);
check("rejects watch w/o v param", youtubeVideoId("https://www.youtube.com/watch?list=abc") === null);
check("rejects channel URL", youtubeVideoId("https://www.youtube.com/@CFPB") === null);

// --- normalize + embed helpers ---
check("normalize → canonical watch URL", normalizeYouTubeUrl(`https://youtu.be/${ID}`) === `https://www.youtube.com/watch?v=${ID}`);
check("normalize rejects junk", normalizeYouTubeUrl("https://vimeo.com/1") === null);
check("embed uses no-cookie host", youtubeEmbedUrl(ID) === `https://www.youtube-nocookie.com/embed/${ID}?rel=0`);

console.log(`\nyoutube.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
