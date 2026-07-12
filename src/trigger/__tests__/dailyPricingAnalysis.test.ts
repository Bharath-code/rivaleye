import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase } = vi.hoisted(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
    process.env.GEMINI_API_KEY = 'fake-gemini-key';

    return {
        mockSupabase: {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
        }
    };
});

// Mock child tasks before importing the main task
vi.mock('../checkPricingContext', () => ({
    checkPricingContext: {
        triggerAndWait: vi.fn(),
    }
}));

vi.mock('../deepAudit', () => ({
    deepAuditTask: {
        trigger: vi.fn(),
    }
}));

vi.mock('../crossRegionComparison', () => ({
    crossRegionComparison: {
        trigger: vi.fn(),
    }
}));

vi.mock('../visionAnalysisContext', () => ({
    visionAnalysisContext: {
        trigger: vi.fn(),
    }
}));

// Mock Trigdev
vi.mock('@trigger.dev/sdk/v3', () => ({
    schedules: {
        task: vi.fn((opts) => opts),
    },
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

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

import { dailyPricingAnalysis, stableFraction } from '../dailyPricingAnalysis';
import { checkPricingContext } from '../checkPricingContext';
import { visionAnalysisContext } from '../visionAnalysisContext';

describe('dailyPricingAnalysisTask', () => {
    const payload = {
        timestamp: new Date().toISOString(),
        lastTimestamp: new Date().toISOString(),
    };

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(checkPricingContext.triggerAndWait).mockResolvedValue({
            ok: true,
            output: { hasChanges: false, alertCreated: false }
        } as any);

        vi.mocked(visionAnalysisContext.trigger).mockResolvedValue(undefined as any);

        // Mock setTimeout to skip delays
        vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
            if (typeof fn === 'function') fn();
            return { unref: () => { } } as any;
        });

        // Reset mock chains
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.eq.mockReturnThis();
        mockSupabase.order.mockReturnThis();
        mockSupabase.limit.mockReturnThis();
    });

    it('processes competitors and builds work queue', async () => {
        // Mock active competitors and contexts
        mockSupabase.from.mockImplementation((table) => {
            if (table === 'competitors') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [{ id: 'c1', name: 'Comp', url: 'https://c1.com', user_id: 'u1', users: { plan: 'pro' } }],
                        error: null,
                    }),
                };
            }
            if (table === 'pricing_contexts') {
                return {
                    select: vi.fn().mockResolvedValue({
                        data: [
                            { id: 'ctx1', key: 'us', name: 'US' },
                            { id: 'ctx2', key: 'eu', name: 'EU' },
                        ],
                        error: null,
                    }),
                };
            }
            if (table === 'pricing_diffs') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            return mockSupabase;
        });

        const result = await (dailyPricingAnalysis as any).run(payload);

        expect(result.processed).toBe(2);
        expect(checkPricingContext.triggerAndWait).toHaveBeenCalledTimes(2);
    });

    it('stableFraction is deterministic for the same seed and varies across seeds', () => {
        expect(stableFraction('c1:ctx1:2026-01-01')).toBe(stableFraction('c1:ctx1:2026-01-01'));
        expect(stableFraction('c1:ctx1:2026-01-01')).not.toBe(stableFraction('c1:ctx1:2026-01-02'));
        const f = stableFraction('c1:ctx1:2026-01-01');
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(1);
    });

    it('applies frequency decay logic deterministically (skips when the daily seed lands above the threshold)', async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 100);

        // Find a competitor id whose seed falls below the 90-day threshold (checked)
        // and one that falls above it (skipped), for today's date.
        const today = new Date().toISOString().slice(0, 10);
        let checkedId = '';
        let skippedId = '';
        for (let i = 0; i < 200 && (!checkedId || !skippedId); i++) {
            const id = `comp-${i}`;
            const f = stableFraction(`${id}:ctx1:${today}`);
            if (f < 0.25 && !checkedId) checkedId = id;
            if (f >= 0.25 && !skippedId) skippedId = id;
        }
        expect(checkedId).not.toBe('');
        expect(skippedId).not.toBe('');

        const contextsFor = (competitorId: string) => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ id: competitorId, name: 'Comp', url: 'https://c1.com', user_id: 'u1', users: { plan: 'pro' } }],
                error: null,
            }),
        });

        mockSupabase.from.mockImplementation((table) => {
            if (table === 'competitors') return contextsFor(checkedId);
            if (table === 'pricing_contexts') {
                return {
                    select: vi.fn().mockResolvedValue({ data: [{ id: 'ctx1', key: 'us', name: 'US' }], error: null }),
                };
            }
            if (table === 'pricing_diffs') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ data: [{ created_at: oldDate.toISOString() }], error: null }),
                };
            }
            return mockSupabase;
        });

        let result = await (dailyPricingAnalysis as any).run(payload);
        expect(result.processed).toBe(1);

        mockSupabase.from.mockImplementation((table) => {
            if (table === 'competitors') return contextsFor(skippedId);
            if (table === 'pricing_contexts') {
                return {
                    select: vi.fn().mockResolvedValue({ data: [{ id: 'ctx1', key: 'us', name: 'US' }], error: null }),
                };
            }
            if (table === 'pricing_diffs') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ data: [{ created_at: oldDate.toISOString() }], error: null }),
                };
            }
            return mockSupabase;
        });

        result = await (dailyPricingAnalysis as any).run(payload);
        expect(result.processed).toBe(0);
    });

    it('fires visionAnalysisContext once per competitor', async () => {
        mockSupabase.from.mockImplementation((table) => {
            if (table === 'competitors') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [{ id: 'c1', name: 'Comp', url: 'https://c1.com', user_id: 'u1', users: { plan: 'pro' } }],
                        error: null,
                    }),
                };
            }
            if (table === 'pricing_contexts') {
                return {
                    select: vi.fn().mockResolvedValue({
                        data: [
                            { id: 'ctx1', key: 'us', name: 'US' },
                            { id: 'ctx2', key: 'eu', name: 'EU' },
                        ],
                        error: null,
                    }),
                };
            }
            if (table === 'pricing_diffs') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            return mockSupabase;
        });

        const result = await (dailyPricingAnalysis as any).run(payload);

        // 2 contexts checked for the same competitor, but vision analysis fires once
        expect(result.processed).toBe(2);
        expect(visionAnalysisContext.trigger).toHaveBeenCalledTimes(1);
        expect(visionAnalysisContext.trigger).toHaveBeenCalledWith({
            competitorId: 'c1',
            competitorUrl: 'https://c1.com',
            competitorName: 'Comp',
            userId: 'u1',
        });
    });
});
