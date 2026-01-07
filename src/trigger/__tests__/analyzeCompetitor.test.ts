import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mocks are available for the dynamic imports and the task definition
const { mockSupabase, mockAI, mockPage, mockBrowser } = vi.hoisted(() => {
    return {
        mockSupabase: {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            update: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
        mockAI: {
            models: {
                generateContent: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        companyName: 'TestCo',
                        pricing: { plans: [{ name: 'Pro', price: '$10' }] },
                        features: { highlighted: ['F1'], differentiators: [] },
                        positioning: { socialProof: [] },
                        insights: [],
                        summary: 'Test summary'
                    })
                }),
            },
        },
        mockPage: {
            setViewportSize: vi.fn().mockResolvedValue(undefined),
            goto: vi.fn().mockResolvedValue(undefined),
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            evaluate: vi.fn().mockResolvedValue(undefined),
            screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
            title: vi.fn().mockResolvedValue('Test Title'),
            close: vi.fn().mockResolvedValue(undefined),
        },
        mockBrowser: {
            newPage: vi.fn(),
            close: vi.fn().mockResolvedValue(undefined),
        }
    };
});

// Mock Trigger.dev BEFORE importing the task
vi.mock('@trigger.dev/sdk/v3', () => ({
    task: vi.fn((opts) => opts),
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
    metadata: {
        set: vi.fn(),
    },
}));

// Mock Supabase with dynamic import support
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

// Mock Google AI with dynamic import support
vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn().mockImplementation(function () {
        return mockAI;
    }),
}));

// Mock Playwright
vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn().mockResolvedValue(mockBrowser),
    },
}));

import { analyzeCompetitorTask } from '../analyzeCompetitor';

describe('analyzeCompetitorTask', () => {
    const payload = {
        competitorId: 'comp-123',
        competitorUrl: 'https://example.com',
        competitorName: 'Example',
        userId: 'user-456',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset implementations to default
        mockBrowser.newPage.mockResolvedValue(mockPage);
        mockPage.goto.mockResolvedValue(undefined);
        mockAI.models.generateContent.mockResolvedValue({
            text: JSON.stringify({
                companyName: 'TestCo',
                pricing: { plans: [{ name: 'Pro', price: '$10' }] },
                features: { highlighted: ['F1'], differentiators: [] },
                positioning: { socialProof: [] },
                insights: [],
                summary: 'Test summary'
            })
        });
        mockSupabase.limit.mockResolvedValue({ data: [], error: null });
        mockSupabase.insert.mockResolvedValue({ data: null, error: null });

        // Mock environment variables
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
        process.env.GEMINI_API_KEY = 'fake-gemini-key';
    });

    it('successfully analyzes a competitor', async () => {
        const result = await (analyzeCompetitorTask as any).run(payload);
        if (!result.success) console.log('Task Error:', result.error);

        expect(result.success).toBe(true);
        expect(result.analysis.companyName).toBe('TestCo');
    });

    it('handles analysis with missing pricing or features (hits hash fallback)', async () => {
        mockAI.models.generateContent.mockResolvedValue({
            text: JSON.stringify({
                companyName: 'TestCo',
                // pricing and features missing
                summary: 'Empty summary'
            })
        });

        const result = await (analyzeCompetitorTask as any).run(payload);
        expect(result.success).toBe(true);
    });

    it('detects no changes when hashes match', async () => {
        // Mock previous analysis with the correct hash for our mock data
        // Hash for { pricing: [{name: 'Pro', price: '$10'}], features: ['F1'], positioning: undefined }
        // Let's just run it once to see what hash it generates or use a known one.
        // Actually, the current hash in the test might be stale if I changed the data.
        const result1 = await (analyzeCompetitorTask as any).run(payload);
        const hash = (mockSupabase.insert.mock.calls[0][0] as any).analysis_hash;

        vi.clearAllMocks();
        mockSupabase.limit.mockResolvedValue({
            data: [{ analysis_hash: hash }],
            error: null
        });

        const result2 = await (analyzeCompetitorTask as any).run(payload);

        expect(result2.success).toBe(true);
        expect(result2.hasChanged).toBe(false);
    });

    it('handles Playwright failure gracefully', async () => {
        mockPage.goto.mockRejectedValue(new Error('Page load failed'));

        const result = await (analyzeCompetitorTask as any).run(payload);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Page load failed');
    });

    it('handles empty AI response text fallback', async () => {
        mockAI.models.generateContent.mockResolvedValue({
            text: null // Should hit line 139 fallback to ""
        });

        const result = await (analyzeCompetitorTask as any).run(payload);
        expect(result.success).toBe(false);
        expect(result.error).toBe('AI response parse failed');
    });

    it('handles non-Error objects in catch block', async () => {
        mockBrowser.newPage.mockRejectedValue('String Error'); // Hits line 196 "Unknown error"

        const result = await (analyzeCompetitorTask as any).run(payload);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error');
    });
});
