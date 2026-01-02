import { createClient } from "@supabase/supabase-js";

/**
 * Screenshot Storage Utility
 *
 * Uploads screenshots to Supabase Storage and returns public URLs.
 * Uses the 'screenshots' bucket configured in migration.
 */

const BUCKET_NAME = "screenshots";

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

/**
 * Upload a screenshot to Supabase Storage.
 * Returns the storage path (not the public URL).
 *
 * Path format: screenshots/{competitor_id}/{context_key}/{timestamp}.webp
 */
export async function uploadScreenshot(
    competitorId: string,
    contextKey: string,
    screenshot: Buffer
): Promise<{ success: true; path: string } | { success: false; error: string }> {
    const supabase = getSupabaseClient();

    const timestamp = Date.now();
    const path = `${competitorId}/${contextKey}/${timestamp}.webp`;

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, screenshot, {
            contentType: "image/webp",
            cacheControl: "31536000", // 1 year cache
            upsert: false,
        });

    if (error) {
        console.error("[Screenshot] Upload failed:", error.message);
        return { success: false, error: error.message };
    }

    return { success: true, path };
}

/**
 * Get public URL for a screenshot.
 */
export function getScreenshotUrl(path: string): string {
    const supabase = getSupabaseClient();
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Delete old screenshots for a competitor/context.
 * Call periodically to manage storage costs.
 */
export async function cleanupOldScreenshots(
    competitorId: string,
    contextKey: string,
    keepLast: number = 5
): Promise<void> {
    const supabase = getSupabaseClient();
    const prefix = `${competitorId}/${contextKey}/`;

    const { data: files, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(prefix, {
            sortBy: { column: "created_at", order: "desc" },
        });

    if (error || !files) {
        console.error("[Screenshot] Cleanup failed:", error?.message);
        return;
    }

    // Delete all files beyond the keepLast limit
    const filesToDelete = files.slice(keepLast).map((f) => `${prefix}${f.name}`);

    if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(filesToDelete);

        if (deleteError) {
            console.error("[Screenshot] Delete failed:", deleteError.message);
        } else {
            console.log(`[Screenshot] Cleaned up ${filesToDelete.length} old screenshots`);
        }
    }
}
