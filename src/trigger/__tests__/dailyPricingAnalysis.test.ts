import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase } = vi.hoisted(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'fake-key';
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

import { dailyPricingAnalysis } from '../dailyPricingAnalysis';
import { checkPricingContext } from '../checkPricingContext';

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

        // Deterministic Math.random for persistence logic
        vi.spyOn(Math, 'random').mockReturnValue(0.1);

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

    it('applies frequency decay logic correctly', async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 100);

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
                        data: [{ id: 'ctx1', key: 'us', name: 'US' }],
                        error: null,
                    }),
                };
            }
            if (table === 'pricing_diffs') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({
                        data: [{ created_at: oldDate.toISOString() }],
                        error: null
                    }),
                };
            }
            return mockSupabase;
        });

        vi.mocked(Math.random).mockReturnValue(0.1);
        let result = await (dailyPricingAnalysis as any).run(payload);
        expect(result.processed).toBe(1);

        vi.mocked(Math.random).mockReturnValue(0.5);
        result = await (dailyPricingAnalysis as any).run(payload);
        expect(result.processed).toBe(0);
    });
});
