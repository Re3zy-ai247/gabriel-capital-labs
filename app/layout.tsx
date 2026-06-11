import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Gabriel Capital Labs — Engineering Financial Freedom",
  description: "AI-powered credit dispute education platform. Understand your report, dispute inaccuracies under the FCRA.",
  manifest: "/manifest.json",
  applicationName: "Gabriel Capital Labs",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "GCL" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0c10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
