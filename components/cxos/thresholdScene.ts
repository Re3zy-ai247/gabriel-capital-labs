// CXOS Threshold — the ENVIRONMENT (Phase 2).
//
// One imperative three.js scene, built for a single ten-second entry and then
// destroyed without a trace. Everything here answers to the mandate's rules:
// the environment wakes up (not a logo animation), light guides attention, and
// nothing is decorative — every element is either the darkness, the light, or
// the architecture the light reveals.
//
// PERFORMANCE ARCHITECTURE (the budget this file is built against):
//   · 3 draw calls total on desktop: one Points cloud, one InstancedMesh of
//     corridor light strips, one additive sprite pair (light core + nebula).
//   · No shadows, no postprocessing, antialias off, DPR clamped (1.5 desktop,
//     1 mobile), particle count 2600 desktop / 1400 mobile.
//   · Zero per-frame allocation: all vectors and buffers are created once.
//   · dispose() releases every geometry, material, texture and the GL context
//     itself — after the Threshold, the page carries NO residual WebGL cost.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  BoxGeometry,
  CanvasTexture,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  WebGLRenderer,
} from "three";

// Palette rule (DESIGN-SYSTEM.md): navy/blue/teal only. These are the brand
// families as light — teal core, ocean depth, on the deepest ink ground.
const INK = 0x02040a;
const TEAL = 0x0ea5c4;   // brand-500 — the ::selection teal, the product's own light
const TEAL_HI = 0x67e8f9;
const OCEAN = 0x2563eb;  // the ocean/blue depth family

export interface ThresholdScene {
  setProgress(p: number): void;
  setParallax(x: number, y: number): void;
  /** Director controls: fraction of the particle field to draw (0.1–1). */
  setDensity(f: number): void;
  /** Director controls: light multiplier (0.2–1.5) on every emissive element. */
  setIntensity(f: number): void;
  getCameraZ(): number;
  tick(dt: number): void;
  resize(): void;
  dispose(): void;
}

/** Soft radial texture, generated — no asset download for atmosphere. */
function glowTexture(inner: string, outer: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export function createThresholdScene(
  canvas: HTMLCanvasElement,
  mobile: boolean,
  onContextLost: () => void,
): ThresholdScene {
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setClearColor(INK, 1);

  // Context loss (integrated-GPU memory pressure, tab backgrounding, driver
  // reset) must degrade to the already-rendered static landing beneath, never
  // freeze on it. preventDefault() is the WebGL-spec signal that WE handle the
  // loss; we deliberately never listen for webglcontextrestored — a one-shot
  // ten-second entrance has nothing worth resuming mid-scene, so falling
  // through to the settled page is the correct outcome here, not a failure to
  // recover from.
  function handleContextLost(e: Event) {
    console.warn("[Threshold] WebGL context lost — degrading to the static landing beneath");
    e.preventDefault();
    onContextLost();
  }
  canvas.addEventListener("webglcontextlost", handleContextLost, false);

  const scene = new Scene();
  const camera = new PerspectiveCamera(58, 1, 0.1, 220);

  // ── The dark: a slow particle field with real depth ────────────────────────
  const COUNT = mobile ? 1400 : 2600;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 90;      // x
    positions[i * 3 + 1] = (Math.random() - 0.5) * 50;  // y
    positions[i * 3 + 2] = -Math.random() * 160;        // z — a field you travel THROUGH
    seeds[i] = Math.random() * Math.PI * 2;
  }
  const pGeo = new BufferGeometry();
  pGeo.setAttribute("position", new BufferAttribute(positions, 3));
  const pTex = glowTexture("rgba(180,230,245,0.9)", "rgba(180,230,245,0)");
  const pMat = new PointsMaterial({
    size: mobile ? 0.5 : 0.42,
    map: pTex,
    color: new Color(TEAL_HI),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new Points(pGeo, pMat);
  scene.add(points);

  // ── The distant light: core + nebula, additive, no shaders ────────────────
  const coreTex = glowTexture("rgba(255,255,255,1)", "rgba(103,232,249,0)");
  const coreMat = new SpriteMaterial({ map: coreTex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const core = new Sprite(coreMat);
  core.position.set(0, 0.6, -120);
  core.scale.setScalar(4);
  scene.add(core);

  const nebTex = glowTexture("rgba(14,165,196,0.55)", "rgba(37,99,235,0)");
  const nebMat = new SpriteMaterial({ map: nebTex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const nebula = new Sprite(nebMat);
  nebula.position.set(0, 0, -122);
  nebula.scale.set(90, 60, 1);
  scene.add(nebula);

  // ── The architecture: corridor light strips, one instanced draw ───────────
  // Two colonnades of emissive strips converging on the light — the facility
  // assembling around the visitor as they advance.
  const STRIPS = mobile ? 16 : 28;
  const strip = new BoxGeometry(0.16, 3.4, 0.16);
  const sMat = new MeshBasicMaterial({ color: new Color(TEAL), transparent: true, opacity: 0 });
  const strips = new InstancedMesh(strip, sMat, STRIPS);
  const m4 = new Matrix4();
  for (let i = 0; i < STRIPS; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    m4.makeTranslation(side * 7.5, 0, -14 - row * 9);
    strips.setMatrixAt(i, m4);
  }
  strips.instanceMatrix.needsUpdate = true;
  scene.add(strips);

  // Floor guide-lines — the landing's grid texture, met early as architecture.
  const railGeo = new BoxGeometry(0.06, 0.06, 150);
  const railMat = new MeshBasicMaterial({ color: new Color(OCEAN), transparent: true, opacity: 0 });
  const railL = new InstancedMesh(railGeo, railMat, 2);
  m4.makeTranslation(-7.5, -2.4, -80); railL.setMatrixAt(0, m4);
  m4.makeTranslation(7.5, -2.4, -80); railL.setMatrixAt(1, m4);
  railL.instanceMatrix.needsUpdate = true;
  scene.add(railL);

  // ── State ─────────────────────────────────────────────────────────────────
  let progress = 0;
  let density = 1;           // Director: fraction of particles drawn
  let intensity = 1;         // Director: emissive multiplier
  let px = 0, py = 0;        // parallax target (pointer / tilt)
  let cx = 0, cy = 0;        // smoothed camera offset
  let time = 0;

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  /** 0→1 within a beat window [a,b] of the master progress. */
  const win = (a: number, b: number) => clamp01((progress - a) / (b - a));
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);

  function setProgress(p: number) { progress = clamp01(p); }
  function setParallax(x: number, y: number) { px = x; py = y; }
  function setDensity(f: number) {
    density = Math.min(1, Math.max(0.1, f));
    pGeo.setDrawRange(0, Math.floor(COUNT * density));
  }
  function setIntensity(f: number) { intensity = Math.min(1.5, Math.max(0.2, f)); }
  function getCameraZ() { return camera.position.z; }

  function tick(dt: number) {
    time += dt;
    // Smoothed parallax — the room answers the hand, it never snaps to it.
    cx += (px * 1.3 - cx) * Math.min(1, dt * 3.2);
    cy += (py * 0.8 - cy) * Math.min(1, dt * 3.2);

    // The walk: one continuous dolly, accelerating through the opening.
    const dolly = ease(win(0.1, 0.92)) * 34 + ease(win(0.92, 1)) * 26;
    camera.position.set(cx, 0.4 + cy * 0.5, 62 - dolly);
    camera.lookAt(cx * 0.35, 0.35, camera.position.z - 30);

    // Beat 0 — the void breathes in.
    pMat.opacity = (0.14 + ease(win(0, 0.14)) * 0.5) * intensity;
    // Particles drift; late in the walk they streak past (z-velocity with progress).
    const flow = 0.35 + ease(win(0.85, 1)) * 26;
    const pos = pGeo.getAttribute("position") as BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] += Math.sin(time * 0.3 + seeds[i]) * dt * 0.12;
      arr[i * 3 + 1] += Math.cos(time * 0.23 + seeds[i]) * dt * 0.1;
      arr[i * 3 + 2] += dt * flow;
      if (arr[i * 3 + 2] > camera.position.z + 2) arr[i * 3 + 2] -= 160;
    }
    pos.needsUpdate = true;

    // Beat 1 — the first light: distant, then undeniable.
    const lightIn = ease(win(0.12, 0.3));
    coreMat.opacity = (lightIn * 0.9 + ease(win(0.92, 1)) * 0.1) * intensity;
    core.scale.setScalar(4 + lightIn * 5 + ease(win(0.85, 1)) * 60);
    nebMat.opacity = lightIn * 0.55 * intensity;

    // Beat 2 — the architecture assembles: strips fade up in sequence, with a
    // slow sinusoidal "power" shimmer that reads as energy, not blinking.
    const arch = win(0.28, 0.52);
    sMat.opacity = ease(arch) * 0.85 * intensity;
    railMat.opacity = ease(win(0.32, 0.5)) * 0.5 * intensity;
    const pulse = 0.92 + Math.sin(time * 1.7) * 0.08;
    sMat.color.setHex(TEAL).multiplyScalar(pulse);

    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.5));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    canvas.removeEventListener("webglcontextlost", handleContextLost);
    pGeo.dispose(); pMat.dispose(); pTex.dispose();
    strip.dispose(); sMat.dispose();
    railGeo.dispose(); railMat.dispose();
    coreMat.dispose(); coreTex.dispose();
    nebMat.dispose(); nebTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  resize();

  // A <canvas> hands out exactly ONE WebGL context for its whole lifetime —
  // once lost (forceContextLoss, above, in a PRIOR instance's dispose()),
  // every later getContext() call on the SAME canvas returns that SAME dead
  // context, never a fresh one. That matters here specifically because React
  // StrictMode's dev-only mount→unmount→mount replay reuses the same canvas
  // DOM node: the renderer just constructed above may already be wrapping a
  // context whose loss transition happened in the PAST (during the sibling
  // instance's disposal, before this instance's webglcontextlost listener
  // even existed to hear it) — events fire on the transition, never on
  // request, so that listener would wait forever for an event that already
  // happened. Deferred one microtask so Threshold.tsx finishes assigning its
  // own `scene` variable (this function returning) and the rest of its
  // effect body (tl, listeners, the watchdog) before onContextLost can
  // possibly run — same ordering guarantee the event listener gets for free
  // by virtue of being async.
  queueMicrotask(() => {
    if (renderer.getContext().isContextLost()) onContextLost();
  });

  return { setProgress, setParallax, setDensity, setIntensity, getCameraZ, tick, resize, dispose };
}
