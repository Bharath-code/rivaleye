import type { Metadata } from "next";
import { Outfit, Space_Mono, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsProvider } from "@/components/providers/AnalyticsProvider";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import Script from "next/script";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RivalEye — Competitive Intelligence That Thinks",
    template: "%s | RivalEye",
  },
  description:
    "Monitor competitor pricing pages. Get AI-powered insights when something changes. Know what matters before it's too late.",
  keywords: [
    "competitive intelligence",
    "competitor monitoring",
    "pricing alerts",
    "SaaS tools",
    "pricing tracking",
    "AI insights",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://rivaleye.app"
  ),
  openGraph: {
    title: "RivalEye — Competitive Intelligence That Thinks",
    description:
      "Monitor competitor pricing. Get AI insights. Act faster than your competition.",
    type: "website",
    siteName: "RivalEye",
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RivalEye — Competitive Intelligence That Thinks",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RivalEye — Competitive Intelligence That Thinks",
    description:
      "Monitor competitor pricing. Get AI insights. Act faster than your competition.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cfToken = process.env.NEXT_PUBLIC_CLOUDFLARE_BEACON_TOKEN;

  return (
    <html
      lang="en"
      className={`dark ${outfit.variable} ${spaceMono.variable} ${inter.variable}`}
    >
      <body className="bg-background text-foreground antialiased min-h-screen flex flex-col noise-overlay">
        {/* Skip to content — accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-emerald-500 focus:text-black focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <AnalyticsProvider>
          <SmoothScroll>
            <main id="main-content">
              {children}
            </main>
          </SmoothScroll>
        </AnalyticsProvider>
        <Toaster position="bottom-right" />
        {/* Aria live region for dynamic announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only" id="announcer" />

        {/* Cloudflare Web Analytics */}
        {cfToken && (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: cfToken })}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
