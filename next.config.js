/** @type {import('next').NextConfig} */

// P1-32 (G-M1) — SERVICE-WORKER CACHE POLICY.
//
// This config used to pass `next-pwa` no `runtimeCaching` key at all, which means
// the package's bundled default list applied (`node_modules/next-pwa/cache.js`).
// Two of those defaults are disqualifying for a product that holds credit files
// and government-ID images:
//   • `cache.js:128-149` — every same-origin `GET /api/*` (except `/api/auth/`)
//     is cached NetworkFirst for 24 hours under cacheName `apis`. That includes
//     `/api/documents/[id]/raw`, which streams DECRYPTED identity-document bytes.
//   • `cache.js:151-167` — every other same-origin request, i.e. every rendered
//     page and every React-Server-Component payload, cached for 24 hours under
//     `others`.
// Cache Storage ignores HTTP cache directives, so `Cache-Control: no-store` on
// those routes did nothing about it. On a shared or resold phone the previous
// signed-in consumer's file stayed on the device.
//
// The policy below is DEFAULT-DENY: only build output and public, non-personal
// assets are cacheable; `/api/*`, `/_next/data/*`, HTML documents, RSC payloads
// and everything cross-origin are NetworkOnly, so the service worker never
// writes them to Cache Storage at all. Offline still works for the app shell's
// static assets (they are precached by workbox), but an authenticated screen
// requires the network — which is the honest behaviour: a stale credit file is
// worse than no credit file.
//
// The `urlPattern` functions are STRINGIFIED into the generated service worker
// by workbox-build, so they must not close over anything in this file. They use
// `self.origin`, the same technique next-pwa's own defaults use.
const runtimeCaching = [
  {
    // Explicit denylist, evaluated first: consumer data and server-rendered
    // payloads. Named separately from the catch-all below so the intent survives
    // any later reordering.
    urlPattern: ({ url }) =>
      self.origin === url.origin &&
      (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")),
    handler: "NetworkOnly",
    options: {},
  },
  {
    // Immutable, content-hashed build output. No consumer data by construction.
    urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith("/_next/static/"),
    handler: "CacheFirst",
    options: {
      cacheName: "static-build-assets",
      expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 },
    },
  },
  {
    // next/image output. The query names a source path in public/, never a user file.
    urlPattern: ({ url }) => self.origin === url.origin && url.pathname === "/_next/image",
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "next-image",
      expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
    },
  },
  {
    // Files shipped in public/: icons, the manifest, the brand mark, fonts.
    // Everything under /api/ is excluded regardless of how the path ends.
    urlPattern: ({ url }) =>
      self.origin === url.origin &&
      !url.pathname.startsWith("/api/") &&
      /^\/(?:icons\/|favicon\.ico$|manifest\.json$|.*\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf)$)/.test(
        url.pathname
      ),
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "static-public-assets",
      expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
    },
  },
  {
    // DEFAULT DENY. HTML documents, RSC payloads, anything cross-origin, and
    // anything a future route invents. A new surface is uncacheable until
    // somebody adds it above deliberately.
    urlPattern: () => true,
    handler: "NetworkOnly",
    options: {},
  },
];

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // `_next/app-build-manifest.json` is NOT served at runtime (404s in prod), so
  // workbox's precache of it fails → the service worker never installs/activates →
  // Web Push can't subscribe. Exclude it from the precache manifest.
  buildExcludes: [/app-build-manifest\.json$/],
  runtimeCaching,
  // public/manifest.json sets "start_url": "/dashboard" — the page a consumer
  // lands on when they open the installed app from their home screen. It is an
  // AUTHENTICATED page, and next-pwa's start-url machinery would cache whatever
  // that URL returns: `cacheStartUrl` adds it to the precache manifest, and
  // `dynamicStartUrl` (default true) both prepends a NetworkFirst `start-url`
  // route and makes next-pwa/register.js re-fetch and re-cache it on the client
  // (register.js:16-25, :50-56) — following the middleware redirect, so a
  // signed-in visitor's dashboard HTML lands in Cache Storage. Both are off. The
  // manifest keeps its start_url: it decides where the installed app OPENS,
  // which is a navigation the consumer's own session then authorizes, and that
  // is unaffected by not caching it.
  cacheStartUrl: false,
  dynamicStartUrl: false,
});

// Release identifier baked into every response at build time. Incident triage:
// compare x-cv-release on a failing response against the deployed commit — a
// stale value means deployment skew (old tab/SW cache), a current value means a
// real application failure. Vercel injects VERCEL_GIT_COMMIT_SHA at build.
const RELEASE = (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 12);

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    // Global security headers (RC1 P0-4). Conservative, non-breaking set — NO strict CSP (would
    // need per-surface browser verification; tracked as a follow-on) and HSTS WITHOUT `preload`
    // (reversible; owner submits to the preload list separately if desired).
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      {
        source: "/:path*",
        headers: [{ key: "x-cv-release", value: RELEASE }, ...security],
      },
    ];
  },
  // Canonical host is www.creditvector.app — redirect the bare apex to it.
  // (Only fires when the request Host is exactly creditvector.app, so the
  // vercel.app and www hosts are unaffected.)
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "creditvector.app" }],
        destination: "https://www.creditvector.app/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
