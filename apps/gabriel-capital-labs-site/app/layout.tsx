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
            Prologue's scroll lock. This script is the sole owner of the
            eligibility predicate (root path, min-width:1024px, no hash,
            session not yet marked seen); ArrivalScene later reads only the
            resulting class. try/catch because sessionStorage can throw
            (privacy modes): on throw, the class is never added, and the
            component therefore takes its composed static path — never a
            locked page with no prologue to unlock it.
            R4.1 — F15: gated on `location.pathname === '/'` too, so the
            lock only ever applies on the arrival route. Every other route
            (404 included) has no ArrivalScene to unlock it, so it must
            never lock in the first place.
            R4.2 — R-1/R-2: this script owns the one atomic prologue-lock
            lifecycle used by first load, Replay, natural completion,
            forced completion, and unmount. `__gclArmPrologueWatchdog()`
            gives each lock a new epoch and arms two independent 22s
            signals: a timer and the CSS `gcl-prologue-watchdog`
            `animationend`. Both signals call the SAME epoch-checked
            `__gclReleasePrologue()` primitive. That primitive clears the
            timer/listener, removes both root classes, and removes only
            `inert` attributes carrying this feature's ownership marker;
            unrelated pre-existing inert state is preserved. CSS never
            unlocks overflow by itself. A forced release dispatches a
            synchronous event so a hydrated ArrivalScene can finish its
            timeline through the ordinary awaken/markComplete path; before
            hydration, removing the class makes the later mount choose the
            composed static path. */}
        {/* eslint-disable-next-line react/no-danger */}
        <script
          id="gcl-js-class"
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('js');" +
              "window.__gclReleasePrologue=function(expectedEpoch,notify){" +
              "if(typeof expectedEpoch==='number'&&window.__gclLockEpoch!==expectedEpoch)return false;" +
              "if(window.__gclPrologueWatchdogTimer!==undefined){clearTimeout(window.__gclPrologueWatchdogTimer);window.__gclPrologueWatchdogTimer=undefined;}" +
              "if(window.__gclPrologueAnimationEnd){document.documentElement.removeEventListener('animationend',window.__gclPrologueAnimationEnd);window.__gclPrologueAnimationEnd=undefined;}" +
              "if(window.__gclPrologueWidthQuery&&window.__gclPrologueWidthChange){window.__gclPrologueWidthQuery.removeEventListener('change',window.__gclPrologueWidthChange);window.__gclPrologueWidthQuery=undefined;window.__gclPrologueWidthChange=undefined;}" +
              "document.documentElement.classList.remove('gcl-prologue','gcl-replaying');" +
              "var owned=document.querySelectorAll('[data-gcl-prologue-inert]');" +
              "for(var i=0;i<owned.length;i++){owned[i].removeAttribute('inert');owned[i].removeAttribute('data-gcl-prologue-inert');}" +
              "window.__gclLockEpoch=(window.__gclLockEpoch||0)+1;" +
              "if(notify)window.dispatchEvent(new Event('gcl:prologue-force-release'));" +
              "return true;" +
              "};" +
              "window.__gclArmPrologueWatchdog=function(){" +
              "if(window.__gclPrologueWatchdogTimer!==undefined)clearTimeout(window.__gclPrologueWatchdogTimer);" +
              "if(window.__gclPrologueAnimationEnd)document.documentElement.removeEventListener('animationend',window.__gclPrologueAnimationEnd);" +
              "if(window.__gclPrologueWidthQuery&&window.__gclPrologueWidthChange)window.__gclPrologueWidthQuery.removeEventListener('change',window.__gclPrologueWidthChange);" +
              "var widthQuery=matchMedia('(min-width:1024px)');" +
              "if(!widthQuery.matches){window.__gclReleasePrologue(undefined,false);return false;}" +
              "var epoch=(window.__gclLockEpoch||0)+1;window.__gclLockEpoch=epoch;" +
              "var onEnd=function(event){if(event.target===document.documentElement&&event.animationName==='gcl-prologue-watchdog')window.__gclReleasePrologue(epoch,true);};" +
              "window.__gclPrologueAnimationEnd=onEnd;document.documentElement.addEventListener('animationend',onEnd);" +
              "var onWidth=function(event){if(!event.matches)window.__gclReleasePrologue(epoch,true);};" +
              "window.__gclPrologueWidthQuery=widthQuery;window.__gclPrologueWidthChange=onWidth;widthQuery.addEventListener('change',onWidth);" +
              "window.__gclPrologueWatchdogTimer=setTimeout(function(){window.__gclReleasePrologue(epoch,true);},22000);" +
              "return epoch;" +
              "};" +
              "try{if(location.pathname==='/'&&matchMedia('(min-width:1024px)').matches&&!location.hash&&sessionStorage.getItem('gcl-arrival-seen')!=='1'){" +
              "document.documentElement.classList.add('gcl-prologue');" +
              "window.__gclArmPrologueWatchdog();" +
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
