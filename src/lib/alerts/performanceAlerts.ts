import { createServerClient } from "@/lib/supabase";
import type { PSIResult } from "@/lib/crawler/pageSpeedInsights";
import { getPerformanceGrade, getCoreWebVitalsStatus } from "@/lib/crawler/pageSpeedInsights";

/**
 * Performance Alerts Module
 *
 * Monitors competitor performance changes and creates alerts
 * when significant degradation or improvement is detected.
 */

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface UnifiedPerformanceData {
    source: string;
    score: number;
    grade: string;
    coreWebVitals: {
        lcp: { value: number | null; status: string };
        fid: { value: number | null; status: string };
        cls: { value: number | null; status: string };
    };
    fetchTime: string;
}

export interface PerformanceAlertData {
    type: "degradation" | "improvement" | "threshold";
    metric: string;
    oldValue: number | string;
    newValue: number | string;
    change: number;
    message: string;
    severity: "high" | "medium" | "low";
}

// ──────────────────────────────────────────────────────────────────────────────
// THRESHOLDS FOR ALERTS
// ──────────────────────────────────────────────────────────────────────────────

const ALERT_THRESHOLDS = {
    // Score changes
    scoreImprovement: 10,    // Alert if score improves by 10+ points
    scoreDegradation: -10,   // Alert if score degrades by 10+ points

    // LCP changes (ms)
    lcpImprovement: -1000,   // Alert if LCP improves by 1s+
    lcpDegradation: 1000,    // Alert if LCP degrades by 1s+

    // CLS changes
    clsImprovement: -0.1,    // Alert if CLS improves by 0.1+
    clsDegradation: 0.1,     // Alert if CLS degrades by 0.1+
};

// ──────────────────────────────────────────────────────────────────────────────
// MAPPERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Map raw PageSpeed Insights result to UnifiedPerformanceData.
 */
export function mapPSIToUnified(psi: PSIResult): UnifiedPerformanceData {
    const status = getCoreWebVitalsStatus(psi.coreWebVitals);

    return {
        source: "pagespeed_insights",
        score: psi.categories.performance,
        grade: getPerformanceGrade(psi.categories.performance),
        coreWebVitals: {
            lcp: { value: psi.coreWebVitals.lcp, status: status.lcp },
            fid: { value: psi.coreWebVitals.fid, status: status.fid },
            cls: { value: psi.coreWebVitals.cls, status: status.cls },
        },
        fetchTime: psi.fetchTime,
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check for performance changes and create alerts if thresholds are exceeded.
 */
export function checkPerformanceChanges(
    oldData: UnifiedPerformanceData,
    newData: UnifiedPerformanceData
): PerformanceAlertData[] {
    const alerts: PerformanceAlertData[] = [];

    // Check score change
    const scoreDiff = newData.score - oldData.score;
    if (scoreDiff >= ALERT_THRESHOLDS.scoreImprovement) {
        alerts.push({
            type: "improvement",
            metric: "Performance Score",
            oldValue: oldData.score,
            newValue: newData.score,
            change: scoreDiff,
            message: `Competitor performance improved by ${scoreDiff} points (${oldData.score} → ${newData.score})`,
            severity: "medium",
        });
    } else if (scoreDiff <= ALERT_THRESHOLDS.scoreDegradation) {
        alerts.push({
            type: "degradation",
            metric: "Performance Score",
            oldValue: oldData.score,
            newValue: newData.score,
            change: scoreDiff,
            message: `Competitor performance degraded by ${Math.abs(scoreDiff)} points — opportunity to outperform!`,
            severity: "high",
        });
    }

    // Check LCP change
    const oldLCP = oldData.coreWebVitals.lcp.value;
    const newLCP = newData.coreWebVitals.lcp.value;
    if (oldLCP !== null && newLCP !== null) {
        const lcpDiff = newLCP - oldLCP;
        if (lcpDiff >= ALERT_THRESHOLDS.lcpDegradation) {
            alerts.push({
                type: "degradation",
                metric: "LCP",
                oldValue: `${Math.round(oldLCP)}ms`,
                newValue: `${Math.round(newLCP)}ms`,
                change: lcpDiff,
                message: `LCP slowed by ${Math.round(lcpDiff)}ms — their loading is getting worse`,
                severity: "high",
            });
        } else if (lcpDiff <= ALERT_THRESHOLDS.lcpImprovement) {
            alerts.push({
                type: "improvement",
                metric: "LCP",
                oldValue: `${Math.round(oldLCP)}ms`,
                newValue: `${Math.round(newLCP)}ms`,
                change: lcpDiff,
                message: `Competitor improved LCP by ${Math.abs(Math.round(lcpDiff))}ms`,
                severity: "medium",
            });
        }
    }

    // Check CLS change
    const oldCLS = oldData.coreWebVitals.cls.value;
    const newCLS = newData.coreWebVitals.cls.value;
    if (oldCLS !== null && newCLS !== null) {
        const clsDiff = newCLS - oldCLS;
        if (clsDiff >= ALERT_THRESHOLDS.clsDegradation) {
            alerts.push({
                type: "degradation",
                metric: "CLS",
                oldValue: oldCLS.toFixed(3),
                newValue: newCLS.toFixed(3),
                change: clsDiff,
                message: `Layout shift increased — their UX is getting worse`,
                severity: "medium",
            });
        } else if (clsDiff <= ALERT_THRESHOLDS.clsImprovement) {
            alerts.push({
                type: "improvement",
                metric: "CLS",
                oldValue: oldCLS.toFixed(3),
                newValue: newCLS.toFixed(3),
                change: clsDiff,
                message: `Competitor improved their layout stability`,
                severity: "low",
            });
        }
    }

    return alerts;
}

/**
 * Create performance alerts in the database.
 */
export async function createPerformanceAlerts(
    userId: string,
    competitorId: string,
    competitorName: string,
    alerts: PerformanceAlertData[]
): Promise<void> {
    if (alerts.length === 0) return;

    const supabase = createServerClient();

    for (const alert of alerts) {
        // Create alert record
        await supabase.from("alerts").insert({
            user_id: userId,
            competitor_id: competitorId,
            title: `${competitorName}: ${alert.metric} ${alert.type}`,
            message: alert.message,
            severity: alert.severity,
            type: "PERFORMANCE_CHANGE",
            metadata: {
                metric: alert.metric,
                oldValue: alert.oldValue,
                newValue: alert.newValue,
                change: alert.change,
                alertType: alert.type,
            },
            read: false,
            created_at: new Date().toISOString(),
        });
    }
}

/**
 * Format alerts for email/Slack notification.
 */
export function formatPerformanceAlertsForNotification(
    competitorName: string,
    alerts: PerformanceAlertData[]
): string {
    if (alerts.length === 0) return "";

    const lines = [`🔔 Performance changes detected for ${competitorName}:`, ""];

    for (const alert of alerts) {
        const icon = alert.type === "degradation" ? "📉" : "📈";
        lines.push(`${icon} ${alert.message}`);
    }

    const degradations = alerts.filter((a) => a.type === "degradation");
    if (degradations.length > 0) {
        lines.push("");
        lines.push("💡 Tip: Degraded competitor performance is an opportunity to gain users with better experience!");
    }

    return lines.join("\n");
}
