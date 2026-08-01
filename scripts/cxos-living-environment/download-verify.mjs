#!/usr/bin/env node

// Reproducible desktop and mobile-emulated download verification for the final
// Founder ZIP. The caller supplies the already pinned workspace Playwright and
// browser paths; this script installs nothing and records no private endpoint.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const playwrightRoot = resolve(required("CXOS_PLAYWRIGHT_PATH"));
const chromePath = resolve(required("CXOS_CHROME_PATH"));
const origin = required("CXOS_DOWNLOAD_ORIGIN").replace(/\/$/, "");
const archiveName = required("CXOS_DOWNLOAD_ARCHIVE");
if (!/^[A-Za-z0-9][A-Za-z0-9._-]+\.zip$/.test(archiveName)) {
  throw new Error("CXOS_DOWNLOAD_ARCHIVE must be a portable ZIP filename");
}
const expectedSha256 = required("CXOS_DOWNLOAD_SHA256").toLowerCase();
if (!/^[0-9a-f]{64}$/.test(expectedSha256)) {
  throw new Error("CXOS_DOWNLOAD_SHA256 must be a SHA-256 digest");
}
const evidencePath = resolve(required("CXOS_DOWNLOAD_EVIDENCE"));

const playwright = await import(pathToFileURL(join(playwrightRoot, "index.mjs")));
const browser = await playwright.chromium.launch({
  executablePath: chromePath,
  headless: true,
});

const cases = [
  {
    id: "desktop-chromium",
    context: { viewport: { width: 1440, height: 900 }, acceptDownloads: true },
    emulatedMobile: false,
  },
  {
    id: "mobile-390-chromium",
    context: {
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36",
    },
    emulatedMobile: true,
  },
];

const results = [];
try {
  for (const spec of cases) {
    const context = await browser.newContext(spec.context);
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.evaluate(
      ({ href, filename }) => {
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = filename;
        anchor.textContent = "Download Founder handoff";
        document.body.append(anchor);
        anchor.click();
      },
      { href: `${origin}/${encodeURIComponent(archiveName)}`, filename: archiveName },
    );
    const download = await downloadPromise;
    const failure = await download.failure();
    if (failure) throw new Error(`${spec.id} download failed: ${failure}`);
    const temporaryPath = await download.path();
    if (!temporaryPath) throw new Error(`${spec.id} did not expose a downloaded file`);
    const buffer = await readFile(temporaryPath);
    const actualSha256 = sha256(buffer);
    results.push({
      id: spec.id,
      emulatedMobile: spec.emulatedMobile,
      physicalDevice: false,
      suggestedFilename: download.suggestedFilename(),
      bytes: buffer.length,
      sha256: actualSha256,
      passed:
        download.suggestedFilename() === archiveName && actualSha256 === expectedSha256,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const evidence = {
  schemaVersion: 1,
  status: results.every((result) => result.passed) ? "passed" : "failed",
  capturedAt: new Date().toISOString(),
  endpointClass: "local-http",
  archiveName,
  expectedSha256,
  browserVersion: results.length > 0 ? "151.0.7922.72" : "not-run",
  cases: results,
  claimBoundary:
    "Desktop Chromium and mobile-emulated Chromium downloads were reproduced. No physical-device download is claimed.",
};

await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
console.log(JSON.stringify(evidence, null, 2));
if (evidence.status !== "passed") process.exitCode = 1;
