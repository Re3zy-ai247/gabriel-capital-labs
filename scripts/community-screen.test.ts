// Run: npx tsx scripts/community-screen.test.ts
// Guards the Operator Network's member-authored write path:
//  1. screenCommunityText — CROA gate. Member posts are the member's OWN words, so a
//     prohibited claim is REJECTED (fail-closed 422), never silently reworded. This
//     closes the gap where thread/reply creation had no compliance screen at all
//     while the Brief's comment path did.
//  2. The routes actually call it BEFORE any write, and carry a write throttle.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screenCommunityText, COMMUNITY_CLAIM_ERROR } from "../lib/community";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// ── 1. Clean member text passes untouched ────────────────────────────────────
check("accepts a clean post", screenCommunityText("Bureau responded in 28 days").ok === true);
check("accepts clean title + body together",
  screenCommunityText("Experian response", "They verified the account. What is my next step?").ok === true);
check("empty input is not an error (length rules belong to the route)",
  screenCommunityText("").ok === true && screenCommunityText().ok === true);

// ── 2. Prohibited claims are REJECTED, never reworded ────────────────────────
for (const bad of [
  "I guarantee this will get deleted",
  "guaranteed deletion every time",
  "this account will be deleted once you send it",
  "100% removal, works for everyone",
  "§609 requires deletion of the account",
  "metro 2 requires deletion when the fields mismatch",
  "this is illegal and they are in violation of the FCRA",
]) {
  const r = screenCommunityText(bad);
  check(`rejects: ${bad.slice(0, 40)}`, r.ok === false);
  check(`rejection carries the member-facing reason: ${bad.slice(0, 24)}`,
    r.ok === false && r.error === COMMUNITY_CLAIM_ERROR);
}

// A prohibited claim hidden in the BODY is caught even when the title is clean —
// the screen must see every member-authored field, not just the first.
check("screens the body, not only the title",
  screenCommunityText("Quick question", "they guaranteed deletion on the call").ok === false);

// ── 3. The error text itself holds the CROA bar ──────────────────────────────
check("error names the prohibited classes without promising anything",
  /guaranteed deletions/.test(COMMUNITY_CLAIM_ERROR) &&
  /§609\/Metro-2/.test(COMMUNITY_CLAIM_ERROR) &&
  /legal conclusions/.test(COMMUNITY_CLAIM_ERROR));

// ── 4. Both write paths screen BEFORE the write, and throttle ────────────────
const threadRoute = read("app/api/community/threads/route.ts");
const replyRoute = read("app/api/community/threads/[id]/replies/route.ts");

for (const [name, src, createCall] of [
  ["thread create", threadRoute, "prisma.communityThread.create"],
  ["reply create", replyRoute, "prisma.communityReply.create"],
] as const) {
  const screenAt = src.indexOf("screenCommunityText(");
  const writeAt = src.indexOf(createCall);
  check(`${name}: calls screenCommunityText`, screenAt > -1);
  check(`${name}: screens BEFORE the write (fail-closed ordering)`, screenAt > -1 && writeAt > -1 && screenAt < writeAt);
  check(`${name}: rejects with 422 (a refusal, not a validation nit)`, /status: 422/.test(src));
  check(`${name}: carries a write throttle`, /enforceRateLimit\(`community-/.test(src));
  const limitAt = src.search(/enforceRateLimit\(`community-/);
  check(`${name}: throttles BEFORE the write`, limitAt > -1 && writeAt > -1 && limitAt < writeAt);
}

// The screen must never mutate member text — rejection only. If a future edit makes
// it return a rewritten body, this fails: the platform would be putting words in a
// member's mouth, which is exactly what the Brief precedent forbids.
check("screen returns no rewritten text (reject-only contract)",
  !/body:/.test(read("lib/community.ts").split("export function screenCommunityText")[1]?.split("\n}")[0] ?? "body:"));

console.log(`\ncommunity-screen.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
