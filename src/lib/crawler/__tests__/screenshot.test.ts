import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockScrape } = vi.hoisted(() => ({ mockScrape: vi.fn() }));

vi.mock("../firecrawl", () => ({
    getFirecrawlClient: () => ({ scrape: mockScrape }),
}));

import { captureScreenshot } from "../screenshot";

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(8)]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8)]);

function stubFetch(buf: Buffer) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    }));
}

beforeEach(() => {
    mockScrape.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => { });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("captureScreenshot (Firecrawl)", () => {
    it("returns buffer, sniffed content type, and page title", async () => {
        mockScrape.mockResolvedValue({ screenshot: "https://fc.dev/shot.png", metadata: { title: "Acme Pricing" } });
        stubFetch(png);

        const res = await captureScreenshot("https://acme.com/pricing");

        expect(res.success).toBe(true);
        if (res.success) {
            expect(Buffer.isBuffer(res.screenshot)).toBe(true);
            expect(res.contentType).toBe("image/png");
            expect(res.title).toBe("Acme Pricing");
            expect(res.url).toBe("https://acme.com/pricing");
        }
        expect(mockScrape.mock.calls[0][1].formats).toContainEqual({ type: "screenshot", fullPage: true });
    });

    it("sniffs JPEG content type", async () => {
        mockScrape.mockResolvedValue({ screenshot: "https://fc.dev/shot.jpg", metadata: {} });
        stubFetch(jpg);

        const res = await captureScreenshot("https://acme.com");
        expect(res.success && res.contentType).toBe("image/jpeg");
    });

    it("fails when Firecrawl returns no screenshot", async () => {
        mockScrape.mockResolvedValue({ metadata: {} });
        const res = await captureScreenshot("https://acme.com");
        expect(res.success).toBe(false);
        if (!res.success) expect(res.code).toBe("UNKNOWN");
    });

    it("maps timeout errors to TIMEOUT", async () => {
        mockScrape.mockRejectedValue(new Error("Request timeout after 60000ms"));
        const res = await captureScreenshot("https://acme.com");
        expect(!res.success && res.code).toBe("TIMEOUT");
    });

    it("maps 403/blocked errors to BLOCKED", async () => {
        mockScrape.mockRejectedValue(new Error("403 Forbidden"));
        const res = await captureScreenshot("https://acme.com");
        expect(!res.success && res.code).toBe("BLOCKED");
    });
});
