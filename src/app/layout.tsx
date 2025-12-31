import type { Metadata } from "next";
import { Instrument_Serif, Space_Mono, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
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
  return (
    <html
      lang="en"
      className={`dark ${instrumentSerif.variable} ${spaceMono.variable} ${inter.variable}`}
    >
      <body className="bg-background text-foreground antialiased min-h-screen flex flex-col noise-overlay">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
