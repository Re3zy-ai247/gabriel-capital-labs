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
//   (1) it renders the character — via the /kai/states asset path, the kaiStateSrc
//       resolver, a product import of the marketing kaiStates catalog, or an
//       inline-SVG character identified by a Shiba aria-label — or
//   (2) Kai introduces itself ("Hi, I'm Kai", "I'm Kai", "I am your AI assistant").
//
// The character catalog itself (lib/kaiStates.ts) is a marketing asset system and
// is intentionally NOT a product surface — it is not scanned.
//
// KNOWN, DOCUMENTED EXEMPTION (EXEMPT below): components/community/KaiAvatar.tsx
// renders the Shiba inline for the community zone (KaiBadge on app/community/*).
// Community is a "distinct product zone" (Constitution Art. VIII), NOT one of the
// Art. III marketing/education surfaces where the character is licensed — so
// whether that render is permitted is an OPEN founder two-world ruling. Until it
// is ruled on, the file is exempted here and reported as a WARNING (never a silent
// pass), so a NEW character render anywhere else still hard-fails. If the founder
// rules it a violation, delete the exemption and the guard fails until it is gone.
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

// Files with a known, founder-gated character render — reported as a WARNING
// rather than a hard FAIL, pending the founder's two-world ruling (see header).
const EXEMPT = new Set<string>(["components/community/KaiAvatar.tsx"]);
const warnings: string[] = [];
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
  /\/kai\/states\//,                       // character still asset path
  /\bkaiStateSrc\s*\(/,                    // the character asset resolver, invoked
  /\bfrom\s+["'][^"']*kaiStates["']/,      // product import of the marketing catalog
  /aria-label\s*=\s*["'][^"']*\bshiba\b/i, // inline-SVG character by its Shiba label
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
  const exempt = EXEMPT.has(f);
  for (const re of CHARACTER) {
    const m = src.match(re);
    if (m && exempt) { warnings.push(`WARN (founder-gated exemption): ${f} matched ${re} — pending two-world ruling`); continue; }
    check(`no rendered character on product surface: ${f}`, !m, m ? `matched ${re}` : "");
  }
  for (const re of SELF_INTRO) {
    const m = src.match(re);
    check(`no Kai self-introduction on product surface: ${f}`, !m, m ? `matched "${m[0]}"` : "");
  }
}

// Positive control — the guard must actually catch a violation if one existed.
check("guard has teeth (detects a character path)", CHARACTER.some((re) => re.test('src="/kai/states/Kai-Happy.png"')));
check("guard has teeth (detects the kaiStates catalog import)", CHARACTER.some((re) => re.test('import { KAI_STATES } from "@/lib/kaiStates"')));
check("guard has teeth (detects an inline-SVG Shiba by aria-label)", CHARACTER.some((re) => re.test('aria-label="Kai the Shiba Inu"')));
check("guard has teeth (detects a self-intro)", SELF_INTRO.some((re) => re.test("Hi, I'm Kai, your assistant")));
// ...and does NOT false-positive on the legitimate KAI monogram.
check("guard allows the KAI monogram", !CHARACTER.some((re) => re.test('<span>KAI</span>')) && !SELF_INTRO.some((re) => re.test('<span className="tracking-widest">KAI</span>')));
// ...and the founder-gated community exemption actually fired (a warning, not a
// silent pass) — proving the broadened detector sees the inline-SVG character.
check("community exemption is live (warned, not silently passed)", warnings.length >= 1, `warnings=${warnings.length}`);

if (warnings.length) console.warn(warnings.join("\n"));
if (violations.length) console.error(violations.join("\n"));
console.log(`\ntwo-world.test.ts: ${pass} passed, ${fail} failed, ${warnings.length} warned  (${files.length} product surfaces scanned)`);
if (fail) process.exit(1);
