#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "../..");
const EVIDENCE_DIR = path.join(REPO_ROOT, "docs/reviews/assets/r4-4");
const DOMAIN = "https://www.gabrielcapitallabs.com";
const THESIS = "Building the Infrastructure for Intelligent Capital.";
const TITLE = `Gabriel Capital Labs — ${THESIS}`;
const DESCRIPTION =
  "Gabriel Capital Labs is the parent institution behind intelligent infrastructure. Building the Infrastructure for Intelligent Capital.";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([:\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]])
  );
}

function metaValue(html, key, value) {
  const tags = [...html.matchAll(/<meta\s+[^>]*>/g)].map((match) => attributes(match[0]));
  const tag = tags.find((candidate) => candidate[key] === value);
  assert.ok(tag, `missing meta ${key}=${value}`);
  return tag.content;
}

function linkValue(html, rel) {
  const tags = [...html.matchAll(/<link\s+[^>]*>/g)].map((match) => attributes(match[0]));
  const tag = tags.find((candidate) => candidate.rel === rel);
  assert.ok(tag, `missing link rel=${rel}`);
  return tag.href;
}

async function verifyCard({ brandPath, publicPath, width, height }) {
  const brandBytes = await readFile(path.join(SITE_ROOT, brandPath));
  const publicBytes = await readFile(path.join(SITE_ROOT, publicPath));
  const exportedBytes = await readFile(path.join(SITE_ROOT, "out", path.basename(publicPath)));
  const metadata = await sharp(publicBytes).metadata();
  assert.deepEqual(
    { format: metadata.format, width: metadata.width, height: metadata.height },
    { format: "png", width, height },
    `${publicPath} metadata differs from the social-card contract`
  );
  const digest = sha256(publicBytes);
  assert.equal(sha256(brandBytes), digest, `${brandPath} and ${publicPath} must be byte-identical`);
  assert.equal(sha256(exportedBytes), digest, `${publicPath} and exported card must be byte-identical`);
  return { brandPath, publicPath, format: "png", width, height, sha256: digest };
}

async function main() {
  const htmlBytes = await readFile(path.join(SITE_ROOT, "out/index.html"));
  const html = htmlBytes.toString("utf8");
  const head = html.split("</head>", 1)[0];
  const renderedTitle = head.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.equal(renderedTitle, TITLE);
  assert.equal(metaValue(head, "name", "description"), DESCRIPTION);
  assert.equal(metaValue(head, "name", "robots"), "index, follow");
  assert.equal(linkValue(head, "canonical"), DOMAIN);
  assert.equal(metaValue(head, "property", "og:title"), TITLE);
  assert.equal(metaValue(head, "property", "og:description"), DESCRIPTION);
  assert.equal(metaValue(head, "property", "og:url"), DOMAIN);
  assert.equal(metaValue(head, "property", "og:site_name"), "Gabriel Capital Labs");
  assert.equal(metaValue(head, "property", "og:image"), `${DOMAIN}/og.png`);
  assert.equal(metaValue(head, "property", "og:image:type"), "image/png");
  assert.equal(metaValue(head, "name", "twitter:card"), "summary_large_image");
  assert.equal(metaValue(head, "name", "twitter:title"), TITLE);
  assert.equal(metaValue(head, "name", "twitter:description"), DESCRIPTION);
  assert.equal(metaValue(head, "name", "twitter:image"), `${DOMAIN}/x-card.png`);
  assert.ok(!head.toLowerCase().includes("noindex"), "production export must not contain noindex");
  assert.ok(!head.includes("Engineering the Future of Intelligence."), "historical thesis leaked into metadata");

  const jsonLdText = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
  assert.ok(jsonLdText, "Organization JSON-LD must be rendered");
  const jsonLd = JSON.parse(jsonLdText);
  assert.deepEqual(jsonLd, {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Gabriel Capital Labs",
    legalName: "Gabriel Capital Labs, LLC",
    url: DOMAIN,
    logo: `${DOMAIN}/gateway-g-512.png`,
    slogan: THESIS,
  });

  const robots = await readFile(path.join(SITE_ROOT, "public/robots.txt"), "utf8");
  const sitemap = await readFile(path.join(SITE_ROOT, "public/sitemap.xml"), "utf8");
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${DOMAIN.replaceAll(".", "\\.")}\/sitemap\\.xml$`, "m"));
  assert.ok(!robots.toLowerCase().includes("noindex"));
  assert.ok(sitemap.includes(`<loc>${DOMAIN}/</loc>`));
  assert.ok(!sitemap.includes("gabrielcapitallabs.com") || sitemap.includes("www.gabrielcapitallabs.com"));

  const cards = [
    await verifyCard({
      brandPath: "brand/web/GCL_OpenGraph_1200x630.png",
      publicPath: "public/og.png",
      width: 1200,
      height: 630,
    }),
    await verifyCard({
      brandPath: "brand/web/GCL_X_Card_1200x600.png",
      publicPath: "public/x-card.png",
      width: 1200,
      height: 600,
    }),
  ];

  const sourceFiles = [
    "app/layout.tsx",
    "content/site.ts",
    "public/robots.txt",
    "public/sitemap.xml",
    "scripts/optimize-images.mjs",
    "scripts/reconcile-social-cards.mjs",
    "scripts/r4-4-seo-verification.mjs",
  ];
  const sourceHashes = {};
  for (const relativePath of sourceFiles) {
    sourceHashes[relativePath] = sha256(await readFile(path.join(SITE_ROOT, relativePath)));
  }

  const report = {
    schemaVersion: 1,
    suite: "gcl-r4.4-seo-metadata-reconciliation",
    approvedThesis: THESIS,
    title: TITLE,
    description: DESCRIPTION,
    canonicalDomain: DOMAIN,
    organizationJsonLd: jsonLd,
    productionIndexing: "index, follow",
    cards,
    exportIndexSha256: sha256(htmlBytes),
    sourceHashes,
    status: "passed",
  };
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const reportPath = path.join(EVIDENCE_DIR, "seo-metadata-verification.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ status: report.status, report: reportPath }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
