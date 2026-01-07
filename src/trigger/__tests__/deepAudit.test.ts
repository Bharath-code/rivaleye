import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
});

// Mock core lib functions
vi.mock('@/lib/crawler/techStackDetector', () => ({
    detectTechStack: vi.fn(),
}));

vi.mock('@/lib/crawler/brandingExtractor', () => ({
    extractBranding: vi.fn(),
}));

vi.mock('@/lib/crawler/pageSpeedInsights', () => ({
    getPageSpeedInsights: vi.fn(),
}));

vi.mock('@/lib/alerts/techStackAlerts', () => ({
    analyzeTechStackChanges: vi.fn(() => []),
    createTechStackAlerts: vi.fn(),
}));

vi.mock('@/lib/alerts/brandingAlerts', () => ({
    analyzeBrandingChanges: vi.fn(() => []),
    createBrandingAlerts: vi.fn(),
}));

vi.mock('@/lib/alerts/performanceAlerts', () => ({
    checkPerformanceChanges: vi.fn(() => []),
    createPerformanceAlerts: vi.fn(),
    mapPSIToUnified: vi.fn(() => ({ score: 90 })),
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
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

import { deepAuditTask } from '../deepAudit';
import { detectTechStack } from '@/lib/crawler/techStackDetector';
import { extractBranding } from '@/lib/crawler/brandingExtractor';
import { getPageSpeedInsights } from '@/lib/crawler/pageSpeedInsights';

describe('deepAuditTask', () => {
    const payload = {
        competitorId: 'comp-1',
        competitorUrl: 'https://comp.com',
        competitorName: 'Comp',
        userId: 'user-1',
        userPlan: 'pro' as const,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(detectTechStack).mockResolvedValue({
            success: true,
            technologies: [{ name: 'React', category: 'Frontend' }],
            summary: 'React site',
        } as any);

        vi.mocked(extractBranding).mockResolvedValue({
            success: true,
            branding: { colors: ['#000000'] },
        } as any);

        vi.mocked(getPageSpeedInsights).mockResolvedValue({
            success: true,
            score: 90,
        } as any);
    });

    it('successfully performs a deep audit for Pro users', async () => {
        const result = await (deepAuditTask as any).run(payload);

        expect(result.success).toBe(true);
        expect(detectTechStack).toHaveBeenCalled();
        expect(extractBranding).toHaveBeenCalled();
        expect(getPageSpeedInsights).toHaveBeenCalled();
    });

    it('skips for non-pro users', async () => {
        const result = await (deepAuditTask as any).run({ ...payload, userPlan: 'free' });

        expect(result.skipped).toBe(true);
        expect(result.reason).toBe('insufficient_plan');
        expect(detectTechStack).not.toHaveBeenCalled();
    });

    it('continues even if one part fails', async () => {
        vi.mocked(detectTechStack).mockRejectedValue(new Error('Tech stack failed'));

        const result = await (deepAuditTask as any).run(payload);

        expect(result.success).toBe(true);
        // Should still call others
        expect(extractBranding).toHaveBeenCalled();
        expect(getPageSpeedInsights).toHaveBeenCalled();
    });
});
