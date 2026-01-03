import { task, logger, metadata } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import { detectTechStack } from "@/lib/crawler/techStackDetector";
import { extractBranding } from "@/lib/crawler/brandingExtractor";
import { getPageSpeedInsights } from "@/lib/crawler/pageSpeedInsights";
import { analyzeTechStackChanges, createTechStackAlerts } from "@/lib/alerts/techStackAlerts";
import { analyzeBrandingChanges, createBrandingAlerts } from "@/lib/alerts/brandingAlerts";
import { checkPerformanceChanges, createPerformanceAlerts, mapPSIToUnified } from "@/lib/alerts/performanceAlerts";
import { getFeatureFlags } from "@/lib/billing/featureFlags";

/**
 * Deep Competitor Audit Task
 * 
 * Performs technical analysis (tech stack, branding, performance)
 * and creates semantic alerts for Pro users.
 */

interface DeepAuditPayload {
    competitorId: string;
    competitorUrl: string;
    competitorName: string;
    userId: string;
    userPlan: "free" | "pro" | "enterprise";
}

export const deepAuditTask = task({
    id: "deep-competitor-audit",
    maxDuration: 300, // 5 minutes (PSI can be slow)
    run: async (payload: DeepAuditPayload) => {
        const { competitorId, competitorUrl, competitorName, userId, userPlan } = payload;
        const flags = getFeatureFlags(userPlan);

        if (!flags.canUseGeoAware) { // Usually Pro check
            logger.info("Skipping deep audit for non-pro user", { userId, userPlan });
            return { skipped: true, reason: "insufficient_plan" };
        }

        logger.info("Starting deep audit", { competitorName, competitorUrl });
        metadata.set("status", "Starting technical audit");

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const results = {
            techStack: { detected: 0, alerts: 0 },
            branding: { changed: false, alerts: 0 },
            performance: { score: 0, alerts: 0 },
        };

        // 1. Tech Stack Audit
        try {
            metadata.set("status", "Analyzing tech stack");
            const { data: prevTech } = await supabase
                .from("competitor_techstack")
                .select("*")
                .eq("competitor_id", competitorId)
                .order("extracted_at", { ascending: false })
                .limit(1);

            const result = await detectTechStack(competitorUrl);
            if (result.success) {
                results.techStack.detected = result.technologies.length;

                if (prevTech?.[0]?.technologies) {
                    const alerts = await analyzeTechStackChanges(
                        prevTech[0].technologies,
                        result.technologies
                    );
                    if (alerts.length > 0) {
                        await createTechStackAlerts(userId, competitorId, competitorName, alerts);
                        results.techStack.alerts = alerts.length;
                    }
                }

                // Store new tech stack
                await supabase.from("competitor_techstack").insert({
                    competitor_id: competitorId,
                    technologies: result.technologies,
                    summary: result.summary,
                    extracted_at: new Date().toISOString(),
                });
            }
        } catch (error) {
            logger.error("Tech stack audit failed", { error });
        }

        // 2. Branding Audit
        try {
            metadata.set("status", "Extracting branding");
            const { data: prevBranding } = await supabase
                .from("competitor_branding")
                .select("*")
                .eq("competitor_id", competitorId)
                .order("extracted_at", { ascending: false })
                .limit(1);

            const brandingResult = await extractBranding(competitorUrl);
            if (brandingResult.success) {
                if (prevBranding?.[0]?.branding_data) {
                    const alerts = analyzeBrandingChanges(
                        prevBranding[0].branding_data,
                        brandingResult.branding
                    );
                    if (alerts.length > 0) {
                        await createBrandingAlerts(userId, competitorId, competitorName, alerts);
                        results.branding.alerts = alerts.length;
                        results.branding.changed = true;
                    }
                }

                // Store new branding
                await supabase.from("competitor_branding").insert({
                    competitor_id: competitorId,
                    branding_data: brandingResult.branding,
                    extracted_at: new Date().toISOString(),
                });
            }
        } catch (error) {
            logger.error("Branding audit failed", { error });
        }

        // 3. Performance Audit
        try {
            metadata.set("status", "Measuring performance (PSI)");
            const { data: prevPerf } = await supabase
                .from("competitor_performance")
                .select("*")
                .eq("competitor_id", competitorId)
                .order("extracted_at", { ascending: false })
                .limit(1);

            const perfData = await getPageSpeedInsights(competitorUrl);
            if (perfData.success) {
                const unifiedPerf = mapPSIToUnified(perfData);
                results.performance.score = unifiedPerf.score;

                if (prevPerf?.[0]?.insights) {
                    const alerts = checkPerformanceChanges(
                        prevPerf[0].insights,
                        unifiedPerf
                    );
                    if (alerts.length > 0) {
                        await createPerformanceAlerts(userId, competitorId, competitorName, alerts);
                        results.performance.alerts = alerts.length;
                    }
                }

                // Store new performance
                await supabase.from("competitor_performance").insert({
                    competitor_id: competitorId,
                    insights: unifiedPerf,
                    extracted_at: new Date().toISOString(),
                });
            }
        } catch (error) {
            logger.error("Performance audit failed", { error });
        }

        metadata.set("status", "Audit Complete");
        logger.info("Deep audit complete", results);
        return { success: true, results };
    },
});
