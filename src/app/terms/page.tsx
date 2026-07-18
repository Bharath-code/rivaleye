import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
    title: "Terms of Service — RivalEye",
    description: "The terms that govern your use of RivalEye.",
};

const sections: { heading: string; body: string }[] = [
    {
        heading: "The service",
        body: "RivalEye monitors publicly available competitor information — pricing pages, tech stack, branding, performance, and AI-answer visibility — and turns changes into briefs and alerts. We only crawl publicly accessible pages.",
    },
    {
        heading: "Your account",
        body: "You're responsible for your account and for the URLs you ask us to monitor. Don't use RivalEye to monitor sites you're prohibited from accessing, to overwhelm third-party sites, or for anything unlawful.",
    },
    {
        heading: "Billing",
        body: "Paid plans are billed monthly via Dodo Payments and renew automatically until cancelled. You can cancel any time from Settings → Manage Billing; access continues until the end of the paid period. Plan limits (competitors, scans, regions) are described on the pricing page.",
    },
    {
        heading: "No warranty",
        body: "Competitor data and AI-generated briefs are provided as-is. Scans depend on third-party sites and AI models, so results may be incomplete or delayed. Verify important findings before acting on them.",
    },
    {
        heading: "Liability",
        body: "To the maximum extent permitted by law, our total liability for any claim is limited to the amount you paid us in the 3 months before the claim arose.",
    },
    {
        heading: "Changes & contact",
        body: "We may update these terms; material changes will be announced by email. Questions: kumarbharath63@gmail.com.",
    },
];

export default function TermsPage() {
    return (
        <div className="flex-1 flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 pt-24 pb-12 px-6">
                <div className="container max-w-2xl mx-auto px-4 py-8">
                    <h1 className="font-display text-3xl text-foreground mb-2">Terms of Service</h1>
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
