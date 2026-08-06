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
        {/* R4 — extends the existing pre-paint script (still the first body
            child, still one script) with the Gateway G Institutional
            Prologue's scroll lock. This predicate MUST stay a literal twin
            of ArrivalScene's own `willRunPrologue` check (min-width:1024px,
            no hash, session not yet marked seen) — one source of intent,
            duplicated because this runs before hydration and has no
            import path to the component. try/catch because sessionStorage
            can throw (privacy modes): on throw, the class is simply never
            added, so the worst case is a first frame without the
            pre-paint lock (ArrivalScene's own predicate, also
            try/catch-safe via its existing sessionStorage usage, still
            governs actual playback) — never a locked page with no
            prologue to unlock it.
            R4.1 — F15: gated on `location.pathname === '/'` too, so the
            lock only ever applies on the arrival route. Every other route
            (404 included) has no ArrivalScene to unlock it, so it must
            never lock in the first place.
            R4.1 — F0 (BLOCKER, hydration dead-man): a bare `setTimeout`
            watchdog that removes the class ~22s after it was added, with
            no dependency on React ever mounting. This is deliberately
            independent of the pure-CSS watchdog in globals.css
            (`gcl-prologue-watchdog`) — two unlock mechanisms that don't
            share a failure mode, so a visitor is never trapped on a black,
            unscrollable page if the JS bundle fails to hydrate.
            R4.2 — R-2 (margin + atomicity): 18s -> 22s — the beat table's
            own P4 hold extension (R4.1 finding 13) left as little as
            ~2.1s of margin between the prologue's real completion
            (measured ~15.1s wall) and the old 18s dead-man under load;
            22s restores real headroom. The callback also strips any
            `[inert]` left on the page — the watchdog previously only
            unlocked scroll (`gcl-prologue`, which drives `overflow` via
            CSS) while leaving the JS-applied `inert` containment
            (ArrivalScene's `setChromeInert`) in place, so a slow-hydration
            visitor could land on a page that scrolls but still hit-tests
            as empty everywhere outside Arrival. Both releases now happen
            in the same tick.
            R4.2 — R-1/epoch guard: `window.__gclLockEpoch` lets a LATER
            lock holder (a desktop Replay re-arming `gcl-prologue` — see
            ArrivalScene.tsx handleReplay) invalidate this specific timer
            without needing a reference to it: bumping the epoch makes
            this callback's own stale `0` check fail, so it becomes a
            harmless no-op instead of releasing a lock it didn't arm. */}
        {/* eslint-disable-next-line react/no-danger */}
        <script
          id="gcl-js-class"
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('js');" +
              "try{if(location.pathname==='/'&&matchMedia('(min-width:1024px)').matches&&!location.hash&&sessionStorage.getItem('gcl-arrival-seen')!=='1'){" +
              "document.documentElement.classList.add('gcl-prologue');" +
              "window.__gclLockEpoch=0;" +
              "setTimeout(function(){" +
              "if(window.__gclLockEpoch!==0)return;" +
              "document.documentElement.classList.remove('gcl-prologue');" +
              "var els=document.querySelectorAll('[inert]');" +
              "for(var i=0;i<els.length;i++){els[i].removeAttribute('inert');}" +
              "},22000);" +
              "}}catch(e){}",
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
