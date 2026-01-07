import { describe, it, expect, vi } from 'vitest'

// Mock Gemini AI to avoid API calls
vi.mock('@google/genai', () => ({
    GoogleGenAI: class {
        models = {
            generateContent: vi.fn(),
        }
    },
}))

import { generateFallbackInsight, type PricingInsight } from '../pricingInsights'
import type { DetectedDiff } from '../pricingDiff'

// ──────────────────────────────────────────────────────────────────────────────
// MOCK DATA FACTORIES
// ──────────────────────────────────────────────────────────────────────────────

function createMockDiff(overrides: Partial<DetectedDiff> = {}): DetectedDiff {
    return {
        type: 'price_increase',
        planName: 'Pro',
        description: 'Pro plan price increased from $49 to $69',
        before: '$49/mo',
        after: '$69/mo',
        severity: 8,
        isMeaningful: true,
        ...overrides,
    }
}

describe('pricingInsights', () => {
    describe('generateFallbackInsight', () => {
        it('returns insight for price_increase', () => {
            const diff = createMockDiff({ type: 'price_increase' })
            const insight = generateFallbackInsight(diff)

            expect(insight.whyItMatters).toContain('Price increases')
            expect(insight.confidence).toBe('high')
            expect(insight.recommendedAction).toBeTruthy()
        })

        it('returns insight for price_decrease', () => {
            const diff = createMockDiff({ type: 'price_decrease' })
            const insight = generateFallbackInsight(diff)

            expect(insight.whyItMatters).toContain('Price decreases')
            expect(insight.confidence).toBe('high')
            expect(insight.strategicImplications).toContain('market share')
        })

        it('returns insight for plan_added', () => {
            const diff = createMockDiff({ type: 'plan_added' })
            const insight = generateFallbackInsight(diff)

            expect(insight.whyItMatters).toContain('New plans')
            expect(insight.confidence).toBe('medium')
        })

        it('returns insight for plan_removed', () => {
            const diff = createMockDiff({ type: 'plan_removed' })
            const insight = generateFallbackInsight(diff)

            expect(insight.whyItMatters).toContain('Removing')
            expect(insight.recommendedAction).toContain('displaced customers')
        })

        it('returns insight for free_tier_removed', () => {
            const diff = createMockDiff({ type: 'free_tier_removed' })
            const insight = generateFallbackInsight(diff)

            expect(insight.whyItMatters).toContain('major monetization')
            expect(insight.confidence).toBe('high')
            expect(insight.strategicImplications).toContain('product-market fit')
        })

        it('returns insight for free_tier_added', () => {
            const diff = createMockDiff({ type: 'free_tier_added' })
            const insight = generateFallbackInsight(diff)

            expect(insight.whyItMatters).toContain('aggressive acquisition')
            expect(insight.confidence).toBe('high')
        })

        it('returns insight for plan_promoted', () => {
            const diff = createMockDiff({ type: 'plan_promoted' })
            const insight = generateFallbackInsight(diff)

            expect(insight.whyItMatters).toContain('highlighted plan')
            expect(insight.confidence).toBe('medium')
        })

        it('returns insight for cta_changed', () => {
            const diff = createMockDiff({ type: 'cta_changed' })
            const insight = generateFallbackInsight(diff)

            expect(insight.whyItMatters).toContain('CTA changes')
            expect(insight.confidence).toBe('low')
        })

        it('returns insight for regional_difference', () => {
            const diff = createMockDiff({ type: 'regional_difference' })
            const insight = generateFallbackInsight(diff)

            expect(insight.whyItMatters).toContain('Regional')
            expect(insight.confidence).toBe('medium')
        })

        it('includes all required fields', () => {
            const diff = createMockDiff()
            const insight = generateFallbackInsight(diff)

            expect(insight.whyItMatters).toBeDefined()
            expect(insight.strategicImplications).toBeDefined()
            expect(insight.recommendedAction).toBeDefined()
            expect(insight.confidence).toBeDefined()
        })
    })
})
