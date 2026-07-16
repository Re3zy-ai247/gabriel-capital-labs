/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // `_next/app-build-manifest.json` is NOT served at runtime (404s in prod), so
  // workbox's precache of it fails → the service worker never installs/activates →
  // Web Push can't subscribe. Exclude it from the precache manifest.
  buildExcludes: [/app-build-manifest\.json$/],
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
