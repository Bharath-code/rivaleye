import { describe, it, expect } from 'vitest';
import { generateFallbackInsight } from '../pricingInsights';
import type { DetectedDiff } from '../pricingDiff';
import type { PricingDiffType } from '@/lib/types';

describe('pricingInsights', () => {
    describe('generateFallbackInsight', () => {
        const diffTypes: PricingDiffType[] = [
            'price_increase',
            'price_decrease',
            'plan_added',
            'plan_removed',
            'free_tier_removed',
            'free_tier_added',
            'plan_promoted',
            'cta_changed',
            'regional_difference'
        ];

        diffTypes.forEach(type => {
            it(`generates insight for ${type}`, () => {
                const diff: DetectedDiff = {
                    type,
                    description: 'Test change',
                    severity: 5,
                    before: 'old',
                    after: 'new',
                };

                const insight = generateFallbackInsight(diff);

                expect(insight).toBeDefined();
                expect(insight.whyItMatters).toBeTruthy();
                expect(insight.strategicImplications).toBeTruthy();
                expect(insight.recommendedAction).toBeTruthy();
                expect(['high', 'medium', 'low']).toContain(insight.confidence);
            });
        });

        it('returns high confidence for price changes', () => {
            const diff: DetectedDiff = { type: 'price_increase', description: 'Price went up', severity: 8 };
            expect(generateFallbackInsight(diff).confidence).toBe('high');
        });

        it('returns high confidence for free tier changes', () => {
            const diff: DetectedDiff = { type: 'free_tier_removed', description: 'No more free', severity: 9 };
            expect(generateFallbackInsight(diff).confidence).toBe('high');
        });

        it('returns medium confidence for plan changes', () => {
            const diff: DetectedDiff = { type: 'plan_added', description: 'New plan', severity: 5 };
            expect(generateFallbackInsight(diff).confidence).toBe('medium');
        });

        it('returns low confidence for CTA changes', () => {
            const diff: DetectedDiff = { type: 'cta_changed', description: 'Button changed', severity: 3 };
            expect(generateFallbackInsight(diff).confidence).toBe('low');
        });
    });
});
