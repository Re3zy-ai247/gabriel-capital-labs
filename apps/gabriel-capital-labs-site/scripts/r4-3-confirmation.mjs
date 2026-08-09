#!/usr/bin/env node

/**
 * R4.3 Founder Experience Closure confirmation harness.
 *
 * Run from apps/gabriel-capital-labs-site against an already-served static
 * export. A filtered run is diagnostic only; only an unfiltered run can be
 * `passed` and `attestable`.
 *
 * Optional environment:
 *   GCL_BASE_URL=http://127.0.0.1:4310
 *   GCL_R43_EVIDENCE_DIR=../../docs/reviews/assets/r4-3
 *   GCL_R43_SCENARIOS=matrix-full-1440x900,narrative-reduced
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const SITE_ROOT = process.cwd();
const REPO_ROOT = path.resolve(SITE_ROOT, "../..");
const BASE_URL = process.env.GCL_BASE_URL ?? "http://127.0.0.1:4310";
const EVIDENCE_DIR = path.resolve(
  SITE_ROOT,
  process.env.GCL_R43_EVIDENCE_DIR ?? "../../docs/reviews/assets/r4-3"
);
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SESSION_KEY = "gcl-arrival-seen";
const OWNED_SELECTOR = "[data-gcl-prologue-inert]";
const APPROVED_OUTRO = "Enter the future we are engineering.";
const NAV_OFFSET = 84;
const DEFAULT_TIMEOUT = 30_000;
const FILTER = new Set(
  (process.env.GCL_R43_SCENARIOS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);

const DESKTOPS = [
  { width: 1920, height: 1080 },
  { width: 1512, height: 982 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 1024, height: 568 },
];
const MOBILES = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 320, height: 568 },
];
const POLICIES = ["no-preference", "reduce"];

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

const SOURCE_FILES = [
  "app/globals.css",
  "app/page.tsx",
  "components/EcosystemSection.tsx",
  "components/EngagementSection.tsx",
  "components/InstitutionalOutroScene.tsx",
  "components/Footer.tsx",
  "content/site.ts",
  "scripts/r4-3-confirmation.mjs",
  "package.json",
];

const results = {
  schemaVersion: 1,
  suite: "gcl-r4.3-founder-experience-closure",
  startedAt: new Date().toISOString(),
  configuration: {
    baseUrl: sanitizeUrl(BASE_URL),
    evidenceDir: EVIDENCE_DIR,
    requestedScenarios: [...FILTER],
    fullConfirmationRun: FILTER.size === 0,
    desktopViewports: DESKTOPS,
    mobileViewports: MOBILES,
    policies: POLICIES,
    expectedPinTopology: {
      desktopFull: 5,
      desktopReduced: 5,
      mobileFull: 2,
      mobileReduced: 0,
    },
  },
  git: {},
  sourceHashes: {},
  assetHashes: {},
  scenarios: {},
  telemetry: [],
  failures: [],
  screenshots: [],
  disclosures: [
    "Automated browser evidence is Chromium-only; Safari/WebKit remains a manual Founder check.",
    "The 1024x568 compact-height pair is an additional stress case beyond the binding minimum matrix.",
  ],
};

let browser;
const declaredScenarios = new Set();

function sanitizeUrl(value) {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.href;
}

function validateEndpoint() {
  const url = new URL(BASE_URL);
  assert.equal(url.username, "", "GCL_BASE_URL must not contain username credentials");
  assert.equal(url.password, "", "GCL_BASE_URL must not contain password credentials");
  assert.equal(url.search, "", "GCL_BASE_URL must not contain a query string");
  assert.ok(["http:", "https:"].includes(url.protocol), "GCL_BASE_URL must be HTTP(S)");
}

function siteUrl(pathname = "/") {
  const url = new URL(BASE_URL);
  const [pathPart, hashPart] = pathname.split("#", 2);
  url.pathname = pathPart || "/";
  url.hash = hashPart ? `#${hashPart}` : "";
  return url.href;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function errorRecord(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
  };
}

async function scenario(name, fn) {
  declaredScenarios.add(name);
  if (FILTER.size > 0 && !FILTER.has(name)) {
    results.scenarios[name] = { status: "skipped", reason: "GCL_R43_SCENARIOS filter" };
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
      url: sanitizeUrl(page.url()),
      text: message.text().replace(/https?:\/\/[^\s"'<>]+/gi, (url) => sanitizeUrl(url)),
    });
  });
  page.on("pageerror", (error) => {
    results.telemetry.push({
      kind: "pageerror",
      label,
      url: sanitizeUrl(page.url()),
      text: error.message,
      stack: error.stack ?? null,
    });
  });
}

async function makePage({ label, viewport, policy = "no-preference", seen = true, instrument = false }) {
  const context = await browser.newContext({ viewport, reducedMotion: policy });
  await context.addInitScript(
    ({ key, seenValue, instrumentListeners }) => {
      try {
        if (seenValue) sessionStorage.setItem(key, "1");
        else sessionStorage.removeItem(key);
      } catch {}

      if (instrumentListeners) {
        const originalAdd = EventTarget.prototype.addEventListener;
        const originalRemove = EventTarget.prototype.removeEventListener;
        const active = new Set();
        window.__gclReplayListenerState = { added: 0, removed: 0, active: 0 };

        EventTarget.prototype.addEventListener = function (type, listener, options) {
          if (this === window && type === "gcl:request-replay" && listener && !active.has(listener)) {
            active.add(listener);
            window.__gclReplayListenerState.added += 1;
            window.__gclReplayListenerState.active = active.size;
          }
          return originalAdd.call(this, type, listener, options);
        };

        EventTarget.prototype.removeEventListener = function (type, listener, options) {
          if (this === window && type === "gcl:request-replay" && listener && active.delete(listener)) {
            window.__gclReplayListenerState.removed += 1;
            window.__gclReplayListenerState.active = active.size;
          }
          return originalRemove.call(this, type, listener, options);
        };
      }
    },
    { key: SESSION_KEY, seenValue: seen, instrumentListeners: instrument }
  );
  const page = await context.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT);
  attachTelemetry(page, label);
  return { context, page };
}

async function withPage(options, fn) {
  const { context, page } = await makePage(options);
  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

async function gotoComposed(page, pathname = "/") {
  const response = await page.goto(siteUrl(pathname), { waitUntil: "load", timeout: DEFAULT_TIMEOUT });
  assert.equal(response?.status(), 200, `${pathname} must serve 200`);
  await page.waitForSelector(".institutional-outro");
  await page.waitForFunction(
    ({ owned }) =>
      !document.documentElement.classList.contains("gcl-prologue") &&
      !document.documentElement.classList.contains("gcl-replaying") &&
      document.querySelectorAll(owned).length === 0,
    { owned: OWNED_SELECTOR }
  );
  await page.waitForTimeout(650);
}

async function screenshot(page, label) {
  const filename = `${safeName(label)}.png`;
  await page.screenshot({ path: path.join(EVIDENCE_DIR, filename), fullPage: false });
  results.screenshots.push(filename);
  return filename;
}

function expectedPins(viewport, policy) {
  if (viewport.width >= 1024) return 5;
  return policy === "reduce" ? 0 : 2;
}

async function scrollToAbsolute(page, top) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "auto" }), top);
  await page.waitForTimeout(900);
}

async function absoluteTop(page, selector) {
  return page.$eval(selector, (element) => element.getBoundingClientRect().top + window.scrollY);
}

async function resolveEcosystem(page) {
  const wings = page.locator(".ecosystem__wing");
  assert.equal(await wings.count(), 4, "Ecosystem must retain four domains");
  for (let index = 0; index < 4; index += 1) {
    await wings.nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1050);
  }
  return page.evaluate(() => {
    const names = [...document.querySelectorAll(".ecosystem__wing-name")];
    return names.map((element) => ({
      name: element.textContent?.trim() ?? "",
      x: element.getBoundingClientRect().x,
      transform: getComputedStyle(element).transform,
    }));
  });
}

async function inspectMatrix(page, viewport, policy, label) {
  await gotoComposed(page);
  const titleOrigins = await resolveEcosystem(page);
  const xs = titleOrigins.map((item) => item.x);
  const spread = Math.max(...xs) - Math.min(...xs);
  assert.ok(spread <= 2, `Ecosystem title-origin spread ${spread}px exceeds 2px`);

  const contactTop = await absoluteTop(page, "#contact");
  await scrollToAbsolute(page, Math.max(0, contactTop - NAV_OFFSET));
  await page.waitForTimeout(500);
  const engagementShot = await screenshot(page, `${label}-engagement`);

  const engagement = await page.evaluate(() => {
    const section = document.querySelector("#contact");
    const chapter = document.querySelector(".engagement__chapter-mark");
    const rows = [...document.querySelectorAll(".engagement__category")];
    const note = document.querySelector(".engagement__placeholder-note");
    const outro = document.querySelector("#institutional-outro");
    const footer = document.querySelector("footer");
    if (!section || !chapter || rows.length !== 6 || !note || !outro || !footer) return null;
    const sectionRect = section.getBoundingClientRect();
    const chapterRect = chapter.getBoundingClientRect();
    const rowRects = rows.map((row) => row.getBoundingClientRect());
    const noteRect = note.getBoundingClientRect();
    const outroRect = outro.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const absolute = (rect) => ({ top: rect.top + scrollY, bottom: rect.bottom + scrollY });
    return {
      section: { width: sectionRect.width, height: sectionRect.height, ...absolute(sectionRect) },
      chapterGap: rowRects[0].top - chapterRect.bottom,
      rowHeights: rowRects.map((rect) => rect.height),
      noteGap: noteRect.top - rowRects.at(-1).bottom,
      bottomBreathingRoom: sectionRect.bottom - noteRect.bottom,
      outro: { height: outroRect.height, ...absolute(outroRect) },
      footer: absolute(footerRect),
      domOrder:
        Boolean(section.compareDocumentPosition(outro) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        Boolean(outro.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING),
      engagementMarks: section.querySelectorAll("img[src*='gateway-g']").length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      headings: [...document.querySelectorAll("h1,h2")].map((heading) => ({
        tag: heading.tagName,
        id: heading.id,
        text: heading.textContent?.replace(/\s+/g, " ").trim(),
      })),
    };
  });
  assert.ok(engagement, "Engagement geometry must exist");
  assert.ok(engagement.chapterGap >= 48, `chapter-to-rows gap is ${engagement.chapterGap}px`);
  assert.ok(engagement.noteGap >= 24, `status-note gap is ${engagement.noteGap}px`);
  assert.ok(
    engagement.bottomBreathingRoom >= 64,
    `Engagement bottom breathing room is ${engagement.bottomBreathingRoom}px`
  );
  assert.ok(Math.min(...engagement.rowHeights) >= 60, "every engagement row needs deliberate height");
  if (viewport.width >= 1024) {
    const rowSpread = Math.max(...engagement.rowHeights) - Math.min(...engagement.rowHeights);
    assert.ok(rowSpread <= 2, `desktop engagement row-height spread is ${rowSpread}px`);
  }
  assert.equal(engagement.engagementMarks, 0, "Gateway G must not remain in Engagement");
  assert.equal(engagement.domOrder, true, "DOM order must be Engagement → Outro → Footer");
  assert.ok(Math.abs(engagement.footer.top - engagement.outro.bottom) <= 1, "Footer must follow Outro flow");
  assert.ok(engagement.overflow <= 0.5, `horizontal overflow is ${engagement.overflow}px`);
  assert.equal(engagement.headings[0]?.tag, "H1", "Arrival must retain the single leading h1");
  assert.ok(
    engagement.headings.some((item) => item.id === "engagement-heading" && item.text === "06 — Engagement"),
    "Engagement must retain a valid labelled h2"
  );

  const outroStart = await absoluteTop(page, "#institutional-outro");
  if (viewport.width >= 1024) {
    const distance = viewport.height * (policy === "reduce" ? 0.6 : 1);
    await scrollToAbsolute(page, outroStart + distance * 0.88);
  } else {
    await page.locator(".institutional-outro__composition").scrollIntoViewIfNeeded();
    await page.waitForTimeout(policy === "reduce" ? 250 : 1400);
  }
  const outroShot = await screenshot(page, `${label}-outro-hold`);

  const outro = await page.evaluate(() => {
    const section = document.querySelector(".institutional-outro");
    const pin = document.querySelector(".institutional-outro__pin");
    const image = document.querySelector(".institutional-outro__mark");
    const markWrap = document.querySelector(".institutional-outro__mark-wrap");
    const heading = document.querySelector(".institutional-outro__heading");
    const lines = [...document.querySelectorAll(".institutional-outro__line")];
    const footer = document.querySelector("footer");
    if (!section || !pin || !image || !markWrap || !heading || lines.length !== 2 || !footer) return null;
    const imageRect = image.getBoundingClientRect();
    const pinRect = pin.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const imageStyle = getComputedStyle(image);
    const chain = [];
    let node = image;
    while (node && node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      chain.push({
        className: node.className,
        filter: style.filter,
        backdropFilter: style.backdropFilter,
        mixBlendMode: style.mixBlendMode,
        maskImage: style.maskImage,
      });
      if (node === section) break;
      node = node.parentElement;
    }
    return {
      accessibleText: heading.textContent?.replace(/\s+/g, " ").trim(),
      lineRects: lines.map((line) => ({
        rectCount: line.getClientRects().length,
        left: line.getBoundingClientRect().left,
        right: line.getBoundingClientRect().right,
        opacity: Number(getComputedStyle(line).opacity),
      })),
      image: {
        width: imageRect.width,
        height: imageRect.height,
        opacity: Number(imageStyle.opacity),
        transform: imageStyle.transform,
        filter: imageStyle.filter,
        mixBlendMode: imageStyle.mixBlendMode,
      },
      markWrap: {
        opacity: Number(getComputedStyle(markWrap).opacity),
        transform: getComputedStyle(markWrap).transform,
      },
      pinHeight: pinRect.height,
      footerTop: footerRect.top,
      imageContained:
        imageRect.left >= pinRect.left - 0.5 &&
        imageRect.right <= pinRect.right + 0.5 &&
        imageRect.top >= pinRect.top - 0.5 &&
        imageRect.bottom <= pinRect.bottom + 0.5,
      chain,
      pinSpacers: document.querySelectorAll(".pin-spacer").length,
      nestedPinSpacers: document.querySelectorAll(".pin-spacer .pin-spacer").length,
      outroPinSpacers: section.querySelectorAll(".pin-spacer").length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  assert.ok(outro, "Outro geometry must exist");
  assert.equal(outro.accessibleText, APPROVED_OUTRO, "Outro accessible name must preserve approved copy");
  assert.ok(outro.lineRects.every((line) => line.rectCount === 1), "each approved message line must remain one line");
  assert.ok(
    outro.lineRects.every((line) => line.left >= -0.5 && line.right <= viewport.width + 0.5),
    "Outro message must remain inside the viewport"
  );
  assert.ok(outro.image.width > 0 && outro.image.height > 0, "Outro G must have rendered geometry");
  const aspectError = Math.abs(outro.image.width / outro.image.height - 480 / 520) / (480 / 520);
  assert.ok(aspectError <= 0.0002, `Gateway G aspect drift is ${aspectError * 100}%`);
  assert.equal(outro.image.opacity, 1, "Gateway G image opacity must remain 1");
  assert.equal(outro.image.transform, "none", "Gateway G image must never receive a transform");
  assert.equal(outro.image.filter, "none", "Gateway G image must never receive a filter");
  assert.equal(outro.image.mixBlendMode, "normal", "Gateway G image blend mode must remain normal");
  assert.equal(outro.imageContained, true, "Gateway G must remain inside the Outro field");
  assert.ok(outro.chain.every((item) => item.filter === "none"), "Gateway G ancestor chain must be filter-free");
  assert.ok(
    outro.chain.every((item) => item.backdropFilter === "none"),
    "Gateway G ancestor chain must be backdrop-filter-free"
  );
  assert.ok(outro.chain.every((item) => item.mixBlendMode === "normal"), "Gateway G chain must not blend");
  assert.ok(outro.chain.every((item) => item.maskImage === "none"), "Gateway G chain must be mask-free");
  assert.ok(outro.pinHeight >= viewport.height - 1, "Outro must occupy a complete visual chapter");
  assert.equal(outro.pinSpacers, expectedPins(viewport, policy), "pin topology must match policy");
  assert.equal(outro.nestedPinSpacers, 0, "pin spacers must never nest");
  assert.equal(outro.outroPinSpacers, viewport.width >= 1024 ? 1 : 0, "Outro pin policy mismatch");
  assert.ok(outro.overflow <= 0.5, `Outro horizontal overflow is ${outro.overflow}px`);
  if (viewport.width >= 1024) {
    assert.ok(outro.footerTop >= viewport.height - 1, "Footer must remain below the pinned hold frame");
  }
  if (policy === "reduce") {
    assert.equal(outro.markWrap.transform, "none", "reduced motion must not transform the G wrapper");
  }

  return {
    viewport,
    policy,
    titleOrigins,
    titleOriginSpreadPx: spread,
    engagement,
    outro,
    screenshots: [engagementShot, outroShot],
  };
}

async function narrative(policy) {
  const viewport = { width: 1440, height: 900 };
  return withPage({ label: `narrative-${policy}`, viewport, policy, seen: true }, async (page) => {
    await gotoComposed(page);
    const start = await absoluteTop(page, "#institutional-outro");
    const distance = viewport.height * (policy === "reduce" ? 0.6 : 1);
    const progressPoints = [0.22, 0.46, 0.88, 0.97];
    const samples = [];

    for (const progress of progressPoints) {
      await scrollToAbsolute(page, start + distance * progress);
      const state = await page.evaluate(() => ({
        signal: Number(getComputedStyle(document.querySelector(".institutional-outro__signal")).opacity),
        mark: Number(getComputedStyle(document.querySelector(".institutional-outro__mark-wrap")).opacity),
        lines: [...document.querySelectorAll(".institutional-outro__line")].map((line) =>
          Number(getComputedStyle(line).opacity)
        ),
        transforms: {
          signal: getComputedStyle(document.querySelector(".institutional-outro__signal")).transform,
          mark: getComputedStyle(document.querySelector(".institutional-outro__mark-wrap")).transform,
          lines: [...document.querySelectorAll(".institutional-outro__line")].map(
            (line) => getComputedStyle(line).transform
          ),
          image: getComputedStyle(document.querySelector(".institutional-outro__mark")).transform,
        },
        markRect: (() => {
          const rect = document.querySelector(".institutional-outro__mark").getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        })(),
        footerTop: document.querySelector("footer").getBoundingClientRect().top,
      }));
      samples.push({ progress, ...state, screenshot: await screenshot(page, `narrative-${policy}-${progress}`) });
    }

    assert.ok(samples[0].signal > 0.3, "architectural signal must resolve before the G");
    assert.ok(samples[0].mark < 0.15, "G must not precede the signal");
    assert.ok(Math.max(...samples[0].lines) < 0.15, "message must not precede the G");
    assert.ok(samples[1].mark > 0.65, "G must resolve before the message");
    assert.ok(Math.max(...samples[1].lines) < 0.15, "message must wait for the G");
    assert.ok(samples[2].mark > 0.98, "G must be fully resolved in the hold");
    assert.ok(Math.min(...samples[2].lines) > 0.95, "message must be fully resolved in the hold");
    assert.ok(samples[2].footerTop >= viewport.height - 1, "footer must remain outside the hold frame");
    assert.equal(samples[2].transforms.image, "none", "Gateway G image must remain untransformed");
    const holdDelta = Math.max(
      ...Object.keys(samples[2].markRect).map((key) =>
        Math.abs(samples[2].markRect[key] - samples[3].markRect[key])
      )
    );
    assert.ok(holdDelta <= 0.5, `hold geometry drifted by ${holdDelta}px`);

    if (policy === "reduce") {
      for (const sample of samples) {
        assert.equal(sample.transforms.signal, "none", "reduced signal must not transform");
        assert.equal(sample.transforms.mark, "none", "reduced G wrapper must not transform");
        assert.ok(sample.transforms.lines.every((value) => value === "none"), "reduced lines must not transform");
      }
    }

    return { policy, samples };
  });
}

async function waitForReplayLock(page, expectedOwned) {
  await page.waitForFunction(
    ({ owned, count }) =>
      document.documentElement.classList.contains("gcl-prologue") &&
      document.documentElement.classList.contains("gcl-replaying") &&
      document.querySelectorAll(owned).length === count,
    { owned: OWNED_SELECTOR, count: expectedOwned },
    { timeout: 9000 }
  );
  const state = await page.evaluate((owned) => ({
    scrollY,
    owned: document.querySelectorAll(owned).length,
    ownedInert: document.querySelectorAll(`${owned}[inert]`).length,
    overflow: getComputedStyle(document.documentElement).overflow,
    replayVisibility: getComputedStyle(document.querySelector(".arrival__replay")).visibility,
  }), OWNED_SELECTOR);
  assert.ok(state.scrollY <= 1, `Replay must return to top before lock, got ${state.scrollY}`);
  assert.equal(state.owned, expectedOwned);
  assert.equal(state.ownedInert, expectedOwned);
  assert.equal(state.overflow, "hidden", "Replay must lock scroll");
  assert.equal(state.replayVisibility, "hidden", "Replay control must be withheld while replaying");
  return state;
}

async function waitForReplayRelease(page, expectedPins) {
  await page.waitForFunction(
    (owned) =>
      !document.documentElement.classList.contains("gcl-prologue") &&
      !document.documentElement.classList.contains("gcl-replaying") &&
      document.querySelectorAll(owned).length === 0 &&
      document.querySelector('[role="status"]')?.textContent?.trim() === "Introduction complete",
    OWNED_SELECTOR,
    { timeout: 26_000 }
  );
  await page.waitForFunction(() => document.activeElement?.classList.contains("arrival__replay"));
  await page.waitForTimeout(350);
  const state = await page.evaluate(() => ({
    owned: document.querySelectorAll("[data-gcl-prologue-inert]").length,
    allInert: document.querySelectorAll("[inert]").length,
    prologue: document.documentElement.classList.contains("gcl-prologue"),
    replaying: document.documentElement.classList.contains("gcl-replaying"),
    overflow: getComputedStyle(document.documentElement).overflow,
    focusClass: document.activeElement?.className ?? "",
    status: document.querySelector('[role="status"]')?.textContent?.trim() ?? "",
    pins: document.querySelectorAll(".pin-spacer").length,
    nestedPins: document.querySelectorAll(".pin-spacer .pin-spacer").length,
    outroPins: document.querySelectorAll(".institutional-outro .pin-spacer").length,
    listener: window.__gclReplayListenerState ?? null,
  }));
  assert.equal(state.owned, 0, "Replay release must clear all owned markers");
  assert.equal(state.allInert, 0, "Replay release must clear all acquired inert state");
  assert.equal(state.prologue, false);
  assert.equal(state.replaying, false);
  assert.notEqual(state.overflow, "hidden", "Replay release must restore scroll");
  assert.match(String(state.focusClass), /arrival__replay/, "Replay release must restore focus");
  assert.equal(state.status, "Introduction complete");
  assert.equal(state.pins, expectedPins, "Replay must not accumulate pin spacers");
  assert.equal(state.nestedPins, 0, "Replay must not nest pin spacers");
  assert.equal(state.outroPins, 1, "Replay must retain exactly one Outro pin");
  assert.equal(state.listener?.active, 1, "exactly one Replay event bridge listener must remain active");
  return state;
}

async function dispatchReplayFrom(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event("gcl:request-replay")));
}

async function replayLifecycle() {
  const viewport = { width: 1440, height: 900 };
  return withPage(
    { label: "replay-lifecycle", viewport, policy: "no-preference", seen: true, instrument: true },
    async (page) => {
      await gotoComposed(page);
      const initial = await page.evaluate(() => ({
        pins: document.querySelectorAll(".pin-spacer").length,
        listener: window.__gclReplayListenerState,
      }));
      assert.equal(initial.pins, 5, "desktop full-motion baseline must have five pins");
      assert.equal(initial.listener?.active, 1, "Replay event bridge must be singular at mount");

      await dispatchReplayFrom(page, "#contact");
      const engagementLock = await waitForReplayLock(page, 9);
      await page.keyboard.press("Escape");
      const afterEscape = await waitForReplayRelease(page, 5);

      await dispatchReplayFrom(page, "#institutional-outro");
      const outroLock = await waitForReplayLock(page, 9);
      const skip = page.locator(".arrival__skip");
      await skip.waitFor({ state: "visible", timeout: 7000 });
      await skip.focus();
      await skip.press("Enter");
      const afterSkip = await waitForReplayRelease(page, 5);

      const footerReplay = page.locator("footer button", { hasText: "Replay Arrival" });
      await footerReplay.scrollIntoViewIfNeeded();
      await footerReplay.focus();
      await footerReplay.press("Enter");
      const footerLock = await waitForReplayLock(page, 9);
      const afterNatural = await waitForReplayRelease(page, 5);
      const finalShot = await screenshot(page, "replay-three-cycles-complete");

      return {
        initial,
        engagementLock,
        afterEscape,
        outroLock,
        afterSkip,
        footerLock,
        afterNatural,
        screenshot: finalShot,
      };
    }
  );
}

async function reducedReplayLifecycle() {
  const viewport = { width: 1440, height: 900 };
  return withPage(
    { label: "replay-reduced", viewport, policy: "reduce", seen: true, instrument: true },
    async (page) => {
      await gotoComposed(page);
      await dispatchReplayFrom(page, "#institutional-outro");
      const lock = await waitForReplayLock(page, 9);
      await page.keyboard.press("Escape");
      const release = await waitForReplayRelease(page, 5);
      return { lock, release };
    }
  );
}

async function unrelatedInertPreservation() {
  const viewport = { width: 1440, height: 900 };
  return withPage(
    { label: "unrelated-inert", viewport, policy: "no-preference", seen: true },
    async (page) => {
      await gotoComposed(page);
      await page.$eval("footer", (footer) => footer.setAttribute("inert", ""));
      await dispatchReplayFrom(page, "#contact");
      await waitForReplayLock(page, 8);
      const active = await page.$eval("footer", (footer) => ({
        inert: footer.hasAttribute("inert"),
        owned: footer.hasAttribute("data-gcl-prologue-inert"),
      }));
      assert.deepEqual(active, { inert: true, owned: false }, "pre-existing footer inert must remain unowned");
      await page.keyboard.press("Escape");
      await page.waitForFunction((owned) => document.querySelectorAll(owned).length === 0, OWNED_SELECTOR);
      const released = await page.$eval("footer", (footer) => ({
        inert: footer.hasAttribute("inert"),
        owned: footer.hasAttribute("data-gcl-prologue-inert"),
      }));
      assert.deepEqual(released, { inert: true, owned: false }, "release must preserve unrelated inert");
      await page.$eval("footer", (footer) => footer.removeAttribute("inert"));
      return { active, released };
    }
  );
}

async function mobileReplayBypass() {
  const viewport = { width: 390, height: 844 };
  return withPage({ label: "mobile-replay", viewport, policy: "no-preference", seen: true }, async (page) => {
    await gotoComposed(page);
    await dispatchReplayFrom(page, "footer");
    await page.waitForTimeout(900);
    const state = await page.evaluate(() => ({
      prologue: document.documentElement.classList.contains("gcl-prologue"),
      replaying: document.documentElement.classList.contains("gcl-replaying"),
      owned: document.querySelectorAll("[data-gcl-prologue-inert]").length,
      inert: document.querySelectorAll("[inert]").length,
      pins: document.querySelectorAll(".pin-spacer").length,
      outroTransform: getComputedStyle(document.querySelector(".institutional-outro__mark-wrap")).transform,
    }));
    assert.equal(state.prologue, false, "mobile Replay must not acquire desktop prologue lock");
    assert.equal(state.replaying, false);
    assert.equal(state.owned, 0);
    assert.equal(state.inert, 0);
    assert.equal(state.pins, 2, "mobile full-motion pin topology must remain inherited baseline");
    return state;
  });
}

async function hashLanding(policy) {
  const viewport = { width: 1440, height: 900 };
  return withPage({ label: `hash-${policy}`, viewport, policy, seen: false }, async (page) => {
    const response = await page.goto(siteUrl("/#contact"), { waitUntil: "load" });
    assert.equal(response?.status(), 200);
    await page.waitForSelector("#contact");
    await page.waitForTimeout(1400);
    await page.waitForFunction(() => {
      const target = document.querySelector("#contact");
      return target && Math.abs(target.getBoundingClientRect().top - 84) <= 1;
    });
    const state = await page.evaluate(() => ({
      top: document.querySelector("#contact").getBoundingClientRect().top,
      hash: location.hash,
      prologue: document.documentElement.classList.contains("gcl-prologue"),
      replaying: document.documentElement.classList.contains("gcl-replaying"),
      owned: document.querySelectorAll("[data-gcl-prologue-inert]").length,
      inert: document.querySelectorAll("[inert]").length,
      pins: document.querySelectorAll(".pin-spacer").length,
    }));
    assert.ok(Math.abs(state.top - NAV_OFFSET) <= 1, `#contact landed at ${state.top}px`);
    assert.equal(state.hash, "#contact");
    assert.equal(state.prologue, false);
    assert.equal(state.replaying, false);
    assert.equal(state.owned, 0);
    assert.equal(state.inert, 0);
    assert.equal(state.pins, 5);
    return state;
  });
}

async function axePolicy(policy, axeSource) {
  const viewport = { width: 1440, height: 900 };
  return withPage({ label: `axe-${policy}`, viewport, policy, seen: true }, async (page) => {
    await gotoComposed(page);
    await page.addScriptTag({ content: axeSource });
    const positions = ["#contact", "#institutional-outro", "footer"];
    const audits = [];

    for (const selector of positions) {
      if (selector === "#institutional-outro") {
        const start = await absoluteTop(page, selector);
        const distance = viewport.height * (policy === "reduce" ? 0.6 : 1);
        await scrollToAbsolute(page, start + distance * 0.88);
      } else {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await page.waitForTimeout(selector === "#contact" ? 1700 : 500);
      }
      if (selector === "#contact") {
        await page.waitForFunction(() =>
          [...document.querySelectorAll(".engagement__category")].every(
            (row) => Number(getComputedStyle(row).opacity) >= 0.99
          )
        );
      }
      const result = await page.evaluate(async (scopeSelector) => {
        const scope = document.querySelector(scopeSelector);
        if (!scope) throw new Error(`Missing axe scope: ${scopeSelector}`);
        const audit = await window.axe.run(scope, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
        });
        return {
          violations: audit.violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => ({
              target: node.target,
              html: node.html,
              failureSummary: node.failureSummary,
            })),
          })),
          passes: audit.passes.length,
        };
      }, selector);
      const blockers = result.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact)
      );
      assert.equal(
        blockers.length,
        0,
        `${policy} ${selector} serious/critical axe violations: ${JSON.stringify(blockers)}`
      );
      audits.push({ selector, ...result });
    }
    return { policy, audits };
  });
}

async function localPerformance() {
  const viewport = { width: 1440, height: 900 };
  return withPage({ label: "performance", viewport, policy: "no-preference", seen: true }, async (page) => {
    const started = Date.now();
    await gotoComposed(page);
    const wallMs = Date.now() - started;
    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType("navigation")[0];
      return {
        responseStart: entry.responseStart,
        domContentLoaded: entry.domContentLoadedEventEnd,
        load: entry.loadEventEnd,
        duration: entry.duration,
        resources: performance.getEntriesByType("resource").length,
      };
    });
    assert.ok(navigation.load < 2000, `local static load event was ${navigation.load}ms`);
    assert.ok(wallMs < 3000, `composed local wall time was ${wallMs}ms`);
    return { wallMs, navigation };
  });
}

async function hashFiles() {
  for (const [relativePath, expected] of Object.entries(EXPECTED_ASSETS)) {
    const actual = sha256(await readFile(path.join(SITE_ROOT, relativePath)));
    assert.equal(actual, expected, `${relativePath} differs from the locked Gateway G projection`);
    results.assetHashes[relativePath] = actual;
  }
  for (const relativePath of SOURCE_FILES) {
    results.sourceHashes[relativePath] = sha256(await readFile(path.join(SITE_ROOT, relativePath)));
  }
}

async function main() {
  validateEndpoint();
  await mkdir(EVIDENCE_DIR, { recursive: true });
  results.git = {
    branch: execFileSync("git", ["branch", "--show-current"], { cwd: REPO_ROOT, encoding: "utf8" }).trim(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim(),
    base: "3600ae2c9cd92d193c2228773420c7ec31e24be2",
  };

  await scenario("canonical-assets-and-source-binding", async () => {
    await hashFiles();
    return { assets: results.assetHashes, sourceFiles: Object.keys(results.sourceHashes).length };
  });

  browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });

  for (const policy of POLICIES) {
    const policyName = policy === "reduce" ? "reduced" : "full";
    for (const viewport of [...DESKTOPS, ...MOBILES]) {
      const name = `matrix-${policyName}-${viewport.width}x${viewport.height}`;
      await scenario(name, () =>
        withPage({ label: name, viewport, policy, seen: true }, (page) =>
          inspectMatrix(page, viewport, policy, name)
        )
      );
    }
  }

  await scenario("narrative-full", () => narrative("no-preference"));
  await scenario("narrative-reduced", () => narrative("reduce"));
  await scenario("replay-full-three-origins", replayLifecycle);
  await scenario("replay-reduced-outro", reducedReplayLifecycle);
  await scenario("unrelated-inert-preservation", unrelatedInertPreservation);
  await scenario("mobile-replay-bypass", mobileReplayBypass);
  await scenario("hash-contact-full", () => hashLanding("no-preference"));
  await scenario("hash-contact-reduced", () => hashLanding("reduce"));

  const axeSource = await readFile(path.join(SITE_ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
  await scenario("axe-full", () => axePolicy("no-preference", axeSource));
  await scenario("axe-reduced", () => axePolicy("reduce", axeSource));
  await scenario("local-static-performance", localPerformance);

  await browser.close();
  browser = undefined;

  if (results.telemetry.length > 0) {
    results.failures.push({
      scenario: "browser-telemetry",
      name: "AssertionError",
      message: `${results.telemetry.length} console/page error(s) captured`,
    });
  }

  const unknown = [...FILTER].filter((name) => !declaredScenarios.has(name));
  if (unknown.length > 0) {
    results.failures.push({
      scenario: "harness-selection",
      name: "AssertionError",
      message: `Unknown GCL_R43_SCENARIOS selection: ${unknown.join(", ")}`,
    });
  }

  if (FILTER.size === 0) {
    const nonPassing = Object.entries(results.scenarios)
      .filter(([, evidence]) => evidence.status !== "passed")
      .map(([name, evidence]) => `${name}:${evidence.status}`);
    if (nonPassing.length > 0) {
      results.failures.push({
        scenario: "harness-completeness",
        name: "AssertionError",
        message: `Full confirmation contains non-passing scenarios: ${nonPassing.join(", ")}`,
      });
    }
  }

  results.finishedAt = new Date().toISOString();
  results.telemetrySummary = { unexpectedCount: results.telemetry.length };
  results.status =
    results.failures.length > 0 ? "failed" : FILTER.size > 0 ? "partial" : "passed";
  results.attestable = results.status === "passed" && FILTER.size === 0;
  const manifestPath = path.join(EVIDENCE_DIR, "r4-3-confirmation-results.json");
  await writeFile(manifestPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  if (results.failures.length > 0) {
    throw new assert.AssertionError({
      message: `${results.failures.length} R4.3 confirmation failure(s); see ${manifestPath}`,
      actual: results.failures.length,
      expected: 0,
      operator: "strictEqual",
    });
  }

  process.stdout.write(
    `${JSON.stringify({ status: results.status, attestable: results.attestable, manifest: manifestPath }, null, 2)}\n`
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
  results.attestable = false;
  if (!results.failures.some((failure) => failure.message === error?.message)) {
    results.failures.push({ scenario: "harness", ...errorRecord(error) });
  }
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(
    path.join(EVIDENCE_DIR, "r4-3-confirmation-results.json"),
    `${JSON.stringify(results, null, 2)}\n`,
    "utf8"
  );
  console.error(error);
  process.exitCode = 1;
});
