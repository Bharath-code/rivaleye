import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
    title: "Privacy Policy — RivalEye",
    description: "How RivalEye collects, uses, and protects your data.",
};

const sections: { heading: string; body: string }[] = [
    {
        heading: "What we collect",
        body: "Your email address and account details when you sign up; the competitor URLs and brand name you configure; usage analytics (via PostHog) to improve the product; and billing details processed by our payment provider, Dodo Payments — we never see or store your card number.",
    },
    {
        heading: "How we use it",
        body: "To run your competitor scans, generate briefs and alerts, send the notification emails you opt into, and operate billing. We do not sell your data or share it with third parties beyond the service providers needed to run RivalEye (Supabase for data storage, Resend for email, Cloudflare for screenshots and bot protection, and the AI providers that power scans).",
    },
    {
        heading: "Public pages",
        body: "Competitor tracking pages you create are public by default and can be listed at /track. You can unlist a page at any time from your dashboard.",
    },
    {
        heading: "Retention & deletion",
        body: "Scan history is retained per your plan's data-retention window. You can delete your account and all associated data at any time by emailing us; we complete deletion within 30 days.",
    },
    {
        heading: "Contact",
        body: "Questions about this policy or your data: kumarbharath63@gmail.com.",
    },
];

export default function PrivacyPage() {
    return (
        <div className="flex-1 flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 pt-24 pb-12 px-6">
                <div className="container max-w-2xl mx-auto px-4 py-8">
                    <h1 className="font-display text-3xl text-foreground mb-2">Privacy Policy</h1>
                    <p className="text-sm text-muted-foreground mb-8">Last updated: July 18, 2026</p>
                    <div className="space-y-8">
                        {sections.map((s) => (
                            <section key={s.heading}>
                                <h2 className="text-lg font-semibold text-foreground mb-2">{s.heading}</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                            </section>
                        ))}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
