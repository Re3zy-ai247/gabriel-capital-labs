// D19 — Next.js's App Router "float" resource-hint mechanism auto-hoists
// its own stripped-down copy of any <link rel="preload" as="image"> it
// finds in the tree (dropping type/imagesrcset/imagesizes), in ADDITION
// to the fully-specified one we author in app/layout.tsx <head>. This is
// internal Next.js behaviour (not something reachable through public
// App Router API in 14.2.18) and reproduces on every build regardless of
// where the <link> is placed in the tree.
//
// Since this is a static export (a single out/index.html), the reliable
// fix is a tiny post-build pass: delete the bare auto-generated duplicate,
// keeping only the fully-specified preload with imagesrcset/imagesizes
// that matches the arrival <picture> element. Guarded so it's a no-op
// (not a silent failure) if a future Next version stops emitting the
// duplicate, or emits it differently.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, "..", "out", "index.html");

const BARE_DUPLICATE =
  '<link rel="preload" as="image" href="/img/gateway-g-480.webp"/>';
const FULL_PRELOAD_MARKER = 'imageSrcSet="/img/gateway-g-480.webp';

async function main() {
  const html = await readFile(indexPath, "utf8");

  const hasFull = html.includes(FULL_PRELOAD_MARKER);
  const hasBare = html.includes(BARE_DUPLICATE);

  if (!hasFull) {
    console.warn(
      "dedupe-preload: expected fully-specified preload not found — leaving out/index.html untouched."
    );
    return;
  }

  if (!hasBare) {
    console.log(
      "dedupe-preload: no bare duplicate preload found (Next.js behaviour may have changed) — nothing to do."
    );
    return;
  }

  const deduped = html.replace(BARE_DUPLICATE, "");
  await writeFile(indexPath, deduped, "utf8");
  console.log("dedupe-preload: removed the auto-hoisted duplicate LCP preload tag.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
