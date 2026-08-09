#!/usr/bin/env node

// R4.4 metadata-only social-card reconciliation.
//
// The approved Gateway G, wordmark, crop, and photographic background are
// decoded from the existing R4.3 cards. Only pixels inside the declared
// tagline rectangle may change. PNG is intentional: unlike a JPEG re-encode,
// it lets the verification below prove exact decoded-pixel identity everywhere
// outside that rectangle, including the Gateway G and wordmark.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "../..");
const EVIDENCE_DIR = path.join(REPO_ROOT, "docs/reviews/assets/r4-4");
const APPROVED_THESIS = "Building the Infrastructure for Intelligent Capital.";
const THESIS_LINES = ["Building the Infrastructure", "for Intelligent Capital."];

const CARDS = [
  {
    name: "open-graph",
    input: "brand/web/GCL_OpenGraph_1200x630.jpg",
    brandOutput: "brand/web/GCL_OpenGraph_1200x630.png",
    publicOutput: "public/og.png",
    width: 1200,
    height: 630,
    taglineRegion: { left: 520, top: 382, width: 520, height: 82 },
    oldTextBounds: { left: 545, top: 388, width: 460, height: 74 },
  },
  {
    name: "x-card",
    input: "brand/web/GCL_X_Card_1200x600.jpg",
    brandOutput: "brand/web/GCL_X_Card_1200x600.png",
    publicOutput: "public/x-card.png",
    width: 1200,
    height: 600,
    taglineRegion: { left: 520, top: 367, width: 520, height: 82 },
    oldTextBounds: { left: 545, top: 373, width: 460, height: 74 },
  },
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pixelOffset(x, y, width) {
  return (y * width + x) * 3;
}

function removeHistoricalTagline(source, card) {
  const { width, oldTextBounds } = card;
  const working = Buffer.from(source);
  const topRows = [oldTextBounds.top - 8, oldTextBounds.top - 7, oldTextBounds.top - 6];
  const bottomStart = oldTextBounds.top + oldTextBounds.height;
  const bottomRows = [bottomStart + 5, bottomStart + 6, bottomStart + 7];

  function averageAt(xValues, yValues, channel) {
    let sum = 0;
    let count = 0;
    for (const y of yValues) {
      for (const x of xValues) {
        sum += source[pixelOffset(x, y, width) + channel];
        count += 1;
      }
    }
    return sum / count;
  }

  const referenceXs = [
    ...Array.from({ length: 12 }, (_, index) => oldTextBounds.left - 18 + index),
    ...Array.from(
      { length: 12 },
      (_, index) => oldTextBounds.left + oldTextBounds.width + 7 + index
    ),
  ];
  const referenceTop = [0, 1, 2].map((channel) =>
    averageAt(referenceXs, topRows, channel)
  );
  const referenceBottom = [0, 1, 2].map((channel) =>
    averageAt(referenceXs, bottomRows, channel)
  );

  // Reconstruct the small historical-copy rectangle from clean samples above
  // and below it. A row residual sampled on both sides restores the original
  // horizontal grid/glow structure without borrowing any old glyph pixels.
  for (let y = oldTextBounds.top; y < oldTextBounds.top + oldTextBounds.height; y += 1) {
    const t = (y - oldTextBounds.top + 1) / (oldTextBounds.height + 1);
    for (let channel = 0; channel < 3; channel += 1) {
      const referenceRow = averageAt(referenceXs, [y], channel);
      const referenceLinear = referenceTop[channel] * (1 - t) + referenceBottom[channel] * t;
      const rowResidual = referenceRow - referenceLinear;
      for (let x = oldTextBounds.left; x < oldTextBounds.left + oldTextBounds.width; x += 1) {
        const top = averageAt([x], topRows, channel);
        const bottom = averageAt([x], bottomRows, channel);
        const reconstructed = top * (1 - t) + bottom * t + rowResidual * 0.65;
        working[pixelOffset(x, y, width) + channel] = Math.max(
          0,
          Math.min(255, Math.round(reconstructed))
        );
      }
    }
  }

  return working;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function renderTagline(region) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${region.width}" height="${region.height}">
      <style>
        text {
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          font-size: 28px;
          font-weight: 300;
          letter-spacing: 0.15px;
          fill: #aeb0b4;
        }
      </style>
      <text x="${region.width / 2}" y="30" text-anchor="middle">${escapeXml(THESIS_LINES[0])}</text>
      <text x="${region.width / 2}" y="70" text-anchor="middle">${escapeXml(THESIS_LINES[1])}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
}

function blendTagline(background, overlay, card) {
  const output = Buffer.from(background);
  const { taglineRegion, width } = card;
  for (let y = 0; y < taglineRegion.height; y += 1) {
    for (let x = 0; x < taglineRegion.width; x += 1) {
      const overlayOffset = (y * taglineRegion.width + x) * 4;
      const alpha = overlay[overlayOffset + 3] / 255;
      if (alpha === 0) continue;
      const outputOffset = pixelOffset(taglineRegion.left + x, taglineRegion.top + y, width);
      for (let channel = 0; channel < 3; channel += 1) {
        output[outputOffset + channel] = Math.round(
          overlay[overlayOffset + channel] * alpha + output[outputOffset + channel] * (1 - alpha)
        );
      }
    }
  }
  return output;
}

function regionHash(raw, imageWidth, region) {
  const hash = createHash("sha256");
  for (let y = region.top; y < region.top + region.height; y += 1) {
    const start = pixelOffset(region.left, y, imageWidth);
    hash.update(raw.subarray(start, start + region.width * 3));
  }
  return hash.digest("hex");
}

function comparePixels(before, after, card) {
  const { width, height, taglineRegion } = card;
  let outsideChanged = 0;
  let insideChanged = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = pixelOffset(x, y, width);
      const changed =
        before[offset] !== after[offset] ||
        before[offset + 1] !== after[offset + 1] ||
        before[offset + 2] !== after[offset + 2];
      if (!changed) continue;
      const inside =
        x >= taglineRegion.left &&
        x < taglineRegion.left + taglineRegion.width &&
        y >= taglineRegion.top &&
        y < taglineRegion.top + taglineRegion.height;
      if (inside) insideChanged += 1;
      else outsideChanged += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    insideChanged,
    outsideChanged,
    changedBounds: { left: minX, top: minY, right: maxX, bottom: maxY },
  };
}

async function reconcile(card) {
  const inputPath = path.join(SITE_ROOT, card.input);
  const brandOutputPath = path.join(SITE_ROOT, card.brandOutput);
  const publicOutputPath = path.join(SITE_ROOT, card.publicOutput);
  const inputBytes = await readFile(inputPath);
  const { data: source, info } = await sharp(inputBytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual(
    { width: info.width, height: info.height, channels: info.channels },
    { width: card.width, height: card.height, channels: 3 },
    `${card.name} source dimensions/channels must remain locked`
  );

  const clean = removeHistoricalTagline(source, card);
  const overlay = await renderTagline(card.taglineRegion);
  const composed = blendTagline(clean, overlay, card);
  const outputBytes = await sharp(composed, {
    raw: { width: card.width, height: card.height, channels: 3 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await writeFile(brandOutputPath, outputBytes);
  await copyFile(brandOutputPath, publicOutputPath);

  const { data: decodedOutput, info: outputInfo } = await sharp(outputBytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual(
    { width: outputInfo.width, height: outputInfo.height, channels: outputInfo.channels },
    { width: card.width, height: card.height, channels: 3 },
    `${card.name} output dimensions/channels must remain locked`
  );

  const pixelDelta = comparePixels(source, decodedOutput, card);
  assert.equal(pixelDelta.outsideChanged, 0, `${card.name} changed outside its tagline region`);
  assert.ok(pixelDelta.insideChanged > 0, `${card.name} tagline region must change`);

  const gatewayRegion = { left: 145, top: 85, width: 310, height: 455 };
  const wordmarkRegion = { left: 500, top: 200, width: 580, height: 170 };
  const gatewayBefore = regionHash(source, card.width, gatewayRegion);
  const gatewayAfter = regionHash(decodedOutput, card.width, gatewayRegion);
  const wordmarkBefore = regionHash(source, card.width, wordmarkRegion);
  const wordmarkAfter = regionHash(decodedOutput, card.width, wordmarkRegion);
  assert.equal(gatewayAfter, gatewayBefore, `${card.name} Gateway G pixels changed`);
  assert.equal(wordmarkAfter, wordmarkBefore, `${card.name} wordmark pixels changed`);

  const publicBytes = await readFile(publicOutputPath);
  assert.equal(sha256(publicBytes), sha256(outputBytes), `${card.name} public copy must be byte-identical`);

  return {
    name: card.name,
    input: card.input,
    inputSha256: sha256(inputBytes),
    brandOutput: card.brandOutput,
    publicOutput: card.publicOutput,
    outputSha256: sha256(outputBytes),
    dimensions: { width: card.width, height: card.height },
    taglineRegion: card.taglineRegion,
    pixelDelta,
    gatewayG: { region: gatewayRegion, before: gatewayBefore, after: gatewayAfter, identical: true },
    wordmark: { region: wordmarkRegion, before: wordmarkBefore, after: wordmarkAfter, identical: true },
    publicCopyByteIdentical: true,
  };
}

async function main() {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const cards = [];
  for (const card of CARDS) cards.push(await reconcile(card));
  const report = {
    schemaVersion: 1,
    suite: "gcl-r4.4-social-card-reconciliation",
    approvedThesis: APPROVED_THESIS,
    renderedLines: THESIS_LINES,
    rendering: {
      format: "lossless PNG",
      fontFamily: "Helvetica Neue",
      fontWeight: 300,
      fontSizePx: 28,
      color: "#aeb0b4",
    },
    cards,
    status: "passed",
  };
  const reportPath = path.join(EVIDENCE_DIR, "social-card-reconciliation.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ status: report.status, report: reportPath }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
