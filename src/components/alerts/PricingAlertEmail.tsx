import * as React from "react";
import type { PricingDiffType, AlertSeverity } from "@/lib/types";

/**
 * Pricing Alert Email Template (React Email compatible)
 *
 * Trust-first design: evidence-backed, clear, with explicit confidence levels.
 * Uses inline styles for email compatibility.
 */

interface PricingAlertEmailProps {
    competitorName: string;
    alertType: PricingDiffType;
    severity: AlertSeverity;
    headline: string;
    beforeValue: string | null;
    afterValue: string | null;
    aiExplanation: string;
    confidence: "high" | "medium" | "low";
    region: string;
    screenshotBeforeUrl?: string;
    screenshotAfterUrl?: string;
    detailsUrl: string;
    unsubscribeUrl: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES (inline for email compatibility) - RivalEye Dark Navy Design System
// ══════════════════════════════════════════════════════════════════════════════

const styles = {
    container: {
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "32px 24px",
        backgroundColor: "#0A0E1A", // Dark navy background
        color: "#F0F4F8",
    },
    header: {
        textAlign: "center" as const,
        marginBottom: "32px",
    },
    logo: {
        fontSize: "24px",
        fontWeight: "700",
        color: "#10B981", // Emerald accent
        letterSpacing: "-0.02em",
    },
    severityBadge: {
        high: {
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: "100px",
            fontSize: "12px",
            fontWeight: "600",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            color: "#EF4444",
        },
        medium: {
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: "100px",
            fontSize: "12px",
            fontWeight: "600",
            backgroundColor: "rgba(245, 158, 11, 0.15)",
            color: "#F59E0B",
        },
        low: {
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: "100px",
            fontSize: "12px",
            fontWeight: "600",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            color: "#10B981",
        },
    },
    headline: {
        fontSize: "20px",
        fontWeight: "600",
        color: "#F0F4F8",
        marginTop: "16px",
        marginBottom: "8px",
    },
    region: {
        fontSize: "14px",
        color: "#94A3B8",
        marginBottom: "24px",
    },
    changeBox: {
        backgroundColor: "#111827", // Card background
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "24px",
        border: "1px solid rgba(148, 163, 184, 0.1)",
    },
    changeLabel: {
        fontSize: "11px",
        fontWeight: "600",
        color: "#94A3B8",
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
        marginBottom: "4px",
    },
    changeValue: {
        fontSize: "16px",
        fontWeight: "500",
        color: "#F0F4F8",
    },
    arrow: {
        textAlign: "center" as const,
        fontSize: "20px",
        color: "#10B981", // Emerald
        margin: "12px 0",
    },
    screenshotGrid: {
        display: "grid" as const,
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
        marginBottom: "24px",
    },
    screenshotBox: {
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid rgba(148, 163, 184, 0.1)",
    },
    screenshotLabel: {
        backgroundColor: "#1E293B",
        padding: "8px 12px",
        fontSize: "12px",
        fontWeight: "600",
        color: "#94A3B8",
    },
    screenshotImg: {
        width: "100%",
        height: "auto",
    },
    insightBox: {
        backgroundColor: "rgba(16, 185, 129, 0.1)", // Emerald tint
        border: "1px solid rgba(16, 185, 129, 0.3)",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "24px",
    },
    insightLabel: {
        fontSize: "12px",
        fontWeight: "600",
        color: "#10B981",
        marginBottom: "8px",
    },
    insightText: {
        fontSize: "14px",
        lineHeight: "1.6",
        color: "#F0F4F8",
    },
    confidenceBadge: {
        high: { color: "#10B981" },
        medium: { color: "#F59E0B" },
        low: { color: "#EF4444" },
    },
    ctaButton: {
        display: "inline-block",
        backgroundColor: "#10B981", // Emerald
        color: "#0A0E1A",
        padding: "14px 28px",
        borderRadius: "8px",
        textDecoration: "none",
        fontWeight: "600",
        fontSize: "14px",
    },
    disclaimer: {
        marginTop: "32px",
        padding: "16px",
        backgroundColor: "rgba(245, 158, 11, 0.1)", // Amber tint
        border: "1px solid rgba(245, 158, 11, 0.3)",
        borderRadius: "8px",
        fontSize: "12px",
        color: "#F59E0B",
        lineHeight: "1.5",
    },
    footer: {
        marginTop: "32px",
        paddingTop: "24px",
        borderTop: "1px solid rgba(148, 163, 184, 0.1)",
        fontSize: "12px",
        color: "#94A3B8",
        textAlign: "center" as const,
    },
    footerLink: {
        color: "#10B981",
        textDecoration: "underline",
    },
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function PricingAlertEmail({
    competitorName,
    alertType,
    severity,
    headline,
    beforeValue,
    afterValue,
    aiExplanation,
    confidence,
    region,
    screenshotBeforeUrl,
    screenshotAfterUrl,
    detailsUrl,
    unsubscribeUrl,
}: PricingAlertEmailProps) {
    const emoji = getAlertEmoji(alertType);

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.logo}>👁️ RivalEye</div>
            </div>

            {/* Severity Badge */}
            <div style={{ textAlign: "center" }}>
                <span style={styles.severityBadge[severity]}>
                    {severity.toUpperCase()} PRIORITY
                </span>
            </div>

            {/* Headline */}
            <h1 style={styles.headline}>
                {emoji} {headline}
            </h1>
            <p style={styles.region}>📍 Region: {region}</p>

            {/* Before/After Change Box */}
            <div style={styles.changeBox}>
                <div>
                    <div style={styles.changeLabel}>Before</div>
                    <div style={styles.changeValue}>{beforeValue || "—"}</div>
                </div>
                <div style={styles.arrow}>↓</div>
                <div>
                    <div style={styles.changeLabel}>After</div>
                    <div style={styles.changeValue}>{afterValue || "—"}</div>
                </div>
            </div>

            {/* Side-by-side Screenshots */}
            {(screenshotBeforeUrl || screenshotAfterUrl) && (
                <table width="100%" cellPadding="0" cellSpacing="0" style={{ marginBottom: "24px" }}>
                    <tbody>
                        <tr>
                            {screenshotBeforeUrl && (
                                <td style={{ width: "48%", verticalAlign: "top" }}>
                                    <div style={styles.screenshotBox}>
                                        <div style={styles.screenshotLabel}>Before</div>
                                        <img
                                            src={screenshotBeforeUrl}
                                            alt="Before screenshot"
                                            style={styles.screenshotImg}
                                        />
                                    </div>
                                </td>
                            )}
                            {screenshotBeforeUrl && screenshotAfterUrl && (
                                <td style={{ width: "4%" }}></td>
                            )}
                            {screenshotAfterUrl && (
                                <td style={{ width: "48%", verticalAlign: "top" }}>
                                    <div style={styles.screenshotBox}>
                                        <div style={styles.screenshotLabel}>After</div>
                                        <img
                                            src={screenshotAfterUrl}
                                            alt="After screenshot"
                                            style={styles.screenshotImg}
                                        />
                                    </div>
                                </td>
                            )}
                        </tr>
                    </tbody>
                </table>
            )}

            {/* AI Insight Box */}
            <div style={styles.insightBox}>
                <div style={styles.insightLabel}>
                    💡 Why It Matters{" "}
                    <span style={styles.confidenceBadge[confidence]}>
                        ({confidence} confidence)
                    </span>
                </div>
                <p style={styles.insightText}>{aiExplanation}</p>
            </div>

            {/* CTA */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <a href={detailsUrl} style={styles.ctaButton}>
                    View Full Details →
                </a>
            </div>

            {/* Disclaimer */}
            <div style={styles.disclaimer}>
                <strong>⚠️ Disclaimer:</strong> This alert was generated through automated
                analysis. While we strive for accuracy, pricing information may change
                rapidly and we recommend verifying directly on the competitor's website
                before making business decisions. AI explanations are suggestions, not
                definitive analysis.
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <p>
                    You're receiving this because you're monitoring {competitorName} on RivalEye.
                </p>
                <p>
                    <a href={unsubscribeUrl} style={styles.footerLink}>
                        Manage alert preferences
                    </a>
                    {" · "}
                    <a href={unsubscribeUrl} style={styles.footerLink}>
                        Unsubscribe
                    </a>
                </p>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function getAlertEmoji(type: PricingDiffType): string {
    const emojis: Record<PricingDiffType, string> = {
        price_increase: "📈",
        price_decrease: "📉",
        plan_added: "➕",
        plan_removed: "➖",
        free_tier_removed: "🚨",
        free_tier_added: "🎁",
        plan_promoted: "⭐",
        cta_changed: "🔄",
        regional_difference: "🌍",
    };
    return emojis[type] || "📊";
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER TO HTML (for email sending)
// ══════════════════════════════════════════════════════════════════════════════

export function renderAlertEmailToHtml(props: PricingAlertEmailProps): string {
    // In production, use react-email or similar
    // For now, return a basic version
    const { competitorName, headline, beforeValue, afterValue, aiExplanation, detailsUrl } = props;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>RivalEye Alert: ${competitorName}</title>
</head>
<body style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0A0E1A; color: #F0F4F8;">
    <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 24px; color: #10B981; margin: 0;">👁️ RivalEye</h1>
    </div>
    <h2 style="font-size: 20px; margin-bottom: 16px; color: #F0F4F8;">${headline}</h2>
    <div style="background: #111827; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(148, 163, 184, 0.1);">
        <p style="margin: 0 0 8px 0;"><strong style="color: #94A3B8;">Before:</strong> <span style="color: #F0F4F8;">${beforeValue || "—"}</span></p>
        <p style="margin: 0;"><strong style="color: #94A3B8;">After:</strong> <span style="color: #10B981;">${afterValue || "—"}</span></p>
    </div>
    <div style="background: rgba(16, 185, 129, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(16, 185, 129, 0.3);">
        <p style="margin: 0 0 8px 0;"><strong style="color: #10B981;">💡 Why It Matters:</strong></p>
        <p style="margin: 0; color: #F0F4F8;">${aiExplanation}</p>
    </div>
    <div style="text-align: center;">
        <a href="${detailsUrl}" style="display: inline-block; background: #10B981; color: #0A0E1A; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Details</a>
    </div>
    <div style="margin-top: 24px; padding: 16px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; font-size: 12px; color: #F59E0B;">
        <strong>⚠️ Disclaimer:</strong> This alert was generated through automated analysis. Verify directly on the competitor's website before making business decisions.
    </div>
</body>
</html>
    `.trim();
}

export default PricingAlertEmail;
