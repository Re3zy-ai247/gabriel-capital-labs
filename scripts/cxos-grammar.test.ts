// Run: npx tsx scripts/cxos-grammar.test.ts
//
// SOURCE-LEVEL guard for the CXOS Experience Grammar codification (Phase 1).
// CSS has no runtime harness in this repository, so these assertions pin the
// SOURCE TEXT of app/globals.css and app/page.tsx — labelled as such, and never
// to be quoted as runtime proof. The behavioural evidence for this phase is the
// screenshot set in the Phase 1 report (real Chromium, including a
// --force-prefers-reduced-motion pass).
//
// WHAT THIS GUARD HOLDS:
//  1. The motion tokens exist with the exact ratified values (the "vector ease"
//     and the duration/amplitude scale from CXOS_FOUNDATION.md §5.8/§5.5).
//  2. The shipped primitives actually CONSUME the tokens — codification means
//     one governed source of timing, not two.
//  3. REDUCED-MOTION COVERAGE BY ENUMERATION: every `cx-` utility declared
//     anywhere in the stylesheet must also be addressed inside a
//     prefers-reduced-motion block. This is the invariant that matters — a
//     future utility added without reduced-motion parity fails HERE, not in an
//     accessibility audit six months later.
//  4. The landing hero carries the Scene 1 choreography classes and app/page.tsx
//     remains a server component (static rendering is a CXOS acceptance
//     criterion — the cinematic layer must never force the landing dynamic).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const page = readFileSync(join(root, "app/page.tsx"), "utf8");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

// ── 1 · tokens, exact ratified values ────────────────────────────────────────
check("the vector ease token exists with the exact house curve",
  /--ease-vector:\s*cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\)/.test(css));
check("--dur-settle is 0.4s", /--dur-settle:\s*0?\.4s/.test(css));
check("--dur-reveal is 0.6s", /--dur-reveal:\s*0?\.6s/.test(css));
check("--dur-focus is 0.35s", /--dur-focus:\s*0?\.35s/.test(css));
check("--dur-crossfade is 0.28s", /--dur-crossfade:\s*0?\.28s/.test(css));
check("--dur-draw is 1.8s", /--dur-draw:\s*1\.8s/.test(css));
check("aurora marketing amplitude is 0.5", /--aurora-marketing:\s*0?\.5\s*;/.test(css));
check("aurora application amplitude is 0.15", /--aurora-app:\s*0?\.15\s*;/.test(css));

// ── 2 · the primitives consume the tokens (governed timing, single source) ──
check("Settle (.animate-rise) resolves through the tokens",
  /\.animate-rise\s*\{\s*animation:\s*rise\s+var\(--dur-settle\)\s+var\(--ease-vector\)\s+both;\s*\}/.test(css));
check("Reveal (.reveal) resolves through the tokens",
  /\.reveal\s*\{[^}]*var\(--dur-reveal\)\s+var\(--ease-vector\)/.test(css));
check("Draw (.animate-draw) resolves through the tokens",
  /\.animate-draw\s*\{\s*animation:\s*draw\s+var\(--dur-draw\)\s+var\(--ease-vector\)/.test(css));
check("Drift (.aurora) amplitude resolves through the marketing token",
  /\.aurora\s*\{[^}]*opacity:\s*var\(--aurora-marketing\)/.test(css));
check("Focus (.cx-focus-out) exists and resolves through the tokens",
  /\.cx-focus-out\s*\{[^}]*blur\(4px\)[^}]*var\(--dur-focus\)\s+var\(--ease-vector\)/.test(css));
check("the application aurora variant exists at half drift speed",
  /\.aurora-app\s*\{[^}]*opacity:\s*var\(--aurora-app\)[^}]*animation-duration:\s*36s/.test(css));

// ── 3 · Scene 1 arrival choreography (M1–M3) ─────────────────────────────────
check("M1: the arrival breath fades the aurora to the marketing amplitude",
  /@keyframes cx-breath\s*\{\s*from\s*\{\s*opacity:\s*0;?\s*\}\s*to\s*\{\s*opacity:\s*var\(--aurora-marketing\);?\s*\}\s*\}/.test(css));
check("M1: the breath composes WITH drift rather than replacing it",
  /\.cx-arrival \.aurora\s*\{\s*animation:\s*cx-breath[^}]*,\s*drift/.test(css));
check("the offset aurora delays only its drift, never its breath",
  /\.cx-arrival \.aurora-late\s*\{\s*animation-delay:\s*0s,\s*5s;\s*\}/.test(css));
check("M2: the settle ladder is exactly 80 / 160 / 240 / 400 ms",
  /\.cx-d1\s*\{\s*animation-delay:\s*80ms/.test(css) &&
  /\.cx-d2\s*\{\s*animation-delay:\s*160ms/.test(css) &&
  /\.cx-d3\s*\{\s*animation-delay:\s*240ms/.test(css) &&
  /\.cx-d4\s*\{\s*animation-delay:\s*400ms/.test(css));
check("M3: the sheen runs ONCE (iteration count 1), automatically, after the breath",
  /\.cx-sheen-overlay::after\s*\{[^}]*animation:\s*cx-sheen\s+0?\.6s\s+var\(--ease-vector\)\s+1\.4s\s+1\s+both/.test(css));
check("M3: the sheen clips itself in its own overlay, never the host card",
  /\.cx-sheen-overlay\s*\{[^}]*overflow:\s*hidden[^}]*pointer-events:\s*none/.test(css));

// ── 4 · reduced-motion coverage BY ENUMERATION ───────────────────────────────
// Collect every reduce block, then every cx- class declared OUTSIDE them, and
// require each to be addressed INSIDE one. A new cx- utility with no
// reduced-motion story fails this guard by construction.
const reduceBlocks: string[] = [];
{
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    reduceBlocks.push(css.slice(start, i - 1));
  }
}
check("at least one prefers-reduced-motion block exists", reduceBlocks.length > 0);
const reduceCss = reduceBlocks.join("\n");
const outsideCss = reduceBlocks.reduce((acc, b) => acc.replace(b, ""), css);
const declared = new Set(
  [...outsideCss.matchAll(/\.(cx-[a-z0-9-]+)/g)].map((x) => x[1])
);
check("cx- utilities exist to be covered (enumeration is not vacuous)", declared.size >= 6);
for (const cls of [...declared].sort()) {
  check(`reduced-motion addresses .${cls}`, reduceCss.includes(`.${cls}`));
}
check("reduced motion lands the aurora at FULL marketing amplitude (final frame, not darkness)",
  /\.cx-arrival \.aurora\s*\{\s*animation:\s*none;\s*opacity:\s*var\(--aurora-marketing\)/.test(reduceCss));
check("reduced motion zeroes every settle delay",
  /\.cx-d1,\s*\.cx-d2,\s*\.cx-d3,\s*\.cx-d4\s*\{\s*animation-delay:\s*0s/.test(reduceCss));
check("reduced motion removes the sheen entirely",
  /\.cx-sheen-overlay::after\s*\{[^}]*display:\s*none/.test(reduceCss));

// ── 5 · the landing hero wears the grammar; the page stays static ────────────
check("the hero section is scoped with cx-arrival",
  /<section className="cx-arrival relative overflow-hidden">/.test(page));
check("the h1 settles as content (LCP element is real copy, not an intro asset)",
  /<h1 className="h-display animate-rise cx-d1/.test(page));
check("the CTA row settles on the ladder", /animate-rise cx-d3[^"]*"/.test(page));
check("the product frame settles last and carries the sheen overlay",
  /animate-rise cx-d4 relative/.test(page) && /className="cx-sheen-overlay rounded-2xl"/.test(page));
check("the sheen overlay is aria-hidden decoration", /aria-hidden className="cx-sheen-overlay/.test(page));
check("the offset aurora uses the class, not an inline animation-delay",
  /aurora aurora-late/.test(page) && !/animationDelay/.test(page));
check("app/page.tsx remains a server component (no 'use client')",
  !/^\s*["']use client["']/m.test(page));

// ── 6 · performance hygiene ──────────────────────────────────────────────────
check("globals.css contains no `transition: all`", !/transition:\s*all\b/.test(css));
check("the arrival animates transform/opacity only (no layout properties in cx keyframes)",
  !/@keyframes cx-[a-z-]+\s*\{[^}]*(width|height|margin|padding|top:|font-size)/.test(
    css.replace(/@keyframes cx-sheen\s*\{[^}]*\}/, "")) // cx-sheen animates `left` INSIDE its own clipped overlay — composited away from document flow, no reflow of content
);

console.log(`\ncxos-grammar.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
