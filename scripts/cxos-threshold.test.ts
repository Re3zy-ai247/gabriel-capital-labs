// Run: npx tsx scripts/cxos-threshold.test.ts
//
// SOURCE-LEVEL guard for the CXOS Threshold (Phase 2) — labelled as such; the
// behavioural evidence is the Playwright pass in the Phase 2 report (overlay
// on first visit, absent on return visit, absent under reduced motion, Escape
// skip, landing HTML complete beneath).
//
// WHAT THIS HOLDS — the safety contract that lets a WebGL entry sequence
// coexist with the never-rescinded CXOS non-negotiables:
//   1. The gate fails closed toward the plain landing: reduced-motion check,
//      session memory, WebGL probe, and load-after-LCP are all present.
//   2. three/gsap NEVER enter the landing's synchronous graph — the experience
//      is reachable only through import().
//   3. Sound cannot autoplay: AudioContext construction exists exactly once,
//      inside the user-gesture toggle, never in an effect.
//   4. The scene cleans up completely: every resource disposed, GL context
//      released, page scroll restored.
//   5. The overlay is an accessible dialog with a first-focus skip control and
//      a single Escape-keyed exit path.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const gate = readFileSync(join(root, "components/cxos/ThresholdGate.tsx"), "utf8");
const thr = readFileSync(join(root, "components/cxos/Threshold.tsx"), "utf8");
const scn = readFileSync(join(root, "components/cxos/thresholdScene.ts"), "utf8");
const page = readFileSync(join(root, "app/page.tsx"), "utf8");

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

// ── 1 · the gate fails closed ────────────────────────────────────────────────
check("gate: reduced-motion visitors never mount the Threshold (and download zero WebGL bytes)",
  /matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\)\s*return/.test(gate));
check("gate: the Threshold plays once per session (sessionStorage memory)",
  /sessionStorage\.getItem\("cx-threshold"\)\s*===\s*"1"\)\s*return/.test(gate));
check("gate: storage failure fails CLOSED (never risks replaying forever)",
  /catch\s*\{[^}]*return/.test(gate));
check("gate: WebGL probed before any import",
  /getContext\("webgl2"\)\s*\?\?\s*probe\.getContext\("webgl"\)/.test(gate) && /if\s*\(!gl\)\s*return/.test(gate));
check("gate: experience loads after the load event + idle — never against LCP",
  /addEventListener\("load"/.test(gate) && /requestIdleCallback/.test(gate));

// ── 2 · heavy libraries are lazy-only ────────────────────────────────────────
check("gate: Threshold reachable only through dynamic import()",
  /import\("\.\/Threshold"\)/.test(gate) && !/from "\.\/Threshold"/.test(gate));
check("gate itself imports neither three nor gsap",
  !/from "three"/.test(gate) && !/from "gsap"/.test(gate));
check("the landing page imports neither three nor gsap statically",
  !/from "three"/.test(page) && !/from "gsap"/.test(page));
check("the landing mounts the gate (the Threshold exists on /)",
  /<ThresholdGate \/>/.test(page));

// ── 3 · sound is opt-in by construction ──────────────────────────────────────
check("exactly ONE AudioContext construction site exists",
  (thr.match(/new AudioContext\(\)/g) ?? []).length === 1);
{
  const toggle = thr.slice(thr.indexOf("function toggleSound"));
  check("…and it lives inside the user-gesture toggle", /new AudioContext\(\)/.test(toggle));
  const effect = thr.slice(thr.indexOf("useEffect"), thr.indexOf("function toggleSound"));
  check("…and never inside the mount effect (no autoplay path)", !/new AudioContext\(\)/.test(effect));
}
check("no media elements — sound is synthesized, nothing downloadable or autoplayable",
  !/<audio/.test(thr) && !/\.play\(\)/.test(thr));
check("the sound toggle is a labelled, stateful control", /aria-pressed=\{soundOn\}/.test(thr));

// ── 4 · complete cleanup ─────────────────────────────────────────────────────
check("scene dispose releases the renderer AND the GL context",
  /renderer\.dispose\(\);\s*renderer\.forceContextLoss\(\)/.test(scn));
check("every geometry/material/texture is disposed",
  ["pGeo", "pMat", "pTex", "strip", "sMat", "railGeo", "railMat", "coreMat", "coreTex", "nebMat", "nebTex"]
    .every((n) => new RegExp(`${n}\\.dispose\\(\\)`).test(scn)));
check("page scroll is locked during the walk and restored after",
  /documentElement\.style\.overflow = "hidden"/.test(thr) && /documentElement\.style\.overflow = prevOverflow/.test(thr));
check("the rAF loop pauses when the tab is hidden", /document\.hidden/.test(thr));
check("session memory is written on EVERY exit path (finish handles skip and completion alike)",
  /sessionStorage\.setItem\("cx-threshold", "1"\)/.test(thr));

// ── 5 · accessibility contract ───────────────────────────────────────────────
check("the overlay is a labelled dialog that names its escape hatch",
  /role="dialog"/.test(thr) && /Press Escape to skip/.test(thr));
check("the skip control takes first focus", /skipRef\.current\?\.focus/.test(thr));
check("Escape is the single exit path and the button reuses it",
  /e\.key === "Escape"\) finish\(false\)/.test(thr) && /new KeyboardEvent\("keydown", \{ key: "Escape" \}\)/.test(thr));
check("focus lands on the Hero's h1 after the opening", /querySelector<HTMLElement>\("#main h1"\)/.test(thr));
check("the canvas and vignette are decoration to assistive tech",
  /<canvas[^>]*aria-hidden/.test(thr) && /cxt-vignette[^"]*"[^>]*\/>/.test(thr.replace(/\n/g, " ")) ? /aria-hidden className="cxt-vignette/.test(thr) : false);

// ── 6 · performance architecture ─────────────────────────────────────────────
check("DPR is clamped (1.5 desktop / 1 mobile)",
  /Math\.min\(window\.devicePixelRatio, mobile \? 1 : 1\.5\)/.test(scn));
check("particle budget is capped (2600 desktop / 1400 mobile)",
  /mobile \? 1400 : 2600/.test(scn));
check("the corridor is ONE instanced draw", /new InstancedMesh\(strip, sMat, STRIPS\)/.test(scn));
check("no shadows anywhere in the scene", !/castShadow|receiveShadow|shadowMap/.test(scn));
check("antialias off — resolution spent on particles, not edges", /antialias: false/.test(scn));
check("the walk cannot stall (auto-advance floor exists alongside input strides)",
  /target = Math\.min\(1, target \+ dt \//.test(thr));
check("input can only move the walk FORWARD (scroll never rewinds the entry)",
  /if \(dy > 0\) target \+=/.test(thr) && !/target -=/.test(thr));
check("no iOS permission wall — tilt only where it is free",
  /requestPermission/.test(thr) && /if \(!iosPermissionWall\) window\.addEventListener\("deviceorientation"/.test(thr));

console.log(`\ncxos-threshold.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
