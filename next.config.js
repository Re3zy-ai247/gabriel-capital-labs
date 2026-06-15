/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
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
