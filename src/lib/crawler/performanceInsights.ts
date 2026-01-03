import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

/**
 * Performance Insights Module
 *
 * Captures Core Web Vitals and performance metrics for competitors:
 * - LCP (Largest Contentful Paint)
 * - FID/INP (First Input Delay / Interaction to Next Paint)
 * - CLS (Cumulative Layout Shift)
 * - TTFB (Time to First Byte)
 * - FCP (First Contentful Paint)
 * - Speed Index
 * - Total load time
 * - Resource metrics
 *
 * This is a PRO-ONLY feature.
 */

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface CoreWebVitals {
    lcp: number | null;    // Largest Contentful Paint (ms)
    fid: number | null;    // First Input Delay (ms) - simulated
    cls: number | null;    // Cumulative Layout Shift (score)
    inp: number | null;    // Interaction to Next Paint (ms) - simulated
}

export interface PerformanceMetrics {
    ttfb: number | null;           // Time to First Byte (ms)
    fcp: number | null;            // First Contentful Paint (ms)
    domContentLoaded: number | null;
    loadComplete: number | null;
    speedIndex: number | null;     // Calculated
}

export interface ResourceMetrics {
    totalRequests: number;
    totalSize: number;             // bytes
    jsSize: number;
    cssSize: number;
    imageSize: number;
    fontCount: number;
    thirdPartyRequests: number;
}

export interface PerformanceScore {
    overall: number;               // 0-100
    grade: "A" | "B" | "C" | "D" | "F";
    issues: PerformanceIssue[];
}

export interface PerformanceIssue {
    type: "critical" | "warning" | "info";
    metric: string;
    message: string;
    value: number | string;
    recommendation: string;
}

export interface PerformanceInsights {
    url: string;
    coreWebVitals: CoreWebVitals;
    metrics: PerformanceMetrics;
    resources: ResourceMetrics;
    score: PerformanceScore;
    extractedAt: string;
}

export interface PerformanceResult {
    success: true;
    insights: PerformanceInsights;
}

export interface PerformanceError {
    success: false;
    error: string;
    code: "TIMEOUT" | "BLOCKED" | "UNKNOWN";
}

export type PerformanceResponse = PerformanceResult | PerformanceError;

// ──────────────────────────────────────────────────────────────────────────────
// THRESHOLDS (Based on Google's Core Web Vitals guidelines)
// ──────────────────────────────────────────────────────────────────────────────

const THRESHOLDS = {
    lcp: { good: 2500, needsImprovement: 4000 },      // ms
    fid: { good: 100, needsImprovement: 300 },        // ms
    cls: { good: 0.1, needsImprovement: 0.25 },       // score
    fcp: { good: 1800, needsImprovement: 3000 },      // ms
    ttfb: { good: 800, needsImprovement: 1800 },      // ms
};

// ──────────────────────────────────────────────────────────────────────────────
// BROWSER MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────────

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (!browserInstance || !browserInstance.isConnected()) {
        browserInstance = await chromium.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
            ],
        });
    }
    return browserInstance;
}

export async function closePerformanceBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PERFORMANCE ANALYSIS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Analyze performance metrics for a competitor URL.
 */
export async function analyzePerformance(url: string): Promise<PerformanceResponse> {
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    // Track resources
    const resources: { type: string; size: number; url: string }[] = [];

    try {
        const browser = await getBrowser();

        // Create context with performance timeline enabled
        context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            deviceScaleFactor: 1,
        });

        page = await context.newPage();

        // Track network requests
        page.on("response", async (response) => {
            try {
                const headers = response.headers();
                const contentLength = parseInt(headers["content-length"] || "0", 10);
                const contentType = headers["content-type"] || "";
                const resourceUrl = response.url();

                let type = "other";
                if (contentType.includes("javascript")) type = "js";
                else if (contentType.includes("css")) type = "css";
                else if (contentType.includes("image")) type = "image";
                else if (contentType.includes("font")) type = "font";
                else if (contentType.includes("html")) type = "html";

                resources.push({
                    type,
                    size: contentLength,
                    url: resourceUrl,
                });
            } catch {
                // Ignore errors
            }
        });

        // Enable CDP for precise timing
        const cdpSession = await context.newCDPSession(page);
        await cdpSession.send("Performance.enable");

        // Start timing
        const startTime = Date.now();

        // Navigate
        const response = await page.goto(url, {
            timeout: 60000,
            waitUntil: "networkidle",
        });

        // TTFB will be calculated from navigation timing in page.evaluate
        let ttfb: number | null = null;

        const performanceTiming = await page.evaluate(() => {
            const timing = performance.timing;
            const entries = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

            // Get paint timings
            const paintEntries = performance.getEntriesByType("paint");
            const fcp = paintEntries.find((e) => e.name === "first-contentful-paint")?.startTime;

            // TTFB from navigation timing
            const ttfbValue = entries?.responseStart || (timing.responseStart - timing.navigationStart);

            // Get LCP
            let lcp = 0;
            const lcpObserver = new PerformanceObserver((list) => {
                const lcpEntries = list.getEntries();
                lcp = lcpEntries[lcpEntries.length - 1]?.startTime || 0;
            });
            try {
                lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
            } catch {
                // LCP not supported
            }

            // Wait a bit for LCP to settle
            return new Promise<{
                fcp: number | null;
                lcp: number | null;
                ttfb: number;
                domContentLoaded: number;
                loadComplete: number;
            }>((resolve) => {
                setTimeout(() => {
                    resolve({
                        fcp: fcp || null,
                        lcp: lcp || null,
                        ttfb: ttfbValue,
                        domContentLoaded: entries?.domContentLoadedEventEnd || timing.domContentLoadedEventEnd - timing.navigationStart,
                        loadComplete: entries?.loadEventEnd || timing.loadEventEnd - timing.navigationStart,
                    });
                }, 2000);
            });
        });

        // Get CLS by observing layout shifts
        const cls = await page.evaluate(() => {
            return new Promise<number>((resolve) => {
                let clsValue = 0;
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        const layoutEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
                        if (!layoutEntry.hadRecentInput) {
                            clsValue += layoutEntry.value || 0;
                        }
                    }
                });
                try {
                    observer.observe({ type: "layout-shift", buffered: true });
                } catch {
                    // CLS not supported
                }
                setTimeout(() => resolve(clsValue), 1000);
            });
        });

        const loadTime = Date.now() - startTime;

        // Calculate resource metrics
        const resourceMetrics = calculateResourceMetrics(resources, url);

        // Calculate speed index (simplified)
        const speedIndex = calculateSpeedIndex(performanceTiming.fcp, performanceTiming.lcp, loadTime);

        // Build core web vitals
        const coreWebVitals: CoreWebVitals = {
            lcp: performanceTiming.lcp,
            fid: null, // Requires user interaction, null for automated tests
            cls: Math.round(cls * 1000) / 1000,
            inp: null, // Requires user interaction
        };

        // Set TTFB from page timing
        ttfb = performanceTiming.ttfb;

        // Build metrics
        const metrics: PerformanceMetrics = {
            ttfb,
            fcp: performanceTiming.fcp,
            domContentLoaded: performanceTiming.domContentLoaded,
            loadComplete: performanceTiming.loadComplete,
            speedIndex,
        };

        // Calculate score
        const score = calculatePerformanceScore(coreWebVitals, metrics, resourceMetrics);

        // Cleanup
        await page.close();
        await context.close();

        return {
            success: true,
            insights: {
                url,
                coreWebVitals,
                metrics,
                resources: resourceMetrics,
                score,
                extractedAt: new Date().toISOString(),
            },
        };
    } catch (error) {
        if (page) await page.close().catch(() => { });
        if (context) await context.close().catch(() => { });

        const message = error instanceof Error ? error.message : "Unknown error";

        if (message.includes("Timeout")) {
            return { success: false, error: "Page load timed out", code: "TIMEOUT" };
        }
        if (message.includes("403") || message.includes("blocked")) {
            return { success: false, error: "Page blocked request", code: "BLOCKED" };
        }

        return { success: false, error: message, code: "UNKNOWN" };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

function calculateResourceMetrics(
    resources: { type: string; size: number; url: string }[],
    pageUrl: string
): ResourceMetrics {
    const pageHost = new URL(pageUrl).host;

    return {
        totalRequests: resources.length,
        totalSize: resources.reduce((sum, r) => sum + r.size, 0),
        jsSize: resources.filter((r) => r.type === "js").reduce((sum, r) => sum + r.size, 0),
        cssSize: resources.filter((r) => r.type === "css").reduce((sum, r) => sum + r.size, 0),
        imageSize: resources.filter((r) => r.type === "image").reduce((sum, r) => sum + r.size, 0),
        fontCount: resources.filter((r) => r.type === "font").length,
        thirdPartyRequests: resources.filter((r) => {
            try {
                return new URL(r.url).host !== pageHost;
            } catch {
                return false;
            }
        }).length,
    };
}

function calculateSpeedIndex(
    fcp: number | null,
    lcp: number | null,
    loadTime: number
): number | null {
    if (!fcp) return null;
    // Simplified speed index calculation
    const lcpValue = lcp || loadTime;
    return Math.round((fcp + lcpValue) / 2);
}

function calculatePerformanceScore(
    cwv: CoreWebVitals,
    metrics: PerformanceMetrics,
    resources: ResourceMetrics
): PerformanceScore {
    const issues: PerformanceIssue[] = [];
    let totalScore = 100;

    // Check LCP
    if (cwv.lcp !== null) {
        if (cwv.lcp > THRESHOLDS.lcp.needsImprovement) {
            totalScore -= 25;
            issues.push({
                type: "critical",
                metric: "LCP",
                message: "Largest Contentful Paint is too slow",
                value: `${Math.round(cwv.lcp)}ms`,
                recommendation: "Optimize images, reduce server response time, remove render-blocking resources",
            });
        } else if (cwv.lcp > THRESHOLDS.lcp.good) {
            totalScore -= 10;
            issues.push({
                type: "warning",
                metric: "LCP",
                message: "Largest Contentful Paint needs improvement",
                value: `${Math.round(cwv.lcp)}ms`,
                recommendation: "Consider lazy loading below-fold images and preloading critical resources",
            });
        }
    }

    // Check CLS
    if (cwv.cls !== null) {
        if (cwv.cls > THRESHOLDS.cls.needsImprovement) {
            totalScore -= 25;
            issues.push({
                type: "critical",
                metric: "CLS",
                message: "Too much layout shift",
                value: cwv.cls.toFixed(3),
                recommendation: "Add size attributes to images/videos, avoid inserting content above existing content",
            });
        } else if (cwv.cls > THRESHOLDS.cls.good) {
            totalScore -= 10;
            issues.push({
                type: "warning",
                metric: "CLS",
                message: "Layout shift needs improvement",
                value: cwv.cls.toFixed(3),
                recommendation: "Reserve space for dynamic content and ads",
            });
        }
    }

    // Check TTFB
    if (metrics.ttfb !== null) {
        if (metrics.ttfb > THRESHOLDS.ttfb.needsImprovement) {
            totalScore -= 15;
            issues.push({
                type: "critical",
                metric: "TTFB",
                message: "Server response time is too slow",
                value: `${Math.round(metrics.ttfb)}ms`,
                recommendation: "Optimize server, use CDN, enable caching",
            });
        } else if (metrics.ttfb > THRESHOLDS.ttfb.good) {
            totalScore -= 5;
            issues.push({
                type: "warning",
                metric: "TTFB",
                message: "Server could respond faster",
                value: `${Math.round(metrics.ttfb)}ms`,
                recommendation: "Consider edge caching or server-side optimizations",
            });
        }
    }

    // Check bundle sizes
    const jsSizeMB = resources.jsSize / (1024 * 1024);
    if (jsSizeMB > 1) {
        totalScore -= 10;
        issues.push({
            type: "warning",
            metric: "JS Size",
            message: "JavaScript bundle is large",
            value: `${jsSizeMB.toFixed(2)}MB`,
            recommendation: "Code split, tree shake, and lazy load JavaScript",
        });
    }

    // Check third-party requests
    if (resources.thirdPartyRequests > 20) {
        totalScore -= 5;
        issues.push({
            type: "info",
            metric: "Third-party",
            message: "Many third-party requests",
            value: resources.thirdPartyRequests,
            recommendation: "Audit third-party scripts and defer non-critical ones",
        });
    }

    // Calculate grade
    let grade: "A" | "B" | "C" | "D" | "F";
    if (totalScore >= 90) grade = "A";
    else if (totalScore >= 75) grade = "B";
    else if (totalScore >= 60) grade = "C";
    else if (totalScore >= 40) grade = "D";
    else grade = "F";

    return {
        overall: Math.max(0, totalScore),
        grade,
        issues,
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// PERFORMANCE COMPARISON
// ──────────────────────────────────────────────────────────────────────────────

export interface PerformanceDiff {
    improved: string[];
    degraded: string[];
    summary: string;
}

export function comparePerformance(
    oldInsights: PerformanceInsights,
    newInsights: PerformanceInsights
): PerformanceDiff {
    const improved: string[] = [];
    const degraded: string[] = [];

    // Compare LCP
    if (oldInsights.coreWebVitals.lcp && newInsights.coreWebVitals.lcp) {
        const diff = newInsights.coreWebVitals.lcp - oldInsights.coreWebVitals.lcp;
        if (diff < -500) improved.push(`LCP improved by ${Math.abs(Math.round(diff))}ms`);
        else if (diff > 500) degraded.push(`LCP degraded by ${Math.round(diff)}ms`);
    }

    // Compare CLS
    if (oldInsights.coreWebVitals.cls !== null && newInsights.coreWebVitals.cls !== null) {
        const diff = newInsights.coreWebVitals.cls - oldInsights.coreWebVitals.cls;
        if (diff < -0.05) improved.push("CLS improved significantly");
        else if (diff > 0.05) degraded.push("CLS degraded (more layout shift)");
    }

    // Compare overall score
    const scoreDiff = newInsights.score.overall - oldInsights.score.overall;
    if (scoreDiff >= 10) improved.push(`Overall score +${scoreDiff} points`);
    else if (scoreDiff <= -10) degraded.push(`Overall score ${scoreDiff} points`);

    let summary = "Performance metrics stable";
    if (improved.length > 0 && degraded.length === 0) {
        summary = "Performance improved";
    } else if (degraded.length > 0 && improved.length === 0) {
        summary = "Performance degraded - potential opportunity";
    } else if (improved.length > 0 && degraded.length > 0) {
        summary = "Mixed performance changes";
    }

    return { improved, degraded, summary };
}
