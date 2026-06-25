// Run: npx tsx scripts/brief-comment.test.ts
// Guards the two pure pieces of Brief comment handling:
//  1. screenCommentBody — CROA gate: prohibited-claim comments are REJECTED, clean
//     comments pass through unchanged (we never reword the reader).
//  2. briefCommentAuthorName — privacy: never exposes a full legal name.
import { screenCommentBody, briefCommentAuthorName } from "../lib/brief";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

// --- screenCommentBody: clean text passes through verbatim ---
const clean = "Great breakdown — I disputed an error and the bureau responded within 30 days.";
const r1 = screenCommentBody(clean);
check("accepts a clean comment", r1.ok === true);
check("clean comment is stored verbatim (not reworded)", r1.ok && r1.body === clean);
check("trims surrounding whitespace", (() => { const r = screenCommentBody("  hello there  "); return r.ok && r.body === "hello there"; })());

// --- rejects empty / too short ---
check("rejects empty", screenCommentBody("").ok === false);
check("rejects 1 char", screenCommentBody("x").ok === false);
check("rejects non-string", screenCommentBody(null).ok === false);

// --- rejects CROA-prohibited claims (does NOT silently store a reworded version) ---
for (const bad of [
  "I guarantee this will work for you",
  "guaranteed deletion is the way to go",
  "that account will be deleted, trust me",
  "section 609 requires deletion of any negative item",
  "this is illegal and they know it",
  "they violated the FCRA when they did that",
  "100% removal, every time",
]) {
  const r = screenCommentBody(bad);
  check(`rejects prohibited: "${bad.slice(0, 32)}…"`, r.ok === false);
}

// --- length cap: a very long comment is capped, still ok if clean ---
const long = "a".repeat(5000);
const rLong = screenCommentBody(long);
check("caps an overlong clean comment to 1500", rLong.ok === true && rLong.body.length === 1500);

// --- briefCommentAuthorName: privacy-safe handle ---
check("prefers username", briefCommentAuthorName({ username: "ceogabriel", name: "Rey Gabriel" }) === "ceogabriel");
check("falls back to FIRST name only (no full legal name)", briefCommentAuthorName({ name: "Rey Gabriel" }) === "Rey");
check("neutral default when nothing", briefCommentAuthorName({}) === "CreditVector reader");
check("trims + caps a long username", briefCommentAuthorName({ username: "x".repeat(60) }).length === 40);

console.log(`\nbrief-comment.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
