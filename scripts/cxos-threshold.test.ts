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
check("Escape is the single exit path and the button reuses it — and it hard-dismisses (true), not the fade-gated path",
  /e\.key === "Escape"\) finish\(true\)/.test(thr) && /new KeyboardEvent\("keydown", \{ key: "Escape" \}\)/.test(thr));
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
  /target = Math\.min\(1, target \+ \(dt \* speed\) \//.test(thr));
check("input can only move the walk FORWARD (scroll never rewinds the entry)",
  /if \(dy > 0 && !paused\) target \+=/.test(thr) && !/target -=/.test(thr));
check("no iOS permission wall — tilt only where it is free",
  /requestPermission/.test(thr) && /if \(!iosPermissionWall\) window\.addEventListener\("deviceorientation"/.test(thr));

// ── 7 · context loss degrades to the landing, never freezes on it ───────────
// A lost WebGL context (integrated-GPU memory pressure, tab backgrounding,
// driver reset) must not be able to strand a visitor behind a frozen entry
// with no working escape hatch. These checks hold the independent mechanisms
// that make that true together, not any one of them alone.
check("(a) the scene registers a webglcontextlost handler, calls preventDefault per the WebGL spec, and never registers a restore listener",
  /addEventListener\("webglcontextlost"/.test(scn) &&
  /e\.preventDefault\(\)/.test(scn) &&
  !/addEventListener\("webglcontextrestored"/.test(scn));
check("(a) Threshold wires that handler to its own hard-dismiss path when creating the scene",
  /createThresholdScene\(canvas, mobile, \(\) => finish\(true\)\)/.test(thr));
check("(a2) a context ALREADY dead at creation time is also caught — not just one that dies later — via a deferred post-creation liveness check",
  /queueMicrotask\(\(\) => \{/.test(scn) && /isContextLost\(\)/.test(scn) && /onContextLost\(\)/.test(scn));
check("(b) the skip/dismiss path does not require a live timeline: Escape hard-dismisses unconditionally",
  /if \(e\.key === "Escape"\) finish\(true\)/.test(thr));
check("(b) teardown is hard-cleanup-first: cleanup() is a standalone function, independently guarded, not nested inside finish()'s deferred fade",
  /function cleanup\(\)/.test(thr) && /if \(cleanedUp\) return;/.test(thr));
check("(b) the cosmetic fade-then-cleanup (finish(false)/onComplete) is reserved for the one call site that already proves the loop is healthy — natural completion",
  /else finish\(false\)/.test(thr) && (thr.match(/finish\(false\)/g) ?? []).length === 1);
check("(c) a watchdog exists with a bounded timeout (DUR + fixed grace) and calls cleanup() directly, bypassing finish()'s `done` gate",
  /window\.setTimeout\(\(\) => \{[\s\S]{0,200}cleanup\(\);[\s\S]{0,20}\}, \(DUR \+ 2\) \* 1000\)/.test(thr));
check("(c) the watchdog is exempt only in review mode — the Director HUD's intentional loop past DUR is not a freeze",
  /const watchdog = review \? undefined : window\.setTimeout/.test(thr));
check("(c) the watchdog timer is cleared on every real teardown path — no leaked timer survives a clean exit",
  (thr.match(/window\.clearTimeout\(watchdog\)/g) ?? []).length >= 2);

// ── 8 · React StrictMode-safe: no ref can poison a persisting mount ─────────
// PROVEN root cause (live, gstack, dev StrictMode repro — not theoretical):
// StrictMode's dev-only mount→unmount→mount replay reuses the same <canvas>
// (one WebGL context per canvas, ever) AND, if the dismissal guard is a REF,
// the first (simulated) unmount's legitimate cleanup poisons it for the
// second (real, persisting) mount — every dismissal path silently becomes a
// permanent no-op on the mount that actually matters. Confirmed live: the
// synchronous scene-creation throw on the second mount is a real, observed
// path, not a hypothetical one.
check("(8a) no ref survives across the effect boundary to gate dismissal — doneRef is gone",
  !/doneRef/.test(thr.replace(/\/\/.*doneRef.*/g, "")));
check("(8b) `done`/`cleanedUp` are declared INSIDE the effect (plain `let`, fresh every invocation), not via useRef at component scope",
  (() => {
    const effectBody = thr.slice(thr.indexOf("useEffect(() => {"), thr.indexOf("}, []);"));
    return /(^|\W)let done = false;/.test(effectBody) &&
      /let cleanedUp = false;/.test(effectBody) &&
      !/const doneRef = useRef/.test(thr);
  })());
check("(8c) the synchronous-throw catch path does its OWN minimal dismissal — it does not CALL finish()/cleanup(), which reference bindings (tl, raf, the listeners) that don't exist yet at that point in the function",
  (() => {
    const raw = thr.slice(thr.indexOf("} catch {"), thr.indexOf("onDone();\n      return;\n    }") + 40);
    // Strip // comments first — the block's own explanatory prose legitimately
    // mentions "finish()/cleanup()" as the thing it is NOT doing, which would
    // otherwise false-positive a plain substring check.
    const code = raw.replace(/\/\/[^\n]*/g, "");
    return /done = true;/.test(code) && /cleanedUp = true;/.test(code) &&
      !/finish\(/.test(code) && !/cleanup\(\)/.test(code);
  })());

console.log(`\ncxos-threshold.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
