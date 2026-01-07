import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'fake-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
    process.env.GEMINI_API_KEY = 'fake-gemini-key';
});

// Mock core lib functions
vi.mock('@/lib/diff/compareRegionalPricing', () => ({
    compareRegionalPricing: vi.fn(),
    getLatestRegionalSnapshots: vi.fn(),
    createRegionalDiffAlert: vi.fn(() => ({ severity: 'medium', description: 'Diff description' })),
}));

vi.mock('@/lib/billing/featureFlags', () => ({
    getFeatureFlags: vi.fn((plan) => ({
        maxRegions: plan === 'pro' ? 8 : 1,
    })),
}));

// Mock Trigdev
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

// Mock Supabase
const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { plan: 'pro' }, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

import { crossRegionComparison } from '../crossRegionComparison';
import { getLatestRegionalSnapshots, compareRegionalPricing } from '@/lib/diff/compareRegionalPricing';

describe('crossRegionComparisonTask', () => {
    const payload = {
        competitorId: 'comp-1',
        competitorName: 'Comp',
        userId: 'user-1',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.single.mockResolvedValue({ data: { plan: 'pro' }, error: null });

        vi.mocked(getLatestRegionalSnapshots).mockResolvedValue([
            { region: 'us', pricing: {} } as any,
            { region: 'in', pricing: {} } as any,
        ]);

        vi.mocked(compareRegionalPricing).mockResolvedValue({
            hasRegionalDifferences: true,
            differences: [
                { planName: 'Pro', baseRegion: 'us', basePrice: 10, comparingRegion: 'in', comparingPrice: 5, priceDifferencePercent: 50, isDiscount: true }
            ],
            summary: 'Significant differences',
        } as any);
    });

    it('successfully compares regions and creates alerts for Pro users', async () => {
        const result = await (crossRegionComparison as any).run(payload);

        expect(result.success).toBe(true);
        expect(result.hasRegionalDifferences).toBe(true);
        expect(result.alertsCreated).toBe(1);
        expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('skips for Free users', async () => {
        mockSupabase.single.mockResolvedValue({ data: { plan: 'free' }, error: null });

        const result = await (crossRegionComparison as any).run(payload);

        expect(result.success).toBe(true);
        expect(result.error).toBe('Cross-region comparison requires Pro plan');
    });

    it('handles insufficient regions', async () => {
        vi.mocked(getLatestRegionalSnapshots).mockResolvedValue([
            { region: 'us', pricing: {} } as any,
        ]);

        const result = await (crossRegionComparison as any).run(payload);

        expect(result.success).toBe(true);
        expect(result.hasRegionalDifferences).toBe(false);
    });

    it('handles no differences found', async () => {
        vi.mocked(compareRegionalPricing).mockResolvedValue({
            hasRegionalDifferences: false,
            differences: [],
        } as any);

        const result = await (crossRegionComparison as any).run(payload);

        expect(result.success).toBe(true);
        expect(result.hasRegionalDifferences).toBe(false);
    });

    it('handles unexpected errors and catches them', async () => {
        vi.mocked(getLatestRegionalSnapshots).mockRejectedValue(new Error('Unexpected comparison error'));

        const result = await (crossRegionComparison as any).run(payload);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unexpected comparison error');
    });
});
