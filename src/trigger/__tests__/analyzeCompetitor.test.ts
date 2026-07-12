import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mocks are available for the dynamic imports and the task definition
const { mockSupabase, mockAI, mockCapture } = vi.hoisted(() => {
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
                generateContent: vi.fn(),
            },
        },
        mockCapture: vi.fn(),
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

vi.mock('@/lib/crawler/screenshot', () => ({
    captureScreenshot: mockCapture,
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
        mockCapture.mockResolvedValue({
            success: true,
            screenshot: Buffer.from('fake-screenshot'),
            contentType: 'image/png',
            url: payload.competitorUrl,
            title: 'Test Title',
            timestamp: new Date().toISOString(),
        });
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
        expect(mockCapture).toHaveBeenCalledWith(payload.competitorUrl);
    });

    it('passes the sniffed content type to Gemini', async () => {
        await (analyzeCompetitorTask as any).run(payload);
        const parts = mockAI.models.generateContent.mock.calls[0][0].contents[0].parts;
        expect(parts[0].inlineData.mimeType).toBe('image/png');
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
        await (analyzeCompetitorTask as any).run(payload);
        const hash = (mockSupabase.insert.mock.calls[0][0] as any).analysis_hash;

        vi.clearAllMocks();
        mockCapture.mockResolvedValue({
            success: true,
            screenshot: Buffer.from('fake-screenshot'),
            contentType: 'image/png',
            url: payload.competitorUrl,
            title: 'Test Title',
            timestamp: new Date().toISOString(),
        });
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
        mockSupabase.limit.mockResolvedValue({
            data: [{ analysis_hash: hash }],
            error: null
        });

        const result2 = await (analyzeCompetitorTask as any).run(payload);

        expect(result2.success).toBe(true);
        expect(result2.hasChanged).toBe(false);
    });

    it('handles screenshot failure gracefully', async () => {
        mockCapture.mockResolvedValue({ success: false, error: 'Page load failed', code: 'TIMEOUT' });

        const result = await (analyzeCompetitorTask as any).run(payload);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Page load failed');
    });

    it('handles empty AI response text fallback', async () => {
        mockAI.models.generateContent.mockResolvedValue({
            text: null // fallback to ""
        });

        const result = await (analyzeCompetitorTask as any).run(payload);
        expect(result.success).toBe(false);
        expect(result.error).toBe('AI response parse failed');
    });

    it('handles non-Error objects in catch block', async () => {
        mockCapture.mockRejectedValue('String Error');

        const result = await (analyzeCompetitorTask as any).run(payload);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error');
    });
});
