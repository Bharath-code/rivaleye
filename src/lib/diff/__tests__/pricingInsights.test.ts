import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateFallbackInsight, generatePricingInsight } from '../pricingInsights'
import type { DetectedDiff } from '../pricingDiff'

// Helper to create a mock diff
function createMockDiff(type: DetectedDiff['type']): DetectedDiff {
    return {
        type,
        severity: 8,
        planName: 'Pro',
        before: '$49/month',
        after: '$79/month',
        description: 'Price changed',
        isMeaningful: true,
    }
}

describe('pricingInsights', () => {
    let originalGeminiKey: string | undefined

    beforeEach(() => {
        originalGeminiKey = process.env.GEMINI_API_KEY
        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(() => {
        if (originalGeminiKey !== undefined) {
            process.env.GEMINI_API_KEY = originalGeminiKey
        } else {
            delete process.env.GEMINI_API_KEY
        }
        vi.restoreAllMocks()
    })

    describe('generatePricingInsight', () => {
        it('returns error when GEMINI_API_KEY is not set', async () => {
            delete process.env.GEMINI_API_KEY

            const result = await generatePricingInsight(createMockDiff('price_increase'))

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('GEMINI_API_KEY not configured')
            }
        })
    })

    describe('generateFallbackInsight', () => {
        it('returns insight for price_increase', () => {
            const diff = createMockDiff('price_increase')
            const insight = generateFallbackInsight(diff)
            expect(insight.whyItMatters).toBeTruthy()
            expect(insight.recommendedAction).toBeTruthy()
            expect(insight.confidence).toBe('high')
        })

        it('returns insight for price_decrease', () => {
            const diff = createMockDiff('price_decrease')
            const insight = generateFallbackInsight(diff)
            expect(insight.whyItMatters).toContain('competitive')
            expect(insight.confidence).toBe('high')
        })

        it('returns insight for plan_added', () => {
            const diff = createMockDiff('plan_added')
            const insight = generateFallbackInsight(diff)
            expect(insight.strategicImplications).toContain('expanding')
            expect(insight.confidence).toBe('medium')
        })

        it('returns insight for plan_removed', () => {
            const diff = createMockDiff('plan_removed')
            const insight = generateFallbackInsight(diff)
            expect(insight.recommendedAction).toContain('customers')
            expect(insight.confidence).toBe('medium')
        })

        it('returns high-priority insight for free_tier_removed', () => {
            const diff = createMockDiff('free_tier_removed')
            const insight = generateFallbackInsight(diff)
            expect(insight.whyItMatters).toContain('monetization')
            expect(insight.confidence).toBe('high')
        })

        it('returns insight for free_tier_added', () => {
            const diff = createMockDiff('free_tier_added')
            const insight = generateFallbackInsight(diff)
            expect(insight.whyItMatters).toContain('aggressive')
            expect(insight.confidence).toBe('high')
        })

        it('returns insight for plan_promoted', () => {
            const diff = createMockDiff('plan_promoted')
            const insight = generateFallbackInsight(diff)
            expect(insight.whyItMatters).toContain('highlighted')
            expect(insight.confidence).toBe('medium')
        })

        it('returns insight for cta_changed', () => {
            const diff = createMockDiff('cta_changed')
            const insight = generateFallbackInsight(diff)
            expect(insight.confidence).toBe('low')
        })

        it('returns insight for regional_difference', () => {
            const diff = createMockDiff('regional_difference')
            const insight = generateFallbackInsight(diff)
            expect(insight.whyItMatters).toContain('Regional')
            expect(insight.confidence).toBe('medium')
        })

        it('all diff types have required fields', () => {
            const diffTypes: DetectedDiff['type'][] = [
                'price_increase',
                'price_decrease',
                'plan_added',
                'plan_removed',
                'free_tier_removed',
                'free_tier_added',
                'plan_promoted',
                'cta_changed',
                'regional_difference',
            ]

            for (const type of diffTypes) {
                const insight = generateFallbackInsight(createMockDiff(type))
                expect(insight.whyItMatters).toBeTruthy()
                expect(insight.strategicImplications).toBeTruthy()
                expect(insight.recommendedAction).toBeTruthy()
                expect(['high', 'medium', 'low']).toContain(insight.confidence)
            }
        })
    })
})
