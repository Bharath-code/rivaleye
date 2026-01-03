import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 Screenshot Storage Utility
 *
 * Replaces Supabase Storage to achieve zero-egress costs and better performace.
 * Uses the S3-compatible R2 API.
 */

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "rivaleye-screenshots";

// Configure S3 client for Cloudflare R2
const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

/**
 * Upload a screenshot to Cloudflare R2.
 */
export async function uploadScreenshot(
    competitorId: string,
    contextKey: string,
    screenshot: Buffer
): Promise<{ success: true; path: string } | { success: false; error: string }> {
    const timestamp = Date.now();
    const path = `${competitorId}/${contextKey}/${timestamp}.webp`;

    try {
        await s3.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: path,
                Body: screenshot,
                ContentType: "image/webp",
                CacheControl: "max-age=31536000", // 1 year cache
            })
        );
        return { success: true, path };
    } catch (error: any) {
        console.error("[Screenshot] R2 Upload failed:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get public URL for a screenshot.
 * Incorporates Cloudflare Image Resizing if a custom domain or proxy is set up.
 */
export function getScreenshotUrl(path: string, options?: { width?: number; quality?: number }): string {
    const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

    // If no base URL is defined, we might need a presigned URL or public bucket access
    if (!baseUrl) {
        console.warn("[Screenshot] NEXT_PUBLIC_R2_PUBLIC_URL is not defined.");
        return path; // Fallback to path
    }

    const url = new URL(`${baseUrl}/${path}`);

    // Optional: Add Cloudflare Image Resizing parameters
    // Note: This requires Cloudflare Images/Resizing to be enabled on the zone
    if (options?.width) {
        url.searchParams.set("width", options.width.toString());
    }
    if (options?.quality) {
        url.searchParams.set("quality", options.quality.toString());
    }
    url.searchParams.set("format", "webp");

    return url.toString();
}

/**
 * Delete old screenshots for a competitor/context.
 */
export async function cleanupOldScreenshots(
    competitorId: string,
    contextKey: string,
    keepLast: number = 5
): Promise<void> {
    const prefix = `${competitorId}/${contextKey}/`;

    try {
        // List objects in the "folder"
        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
        });

        const response = await s3.send(listCommand);

        if (!response.Contents || response.Contents.length <= keepLast) {
            return;
        }

        // Sort by LastModified (newest first)
        const sorted = response.Contents.sort((a, b) =>
            (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)
        );

        // Files to delete (beyond the limit)
        const toDelete = sorted.slice(keepLast).map(obj => ({ Key: obj.Key }));

        if (toDelete.length > 0) {
            await s3.send(
                new DeleteObjectsCommand({
                    Bucket: BUCKET_NAME,
                    Delete: { Objects: toDelete as any },
                })
            );
            console.log(`[Screenshot] Cleaned up ${toDelete.length} old screenshots from R2`);
        }
    } catch (error: any) {
        console.error("[Screenshot] R2 Cleanup failed:", error.message);
    }
}
