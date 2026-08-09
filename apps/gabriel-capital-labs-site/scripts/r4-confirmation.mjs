#!/usr/bin/env node

/**
 * R4.2 institutional-prologue confirmation harness.
 *
 * Usage (from apps/gabriel-capital-labs-site):
 *   node scripts/r4-confirmation.mjs
 *
 * Optional environment:
 *   GCL_BASE_URL=http://127.0.0.1:4310
 *   GCL_CONTROL_URL=http://127.0.0.1:4311
 *   GCL_CONTROL_ROOT=/absolute/path/to/r3-site-root
 *   GCL_EVIDENCE_DIR=docs/reviews/assets/r4
 *   GCL_SCENARIOS=name-one,name-two  (partial/non-attestable smoke only)
 *   GCL_PLAYWRIGHT_PATH=/absolute/path/to/playwright/index.mjs
 *   GCL_CHROME_PATH=/absolute/path/to/Google\ Chrome
 *
 * The site and (optionally) R3 control must already be running. The script
 * creates its evidence directory, writes selected PNGs plus one JSON manifest,
 * and exits non-zero when any assertion or page/console-error check fails.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SITE_CWD = process.cwd();
const BASE_URL = process.env.GCL_BASE_URL ?? "http://127.0.0.1:4310";
const CONTROL_URL = process.env.GCL_CONTROL_URL ?? "http://127.0.0.1:4311";
const CONTROL_ROOT = process.env.GCL_CONTROL_ROOT
  ? path.resolve(process.env.GCL_CONTROL_ROOT)
  : null;
const EVIDENCE_DIR = path.resolve(
  SITE_CWD,
  process.env.GCL_EVIDENCE_DIR ?? "../../docs/reviews/assets/r4"
);
const PLAYWRIGHT_SPECIFIER = process.env.GCL_PLAYWRIGHT_PATH ?? "playwright-core";
const CHROME_PATH =
  process.env.GCL_CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const SESSION_KEY = "gcl-arrival-seen";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const WATCHDOG_CEILING_MS = 23_500;
const BEAT_TABLE_MS = 15_100;
const DEFAULT_TIMEOUT = 30_000;
const REQUESTED_SCENARIOS = new Set(
  (process.env.GCL_SCENARIOS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const OWNED_SELECTOR = "[data-gcl-prologue-inert]";
const OWNED_INERT_SELECTOR = "[data-gcl-prologue-inert][inert]";
const R3_CONTROL_COMMIT = "0c7f51501bee404539ba54b21a339141ef7d2ff6";
const R3_CONTROL_SOURCE_DIGEST =
  "83c5664e7f3a7cc4bf7bbc4591aac1023a784d910c70177e02da72642d25ae90";

const EXPECTED_ASSETS = {
  "public/img/gateway-g-480.webp":
    "90b2c57e6dfd5d2a6cfc46d7f4a89c534337ff19954a6719142872af8b737b19",
  "public/img/gateway-g-768.webp":
    "bdc797d78f19d2e59c7e1e06f9c106203492651ba4300c2c93427407ccf1ef7a",
  "public/img/gateway-g-1080.webp":
    "67f8f444ad9800520e1a4d0f941021cffe8903a16b1a00a9909f25649ef9ccc7",
  "public/img/gateway-g-480.png":
    "9ed7766905c9167b6dd86b6e061430fb1e66892ff1501460702c8755b66b1c9b",
};

const results = {
  schemaVersion: 2,
  suite: "gcl-r4.2-confirmation",
  startedAt: new Date().toISOString(),
  configuration: {
    baseUrl: sanitizeRecordedUrl(BASE_URL),
    controlUrl: sanitizeRecordedUrl(CONTROL_URL),
    controlRootProvided: Boolean(CONTROL_ROOT),
    evidenceDir: EVIDENCE_DIR,
    playwrightSpecifier: PLAYWRIGHT_SPECIFIER,
    chromePath: CHROME_PATH,
    requestedScenarios: [...REQUESTED_SCENARIOS],
    fullConfirmationRun: REQUESTED_SCENARIOS.size === 0,
    watchdogCeilingMs: WATCHDOG_CEILING_MS,
    beatTableMs: BEAT_TABLE_MS,
  },
  assets: {},
  scenarios: {},
  telemetry: [],
  disclosures: [],
  failures: [],
};

let browser;
let screenshotSequence = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorRecord(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
  };
}

function safeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sanitizeRecordedUrl(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "[invalid URL]";
  }
}

function sanitizeTelemetryText(value) {
  return String(value).replace(/https?:\/\/[^\s"'<>]+/gi, (candidate) =>
    sanitizeRecordedUrl(candidate)
  );
}

function assertCredentialFreeEndpoint(value, label) {
  const url = new URL(value);
  assert.equal(url.username, "", `${label} must not contain URL username credentials`);
  assert.equal(url.password, "", `${label} must not contain URL password credentials`);
  assert.equal(url.search, "", `${label} must not contain query credentials; use headers/cookies`);
}

function siteUrl(pathname = "/", base = BASE_URL) {
  const url = new URL(base);
  url.username = "";
  url.password = "";
  url.search = "";
  const [pathPart, hashPart] = pathname.split("#", 2);
  url.pathname = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  url.hash = hashPart ? `#${hashPart}` : "";
  return url.href;
}

async function screenshot(page, label) {
  screenshotSequence += 1;
  const filename = `${String(screenshotSequence).padStart(2, "0")}-${safeName(label)}.png`;
  await page.screenshot({ path: path.join(EVIDENCE_DIR, filename), fullPage: false });
  return filename;
}

async function scenario(name, fn) {
  if (REQUESTED_SCENARIOS.size > 0 && !REQUESTED_SCENARIOS.has(name)) {
    results.scenarios[name] = { status: "skipped", reason: "GCL_SCENARIOS filter" };
    return;
  }
  const started = Date.now();
  try {
    const evidence = (await fn()) ?? {};
    results.scenarios[name] = {
      ...evidence,
      status: "passed",
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const failure = { scenario: name, ...errorRecord(error) };
    results.failures.push(failure);
    results.scenarios[name] = {
      status: "failed",
      durationMs: Date.now() - started,
      error: failure,
    };
  }
}

function attachTelemetry(page, label) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    results.telemetry.push({
      kind: "console.error",
      label,
      url: sanitizeRecordedUrl(page.url()),
      text: sanitizeTelemetryText(message.text()),
    });
  });
  page.on("pageerror", (error) => {
    results.telemetry.push({
      kind: "pageerror",
      label,
      url: sanitizeRecordedUrl(page.url()),
      text: sanitizeTelemetryText(error.message),
      stack: error.stack ? sanitizeTelemetryText(error.stack) : null,
    });
  });
}

async function makePage({
  label,
  reducedMotion = "no-preference",
  viewport = DESKTOP,
  seen = false,
} = {}) {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.addInitScript(
    ({ key, seenValue }) => {
      try {
        if (seenValue) sessionStorage.setItem(key, "1");
        else sessionStorage.removeItem(key);
      } catch {}
    },
    { key: SESSION_KEY, seenValue: seen }
  );
  const page = await context.newPage();
  attachTelemetry(page, label ?? "unnamed");
  page.setDefaultTimeout(DEFAULT_TIMEOUT);
  return { context, page };
}

async function goto(page, url = BASE_URL, waitUntil = "domcontentloaded") {
  const response = await page.goto(url, { waitUntil, timeout: DEFAULT_TIMEOUT });
  await page.waitForSelector("body");
  return response?.status() ?? null;
}

async function stateSnapshot(page) {
  return page.evaluate(
    ({ ownedSelector, ownedInertSelector }) => {
      const html = document.documentElement;
      const replay = document.querySelector(".arrival__replay");
      const replayStyle = replay ? getComputedStyle(replay) : null;
      return {
        prologue: html.classList.contains("gcl-prologue"),
        replaying: html.classList.contains("gcl-replaying"),
        overflow: getComputedStyle(html).overflow,
        overflowY: getComputedStyle(html).overflowY,
        scrollY: window.scrollY,
        dataOwned: document.querySelectorAll(ownedSelector).length,
        ownedInert: document.querySelectorAll(ownedInertSelector).length,
        allInert: document.querySelectorAll("[inert]").length,
        bodyInline: {
          overflow: document.body.style.overflow,
          overflowY: document.body.style.overflowY,
          position: document.body.style.position,
          pointerEvents: document.body.style.pointerEvents,
        },
        replay: replayStyle
          ? {
              opacity: Number(replayStyle.opacity),
              visibility: replayStyle.visibility,
              pointerEvents: replayStyle.pointerEvents,
              ariaBusy: replay?.getAttribute("aria-busy"),
            }
          : null,
        pinSpacers: document.querySelectorAll(".pin-spacer").length,
        nestedPinSpacers: document.querySelectorAll(".pin-spacer .pin-spacer").length,
      };
    },
    { ownedSelector: OWNED_SELECTOR, ownedInertSelector: OWNED_INERT_SELECTOR }
  );
}

async function waitForPrologue(page, { replay = false } = {}) {
  await page.waitForFunction(
    ({ replayExpected, ownedInertSelector }) => {
      const html = document.documentElement;
      return (
        html.classList.contains("gcl-prologue") &&
        html.classList.contains("gcl-replaying") === replayExpected &&
        document.querySelectorAll(ownedInertSelector).length > 0
      );
    },
    { replayExpected: replay, ownedInertSelector: OWNED_INERT_SELECTOR }
  );
}

async function assertPrologueContained(page, { replay = false } = {}) {
  await waitForPrologue(page, { replay });
  await page.waitForFunction(() => window.scrollY <= 1);
  const before = await stateSnapshot(page);
  assert.equal(before.prologue, true, "gcl-prologue must be active");
  assert.equal(before.replaying, replay, "gcl-replaying must match the replay state");
  assert.ok(before.dataOwned > 0, "prologue must mark the inert nodes it owns");
  assert.equal(
    before.ownedInert,
    before.dataOwned,
    "every prologue-owned node must be inert while the lock is active"
  );
  assert.ok(
    before.overflow === "hidden" || before.overflowY === "hidden",
    `scroll must be locked, got overflow=${before.overflow}/${before.overflowY}`
  );
  if (replay) {
    assert.ok(before.replay, "Replay control must exist");
    assert.ok(before.replay.opacity <= 0.01, "Replay control must be visually hidden during replay");
    assert.equal(before.replay.visibility, "hidden", "Replay control must be hidden during replay");
    assert.equal(before.replay.pointerEvents, "none", "Replay control must not capture input");
  }

  const y = before.scrollY;
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(180);
  const afterWheel = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(afterWheel - y) <= 1, `wheel changed scrollY while locked: ${y} -> ${afterWheel}`);
  return before;
}

async function waitForIntroductionComplete(page) {
  await page.waitForFunction(
    ({ ownedSelector }) => {
      const html = document.documentElement;
      const replay = document.querySelector(".arrival__replay");
      const status = document.querySelector('[role="status"]');
      return (
        !html.classList.contains("gcl-prologue") &&
        !html.classList.contains("gcl-replaying") &&
        document.querySelectorAll(ownedSelector).length === 0 &&
        replay?.getAttribute("aria-busy") === "false" &&
        status?.textContent?.includes("Introduction complete")
      );
    },
    { ownedSelector: OWNED_SELECTOR },
    { timeout: DEFAULT_TIMEOUT }
  );
}

async function assertComposed(page, { arrivalRequired = true } = {}) {
  await page.waitForFunction(
    ({ ownedSelector }) => {
      const html = document.documentElement;
      return (
        !html.classList.contains("gcl-prologue") &&
        !html.classList.contains("gcl-replaying") &&
        document.querySelectorAll(ownedSelector).length === 0 &&
        document.querySelectorAll("[inert]").length === 0
      );
    },
    { ownedSelector: OWNED_SELECTOR }
  );

  const composed = await page.evaluate(() => {
    const arrival = document.querySelector(".arrival");
    if (!arrival) return { hasArrival: false };
    const selectors = [
      ".arrival__mark-wrap",
      ".arrival__wordmark-top",
      ".arrival__wordmark-bottom",
      ".arrival__tagline-line",
    ];
    return {
      hasArrival: true,
      visible: selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return { selector, exists: false };
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return {
          selector,
          exists: true,
          opacity: Number(style.opacity),
          visibility: style.visibility,
          width: box.width,
          height: box.height,
        };
      }),
    };
  });
  if (arrivalRequired) {
    assert.equal(composed.hasArrival, true, "Arrival must exist on this route");
    for (const item of composed.visible) {
      assert.equal(item.exists, true, `${item.selector} must exist`);
      assert.ok(item.opacity >= 0.99, `${item.selector} must be fully composed`);
      assert.equal(item.visibility, "visible", `${item.selector} must be visible`);
      assert.ok(item.width > 0 && item.height > 0, `${item.selector} must have geometry`);
    }
  }
  return composed;
}

async function assertPostReplay(page, expectedPinSpacers) {
  await waitForIntroductionComplete(page);
  // markComplete intentionally lands focus one animation frame after the
  // replay class is released, when the previously hidden chip is rendered
  // focusable. Wait for that contract instead of sampling the intervening
  // React commit.
  await page.waitForFunction(() => document.activeElement?.classList.contains("arrival__replay"));
  const settled = await stateSnapshot(page);
  assert.equal(settled.prologue, false);
  assert.equal(settled.replaying, false);
  assert.equal(settled.dataOwned, 0, "owned marker attributes must be removed");
  assert.equal(settled.ownedInert, 0, "owned inert must be removed");
  assert.equal(settled.allInert, 0, "no inert nodes may survive replay exit");
  assert.deepEqual(
    settled.bodyInline,
    { overflow: "", overflowY: "", position: "", pointerEvents: "" },
    "Replay exit must not leave stale body interaction styles"
  );
  assert.equal(settled.nestedPinSpacers, 0, "pin spacers must never nest");
  assert.equal(
    settled.pinSpacers,
    expectedPinSpacers,
    "replay must not accumulate pin spacers/timelines"
  );

  const focus = await page.evaluate(() => ({
    className: document.activeElement?.className ?? "",
    id: document.activeElement?.id ?? "",
    status: document.querySelector('[role="status"]')?.textContent?.trim() ?? "",
  }));
  assert.match(String(focus.className), /arrival__replay/, "Replay exit must return focus to Replay");
  assert.equal(focus.status, "Introduction complete", "Replay exit status must be intentional");

  // Nav is released immediately but deliberately fades over 600ms. Test
  // its settled interactive state rather than treating the intended fade
  // as a failed release.
  await page.waitForFunction(() => {
    const nav = document.querySelector(".nav");
    if (!nav) return false;
    const style = getComputedStyle(nav);
    return style.visibility === "visible" && Number(style.opacity) > 0.9;
  });
  const usability = await page.evaluate(() => {
    const nav = document.querySelector(".nav");
    const navTarget = nav?.querySelector("a,button");
    const overlay = document.querySelector(".arrival__stage-overlay");
    const navStyle = nav ? getComputedStyle(nav) : null;
    let navHit = false;
    if (navTarget) {
      const rect = navTarget.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      navHit = hit === navTarget || navTarget.contains(hit);
    }
    return {
      navVisible: navStyle?.visibility === "visible" && Number(navStyle.opacity) > 0.9,
      navPointer: navStyle?.pointerEvents !== "none",
      navHit,
      overlayPointer: overlay ? getComputedStyle(overlay).pointerEvents : "none",
      nanStyles: document.querySelectorAll('[style*="NaN"]').length,
    };
  });
  assert.equal(usability.navVisible, true, "Nav must be visible after replay");
  assert.equal(usability.navPointer, true, "Nav must accept pointer input after replay");
  assert.equal(usability.navHit, true, "Nav must win hit-testing after replay");
  assert.equal(usability.overlayPointer, "none", "Arrival overlay must not capture input");
  assert.equal(usability.nanStyles, 0, "No invalid timeline style may be left behind");

  const beforeScroll = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(180);
  const afterScroll = await page.evaluate(() => window.scrollY);
  assert.ok(afterScroll > beforeScroll + 2, "Page must scroll after replay exit");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY <= 1);

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.keyboard.press("Tab");
  const keyboard = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    inertAncestor: Boolean(document.activeElement?.closest("[inert]")),
  }));
  assert.notEqual(keyboard.tag, "BODY", "Keyboard navigation must leave body");
  assert.equal(keyboard.inertAncestor, false, "Keyboard focus must not land inside inert content");
}

async function gatewayChain(page, phase) {
  const sample = await page.evaluate(() => {
    const image = document.querySelector("img.arrival__mark");
    if (!(image instanceof HTMLElement)) return null;
    const chain = [];
    let node = image;
    while (node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      chain.push({
        tag: node.tagName,
        className: node.className,
        filter: style.filter,
        backdropFilter: style.backdropFilter,
        maskImage: style.maskImage,
        webkitMaskImage: style.webkitMaskImage,
        mixBlendMode: style.mixBlendMode,
      });
      if (node.classList.contains("arrival")) break;
      node = node.parentElement;
    }
    const imageStyle = getComputedStyle(image);
    return {
      chain,
      image: {
        opacity: Number(imageStyle.opacity),
        transform: imageStyle.transform,
        inlineOpacity: image.style.opacity,
        inlineTransform: image.style.transform,
      },
    };
  });
  assert.ok(sample, `Gateway G image must exist at ${phase}`);
  for (const node of sample.chain) {
    assert.equal(node.filter, "none", `${phase}: ${node.tag}.${node.className} must not filter Gateway G`);
    assert.ok(
      !node.backdropFilter || node.backdropFilter === "none",
      `${phase}: ${node.tag}.${node.className} must not backdrop-filter Gateway G`
    );
    assert.ok(
      !node.maskImage || node.maskImage === "none",
      `${phase}: ${node.tag}.${node.className} must not mask Gateway G`
    );
    assert.ok(
      !node.webkitMaskImage || node.webkitMaskImage === "none",
      `${phase}: ${node.tag}.${node.className} must not webkit-mask Gateway G`
    );
    assert.equal(
      node.mixBlendMode,
      "normal",
      `${phase}: ${node.tag}.${node.className} must not blend Gateway G`
    );
  }
  assert.equal(sample.image.opacity, 1, `${phase}: image opacity itself must remain 1`);
  assert.equal(sample.image.transform, "none", `${phase}: image transform itself must remain none`);
  assert.equal(sample.image.inlineOpacity, "", `${phase}: image must have no inline opacity mutation`);
  assert.equal(sample.image.inlineTransform, "", `${phase}: image must have no inline transform mutation`);
  return sample;
}

async function runInitialVisit(reducedMotion) {
  const label = `initial-${reducedMotion}`;
  const { context, page } = await makePage({ label, reducedMotion, seen: false });
  const shots = [];
  const samples = {};
  try {
    await goto(page, siteUrl("/"));
    await assertPrologueContained(page, { replay: false });
    await page.waitForTimeout(650);
    samples.p1 = await gatewayChain(page, `${label}-P1`);
    shots.push(await screenshot(page, `${label}-p1`));

    await page.waitForTimeout(5_450);
    samples.p3 = await gatewayChain(page, `${label}-P3`);
    shots.push(await screenshot(page, `${label}-p3`));

    await page.waitForFunction(() => !document.documentElement.classList.contains("gcl-prologue"), null, {
      timeout: DEFAULT_TIMEOUT,
    });
    samples.p6 = await gatewayChain(page, `${label}-P6`);
    shots.push(await screenshot(page, `${label}-p6`));
    await waitForIntroductionComplete(page);
    await assertComposed(page);
    return { screenshots: shots, gatewaySamples: samples, finalState: await stateSnapshot(page) };
  } finally {
    await context.close();
  }
}

async function seedSeenAndRunReplays() {
  const { context, page } = await makePage({
    label: "three-consecutive-replays",
    reducedMotion: "no-preference",
    seen: true,
  });
  const cycles = [];
  try {
    await goto(page, siteUrl("/"));
    await assertComposed(page);
    const baselinePins = (await stateSnapshot(page)).pinSpacers;

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(".arrival__replay").click();
    cycles.push({ source: "top", active: await assertPrologueContained(page, { replay: true }) });
    await page.keyboard.press("Escape");
    await assertPostReplay(page, baselinePins);

    await page.evaluate(() => window.scrollTo(0, Math.max(800, document.documentElement.scrollHeight * 0.45)));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.dispatchEvent(new Event("gcl:request-replay")));
    cycles.push({ source: "mid-event-bridge", active: await assertPrologueContained(page, { replay: true }) });
    await page.waitForFunction(() => {
      const skip = document.querySelector(".arrival__skip");
      if (!(skip instanceof HTMLElement)) return false;
      const style = getComputedStyle(skip);
      return style.visibility === "visible" && style.pointerEvents !== "none" && Number(style.opacity) > 0.5;
    });
    await page.locator(".arrival__skip").focus();
    await page.keyboard.press("Enter");
    await assertPostReplay(page, baselinePins);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    const footerReplay = page.locator("footer").getByRole("button", { name: /replay/i }).first();
    assert.ok((await footerReplay.count()) > 0, "Footer Replay control must exist");
    await footerReplay.click();
    cycles.push({ source: "footer", active: await assertPrologueContained(page, { replay: true }) });
    await assertPostReplay(page, baselinePins);

    return {
      baselinePinSpacers: baselinePins,
      cycles,
      screenshot: await screenshot(page, "three-replays-final"),
    };
  } finally {
    await context.close();
  }
}

async function replayOriginMatrix() {
  const { context, page } = await makePage({
    label: "replay-origin-matrix",
    reducedMotion: "no-preference",
    seen: true,
  });
  const origins = [
    ["arrival", ".arrival"],
    ["institution", ".institution"],
    ["mission", ".mission"],
    ["ecosystem", ".ecosystem"],
    ["principles", ".principles"],
    ["engagement", ".engagement"],
    ["footer", "footer"],
  ];
  const samples = [];
  try {
    await goto(page, siteUrl("/"));
    await assertComposed(page);
    const baselinePins = (await stateSnapshot(page)).pinSpacers;
    for (const [name, selector] of origins) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      const sourceY = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => window.dispatchEvent(new Event("gcl:request-replay")));
      const active = await assertPrologueContained(page, { replay: true });
      await page.keyboard.press("Escape");
      await assertPostReplay(page, baselinePins);
      samples.push({ name, selector, sourceY, active });
    }
    return { baselinePinSpacers: baselinePins, samples };
  } finally {
    await context.close();
  }
}

async function bypassRoute(pathname, { arrivalRequired = true } = {}) {
  const label = `bypass-${safeName(pathname) || "root"}`;
  const { context, page } = await makePage({ label, seen: false });
  try {
    const httpStatus = await goto(page, siteUrl(pathname));
    await page.waitForTimeout(350);
    const composed = await assertComposed(page, { arrivalRequired });
    return { pathname, httpStatus, composed, state: await stateSnapshot(page) };
  } finally {
    await context.close();
  }
}

async function delayedHydration() {
  const { context, page } = await makePage({ label: "delayed-hydration-23s", seen: false });
  let delayedRequests = 0;
  try {
    await page.route("**/_next/static/**/*.js", async (route) => {
      delayedRequests += 1;
      await delay(23_000);
      await route.continue();
    });
    await goto(page, siteUrl("/"), "commit");
    await page.waitForSelector(".arrival");
    await page.waitForFunction(
      ({ ownedSelector }) =>
        performance.now() >= 22_000 &&
        !document.documentElement.classList.contains("gcl-prologue") &&
        document.querySelectorAll(ownedSelector).length === 0 &&
        document.querySelectorAll("[inert]").length === 0,
      { ownedSelector: OWNED_SELECTOR },
      { timeout: 28_000 }
    );
    assert.ok(delayedRequests > 0, "At least one Next.js bundle request must be delayed");
    await page.waitForFunction(() => document.querySelector(".arrival--static"), null, {
      timeout: 12_000,
    });
    const composed = await assertComposed(page);
    return {
      delayedRequests,
      performanceNowMs: await page.evaluate(() => performance.now()),
      composed,
      screenshot: await screenshot(page, "delayed-hydration-composed"),
    };
  } finally {
    await context.close();
  }
}

async function preHydrationBreakpointCrossing() {
  const { context, page } = await makePage({
    label: "pre-hydration-breakpoint-crossing",
    seen: false,
    viewport: DESKTOP,
  });
  let delayedRequests = 0;
  let releaseBundles = () => {};
  const bundleGate = new Promise((resolve) => {
    releaseBundles = resolve;
  });
  try {
    await page.route("**/_next/static/**/*.js", async (route) => {
      delayedRequests += 1;
      await bundleGate;
      await route.continue();
    });
    await goto(page, siteUrl("/"), "commit");
    await page.waitForSelector(".arrival");
    await page.waitForFunction(() => document.documentElement.classList.contains("gcl-prologue"));

    await page.setViewportSize(PHONE);
    await page.waitForFunction(
      ({ ownedSelector }) =>
        !document.documentElement.classList.contains("gcl-prologue") &&
        !document.documentElement.classList.contains("gcl-replaying") &&
        document.querySelectorAll(ownedSelector).length === 0 &&
        document.querySelectorAll("[inert]").length === 0,
      { ownedSelector: OWNED_SELECTOR }
    );
    const releasedBeforeHydration = await stateSnapshot(page);

    releaseBundles();
    await page.waitForFunction(
      (key) => {
        try {
          return sessionStorage.getItem(key) === "1";
        } catch {
          return false;
        }
      },
      SESSION_KEY
    );
    await assertComposed(page);
    const hydrated = await stateSnapshot(page);
    assert.equal(hydrated.prologue, false, "Mobile hydration must not restore the desktop lock");
    assert.equal(hydrated.allInert, 0, "Mobile hydration must not apply stale desktop inert state");
    assert.ok(delayedRequests > 0, "At least one Next.js bundle must be held across the resize");
    return {
      delayedRequests,
      releasedBeforeHydration,
      hydrated,
      screenshot: await screenshot(page, "pre-hydration-mobile-release"),
    };
  } finally {
    releaseBundles();
    await context.close();
  }
}

async function replayPreflightBreakpointCrossing() {
  const { context, page } = await makePage({
    label: "replay-preflight-breakpoint-crossing",
    seen: true,
    viewport: DESKTOP,
  });
  try {
    await goto(page, siteUrl("/"));
    await assertComposed(page);
    const baselinePins = (await stateSnapshot(page)).pinSpacers;

    await page.evaluate(() => {
      const nativeScrollTo = window.scrollTo.bind(window);
      nativeScrollTo(0, Math.max(1200, document.documentElement.scrollHeight * 0.55));
      // Make the preflight's 1.5s safety branch deterministic: ignore its
      // first smooth request, but still honor the final auto snap.
      window.__gclR4NativeScrollTo = nativeScrollTo;
      window.scrollTo = (...args) => {
        const first = args[0];
        if (typeof first === "object" && first?.behavior === "smooth") return;
        if (typeof first === "number" && first === 0 && args[1] === 0) return;
        window.__gclR4NativeScrollTo(...args);
      };
      window.dispatchEvent(new Event("gcl:request-replay"));
    });
    await page.setViewportSize(PHONE);
    // Let the policy-driven GSAP controller rebuild, then attempt a second
    // replay while the original request is still awaiting its forced top
    // reset. The component-lifetime guard must reject this request: a
    // mobile replay would synchronously clear the seen marker.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    const duplicateGuard = await page.evaluate(async (key) => {
      window.dispatchEvent(new Event("gcl:request-replay"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        seen: sessionStorage.getItem(key),
        busy: document.querySelector(".arrival__replay")?.getAttribute("aria-busy"),
        status: document.querySelector('[role="status"]')?.textContent ?? "",
      };
    }, SESSION_KEY);
    assert.equal(duplicateGuard.seen, "1", "Policy rebuild must preserve the replay duplicate guard");
    assert.equal(duplicateGuard.busy, "true", "Original replay must remain busy until cancellation");
    assert.ok(
      duplicateGuard.status.includes("Replaying introduction"),
      `Replay live status changed before cancellation: ${duplicateGuard.status}`
    );
    // Cover the complete smooth-scroll safety window; a stale desktop
    // callback used to re-arm lock/inert only after this await resolved.
    await page.waitForTimeout(1_800);
    await page.evaluate(() => {
      if (window.__gclR4NativeScrollTo) {
        window.scrollTo = window.__gclR4NativeScrollTo;
        delete window.__gclR4NativeScrollTo;
      }
    });
    await page.waitForFunction(
      ({ ownedSelector }) => {
        const replay = document.querySelector(".arrival__replay");
        return (
          window.scrollY <= 1 &&
          !document.documentElement.classList.contains("gcl-prologue") &&
          !document.documentElement.classList.contains("gcl-replaying") &&
          document.querySelectorAll(ownedSelector).length === 0 &&
          document.querySelectorAll("[inert]").length === 0 &&
          replay?.getAttribute("aria-busy") === "false" &&
          document.querySelector('[role="status"]')?.textContent?.includes("Introduction complete")
        );
      },
      { ownedSelector: OWNED_SELECTOR }
    );
    await page.waitForFunction(
      () => document.activeElement?.classList.contains("arrival__replay") === true
    );
    await assertComposed(page);
    const mobile = await stateSnapshot(page);

    // Return to the timeline's desktop flavor and prove the canceled
    // preflight did not strand the synchronous replay guard.
    await page.setViewportSize(DESKTOP);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.dispatchEvent(new Event("gcl:request-replay")));
    const replayActive = await assertPrologueContained(page, { replay: true });
    await page.keyboard.press("Escape");
    await assertPostReplay(page, baselinePins);
    return {
      duplicateGuard,
      mobile,
      replayActive,
      screenshot: await screenshot(page, "replay-preflight-crossing-recovered"),
    };
  } finally {
    await context.close();
  }
}

async function replayArmImmediateWidthFailure() {
  const { context, page } = await makePage({
    label: "replay-arm-immediate-width-failure",
    seen: true,
    viewport: DESKTOP,
  });
  try {
    await goto(page, siteUrl("/"));
    await assertComposed(page);
    const baselinePins = (await stateSnapshot(page)).pinSpacers;

    await page.evaluate(() => {
      const originalArm = window.__gclArmPrologueWatchdog;
      if (!originalArm) throw new Error("Shared prologue arm function is unavailable");
      window.__gclArmPrologueWatchdog = () => {
        const nativeMatchMedia = window.matchMedia;
        window.matchMedia = (query) => {
          if (query !== "(min-width:1024px)") return nativeMatchMedia.call(window, query);
          return {
            matches: false,
            media: query,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent() {
              return true;
            },
          };
        };
        try {
          return originalArm();
        } finally {
          window.matchMedia = nativeMatchMedia;
          window.__gclArmPrologueWatchdog = originalArm;
        }
      };
      window.dispatchEvent(new Event("gcl:request-replay"));
    });

    await page.waitForFunction(
      ({ key, ownedSelector }) => {
        const replay = document.querySelector(".arrival__replay");
        return (
          sessionStorage.getItem(key) === "1" &&
          !document.documentElement.classList.contains("gcl-prologue") &&
          !document.documentElement.classList.contains("gcl-replaying") &&
          document.querySelectorAll(ownedSelector).length === 0 &&
          document.querySelectorAll("[inert]").length === 0 &&
          replay?.getAttribute("aria-busy") === "false" &&
          document.querySelector('[role="status"]')?.textContent?.includes("Introduction complete")
        );
      },
      { key: SESSION_KEY, ownedSelector: OWNED_SELECTOR }
    );
    await assertComposed(page);
    const failedArmState = await stateSnapshot(page);

    // The failed acquisition must not poison the next legitimate replay.
    await page.evaluate(() => window.dispatchEvent(new Event("gcl:request-replay")));
    const recovered = await assertPrologueContained(page, { replay: true });
    await page.keyboard.press("Escape");
    await assertPostReplay(page, baselinePins);
    return {
      failedArmState,
      recovered,
      screenshot: await screenshot(page, "replay-arm-width-failure-recovered"),
    };
  } finally {
    await context.close();
  }
}

async function replayAfterPolicyRemounts() {
  const { context, page } = await makePage({
    label: "replay-after-policy-remounts",
    seen: true,
    viewport: PHONE,
  });
  try {
    await goto(page, siteUrl("/"));
    await assertComposed(page);
    const initialMobilePins = (await stateSnapshot(page)).pinSpacers;

    await page.setViewportSize(DESKTOP);
    await page.waitForFunction(() => document.querySelectorAll(".pin-spacer").length === 4);
    await assertComposed(page);
    await page.evaluate(() => window.dispatchEvent(new Event("gcl:request-replay")));
    const firstDesktopReplay = await assertPrologueContained(page, { replay: true });
    await page.keyboard.press("Escape");
    await assertPostReplay(page, 4);

    await page.setViewportSize(PHONE);
    await page.waitForFunction(() => document.querySelectorAll(".pin-spacer").length === 2);
    await assertComposed(page);
    await page.evaluate(() => window.dispatchEvent(new Event("gcl:request-replay")));
    await page.waitForFunction(
      () => document.querySelector(".arrival__replay")?.getAttribute("aria-busy") === "true"
    );
    const mobileActive = await stateSnapshot(page);
    assert.equal(mobileActive.prologue, false, "Mobile replay after remount must not acquire desktop lock");
    assert.equal(mobileActive.allInert, 0, "Mobile replay after remount must not acquire desktop inert");
    await page.waitForFunction(
      (key) =>
        document.querySelector(".arrival__replay")?.getAttribute("aria-busy") === "false" &&
        sessionStorage.getItem(key) === "1",
      SESSION_KEY
    );
    await assertComposed(page);
    const mobileComplete = await stateSnapshot(page);

    await page.setViewportSize(DESKTOP);
    await page.waitForFunction(() => document.querySelectorAll(".pin-spacer").length === 4);
    await page.evaluate(() => window.dispatchEvent(new Event("gcl:request-replay")));
    const secondDesktopReplay = await assertPrologueContained(page, { replay: true });
    await page.keyboard.press("Escape");
    await assertPostReplay(page, 4);
    return {
      initialMobilePins,
      firstDesktopReplay,
      mobileActive,
      mobileComplete,
      secondDesktopReplay,
      screenshot: await screenshot(page, "policy-remount-replays-recovered"),
    };
  } finally {
    await context.close();
  }
}

async function unrelatedInertPreservation() {
  const { context, page } = await makePage({
    label: "unrelated-inert-preservation",
    seen: true,
    viewport: DESKTOP,
  });
  try {
    await goto(page, siteUrl("/"));
    await assertComposed(page);
    const baselinePins = (await stateSnapshot(page)).pinSpacers;
    await page.evaluate(() => {
      const footer = document.querySelector("footer");
      if (!(footer instanceof HTMLElement)) throw new Error("Footer inert target is unavailable");
      footer.setAttribute("inert", "");
      footer.setAttribute("data-r4-preexisting-inert", "");
      window.dispatchEvent(new Event("gcl:request-replay"));
    });
    await assertPrologueContained(page, { replay: true });
    const activeOwnership = await page.evaluate(() => {
      const footer = document.querySelector("footer");
      return {
        inert: footer?.hasAttribute("inert") ?? false,
        claimed: footer?.hasAttribute("data-gcl-prologue-inert") ?? false,
      };
    });
    assert.equal(activeOwnership.inert, true, "Pre-inert footer must remain inert during replay");
    assert.equal(
      activeOwnership.claimed,
      false,
      "Prologue acquisition must not claim an already-inert target"
    );
    await page.keyboard.press("Escape");
    await waitForIntroductionComplete(page);
    await page.waitForFunction(() => document.activeElement?.classList.contains("arrival__replay"));
    const preserved = await page.evaluate(() => {
      const sentinel = document.querySelector("footer[data-r4-preexisting-inert]");
      return {
        exists: Boolean(sentinel),
        inert: sentinel?.hasAttribute("inert") ?? false,
        owned: sentinel?.hasAttribute("data-gcl-prologue-inert") ?? false,
        ownedRemaining: document.querySelectorAll("[data-gcl-prologue-inert]").length,
      };
    });
    assert.equal(preserved.exists, true, "Unrelated inert sentinel must survive release");
    assert.equal(preserved.inert, true, "Atomic release must preserve unrelated inert ownership");
    assert.equal(preserved.owned, false, "Prologue must not claim a pre-existing inert node");
    assert.equal(preserved.ownedRemaining, 0, "Prologue-owned inert markers must still clear");
    await page.evaluate(() => {
      const footer = document.querySelector("footer[data-r4-preexisting-inert]");
      footer?.removeAttribute("inert");
      footer?.removeAttribute("data-r4-preexisting-inert");
    });
    await assertPostReplay(page, baselinePins);
    return { activeOwnership, preserved };
  } finally {
    await context.close();
  }
}

async function crossingAt(seconds) {
  const label = `crossing-${seconds}s`;
  const { context, page } = await makePage({ label, seen: false, viewport: DESKTOP });
  try {
    await goto(page, siteUrl("/"));
    await waitForPrologue(page);
    const initialPins = (await stateSnapshot(page)).pinSpacers;
    await page.waitForTimeout(seconds * 1000);
    await page.setViewportSize(PHONE);
    await page.waitForFunction(
      ({ ownedSelector }) =>
        !document.documentElement.classList.contains("gcl-prologue") &&
        document.querySelectorAll(ownedSelector).length === 0,
      { ownedSelector: OWNED_SELECTOR }
    );
    await page.waitForTimeout(500);

    const mobile = await page.evaluate(() => {
      const image = document.querySelector("img.arrival__mark");
      const targetSelectors = {
        mark: ".arrival__mark-wrap",
        atmosphere: ".arrival__atmosphere",
        signal: ".arrival__signal",
        skip: ".arrival__skip",
      };
      const styles = Object.fromEntries(
        Object.entries(targetSelectors).map(([name, selector]) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) return [name, null];
          return [
            name,
            {
              attribute: element.getAttribute("style") ?? "",
              opacity: element.style.opacity,
              transform: element.style.transform,
              translate: element.style.translate,
              scale: element.style.scale,
              visibility: element.style.visibility,
              pointerEvents: element.style.pointerEvents,
              animationName: getComputedStyle(element).animationName,
            },
          ];
        })
      );
      const box = image?.getBoundingClientRect();
      return {
        mark: box ? { width: box.width, height: box.height } : null,
        styles,
        pinSpacers: document.querySelectorAll(".pin-spacer").length,
        nestedPinSpacers: document.querySelectorAll(".pin-spacer .pin-spacer").length,
      };
    });
    assert.ok(mobile.mark, "Crossed mobile Gateway G must exist");
    assert.ok(Math.abs(mobile.mark.width - 120) <= 1, `mark width ${mobile.mark.width} != 120±1`);
    assert.ok(Math.abs(mobile.mark.height - 130) <= 1, `mark height ${mobile.mark.height} != 130±1`);
    for (const [name, style] of Object.entries(mobile.styles)) {
      assert.ok(style, `${name} target must exist`);
      for (const property of ["opacity", "transform", "translate", "scale", "visibility", "pointerEvents"]) {
        assert.equal(style[property], "", `${name} retains desktop inline ${property}: ${style.attribute}`);
      }
    }
    assert.equal(
      mobile.styles.atmosphere.animationName,
      "none",
      "Atmosphere animation must be absent after crossing"
    );
    assert.equal(mobile.styles.signal.animationName, "none", "Signal animation must be absent after crossing");
    assert.equal(mobile.nestedPinSpacers, 0, "Crossing must not nest pin spacers");
    // Responsive chapters legitimately deactivate two desktop-only pins at
    // phone width (four desktop spacers becomes two mobile spacers). The
    // invariant here is no accumulation/nesting, followed by exact desktop
    // topology restoration when crossing back up.
    assert.ok(
      mobile.pinSpacers <= initialPins,
      `Crossing down accumulated pin spacers: ${initialPins} -> ${mobile.pinSpacers}`
    );

    const shot = await screenshot(page, `${label}-mobile`);
    await page.setViewportSize(DESKTOP);
    await page.waitForTimeout(650);
    await assertComposed(page);
    const desktopPins = (await stateSnapshot(page)).pinSpacers;
    assert.equal(desktopPins, initialPins, "Crossing back up must restore one stable pin topology");
    return { seconds, initialPins, mobile, desktopPins, screenshot: shot };
  } finally {
    await context.close();
  }
}

async function taglineGeometry(page) {
  return page.evaluate(() => {
    const tagline = document.querySelector(".arrival__tagline-line");
    const wordTop = document.querySelector(".arrival__wordmark-top");
    const wordBottom = document.querySelector(".arrival__wordmark-bottom");
    if (!tagline || !wordTop || !wordBottom) return null;
    const range = document.createRange();
    range.selectNodeContents(tagline);
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
    const lines = [];
    for (const rect of rects) {
      const line = lines.find((candidate) => Math.abs(candidate.top - rect.top) <= 1);
      if (line) {
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
      } else {
        lines.push({ top: rect.top, left: rect.left, right: rect.right });
      }
    }
    const lineWidths = lines.map((line) => line.right - line.left);
    const rect = tagline.getBoundingClientRect();
    const wordWidth = Math.max(wordTop.getBoundingClientRect().width, wordBottom.getBoundingClientRect().width);
    return {
      lines: lines.length,
      lineWidths,
      balanceRatio: Math.max(...lineWidths) / Math.min(...lineWidths),
      rect: { left: rect.left, right: rect.right, width: rect.width },
      wordWidth,
      viewportWidth: window.innerWidth,
      clientWidth: tagline.clientWidth,
      scrollWidth: tagline.scrollWidth,
      maxInlineSize: getComputedStyle(tagline).maxInlineSize,
      textWrap: getComputedStyle(tagline).textWrap,
    };
  });
}

async function taglineRange() {
  const { context, page } = await makePage({
    label: "tagline-range",
    seen: true,
    viewport: { width: 320, height: 844 },
  });
  const samples = {};
  try {
    await goto(page, siteUrl("/"));
    await assertComposed(page);
    for (const width of [320, 360, 375, 390, 393, 412, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(100);
      const sample = await taglineGeometry(page);
      assert.ok(sample, `Tagline geometry must exist at ${width}px`);
      assert.equal(sample.lines, 2, `Tagline must have exactly two balanced lines at ${width}px`);
      assert.equal(sample.textWrap, "balance", `Tagline must use text-wrap: balance at ${width}px`);
      assert.ok(sample.rect.left >= -0.5 && sample.rect.right <= width + 0.5, `Tagline overflows at ${width}px`);
      assert.ok(sample.scrollWidth <= sample.clientWidth + 1, `Tagline has horizontal overflow at ${width}px`);
      assert.ok(
        Math.max(...sample.lineWidths) <= sample.wordWidth + 1,
        `Tagline line (${Math.max(...sample.lineWidths)}px) is wider than wordmark (${sample.wordWidth}px) at ${width}px`
      );
      assert.ok(sample.balanceRatio <= 1.25, `Tagline line balance ${sample.balanceRatio} exceeds 1.25 at ${width}px`);
      samples[width] = sample;
    }
    for (const width of [768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(120);
      const sample = await taglineGeometry(page);
      assert.ok(sample, `Tagline geometry must exist at ${width}px`);
      assert.equal(sample.maxInlineSize, "none", `Phone max-inline-size leaked to ${width}px`);
      assert.ok(sample.scrollWidth <= sample.clientWidth + 1, `Tagline overflows at ${width}px`);
      samples[width] = sample;
    }
    return { samples };
  } finally {
    await context.close();
  }
}

async function skipComposite() {
  const { context, page } = await makePage({ label: "skip-composite", seen: false });
  try {
    await goto(page, siteUrl("/"));
    await waitForPrologue(page);
    await page.waitForTimeout(4_500);
    const metrics = await page.evaluate(() => {
      const skip = document.querySelector(".arrival__skip");
      const signal = document.querySelector(".arrival__signal");
      const arrival = document.querySelector(".arrival");
      if (!skip || !signal || !arrival) return null;
      const parse = (value) => {
        const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
        return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0];
      };
      const blend = (foreground, background, alpha) =>
        foreground.map((value, index) => Math.round(value * alpha + background[index] * (1 - alpha)));
      const channel = (value) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (rgb) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
      const contrast = (a, b) => {
        const high = Math.max(luminance(a), luminance(b));
        const low = Math.min(luminance(a), luminance(b));
        return (high + 0.05) / (low + 0.05);
      };
      const skipStyle = getComputedStyle(skip);
      const signalStyle = getComputedStyle(signal);
      const background = parse(getComputedStyle(arrival).backgroundColor);
      const resolver = document.createElement("span");
      resolver.style.color = "var(--gcl-gateway-gold)";
      document.body.appendChild(resolver);
      const goldColor = getComputedStyle(resolver).color;
      resolver.remove();
      const gold = parse(goldColor);
      const skipForeground = parse(skipStyle.color);
      const skipComposite = blend(skipForeground, background, Number(skipStyle.opacity));
      const signalComposite = blend(gold, background, Number(signalStyle.opacity));
      return {
        background,
        gold,
        goldColor,
        skipForeground,
        skipOpacity: Number(skipStyle.opacity),
        signalOpacity: Number(signalStyle.opacity),
        skipComposite,
        signalComposite,
        contrast: contrast(skipComposite, background),
        skipLuminance: luminance(skipComposite),
        signalLuminance: luminance(signalComposite),
      };
    });
    assert.ok(metrics, "Skip/signal composite metrics must be available");
    assert.ok(metrics.signalOpacity >= 0.45, "Signal must be near its P2 peak for measurement");
    assert.ok(metrics.contrast >= 3, `Skip composite contrast ${metrics.contrast.toFixed(3)} is below 3:1`);
    assert.ok(
      metrics.skipLuminance < metrics.signalLuminance,
      `Skip luminance ${metrics.skipLuminance} must remain below signal ${metrics.signalLuminance}`
    );

    const skip = page.locator(".arrival__skip");
    await skip.hover();
    await page.waitForTimeout(320);
    const hover = await skip.evaluate((element) => {
      const style = getComputedStyle(element);
      const resolver = document.createElement("span");
      resolver.style.color = "var(--gcl-gateway-gold)";
      document.body.appendChild(resolver);
      const gold = getComputedStyle(resolver).color;
      resolver.remove();
      return {
        opacity: Number(style.opacity),
        color: style.color,
        gold,
      };
    });
    assert.equal(hover.opacity, 1, "Skip hover must restore full opacity");
    assert.equal(hover.color, hover.gold, "Skip hover must restore Gateway gold");

    await page.mouse.move(20, 400);
    await page.locator(".skip-link").focus();
    await page.keyboard.press("Tab");
    assert.equal(await skip.evaluate((element) => document.activeElement === element), true);
    await page.waitForTimeout(320);
    const focus = await skip.evaluate((element) => {
      const style = getComputedStyle(element);
      const resolver = document.createElement("span");
      resolver.style.color = "var(--gcl-gateway-gold)";
      document.body.appendChild(resolver);
      const gold = getComputedStyle(resolver).color;
      resolver.remove();
      return {
        opacity: Number(style.opacity),
        color: style.color,
        gold,
      };
    });
    assert.equal(focus.opacity, 1, "Skip focus must restore full opacity");
    assert.equal(focus.color, focus.gold, "Skip focus must restore Gateway gold");
    const shot = await screenshot(page, "skip-p2-composite");
    await page.keyboard.press("Enter");
    return { metrics, hover, focus, screenshot: shot };
  } finally {
    await context.close();
  }
}

async function skipFocusFlows() {
  const report = {};

  {
    const { context, page } = await makePage({ label: "skip-to-content", seen: false });
    try {
      await goto(page, siteUrl("/"));
      await waitForPrologue(page);
      await page.locator(".skip-link").focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !document.documentElement.classList.contains("gcl-prologue"));
      await page.waitForTimeout(100);
      const result = await page.evaluate(() => ({
        hash: location.hash,
        activeId: document.activeElement?.id ?? "",
        inert: document.querySelectorAll("[inert]").length,
      }));
      assert.equal(result.hash, "#content", "Skip-to-content must perform its native fragment jump");
      assert.equal(result.activeId, "arrival-heading", "Skip-to-content must land focus intentionally");
      assert.equal(result.inert, 0, "Skip-to-content must release inert containment");
      report.skipToContent = result;
    } finally {
      await context.close();
    }
  }

  {
    const { context, page } = await makePage({ label: "arrival-skip-enter", seen: false });
    try {
      await goto(page, siteUrl("/"));
      await waitForPrologue(page);
      await page.waitForFunction(() => {
        const skip = document.querySelector(".arrival__skip");
        if (!(skip instanceof HTMLElement)) return false;
        const style = getComputedStyle(skip);
        return style.visibility === "visible" && style.pointerEvents !== "none";
      });
      await page.locator(".arrival__skip").focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !document.documentElement.classList.contains("gcl-prologue"));
      const result = await page.evaluate(() => ({
        activeId: document.activeElement?.id ?? "",
        inert: document.querySelectorAll("[inert]").length,
      }));
      assert.equal(result.activeId, "arrival-heading", "SKIP Enter must focus arrival-heading");
      assert.equal(result.inert, 0, "SKIP Enter must release inert containment");
      report.arrivalSkip = result;
    } finally {
      await context.close();
    }
  }

  return report;
}

async function locateAxe() {
  const candidates = [
    path.join(SITE_CWD, "node_modules/axe-core/axe.min.js"),
    path.resolve(SITE_CWD, "../../node_modules/axe-core/axe.min.js"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

async function axePolicy(axeSource, reducedMotion) {
  const { context, page } = await makePage({
    label: `axe-${reducedMotion}`,
    reducedMotion,
    seen: true,
  });
  try {
    await goto(page, siteUrl("/"));
    await assertComposed(page);
    await page.addScriptTag({ content: axeSource });
    const audit = await page.evaluate(async () => {
      const output = await globalThis.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
      });
      return output.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        help: violation.help,
      }));
    });
    const severe = audit.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    assert.equal(severe.length, 0, `axe found serious/critical violations: ${JSON.stringify(severe)}`);
    return { reducedMotion, total: audit.length, severe: severe.length, violations: audit };
  } finally {
    await context.close();
  }
}

async function throttledPolicy(reducedMotion) {
  const { context, page } = await makePage({
    label: `cpu-6x-${reducedMotion}`,
    reducedMotion,
    seen: false,
  });
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await goto(page, siteUrl("/"));
    await page.waitForFunction(() => document.documentElement.classList.contains("gcl-prologue"));
    await page.waitForFunction(() => !document.documentElement.classList.contains("gcl-prologue"), null, {
      timeout: WATCHDOG_CEILING_MS + 5_000,
    });
    const unlockMs = await page.evaluate(() => performance.now());
    await waitForIntroductionComplete(page);
    const completeMs = await page.evaluate(() => performance.now());
    assert.ok(Number.isFinite(unlockMs) && unlockMs > 0, "6x unlock time must be finite");
    assert.ok(Number.isFinite(completeMs) && completeMs > 0, "6x complete time must be finite");
    assert.ok(unlockMs <= WATCHDOG_CEILING_MS, `6x unlock ${unlockMs}ms exceeded watchdog ceiling`);
    assert.ok(completeMs <= WATCHDOG_CEILING_MS, `6x complete ${completeMs}ms exceeded watchdog ceiling`);
    return { reducedMotion, cpuRate: 6, unlockMs, completeMs, beatTableMs: BEAT_TABLE_MS };
  } finally {
    await context.close();
  }
}

async function hashAssets() {
  const report = {};
  for (const [relativePath, expected] of Object.entries(EXPECTED_ASSETS)) {
    const bytes = await readFile(path.resolve(SITE_CWD, relativePath));
    const actual = createHash("sha256").update(bytes).digest("hex");
    assert.equal(actual, expected, `${relativePath} SHA-256 drifted`);
    report[relativePath] = { expected, actual, bytes: bytes.byteLength };
  }
  return report;
}

async function hashSourceTree(root) {
  const digest = createHash("sha256");
  let fileCount = 0;
  const excluded = new Set([
    ".DS_Store",
    ".next",
    "coverage",
    "node_modules",
    "out",
    "tsconfig.tsbuildinfo",
  ]);

  const walk = async (directory, prefix = "") => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute, relative);
      } else if (entry.isFile()) {
        const bytes = await readFile(absolute);
        digest.update(relative).update("\0").update(bytes).update("\0");
        fileCount += 1;
      }
    }
  };

  await walk(root);
  return { sha256: digest.digest("hex"), fileCount };
}

async function verifyControlProvenance() {
  assert.ok(CONTROL_ROOT, "GCL_CONTROL_ROOT is required for an attestable R3 parity check");
  const source = await hashSourceTree(CONTROL_ROOT);
  assert.equal(
    source.sha256,
    R3_CONTROL_SOURCE_DIGEST,
    `R3 control source digest mismatch (actual ${source.sha256})`
  );

  const localIndex = await readFile(path.join(CONTROL_ROOT, "out", "index.html"));
  const response = await fetch(siteUrl("/", CONTROL_URL));
  assert.equal(response.status, 200, `R3 control returned HTTP ${response.status}`);
  const servedIndex = Buffer.from(await response.arrayBuffer());
  const localIndexSha256 = createHash("sha256").update(localIndex).digest("hex");
  const servedIndexSha256 = createHash("sha256").update(servedIndex).digest("hex");
  assert.equal(
    servedIndexSha256,
    localIndexSha256,
    "CONTROL_URL does not serve GCL_CONTROL_ROOT/out/index.html"
  );
  return {
    commit: R3_CONTROL_COMMIT,
    sourceSha256: source.sha256,
    sourceFiles: source.fileCount,
    indexSha256: localIndexSha256,
  };
}

function validateHarnessEndpoints() {
  assertCredentialFreeEndpoint(BASE_URL, "GCL_BASE_URL");
  assertCredentialFreeEndpoint(CONTROL_URL, "GCL_CONTROL_URL");
  if (REQUESTED_SCENARIOS.size === 0 || REQUESTED_SCENARIOS.has("r3-control-parity")) {
    assert.ok(CONTROL_ROOT, "GCL_CONTROL_ROOT is required when R3 control parity is selected");
  }
}

async function geometry(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box
        ? { x: box.x, y: box.y, width: box.width, height: box.height }
        : null;
    };
    return {
      mark: rect("img.arrival__mark"),
      glow: rect(".arrival__glow"),
      cue: rect(".arrival__cue"),
      documentHeight: document.documentElement.scrollHeight,
      pinSpacers: document.querySelectorAll(".pin-spacer").length,
    };
  });
}

function assertRectClose(actual, control, label, tolerance = 1) {
  assert.ok(actual && control, `${label} geometry must exist in current and control`);
  for (const key of ["x", "y", "width", "height"]) {
    assert.ok(
      Math.abs(actual[key] - control[key]) <= tolerance,
      `${label}.${key}: current=${actual[key]}, control=${control[key]}, tolerance=${tolerance}`
    );
  }
}

function assertSizeClose(actual, control, label, tolerance = 1) {
  assert.ok(actual && control, `${label} geometry must exist in current and control`);
  for (const key of ["width", "height"]) {
    assert.ok(
      Math.abs(actual[key] - control[key]) <= tolerance,
      `${label}.${key}: current=${actual[key]}, control=${control[key]}, tolerance=${tolerance}`
    );
  }
}

async function controlParity() {
  const provenance = await verifyControlProvenance();

  const context = await browser.newContext({ viewport: PHONE, reducedMotion: "no-preference" });
  await context.addInitScript((key) => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {}
  }, SESSION_KEY);
  const current = await context.newPage();
  const control = await context.newPage();
  attachTelemetry(current, "control-parity-current");
  attachTelemetry(control, "control-parity-r3");
  try {
    await Promise.all([goto(current, siteUrl("/")), goto(control, siteUrl("/", CONTROL_URL))]);
    await Promise.all([assertComposed(current), assertComposed(control)]);
    const [currentGeometry, controlGeometry] = await Promise.all([geometry(current), geometry(control)]);
    // The inherited Founder tagline intentionally shifts the stage stack on
    // mobile; protect the canonical mark's size/proportions, not that disclosed
    // vertical copy reflow. Glow and cue remain exact baseline anchors.
    assertSizeClose(currentGeometry.mark, controlGeometry.mark, "Gateway G");
    assertRectClose(currentGeometry.glow, controlGeometry.glow, "Arrival glow");
    assertRectClose(currentGeometry.cue, controlGeometry.cue, "Arrival cue");
    assert.ok(
      Math.abs(currentGeometry.documentHeight - controlGeometry.documentHeight) <= 2,
      `document height drift: current=${currentGeometry.documentHeight}, control=${controlGeometry.documentHeight}`
    );
    assert.equal(currentGeometry.pinSpacers, controlGeometry.pinSpacers, "mobile pin topology drifted from R3");
    const screenshots = await Promise.all([
      screenshot(current, "control-parity-current"),
      screenshot(control, "control-parity-r3"),
    ]);
    return {
      skipped: false,
      provenance,
      current: currentGeometry,
      control: controlGeometry,
      screenshots,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  validateHarnessEndpoints();
  await mkdir(EVIDENCE_DIR, { recursive: true });

  await scenario("canonical-assets", async () => {
    results.assets = await hashAssets();
    return { count: Object.keys(results.assets).length };
  });

  const playwrightSpecifier = PLAYWRIGHT_SPECIFIER.startsWith("file:")
    ? PLAYWRIGHT_SPECIFIER
    : PLAYWRIGHT_SPECIFIER.startsWith("/") || PLAYWRIGHT_SPECIFIER.startsWith(".")
      ? pathToFileURL(path.resolve(PLAYWRIGHT_SPECIFIER)).href
      : PLAYWRIGHT_SPECIFIER;
  const { chromium } = await import(playwrightSpecifier);
  browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });

  await scenario("initial-first-visit-full-motion", () => runInitialVisit("no-preference"));
  await scenario("initial-first-visit-reduced-motion", () => runInitialVisit("reduce"));
  await scenario("three-consecutive-desktop-replays", seedSeenAndRunReplays);
  await scenario("replay-origin-matrix", replayOriginMatrix);
  await scenario("replay-preflight-breakpoint-crossing", replayPreflightBreakpointCrossing);
  await scenario("replay-arm-immediate-width-failure", replayArmImmediateWidthFailure);
  await scenario("replay-after-policy-remounts", replayAfterPolicyRemounts);
  await scenario("unrelated-inert-preservation", unrelatedInertPreservation);

  await scenario("deep-hash-contact-bypass", () => bypassRoute("/#contact"));
  await scenario("deep-hash-mission-bypass", () => bypassRoute("/#mission"));
  await scenario("index-html-bypass", () => bypassRoute("/index.html"));
  await scenario("404-bypass", () => bypassRoute("/__r4_confirmation_missing__", { arrivalRequired: false }));
  await scenario("watchdog-23s-delayed-hydration", delayedHydration);
  await scenario("pre-hydration-breakpoint-crossing", preHydrationBreakpointCrossing);

  for (const seconds of [1.5, 3, 6]) {
    await scenario(`crossing-${seconds}s`, () => crossingAt(seconds));
  }
  await scenario("tagline-range-320-1440", taglineRange);
  await scenario("skip-composite-hierarchy", skipComposite);
  await scenario("skip-focus-flows", skipFocusFlows);

  const axePath = await locateAxe();
  if (axePath) {
    const axeSource = await readFile(axePath, "utf8");
    await scenario("axe-full-motion", () => axePolicy(axeSource, "no-preference"));
    await scenario("axe-reduced-motion", () => axePolicy(axeSource, "reduce"));
  } else {
    results.disclosures.push("axe-core/axe.min.js was not present in current node_modules; axe scenarios skipped.");
    results.scenarios["axe-full-motion"] = { status: "skipped", reason: "axe-core unavailable" };
    results.scenarios["axe-reduced-motion"] = { status: "skipped", reason: "axe-core unavailable" };
  }

  await scenario("cpu-6x-full-motion", () => throttledPolicy("no-preference"));
  await scenario("cpu-6x-reduced-motion", () => throttledPolicy("reduce"));
  await scenario("r3-control-parity", controlParity);

  await browser.close();
  browser = undefined;

  // Chromium reports an expected failed-document console message for the
  // deliberate 404 route probe. Preserve it in the evidence manifest but
  // do not mistake that one exact probe for an application console defect.
  const unexpectedTelemetry = results.telemetry.filter(
    (entry) =>
      !(
        entry.kind === "console.error" &&
        entry.label === "bypass-r4-confirmation-missing" &&
        entry.text === "Failed to load resource: the server responded with a status of 404 (Not Found)"
      )
  );
  if (unexpectedTelemetry.length > 0) {
    results.failures.push({
      scenario: "page-telemetry",
      name: "AssertionError",
      message: `${unexpectedTelemetry.length} unexpected console/page error(s) captured`,
    });
  }
  const unknownRequestedScenarios = [...REQUESTED_SCENARIOS].filter(
    (name) => !(name in results.scenarios)
  );
  if (unknownRequestedScenarios.length > 0) {
    results.failures.push({
      scenario: "harness-selection",
      name: "AssertionError",
      message: `Unknown GCL_SCENARIOS selection: ${unknownRequestedScenarios.join(", ")}`,
    });
  }
  if (REQUESTED_SCENARIOS.size === 0) {
    const nonPassingScenarios = Object.entries(results.scenarios)
      .filter(([, evidence]) => evidence.status !== "passed")
      .map(([name, evidence]) => `${name}:${evidence.status}`);
    if (nonPassingScenarios.length > 0) {
      results.failures.push({
        scenario: "harness-completeness",
        name: "AssertionError",
        message: `Full confirmation contains non-passing mandatory scenarios: ${nonPassingScenarios.join(", ")}`,
      });
    }
  }
  results.finishedAt = new Date().toISOString();
  results.status =
    results.failures.length > 0
      ? "failed"
      : REQUESTED_SCENARIOS.size > 0
        ? "partial"
        : "passed";
  results.attestable = results.status === "passed" && REQUESTED_SCENARIOS.size === 0;
  results.telemetrySummary = {
    expectedCount: results.telemetry.length - unexpectedTelemetry.length,
    unexpectedCount: unexpectedTelemetry.length,
  };
  const manifestPath = path.join(EVIDENCE_DIR, "r4-confirmation-results.json");
  await writeFile(manifestPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  if (results.failures.length > 0) {
    throw new assert.AssertionError({
      message: `${results.failures.length} R4.2 confirmation failure(s); see ${manifestPath}`,
      actual: results.failures.length,
      expected: 0,
      operator: "strictEqual",
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: results.status,
        attestable: results.attestable,
        manifest: manifestPath,
      },
      null,
      2
    )}\n`
  );
}

main().catch(async (error) => {
  if (browser) {
    try {
      await browser.close();
    } catch {}
  }
  results.finishedAt = new Date().toISOString();
  results.status = "failed";
  if (!results.failures.some((failure) => failure.message === error.message)) {
    results.failures.push({ scenario: "harness", ...errorRecord(error) });
  }
  try {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await writeFile(
      path.join(EVIDENCE_DIR, "r4-confirmation-results.json"),
      `${JSON.stringify(results, null, 2)}\n`,
      "utf8"
    );
  } catch {}
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
