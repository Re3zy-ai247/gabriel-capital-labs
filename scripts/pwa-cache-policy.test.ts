// Run: npx tsx scripts/pwa-cache-policy.test.ts
//
// P1-32 (G-M1) — the service worker must not put a consumer's data in Cache
// Storage.
//
// THE DEFECT (next.config.js:2-11 on a72a47c): `next-pwa` was configured with no
// `runtimeCaching` key, so its bundled default list applied
// (node_modules/next-pwa/cache.js). Two of those defaults are disqualifying here:
//   · `cache.js:128-149` caches every same-origin `GET /api/*` (except
//     `/api/auth/`) NetworkFirst for 24 h under cacheName "apis". That includes
//     `/api/documents/[id]/raw`, which streams DECRYPTED government-ID bytes.
//   · `cache.js:151-167` caches every other same-origin request — every rendered
//     page and every RSC payload — for 24 h under "others".
// Cache Storage ignores HTTP cache directives, so `Cache-Control: no-store` on
// those routes did nothing. `public/manifest.json:6` also sets
// `"start_url": "/dashboard"`, an authenticated page, which next-pwa's
// `dynamicStartUrl` machinery fetches and caches client-side
// (next-pwa/register.js:16-25).
//
// THIS GUARD LOADS THE REAL next.config.js with `next-pwa` intercepted, captures
// the options the config actually passes, and RESOLVES representative URLs
// against the real `urlPattern` matchers in registration order — the same
// first-match-wins rule workbox-routing applies. It asserts on the resulting
// handler, not on the text of the file.
//
// Offline. No build, no network.
import { readFileSync } from "node:fs";
import Module from "node:module";
import { join } from "node:path";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}`);
  }
}

type Rule = {
  urlPattern: RegExp | ((ctx: { url: URL; request: { destination: string }; sameOrigin: boolean }) => boolean);
  handler: string;
  options?: { cacheName?: string };
};
type PwaOptions = {
  runtimeCaching?: Rule[];
  cacheStartUrl?: boolean;
  dynamicStartUrl?: boolean;
  disable?: boolean;
};

const ORIGIN = "https://www.creditvector.app";
// The service worker runs with a `self` global; the matchers use `self.origin`
// exactly as next-pwa's own defaults do. Provide it so they can be evaluated.
(globalThis as unknown as { self: { origin: string } }).self = { origin: ORIGIN };

// ── capture what next.config.js hands to next-pwa ────────────────────────────
const root = join(__dirname, "..");
// A holder object, not a bare `let`: TypeScript narrows a variable only
// assigned inside a callback to `null`, which then makes every later property
// read an error on `never`.
const capture: { options: PwaOptions | null } = { options: null };
const internals = Module as unknown as {
  _load(request: string, parent: unknown, isMain: boolean): unknown;
};
const originalLoad = internals._load;
internals._load = function patched(request: string, parent: unknown, isMain: boolean): unknown {
  if (request === "next-pwa") {
    return (opts: PwaOptions) => {
      capture.options = opts;
      return (cfg: unknown) => cfg;
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
require(join(root, "next.config.js"));
internals._load = originalLoad;

/** Resolve a URL the way workbox-routing does: first matching route wins. */
function handlerFor(href: string, destination = "empty"): string {
  const rules = capture.options?.runtimeCaching ?? [];
  const url = new URL(href);
  const ctx = { url, request: { destination }, sameOrigin: url.origin === ORIGIN };
  for (const rule of rules) {
    const matched =
      typeof rule.urlPattern === "function" ? rule.urlPattern(ctx) : rule.urlPattern.test(url.href);
    if (matched) return rule.handler;
  }
  return "<no rule — workbox falls through to the network but writes nothing>";
}

function cacheNameFor(href: string, destination = "empty"): string | undefined {
  const rules = capture.options?.runtimeCaching ?? [];
  const url = new URL(href);
  const ctx = { url, request: { destination }, sameOrigin: url.origin === ORIGIN };
  for (const rule of rules) {
    const matched =
      typeof rule.urlPattern === "function" ? rule.urlPattern(ctx) : rule.urlPattern.test(url.href);
    if (matched) return rule.options?.cacheName;
  }
  return undefined;
}

console.log("\nthe policy is explicit at all");
check("next.config.js really configures next-pwa", capture.options !== null);
check(
  "an explicit runtimeCaching list is supplied, so next-pwa's defaults do NOT apply",
  Array.isArray(capture.options?.runtimeCaching) && (capture.options?.runtimeCaching?.length ?? 0) > 0
);

console.log("\nconsumer data is never written to Cache Storage");
const NEVER_CACHED: Array<[string, string, string]> = [
  ["an API response", `${ORIGIN}/api/tradelines`, "empty"],
  ["a decrypted identity document", `${ORIGIN}/api/documents/doc_1/raw`, "empty"],
  ["a decrypted support attachment", `${ORIGIN}/api/attachments/att_1`, "empty"],
  ["the report upload stream", `${ORIGIN}/api/reports/upload`, "empty"],
  ["a Next data payload", `${ORIGIN}/_next/data/build/dashboard.json`, "empty"],
  ["the authenticated dashboard document", `${ORIGIN}/dashboard`, "document"],
  ["the letters page document", `${ORIGIN}/letters`, "document"],
  ["a printable letter", `${ORIGIN}/letters/print/letter_1`, "document"],
  ["an RSC payload for an authed page", `${ORIGIN}/tradelines?_rsc=abc12`, "empty"],
  ["the marketing landing page", `${ORIGIN}/`, "document"],
  ["a cross-origin request", "https://example.invalid/anything", "empty"],
];
for (const [label, href, destination] of NEVER_CACHED) {
  const handler = handlerFor(href, destination);
  check(`${label} is NetworkOnly (${handler})`, handler === "NetworkOnly");
  check(`${label} is bound to no cache`, cacheNameFor(href, destination) === undefined);
}

console.log("\nstatic build output is still cacheable, so the app shell survives");
const CACHEABLE: Array<[string, string]> = [
  ["a hashed JS chunk", `${ORIGIN}/_next/static/chunks/main-abc123.js`],
  ["a hashed stylesheet", `${ORIGIN}/_next/static/css/abc123.css`],
  ["a self-hosted font", `${ORIGIN}/_next/static/media/jakarta-abc.woff2`],
  ["an optimized image", `${ORIGIN}/_next/image?url=%2Ficons%2Ficon-192.png&w=256&q=75`],
  ["a PWA icon", `${ORIGIN}/icons/icon-192.png`],
  ["the web app manifest", `${ORIGIN}/manifest.json`],
  ["the brand mark", `${ORIGIN}/logo-mark.png`],
];
for (const [label, href] of CACHEABLE) {
  const handler = handlerFor(href);
  check(`${label} is cacheable (${handler})`, handler !== "NetworkOnly" && handler.startsWith("<") === false);
}

console.log("\nan /api/ path that merely looks like an asset is still not cached");
check(
  "/api/documents/doc_1/raw.png does not fall into the asset rule",
  handlerFor(`${ORIGIN}/api/documents/doc_1/raw.png`) === "NetworkOnly"
);

console.log("\nthe last rule is a default deny, so a NEW surface is uncacheable by default");
const rules = capture.options?.runtimeCaching ?? [];
const last = rules[rules.length - 1];
check("a catch-all rule exists", last !== undefined);
check("and it is NetworkOnly", last?.handler === "NetworkOnly");
check(
  "an invented future route is not cached",
  handlerFor(`${ORIGIN}/some/route/invented/later`) === "NetworkOnly"
);

console.log("\nthe authenticated start_url is not fetched into Cache Storage");
// public/manifest.json keeps "start_url": "/dashboard" — that decides where the
// installed app OPENS, a navigation the consumer's own session then authorizes.
// What must not happen is next-pwa fetching and STORING it.
check("dynamicStartUrl is off (no start-url route, no register.js re-fetch)", capture.options?.dynamicStartUrl === false);
check("cacheStartUrl is off (start_url is not added to the precache manifest)", capture.options?.cacheStartUrl === false);

async function main(): Promise<void> {
  console.log("\nM-3: the custom worker purges caches the OLD worker already wrote");
  // next.config.js stops the new worker writing consumer data to Cache Storage,
  // but entries the previous worker wrote survive on the device until the browser
  // evicts them — decrypted /api/documents/[id]/raw bytes and authenticated
  // /dashboard HTML on a possibly-resold phone. worker/index.js is compiled into
  // public/sw.js by next-pwa, so its activate handler runs once per SW activation.
  // Executed here in a fake service-worker global rather than pattern-matched.
  const workerSource = readFileSync(join(root, "worker", "index.js"), "utf8");
  const listeners = new Map<string, (event: { waitUntil(p: Promise<unknown>): void }) => void>();
  const cacheNames = [
    "apis",
    "others",
    "start-url",
    "next-data",
    "static-data-assets",
    "static-js-assets",
    "google-fonts-webfonts",
    // must SURVIVE:
    "workbox-precache-v2-https://www.creditvector.app/",
    "static-build-assets",
    "static-public-assets",
    "next-image",
  ];
  const deleted: string[] = [];
  const fakeSelf = {
    addEventListener: (type: string, fn: (event: { waitUntil(p: Promise<unknown>): void }) => void) => {
      listeners.set(type, fn);
    },
    registration: { showNotification: () => {} },
  };
  const fakeCaches = {
    keys: async () => cacheNames.slice(),
    delete: async (name: string) => {
      deleted.push(name);
      return true;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function("self", "caches", "clients", workerSource)(fakeSelf, fakeCaches, { matchAll: async () => [] });

  check("the worker registers an activate handler", listeners.has("activate"));
  check("the push handler is still registered (the purge did not displace it)", listeners.has("push"));
  const activate = listeners.get("activate");
  if (activate) {
    const pending: Promise<unknown>[] = [];
    activate({ waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
  }
  for (const name of ["apis", "others", "start-url", "next-data", "static-data-assets"]) {
    check(`the legacy "${name}" cache is deleted`, deleted.includes(name));
  }
  check(
    "workbox's own precache is NOT deleted",
    !deleted.some((n) => n.startsWith("workbox-precache"))
  );
  for (const name of ["static-build-assets", "static-public-assets", "next-image"]) {
    check(`the cache this build actually uses ("${name}") survives`, !deleted.includes(name));
  }
  check(
    "deleting a cache that never existed is harmless (only present names are touched)",
    deleted.every((n) => cacheNames.includes(n))
  );

  console.log("\nnon-vacuity: the same URLs against next-pwa's DEFAULT list");
  // If this guard passed on the pre-change config it would be worthless. Resolve
  // the same URLs against the INSTALLED default list — the exact rules that
  // applied on a72a47c — and show they are cached.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const defaultCache = require(join(root, "node_modules", "next-pwa", "cache.js")) as Rule[];
  function defaultHandlerFor(href: string, destination = "empty"): string {
    const url = new URL(href);
    const ctx = { url, request: { destination }, sameOrigin: url.origin === ORIGIN };
    for (const rule of defaultCache) {
      const matched =
        typeof rule.urlPattern === "function" ? rule.urlPattern(ctx) : rule.urlPattern.test(url.href);
      if (matched) return rule.handler;
    }
    return "<none>";
  }
  check(
    `the default list DOES cache /api/tradelines (${defaultHandlerFor(`${ORIGIN}/api/tradelines`)})`,
    defaultHandlerFor(`${ORIGIN}/api/tradelines`) === "NetworkFirst"
  );
  check(
    `the default list DOES cache the decrypted document route (${defaultHandlerFor(`${ORIGIN}/api/documents/doc_1/raw`)})`,
    defaultHandlerFor(`${ORIGIN}/api/documents/doc_1/raw`) === "NetworkFirst"
  );
  check(
    `the default list DOES cache /dashboard (${defaultHandlerFor(`${ORIGIN}/dashboard`, "document")})`,
    defaultHandlerFor(`${ORIGIN}/dashboard`, "document") === "NetworkFirst"
  );

  console.log(`\npwa-cache-policy.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
