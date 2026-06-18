import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// Plus Jakarta Sans — a modern grotesk with more character than Inter, tuned for
// both display headlines (heavier weights) and dense data UI. Exposed as --font-sans.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CreditVector™ — AI-Powered Credit Intelligence Platform",
  description: "CreditVector™ by Gabriel Capital Labs — an AI-powered credit intelligence platform. Understand your report, dispute inaccuracies under the FCRA, and build toward your goals.",
  manifest: "/manifest.json",
  applicationName: "CreditVector",
  metadataBase: new URL("https://www.creditvector.app"),
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CreditVector" },
  openGraph: {
    title: "CreditVector™ — AI-Powered Credit Intelligence Platform",
    description: "Understand your credit reports, dispute inaccuracies under the FCRA, and track every dispute — all in one place.",
    url: "https://www.creditvector.app",
    siteName: "CreditVector",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "CreditVector" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CreditVector™ — AI-Powered Credit Intelligence Platform",
    description: "Understand your credit reports, dispute inaccuracies under the FCRA, and track every dispute — all in one place.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#060a14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Set the theme class before first paint to avoid a flash of the wrong theme.
const noFlashTheme = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className="font-sans antialiased">
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
