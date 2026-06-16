import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
  themeColor: "#0a0c10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Set the theme class before first paint to avoid a flash of the wrong theme.
const noFlashTheme = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
