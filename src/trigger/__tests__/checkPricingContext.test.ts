import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock core lib functions
vi.mock('@/lib/crawler/geoPlaywright', () => ({
    scrapeWithGeoContext: vi.fn(),
    closeGeoBrowser: vi.fn(),
}));

vi.mock('@/lib/crawler', () => ({
    decideScraper: vi.fn(() => 'playwright'),
    getCurrencySymbols: vi.fn(() => ['$']),
    shouldUpgradeToPlaywright: vi.fn(() => false),
}));

vi.mock('@/lib/crawler/screenshotStorage', () => ({
    uploadScreenshot: vi.fn(),
    getScreenshotUrl: vi.fn(() => 'https://img.com/123'),
}));

vi.mock('@/lib/diff/pricingDiff', () => ({
    diffPricing: vi.fn(),
}));

vi.mock('@/lib/diff/pricingInsights', () => ({
    generatePricingInsight: vi.fn(),
    generateFallbackInsight: vi.fn(),
}));

vi.mock('@/lib/diff/alertRules', () => ({
    shouldTriggerAlert: vi.fn(),
    formatAlertContent: vi.fn(() => ({ headline: 'Title', body: 'Body' })),
}));

vi.mock('@/lib/alerts/sendEmail', () => ({
    sendAlertEmail: vi.fn(),
}));

vi.mock('@/lib/alerts/slackIntegration', () => ({
    pushToSlack: vi.fn(),
}));

vi.mock('@/lib/billing/featureFlags', () => ({
    getFeatureFlags: vi.fn(() => ({
        canViewScreenshots: true,
        canViewAiInsights: true,
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
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'snap-123', plan: 'pro', email: 'test@ee.com' }, error: null }),
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

import { checkPricingContext } from '../checkPricingContext';
import { scrapeWithGeoContext } from '@/lib/crawler/geoPlaywright';
import { diffPricing } from '@/lib/diff/pricingDiff';
import { shouldTriggerAlert } from '@/lib/diff/alertRules';
import { uploadScreenshot } from '@/lib/crawler/screenshotStorage';
import { generatePricingInsight } from '@/lib/diff/pricingInsights';

describe('checkPricingContextTask', () => {
    const payload = {
        competitorId: 'comp-1',
        competitorUrl: 'https://comp.com',
        competitorName: 'Comp',
        userId: 'user-1',
        context: { id: 'ctx-1', key: 'us', name: 'USA', requires_browser: true },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';

        // Default mock behaviors
        mockSupabase.single.mockResolvedValue({ data: { id: 'snap-123', plan: 'pro', email: 'test@ee.com' }, error: null });

        vi.mocked(scrapeWithGeoContext).mockResolvedValue({
            success: true,
            pricingSchema: { plans: [] } as any,
            currencyDetected: 'USD',
            domHash: 'hash',
            screenshot: Buffer.from('abc'),
        });

        vi.mocked(diffPricing).mockReturnValue({
            hasMeaningfulChanges: true,
            diffs: [{ type: 'price_increase', severity: 0.8, description: 'Price up', before: '$10', after: '$20' }],
            overallSeverity: 0.8,
            summary: 'Summary',
        } as any);

        vi.mocked(shouldTriggerAlert).mockReturnValue({
            shouldAlert: true,
            severity: 'high',
        });

        vi.mocked(uploadScreenshot).mockResolvedValue({
            success: true,
            path: 'path/to/img.png',
        });

        vi.mocked(generatePricingInsight).mockResolvedValue({
            success: true,
            insight: { whyItMatters: 'Insight', tacticalPlaybook: { recommendedAction: 'Action' } },
        } as any);
    });

    it('successfully checks pricing context and creates alert', async () => {
        const result = await (checkPricingContext as any).run(payload);
        if (!result.success) console.log('Task Error:', result.error);

        expect(result.success).toBe(true);
        expect(result.alertCreated).toBe(true);
        expect(scrapeWithGeoContext).toHaveBeenCalledWith(payload.competitorUrl, payload.context);
    });

    it('handles scrape failure', async () => {
        vi.mocked(scrapeWithGeoContext).mockResolvedValue({
            success: false,
            error: 'Scraper blocked',
        } as any);

        const result = await (checkPricingContext as any).run(payload);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Scraper blocked');
    });

    it('skips alert if change is not meaningful', async () => {
        vi.mocked(diffPricing).mockReturnValue({
            hasMeaningfulChanges: false,
            diffs: [],
        } as any);

        const result = await (checkPricingContext as any).run(payload);

        expect(result.success).toBe(true);
        expect(result.hasChanges).toBe(false);
        expect(result.alertCreated).toBe(false);
    });
});
