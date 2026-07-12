import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, mockVisionTrigger } = vi.hoisted(() => ({
    mockSupabase: {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn(),
    },
    mockVisionTrigger: vi.fn(),
}));

vi.mock('@trigger.dev/sdk/v3', () => ({
    schedules: { task: vi.fn((opts) => opts) },
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    metadata: { set: vi.fn() },
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

vi.mock('../visionAnalysisContext', () => ({
    visionAnalysisContext: { trigger: mockVisionTrigger },
}));

import { dailyCompetitorAnalysis } from '../dailyAnalysis';

describe('dailyCompetitorAnalysis (per-user cadence scheduler)', () => {
    const payload = { timestamp: new Date().toISOString(), lastTimestamp: new Date().toISOString() };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
        mockVisionTrigger.mockResolvedValue(undefined);
    });

    it('triggers vision analysis for every active competitor', async () => {
        mockSupabase.eq.mockResolvedValue({
            data: [
                { id: 'c1', name: 'Comp 1', url: 'https://c1.com', user_id: 'u1' },
                { id: 'c2', name: 'Comp 2', url: 'https://c2.com', user_id: 'u1' },
            ],
            error: null,
        });

        const result = await (dailyCompetitorAnalysis as any).run(payload);

        expect(result.triggered).toBe(2);
        expect(mockVisionTrigger).toHaveBeenCalledTimes(2);
        expect(mockVisionTrigger).toHaveBeenCalledWith({
            competitorId: 'c1',
            competitorUrl: 'https://c1.com',
            competitorName: 'Comp 1',
            userId: 'u1',
        });
    });

    it('returns zero triggered when there are no active competitors', async () => {
        mockSupabase.eq.mockResolvedValue({ data: [], error: null });

        const result = await (dailyCompetitorAnalysis as any).run(payload);

        expect(result.triggered).toBe(0);
        expect(mockVisionTrigger).not.toHaveBeenCalled();
    });

    it('continues past a failed trigger', async () => {
        mockSupabase.eq.mockResolvedValue({
            data: [
                { id: 'c1', name: 'Comp 1', url: 'https://c1.com', user_id: 'u1' },
                { id: 'c2', name: 'Comp 2', url: 'https://c2.com', user_id: 'u1' },
            ],
            error: null,
        });
        mockVisionTrigger.mockRejectedValueOnce(new Error('trigger failed')).mockResolvedValueOnce(undefined);

        const result = await (dailyCompetitorAnalysis as any).run(payload);

        expect(result.triggered).toBe(1);
    });
});
