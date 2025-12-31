import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { getUserWithQuota, canManualCheck, incrementManualCheckCount } from "@/lib/quotas";
import { fetchPageWithRetry } from "@/lib/crawler";
import { recordSuccess, recordFailure } from "@/lib/crawler/guardrails";
import { createNormalizedSnapshot } from "@/lib/diff/normalize";
import { detectManualSpam } from "@/lib/abuseDetection";

/**
 * Manual Check API
 *
 * POST /api/check-now
 * Triggers an immediate crawl for a competitor (subject to quotas)
 */

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { competitorId } = body;

        if (!competitorId) {
            return NextResponse.json({ error: "competitorId required" }, { status: 400 });
        }

        const supabase = createServerClient();

        // Get user with quota state
        const user = await getUserWithQuota(supabase, userId);

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Check abuse patterns
        const abuseCheck = await detectManualSpam(supabase, userId);
        if (abuseCheck.flagged) {
            return NextResponse.json(
                { error: abuseCheck.message },
                { status: 429 }
            );
        }

        // Check quota
        const quotaCheck = canManualCheck(user);
        if (!quotaCheck.allowed) {
            return NextResponse.json(
                {
                    error: quotaCheck.reason,
                    upgradePrompt: quotaCheck.upgradePrompt,
                },
                { status: 429 }
            );
        }

        // Verify user owns this competitor
        const { data: competitor } = await supabase
            .from("competitors")
            .select("*")
            .eq("id", competitorId)
            .eq("user_id", userId)
            .single();

        if (!competitor) {
            return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
        }

        // Increment quota before crawling
        await incrementManualCheckCount(supabase, userId);

        // Perform crawl
        const crawlResult = await fetchPageWithRetry(competitor.url);

        if (!crawlResult.success) {
            await recordFailure(supabase, competitorId, competitor.failure_count);
            return NextResponse.json(
                { error: `Crawl failed: ${crawlResult.error}` },
                { status: 502 }
            );
        }

        // Normalize and save snapshot
        const { normalizedText, hash } = createNormalizedSnapshot(crawlResult.rawText);

        await supabase.from("snapshots").insert({
            competitor_id: competitorId,
            hash,
            normalized_text: normalizedText,
            markdown: crawlResult.markdown,
        });

        await recordSuccess(supabase, competitorId);

        return NextResponse.json({
            success: true,
            message: "Page checked successfully",
            hash,
        });
    } catch (error) {
        console.error("Manual check error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
