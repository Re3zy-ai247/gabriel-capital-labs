import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { site } from "@/content/site";

const inter = Inter({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.domain),
  title: site.title,
  description: site.description,
  alternates: {
    canonical: site.domain,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: site.domain,
    title: site.title,
    description: site.description,
    siteName: site.name,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: site.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
    images: ["/x-card.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#060608",
  width: "device-width",
  initialScale: 1,
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  legalName: site.legalName,
  url: site.domain,
  logo: `${site.domain}/gateway-g-512.png`,
  slogan: site.tagline.join(" "),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* D19 — a single LCP preload lives here, in the real <head>, with
            responsive hints matching the arrival <picture> element exactly.
            Authoring it inside <body> (its previous location) caused
            Next.js to also hoist its own stripped-down copy to <head>,
            producing two preload tags for the same image. */}
        <link
          rel="preload"
          as="image"
          href="/img/gateway-g-480.webp"
          type="image/webp"
          imageSrcSet="/img/gateway-g-480.webp 480w, /img/gateway-g-768.webp 768w, /img/gateway-g-1080.webp 1036w"
          imageSizes="(max-width: 720px) 40vw, 220px"
        />
      </head>
      <body>
        {/* D9 / R2 1.1 — mark JS as available before hydration so CSS can
            gate every animation-initial (hidden) state behind `html.js`.
            This MUST be a real, executable <script> tag emitted as the
            first child of <body> — not next/script (even
            strategy="beforeInteractive"), which in an App Router static
            export rides Next's own `self.__next_s` loader array and only
            actually runs at hydration, well after first paint. A plain
            inline script here runs synchronously as the parser reaches it,
            before any content below it is parsed or painted, in every
            browser, with no framework loader in the path. Without it
            running, no-JS visitors get the fully visible, fully static
            composition — that fallback still holds, it just needs to
            reliably NOT be the JS path's own experience too. */}
        {/* eslint-disable-next-line react/no-danger */}
        <script
          id="gcl-js-class"
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js');",
          }}
        />
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        {children}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </body>
    </html>
  );
}
