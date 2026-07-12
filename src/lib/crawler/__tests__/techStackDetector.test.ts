import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockScrape } = vi.hoisted(() => ({ mockScrape: vi.fn() }));

vi.mock("../firecrawl", () => ({
    getFirecrawlClient: () => ({ scrape: mockScrape }),
}));

import { detectTechStack, compareTechStacks, type DetectedTech } from "../techStackDetector";

function stubHeaders(headers: Record<string, string>) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        headers: new Headers(headers),
        body: null,
    }));
}

beforeEach(() => {
    mockScrape.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("detectTechStack (Firecrawl)", () => {
    it("detects frameworks and analytics from script srcs and html patterns", async () => {
        mockScrape.mockResolvedValue({
            html: `<html><head>
                <script src="/_next/static/chunks/main.js"></script>
                <script src="https://www.googletagmanager.com/gtag/js"></script>
                <script src="https://js.stripe.com/v3/"></script>
            </head><body data-reactroot=""></body></html>`,
        });
        stubHeaders({});

        const res = await detectTechStack("https://acme.com");

        expect(res.success).toBe(true);
        if (res.success) {
            const names = res.technologies.map((t) => t.name);
            expect(names).toContain("Next.js");
            expect(names).toContain("React");
            expect(names).toContain("Google Analytics");
            expect(names).toContain("Stripe");
            expect(res.summary.framework).toBe("Next.js");
            expect(res.summary.payments).toContain("Stripe");
        }
    });

    it("detects hosting/CDN from response headers via plain fetch", async () => {
        mockScrape.mockResolvedValue({ html: "<html></html>" });
        stubHeaders({ "cf-ray": "abc123", "x-vercel-id": "iad1::xyz" });

        const res = await detectTechStack("https://acme.com");

        expect(res.success).toBe(true);
        if (res.success) {
            const names = res.technologies.map((t) => t.name);
            expect(names).toContain("Cloudflare");
            expect(names).toContain("Vercel");
        }
    });

    it("succeeds with empty detections when nothing matches", async () => {
        mockScrape.mockResolvedValue({ html: "<html><body>plain</body></html>" });
        stubHeaders({});

        const res = await detectTechStack("https://plain.com");
        expect(res.success).toBe(true);
        if (res.success) {
            expect(res.technologies).toHaveLength(0);
            expect(res.summary.framework).toBeNull();
        }
    });

    it("still detects header signatures when the header fetch fails", async () => {
        mockScrape.mockResolvedValue({ html: `<script src="https://static.hotjar.com/c.js"></script>` });
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

        const res = await detectTechStack("https://acme.com");
        expect(res.success).toBe(true);
        if (res.success) expect(res.technologies.map((t) => t.name)).toContain("Hotjar");
    });

    it("maps timeout errors to TIMEOUT", async () => {
        mockScrape.mockRejectedValue(new Error("Request timeout"));
        stubHeaders({});
        const res = await detectTechStack("https://slow.com");
        expect(!res.success && res.code).toBe("TIMEOUT");
    });

    it("maps blocked errors to BLOCKED", async () => {
        mockScrape.mockRejectedValue(new Error("403 Forbidden"));
        stubHeaders({});
        const res = await detectTechStack("https://blocked.com");
        expect(!res.success && res.code).toBe("BLOCKED");
    });

    it("maps generic errors to UNKNOWN", async () => {
        mockScrape.mockRejectedValue(new Error("Network connection lost"));
        stubHeaders({});
        const res = await detectTechStack("https://example.com");
        expect(res.success).toBe(false);
        if (!res.success) {
            expect(res.code).toBe("UNKNOWN");
            expect(res.error).toBe("Network connection lost");
        }
    });
});

describe("compareTechStacks", () => {
    const tech = (name: string): DetectedTech => ({
        name,
        category: "framework",
        confidence: "high",
        evidence: "test",
    });

    it("returns no changes when stacks are identical", () => {
        const stack = [tech("React")];
        const diff = compareTechStacks(stack, stack);
        expect(diff.added).toHaveLength(0);
        expect(diff.removed).toHaveLength(0);
        expect(diff.summary).toBe("No tech stack changes");
    });

    it("detects added technology", () => {
        const diff = compareTechStacks([tech("React")], [tech("React"), tech("Stripe")]);
        expect(diff.added.map((t) => t.name)).toEqual(["Stripe"]);
        expect(diff.summary).toContain("Added: Stripe");
    });

    it("detects removed technology", () => {
        const diff = compareTechStacks([tech("React"), tech("Segment")], [tech("React")]);
        expect(diff.removed).toEqual(["Segment"]);
        expect(diff.summary).toContain("Removed: Segment");
    });
});
