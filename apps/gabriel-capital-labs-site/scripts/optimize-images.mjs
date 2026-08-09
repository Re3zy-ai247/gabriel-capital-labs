// Asset pipeline for Gabriel Capital Labs cinematic site.
// Generates responsive WebP (+ PNG fallback for transparent mark) variants
// into public/img/, and copies favicon/OG/X-card/footer-lockup assets as-is
// into public/. Run with: npm run optimize-images
import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const brand = path.join(root, "brand");
const publicDir = path.join(root, "public");
const imgDir = path.join(publicDir, "img");

const QUALITY = 72;

async function ensureDir(dir) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

async function makeVariants({ src, destBase, widths, formats = ["webp"], quality = QUALITY }) {
  const results = [];
  for (const width of widths) {
    for (const format of formats) {
      const outPath = path.join(imgDir, `${destBase}-${width}.${format}`);
      const pipeline = sharp(src).resize({ width, withoutEnlargement: true });
      if (format === "webp") {
        await pipeline.webp({ quality }).toFile(outPath);
      } else if (format === "png") {
        await pipeline.png({ quality, compressionLevel: 9 }).toFile(outPath);
      }
      const meta = await sharp(outPath).metadata();
      results.push({ path: outPath, width: meta.width, height: meta.height });
    }
  }
  return results;
}

async function main() {
  await ensureDir(imgDir);

  const report = [];

  // 1. The Gateway G — transparent material, THE hero object. Keep alpha channel.
  const markSrc = path.join(brand, "canonical", "GatewayG_Canonical_Material_Transparent.png");
  report.push(
    ...(await makeVariants({
      src: markSrc,
      destBase: "gateway-g",
      widths: [480, 768, 1080],
      formats: ["webp", "png"],
    }))
  );

  // 2. Footer lockup — the site never shows a full hero photograph (the
  // arrival scene is built from CSS gradient + radial glow, not a hero
  // still), so we do not generate unused hero variants. The footer lockup
  // IS used, but only ever at ~36-48px — generate small WebP variants
  // instead of shipping the 1000x1000 master into the page.
  const footerLockupSrc = path.join(brand, "web", "GCL_Footer_Lockup_Dark_1000x1000.png");
  report.push(
    ...(await makeVariants({
      src: footerLockupSrc,
      destBase: "footer-lockup",
      widths: [96, 192],
      formats: ["webp", "png"],
    }))
  );

  // 3. Copy favicons / OG / X-card as-is into public/
  const copies = [
    ["web/favicon.ico", "favicon.ico"],
    ["web/apple-touch-icon.png", "apple-touch-icon.png"],
    ["web/android-chrome-192x192.png", "android-chrome-192x192.png"],
    ["web/android-chrome-512x512.png", "android-chrome-512x512.png"],
    ["web/GCL_OpenGraph_1200x630.png", "og.png"],
    ["web/GCL_X_Card_1200x600.png", "x-card.png"],
    ["web/GatewayG_Material_Transparent_512x512.png", "gateway-g-512.png"],
  ];
  for (const [from, to] of copies) {
    const src = path.join(brand, from);
    const dest = path.join(publicDir, to);
    await copyFile(src, dest);
    report.push({ path: dest, copied: true });
  }

  console.log("Image pipeline complete:");
  for (const r of report) {
    console.log(
      ` - ${path.relative(root, r.path)}${r.width ? ` (${r.width}x${r.height})` : " (copied as-is)"}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
