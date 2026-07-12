import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, mockAI, mockCapture } = vi.hoisted(() => {
    return {
        mockSupabase: {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
        mockAI: {
            models: { generateContent: vi.fn() },
        },
        mockCapture: vi.fn(),
    };
});

vi.mock('@trigger.dev/sdk/v3', () => ({
    task: vi.fn((opts) => opts),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    metadata: { set: vi.fn() },
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn().mockImplementation(function () { return mockAI; }),
}));

vi.mock('@/lib/crawler/screenshot', () => ({
    captureScreenshot: mockCapture,
}));

vi.mock('@/lib/crawler/screenshotStorage', () => ({
    uploadScreenshot: vi.fn().mockResolvedValue({ success: true, path: 'comp-1/daily/123.png' }),
}));

import { visionAnalysisContext } from '../visionAnalysisContext';

describe('visionAnalysisContext', () => {
    const payload = {
        competitorId: 'comp-1',
        competitorUrl: 'https://comp.com',
        competitorName: 'Comp',
        userId: 'user-1',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
        process.env.GEMINI_API_KEY = 'fake-gemini-key';

        mockSupabase.limit.mockResolvedValue({ data: [], error: null });
        mockSupabase.insert.mockResolvedValue({ data: null, error: null });

        mockCapture.mockResolvedValue({
            success: true,
            screenshot: Buffer.from('fake-screenshot'),
            contentType: 'image/png',
            url: payload.competitorUrl,
            title: 'Comp',
            timestamp: new Date().toISOString(),
        });

        mockAI.models.generateContent.mockResolvedValue({
            text: JSON.stringify({
                companyName: 'Comp',
                pricing: { plans: [{ name: 'Pro', price: '$10' }] },
                features: { highlighted: ['F1'], differentiators: [] },
                positioning: { valueProposition: 'Great value', socialProof: [] },
                insights: [],
                summary: 'Summary',
            }),
        });
    });

    it('stores the analysis and returns success', async () => {
        const result = await (visionAnalysisContext as any).run(payload);

        expect(result.success).toBe(true);
        expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
            competitor_id: 'comp-1',
            user_id: 'user-1',
            model: 'gemini-2.0-flash',
        }));
    });

    it('creates a vision_change alert when the hash changes and a previous analysis exists', async () => {
        mockSupabase.limit.mockResolvedValue({
            data: [{ analysis_hash: 'stale-hash', analysis_data: { pricing: { plans: [] }, features: {}, positioning: {} } }],
            error: null,
        });

        await (visionAnalysisContext as any).run(payload);

        expect(mockSupabase.from).toHaveBeenCalledWith('alerts');
        expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({ type: 'vision_change' }));
    });

    it('fails cleanly when the screenshot capture fails', async () => {
        mockCapture.mockResolvedValue({ success: false, error: 'Blocked', code: 'BLOCKED' });

        const result = await (visionAnalysisContext as any).run(payload);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Blocked');
        expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('fails cleanly when the AI response cannot be parsed', async () => {
        mockAI.models.generateContent.mockResolvedValue({ text: 'not json' });

        const result = await (visionAnalysisContext as any).run(payload);

        expect(result.success).toBe(false);
        expect(result.error).toBe('AI response parse failed');
    });
});
