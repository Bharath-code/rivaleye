import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const checkRateLimitMock = vi.fn();
const queryModelMock = vi.fn();

const maybeSingleMock = vi.fn();
const insertMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/rateLimit", async () => {
    const actual = await vi.importActual<typeof import("@/lib/rateLimit")>(
        "@/lib/rateLimit"
    );
    return {
        ...actual,
        checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
    };
});

vi.mock("@/lib/aeo/providers", async () => {
    const actual = await vi.importActual<typeof import("@/lib/aeo/providers")>(
        "@/lib/aeo/providers"
    );
    return {
        ...actual,
        queryModel: (...args: unknown[]) => queryModelMock(...args),
    };
});

vi.mock("@/lib/supabase", () => ({
    createServerClient: () => ({ from: fromMock }),
}));

function buildSelectChain() {
    return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: maybeSingleMock,
    };
}

function setupFrom() {
    fromMock.mockImplementation(() => ({
        ...buildSelectChain(),
        insert: insertMock,
    }));
}

function postRequest(body: unknown, ip = "1.2.3.4") {
    return new NextRequest("http://localhost/api/public/aeo-check", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-forwarded-for": ip,
        },
        body: JSON.stringify(body),
    });
}

describe("POST /api/public/aeo-check", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupFrom();
        insertMock.mockResolvedValue({ error: null });
        checkRateLimitMock.mockResolvedValue({
            allowed: true,
            remaining: 2,
            resetMs: 1000,
        });
    });

    it("returns the cached result with zero queryModel calls on a cache hit", async () => {
        maybeSingleMock.mockResolvedValue({
            data: {
                result: {
                    brand: "Acme",
                    url: "https://acme.com",
                    total: 3,
                    mentions: 1,
                    visibility_pct: 33.3,
                    results: [],
                },
                created_at: new Date().toISOString(),
            },
        });

        const { POST } = await import("../aeo-check/route");
        const res = await POST(
            postRequest({ brand: "Acme", url: "https://acme.com" })
        );
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.cached).toBe(true);
        expect(json.brand).toBe("Acme");
        expect(queryModelMock).not.toHaveBeenCalled();
        expect(insertMock).not.toHaveBeenCalled();
    });

    it("runs the scan on a cache miss and caps calls at 3 queries x 2 models", async () => {
        maybeSingleMock.mockResolvedValue({ data: null });
        queryModelMock.mockResolvedValue({
            model: "gemini",
            response_text: "Acme is a great tool for competitive intelligence.",
            citations: [],
        });

        const { POST } = await import("../aeo-check/route");
        const res = await POST(
            postRequest({ brand: "Acme", url: "https://acme.com" })
        );
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.cached).toBe(false);
        expect(queryModelMock.mock.calls.length).toBeGreaterThan(0);
        expect(queryModelMock.mock.calls.length).toBeLessThanOrEqual(6);
        expect(insertMock).toHaveBeenCalledTimes(1);
    });

    it("returns 502 when every queryModel call fails", async () => {
        maybeSingleMock.mockResolvedValue({ data: null });
        queryModelMock.mockResolvedValue(null);

        const { POST } = await import("../aeo-check/route");
        const res = await POST(
            postRequest({ brand: "Acme", url: "https://acme.com" })
        );
        const json = await res.json();

        expect(res.status).toBe(502);
        expect(json.error).toBeTruthy();
        expect(insertMock).not.toHaveBeenCalled();
    });

    it("returns 400 for a URL that fails validateCompetitorUrl (SSRF guard)", async () => {
        const { POST } = await import("../aeo-check/route");
        const res = await POST(
            postRequest({ brand: "Acme", url: "http://localhost" })
        );
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBeTruthy();
        expect(queryModelMock).not.toHaveBeenCalled();
        expect(fromMock).not.toHaveBeenCalled();
    });

    it("returns 429 when the per-IP rate limit is exceeded", async () => {
        checkRateLimitMock.mockResolvedValue({
            allowed: false,
            remaining: 0,
            resetMs: 60000,
        });

        const { POST } = await import("../aeo-check/route");
        const res = await POST(
            postRequest({ brand: "Acme", url: "https://acme.com" })
        );
        const json = await res.json();

        expect(res.status).toBe(429);
        expect(json.error).toBeTruthy();
        expect(res.headers.get("Retry-After")).toBe("60");
        expect(queryModelMock).not.toHaveBeenCalled();
        expect(fromMock).not.toHaveBeenCalled();
    });
});
