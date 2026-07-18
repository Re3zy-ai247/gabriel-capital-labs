// Run: npx tsx scripts/two-world.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// TWO-WORLD ENGINEERING INVARIANT — executable enforcement of the frozen
// Constitution (KAI-DESIGN-LAWS §11; CREDITVECTOR-BRAND-ARCHITECTURE §7;
// KAI-VOICE-GUIDE §9). Makes a constitutional law a hard, testable gate:
//
//   In the PRODUCT, Kai is the KAI monogram + executive intelligence ONLY.
//   The rendered Shiba Inu character is a MARKETING/EDUCATION asset and must
//   NEVER appear on a product/executive surface. Kai never introduces itself.
//
// This guard scans every product surface (components/, app/) and FAILS if:
//   (1) it renders the character (references /kai/states or calls kaiStateSrc), or
//   (2) Kai introduces itself ("Hi, I'm Kai", "I'm Kai", "I am your AI assistant").
//
// The character catalog itself (lib/kaiStates.ts) is a marketing asset system and
// is intentionally NOT a product surface — it is not scanned. A rendered-character
// marketing surface, if ever added, must live outside components/ + app/ product
// routes and would be exempted explicitly here.
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

let pass = 0, fail = 0;
const violations: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else { fail++; violations.push(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`); }
}

// Product surfaces only. (lib/ holds the marketing character catalog + engines.)
const ROOTS = ["components", "app"];
const EXT = /\.(tsx|ts)$/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) continue;
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));
check("product surfaces found to scan", files.length > 0, `scanned ${files.length} files`);

// Rule 1 — no rendered character on any product surface.
const CHARACTER = [
  /\/kai\/states\//,        // character still asset path
  /\bkaiStateSrc\s*\(/,     // the character asset resolver, invoked
];
// Rule 2 — Kai never introduces itself in the product (Voice §9).
const SELF_INTRO = [
  /Hi,?\s*I['’]?m\s+Kai\b/i,
  /\bI['’]?m\s+Kai\b/i,
  /\bI\s+am\s+Kai\b/i,
  /I['’]?m\s+your\s+AI\s+(assistant|helper)/i,
  /\bI\s+am\s+watching\s+your\s+credit\b/i,
];

for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const re of CHARACTER) {
    const m = src.match(re);
    check(`no rendered character on product surface: ${f}`, !m, m ? `matched ${re}` : "");
  }
  for (const re of SELF_INTRO) {
    const m = src.match(re);
    check(`no Kai self-introduction on product surface: ${f}`, !m, m ? `matched "${m[0]}"` : "");
  }
}

// Positive control — the guard must actually catch a violation if one existed.
check("guard has teeth (detects a character path)", CHARACTER.some((re) => re.test('src="/kai/states/Kai-Happy.png"')));
check("guard has teeth (detects a self-intro)", SELF_INTRO.some((re) => re.test("Hi, I'm Kai, your assistant")));
// ...and does NOT false-positive on the legitimate KAI monogram.
check("guard allows the KAI monogram", !CHARACTER.some((re) => re.test('<span>KAI</span>')) && !SELF_INTRO.some((re) => re.test('<span className="tracking-widest">KAI</span>')));

if (violations.length) console.error(violations.join("\n"));
console.log(`\ntwo-world.test.ts: ${pass} passed, ${fail} failed  (${files.length} product surfaces scanned)`);
if (fail) process.exit(1);
