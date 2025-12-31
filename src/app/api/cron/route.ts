import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { fetchPageWithRetry } from "@/lib/crawler";
import { shouldCrawl, recordSuccess, recordFailure, isHashSeenRecently } from "@/lib/crawler/guardrails";
import { createNormalizedSnapshot } from "@/lib/diff/normalize";
import { computeDiff, summarizeDiff } from "@/lib/diff/diffEngine";
import { isMeaningful } from "@/lib/diff/isMeaningful";
import { generateInsight } from "@/lib/ai/generateInsight";
import { sendAlertEmail } from "@/lib/alerts/sendEmail";
import type { Competitor, Snapshot } from "@/lib/types";

/**
 * Daily Monitoring Cron Job
 *
 * Runs the full pipeline for all active competitors:
 * 1. Check eligibility (guardrails)
 * 2. Fetch page via crawler fallback cascade
 * 3. Normalize + hash
 * 4. Compare to last snapshot
 * 5. If meaningful diff → generate AI insight → send email
 * 6. Save new snapshot
 */

export async function GET(request: NextRequest) {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = createServerClient();

        // Get all competitors (not just active — guardrails will filter)
        const { data: competitors, error: fetchError } = await supabase
            .from("competitors")
            .select("*, users(email)") as {
                data: (Competitor & { users: { email: string } })[] | null;
                error: Error | null;
            };

        if (fetchError || !competitors) {
            console.error("Error fetching competitors:", fetchError);
            return NextResponse.json({ error: "Failed to fetch competitors" }, { status: 500 });
        }

        const results = {
            processed: 0,
            skipped: 0,
            meaningful: 0,
            errors: 0,
        };

        for (const competitor of competitors) {
            try {
                // 1. Check eligibility (guardrails)
                const eligibility = shouldCrawl(competitor);
                if (!eligibility.eligible) {
                    console.log(`Skipping ${competitor.name}: ${eligibility.reason}`);
                    results.skipped++;
                    continue;
                }

                console.log(`Processing: ${competitor.name} (${competitor.url})`);

                // 2. Fetch page
                const crawlResult = await fetchPageWithRetry(competitor.url);

                if (!crawlResult.success) {
                    console.error(`Crawl failed for ${competitor.name}:`, crawlResult.error);
                    const { paused } = await recordFailure(supabase, competitor.id, competitor.failure_count);
                    if (paused) {
                        console.log(`Paused ${competitor.name} after repeated failures`);
                    }
                    results.errors++;
                    continue;
                }

                // 3. Normalize + hash
                const { normalizedText, hash } = createNormalizedSnapshot(crawlResult.rawText);

                // 4. Get previous snapshot
                const { data: prevSnapshots } = await supabase
                    .from("snapshots")
                    .select("*")
                    .eq("competitor_id", competitor.id)
                    .order("created_at", { ascending: false })
                    .limit(1) as { data: Snapshot[] | null };

                const prevSnapshot = prevSnapshots?.[0];

                // 5. Early exit if hash unchanged
                if (prevSnapshot && prevSnapshot.hash === hash) {
                    console.log(`No change for ${competitor.name}`);
                    await recordSuccess(supabase, competitor.id);
                    results.processed++;
                    continue;
                }

                // 6. Check hash deduplication (page reverted)
                if (prevSnapshot && (await isHashSeenRecently(supabase, competitor.id, hash))) {
                    console.log(`Hash seen recently for ${competitor.name}, skipping alert`);
                    await recordSuccess(supabase, competitor.id);
                    results.processed++;
                    continue;
                }

                // 7. Compare if we have a previous snapshot
                if (prevSnapshot) {
                    const diff = computeDiff(
                        prevSnapshot.normalized_text,
                        normalizedText,
                        prevSnapshot.hash,
                        hash
                    );

                    if (diff.hasChanges) {
                        const meaningfulness = isMeaningful(diff);

                        if (meaningfulness.isMeaningful) {
                            results.meaningful++;

                            // 8. Generate AI insight
                            const insight = await generateInsight(diff, meaningfulness, competitor.name);

                            // 9. Save alert
                            await supabase.from("alerts").insert({
                                competitor_id: competitor.id,
                                diff_summary: summarizeDiff(diff),
                                ai_insight: JSON.stringify(insight),
                                is_meaningful: true,
                            });

                            // 10. Send email
                            const userEmail = competitor.users?.email;
                            if (userEmail) {
                                await sendAlertEmail({
                                    to: userEmail,
                                    competitorName: competitor.name,
                                    pageUrl: competitor.url,
                                    insight,
                                });
                            }
                        }
                    }
                }

                // 11. Save new snapshot
                await supabase.from("snapshots").insert({
                    competitor_id: competitor.id,
                    hash,
                    normalized_text: normalizedText,
                    markdown: crawlResult.markdown,
                });

                // 12. Record success
                await recordSuccess(supabase, competitor.id);
                results.processed++;
            } catch (error) {
                console.error(`Error processing ${competitor.name}:`, error);
                results.errors++;
            }
        }

        console.log("Cron job complete:", results);

        return NextResponse.json({
            success: true,
            ...results,
        });
    } catch (error) {
        console.error("Cron job failed:", error);
        return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
    }
}
