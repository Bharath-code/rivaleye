import { describe, it, expect } from 'vitest'
import { diffPricing, diffRegionalPricing } from '../pricingDiff'
import type { PricingSchema, PricingPlan } from '@/lib/types'

// Helper to create a mock pricing plan
function createMockPlan(overrides: Partial<PricingPlan> = {}): PricingPlan {
    return {
        id: 'plan-1',
        name: 'Pro',
        price_raw: '$49/month',
        price_numeric: 49,
        billing: 'monthly',
        currency: 'USD',
        features: ['Feature 1', 'Feature 2'],
        cta: 'Get Started',
        ...overrides,
    }
}

// Helper to create a mock pricing schema
function createMockSchema(overrides: Partial<PricingSchema> = {}): PricingSchema {
    return {
        plans: [createMockPlan()],
        has_free_tier: false,
        highlighted_plan: null,
        currency: 'USD',
        source_url: 'https://example.com/pricing',
        scraped_at: new Date().toISOString(),
        ...overrides,
    }
}

describe('pricingDiff', () => {
    describe('diffPricing', () => {
        it('returns no changes for initial snapshot (before is null)', () => {
            const after = createMockSchema()
            const result = diffPricing(null, after)
            expect(result.hasMeaningfulChanges).toBe(false)
            expect(result.diffs).toHaveLength(0)
            expect(result.summary).toContain('Initial snapshot')
        })

        it('returns no changes when schemas are identical', () => {
            const before = createMockSchema()
            const after = createMockSchema()
            const result = diffPricing(before, after)
            expect(result.hasMeaningfulChanges).toBe(false)
        })

        describe('free tier changes', () => {
            it('detects free tier removal', () => {
                const before = createMockSchema({ has_free_tier: true })
                const after = createMockSchema({ has_free_tier: false })
                const result = diffPricing(before, after)
                expect(result.hasMeaningfulChanges).toBe(true)
                expect(result.diffs[0].type).toBe('free_tier_removed')
                expect(result.diffs[0].severity).toBe(1.0) // Highest severity
            })

            it('detects free tier addition', () => {
                const before = createMockSchema({ has_free_tier: false })
                const after = createMockSchema({ has_free_tier: true })
                const result = diffPricing(before, after)
                expect(result.hasMeaningfulChanges).toBe(true)
                expect(result.diffs[0].type).toBe('free_tier_added')
            })
        })

        describe('plan changes', () => {
            it('detects plan addition', () => {
                const before = createMockSchema({
                    plans: [createMockPlan({ name: 'Basic' })],
                })
                const after = createMockSchema({
                    plans: [
                        createMockPlan({ name: 'Basic' }),
                        createMockPlan({ name: 'Enterprise', price_raw: '$199/month' }),
                    ],
                })
                const result = diffPricing(before, after)
                expect(result.hasMeaningfulChanges).toBe(true)
                const addedDiff = result.diffs.find(d => d.type === 'plan_added')
                expect(addedDiff).toBeDefined()
                expect(addedDiff?.planName).toBe('Enterprise')
            })

            it('detects plan removal', () => {
                const before = createMockSchema({
                    plans: [
                        createMockPlan({ name: 'Basic' }),
                        createMockPlan({ name: 'Enterprise' }),
                    ],
                })
                const after = createMockSchema({
                    plans: [createMockPlan({ name: 'Basic' })],
                })
                const result = diffPricing(before, after)
                expect(result.hasMeaningfulChanges).toBe(true)
                const removedDiff = result.diffs.find(d => d.type === 'plan_removed')
                expect(removedDiff).toBeDefined()
                expect(removedDiff?.planName).toBe('Enterprise')
            })
        })

        describe('price changes', () => {
            it('detects price increase >= 5%', () => {
                const before = createMockSchema({
                    plans: [createMockPlan({ price_raw: '$49/month' })],
                })
                const after = createMockSchema({
                    plans: [createMockPlan({ price_raw: '$79/month' })],
                })
                const result = diffPricing(before, after)
                expect(result.hasMeaningfulChanges).toBe(true)
                const priceDiff = result.diffs.find(d => d.type === 'price_increase')
                expect(priceDiff).toBeDefined()
                expect(priceDiff?.description).toContain('increased')
            })

            it('detects price decrease >= 5%', () => {
                const before = createMockSchema({
                    plans: [createMockPlan({ price_raw: '$79/month' })],
                })
                const after = createMockSchema({
                    plans: [createMockPlan({ price_raw: '$49/month' })],
                })
                const result = diffPricing(before, after)
                expect(result.hasMeaningfulChanges).toBe(true)
                const priceDiff = result.diffs.find(d => d.type === 'price_decrease')
                expect(priceDiff).toBeDefined()
            })

            it('ignores small price changes < 5%', () => {
                const before = createMockSchema({
                    plans: [createMockPlan({ price_raw: '$49/month' })],
                })
                const after = createMockSchema({
                    plans: [createMockPlan({ price_raw: '$50/month' })], // ~2% change
                })
                const result = diffPricing(before, after)
                const priceDiff = result.diffs.find(d =>
                    d.type === 'price_increase' || d.type === 'price_decrease'
                )
                expect(priceDiff).toBeUndefined()
            })
        })

        describe('highlighted plan changes', () => {
            it('detects promoted plan change', () => {
                const before = createMockSchema({
                    plans: [
                        createMockPlan({ id: 'basic', name: 'Basic' }),
                        createMockPlan({ id: 'pro', name: 'Pro' }),
                    ],
                    highlighted_plan: 'basic',
                })
                const after = createMockSchema({
                    plans: [
                        createMockPlan({ id: 'basic', name: 'Basic' }),
                        createMockPlan({ id: 'pro', name: 'Pro' }),
                    ],
                    highlighted_plan: 'pro',
                })
                const result = diffPricing(before, after)
                const promotedDiff = result.diffs.find(d => d.type === 'plan_promoted')
                expect(promotedDiff).toBeDefined()
            })
        })

        describe('overall severity calculation', () => {
            it('returns 0 severity for no diffs', () => {
                const schema = createMockSchema()
                const result = diffPricing(schema, schema)
                expect(result.overallSeverity).toBe(0)
            })

            it('caps severity at 1.0', () => {
                // Multiple high-severity changes
                const before = createMockSchema({
                    has_free_tier: true,
                    plans: [
                        createMockPlan({ name: 'Pro', price_raw: '$49' }),
                        createMockPlan({ name: 'Enterprise', price_raw: '$199' }),
                    ],
                })
                const after = createMockSchema({
                    has_free_tier: false,
                    plans: [
                        createMockPlan({ name: 'Pro', price_raw: '$99' }),
                    ],
                })
                const result = diffPricing(before, after)
                expect(result.overallSeverity).toBeLessThanOrEqual(1.0)
            })
        })
    })

    describe('diffRegionalPricing', () => {
        it('detects regional price difference >= 10%', () => {
            const contextA = {
                key: 'us',
                schema: createMockSchema({
                    plans: [createMockPlan({ price_raw: '$49/month' })],
                }),
            }
            const contextB = {
                key: 'in',
                schema: createMockSchema({
                    plans: [createMockPlan({ price_raw: '$29/month' })], // ~41% cheaper
                }),
            }
            const diffs = diffRegionalPricing(contextA, contextB)
            expect(diffs.length).toBeGreaterThan(0)
            expect(diffs[0].type).toBe('regional_difference')
            expect(diffs[0].description).toContain('US')
            expect(diffs[0].description).toContain('IN')
        })

        it('ignores small regional differences < 10%', () => {
            const contextA = {
                key: 'us',
                schema: createMockSchema({
                    plans: [createMockPlan({ price_raw: '$49/month' })],
                }),
            }
            const contextB = {
                key: 'eu',
                schema: createMockSchema({
                    plans: [createMockPlan({ price_raw: '$47/month' })], // ~4% difference
                }),
            }
            const diffs = diffRegionalPricing(contextA, contextB)
            expect(diffs.length).toBe(0)
        })

        it('returns empty array when no matching plans', () => {
            const contextA = {
                key: 'us',
                schema: createMockSchema({
                    plans: [createMockPlan({ name: 'Pro US' })],
                }),
            }
            const contextB = {
                key: 'eu',
                schema: createMockSchema({
                    plans: [createMockPlan({ name: 'Pro EU' })],
                }),
            }
            const diffs = diffRegionalPricing(contextA, contextB)
            expect(diffs).toHaveLength(0)
        })
    })
})
