import type { MetadataRoute } from "next";
import competitorsData from "@/data/competitors.json";
import industriesData from "@/data/industries.json";

/**
 * Dynamic sitemap.xml
 *
 * Emits all programmatic SEO URLs:
 *  - 10 /vs/[competitor]
 *  - 5 /for/[industry]
 *  - 15 /track/[competitor]-pricing/[region]
 *  - 1 /track index
 *  - core marketing pages (/, /signup, /login, /#pricing)
 *
 * Submit to Google Search Console: rivaleye.com/sitemap.xml
 */

const SITE_URL =
    process.env.NEXT_PUBLIC_APP_URL || "https://rivaleye.com";

const TARGET_COMPETITORS = [
    "stripe",
    "notion",
    "figma",
    "linear",
    "vercel",
];

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    // Core marketing pages — changeFrequency: weekly
    const core: MetadataRoute.Sitemap = [
        {
            url: `${SITE_URL}/`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 1.0,
        },
        {
            url: `${SITE_URL}/#pricing`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${SITE_URL}/track`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${SITE_URL}/login`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${SITE_URL}/signup`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.8,
        },
    ];

    // /vs/[competitor] — 10 pages, priority 0.85 (high purchase intent)
    const vsPages: MetadataRoute.Sitemap = competitorsData.competitors.map(
        (c) => ({
            url: `${SITE_URL}/vs/${c.slug}`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.85,
        })
    );

    // /for/[industry] — 5 pages, priority 0.75 (top of funnel)
    const forPages: MetadataRoute.Sitemap = industriesData.industries.map(
        (i) => ({
            url: `${SITE_URL}/for/${i.slug}`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.75,
        })
    );

    // /track/[competitor]-pricing/[region] — 15 pages, priority 0.7
    const trackPages: MetadataRoute.Sitemap = [];
    for (const comp of TARGET_COMPETITORS) {
        for (const region of industriesData.regions) {
            trackPages.push({
                url: `${SITE_URL}/track/${comp}-pricing/${region.slug}`,
                lastModified: now,
                changeFrequency: "daily",
                priority: 0.7,
            });
        }
    }

    return [...core, ...vsPages, ...forPages, ...trackPages];
}
