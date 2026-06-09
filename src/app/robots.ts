import type { MetadataRoute } from "next";

/**
 * robots.txt
 *
 * Allow all crawlers, point them at the sitemap, and explicitly
 * disallow the dashboard (private area).
 */

const SITE_URL =
    process.env.NEXT_PUBLIC_APP_URL || "https://rivaleye.com";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: ["/", "/vs/", "/for/", "/track/"],
                disallow: ["/api/", "/dashboard/", "/login", "/signup", "/settings", "/auth/"],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
