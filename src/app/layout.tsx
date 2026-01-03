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
  title: "RivalEye — Competitive Intelligence That Thinks",
  description:
    "Monitor competitor pricing pages. Get AI-powered insights when something changes. Know what matters before it's too late.",
  keywords: ["competitive intelligence", "competitor monitoring", "pricing alerts", "SaaS tools"],
  openGraph: {
    title: "RivalEye — Competitive Intelligence That Thinks",
    description: "Monitor competitor pricing. Get AI insights. Act faster.",
    type: "website",
  },
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
        <AnalyticsProvider>
          <SmoothScroll>
            {children}
          </SmoothScroll>
        </AnalyticsProvider>
        <Toaster position="bottom-right" />

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
