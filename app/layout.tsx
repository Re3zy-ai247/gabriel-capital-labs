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
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CreditVector" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
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
