import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    compareRegionalPricing,
    createRegionalDiffAlert,
    type RegionalComparisonResult,
} from '../compareRegionalPricing'
import type { PricingSchema } from '@/lib/types'

// Mock the currency module
vi.mock('@/lib/currency', () => ({
    getRateToUsd: vi.fn().mockResolvedValue(1), // Default: 1 USD = 1 USD
}))

import { getRateToUsd } from '@/lib/currency'

// Helper to create mock PricingSchema
function createMockPricingSchema(plans: { name: string; price_raw: string | null }[]): PricingSchema {
    return {
        plans: plans.map(p => ({
            name: p.name,
            price_raw: p.price_raw,
            price: 0,
            period: 'monthly',
            features: [],
            cta: 'Get Started',
        })),
        currency: 'USD',
        has_free_tier: false,
        extracted_at: new Date().toISOString(),
    }
}

// Helper to create regional snapshot
function createMockSnapshot(region: string, currency: string, plans: { name: string; price_raw: string | null }[]) {
    return {
        region,
        pricingSchema: createMockPricingSchema(plans),
        currency,
        snapshotId: `snapshot-${region}`,
    }
}

describe('compareRegionalPricing', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        vi.mocked(getRateToUsd).mockResolvedValue(1)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('basic functionality', () => {
        it('returns no differences when less than 2 regions', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$99/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.hasRegionalDifferences).toBe(false)
            expect(result.differences).toHaveLength(0)
            expect(result.summary).toContain('Insufficient')
        })

        it('returns no differences when empty snapshots', async () => {
            const result = await compareRegionalPricing([])

            expect(result.hasRegionalDifferences).toBe(false)
        })

        it('detects no differences when prices are same', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$99/mo' }]),
                createMockSnapshot('eu', 'USD', [{ name: 'Pro', price_raw: '$99/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.hasRegionalDifferences).toBe(false)
            expect(result.summary).toContain('No significant')
        })
    })

    describe('regional difference detection', () => {
        it('detects discount in comparing region', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$100/mo' }]),
                createMockSnapshot('in', 'USD', [{ name: 'Pro', price_raw: '$50/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.hasRegionalDifferences).toBe(true)
            expect(result.differences).toHaveLength(1)
            expect(result.differences[0].isDiscount).toBe(true)
            expect(result.differences[0].priceDifferencePercent).toBe(-50)
        })

        it('detects premium in comparing region', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$100/mo' }]),
                createMockSnapshot('eu', 'USD', [{ name: 'Pro', price_raw: '$150/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.hasRegionalDifferences).toBe(true)
            expect(result.differences[0].isDiscount).toBe(false)
            expect(result.differences[0].priceDifferencePercent).toBe(50)
        })

        it('ignores differences below 10%', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$100/mo' }]),
                createMockSnapshot('eu', 'USD', [{ name: 'Pro', price_raw: '$105/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.hasRegionalDifferences).toBe(false)
        })

        it('uses US as baseline when available', async () => {
            const snapshots = [
                createMockSnapshot('eu', 'USD', [{ name: 'Pro', price_raw: '$120/mo' }]),
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$100/mo' }]),
                createMockSnapshot('in', 'USD', [{ name: 'Pro', price_raw: '$80/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            // Both EU and IN should compare to US
            expect(result.differences.length).toBeGreaterThanOrEqual(2)
            expect(result.differences.every(d => d.baseRegion === 'US')).toBe(true)
        })
    })

    describe('severity calculation', () => {
        it('sets high severity for differences >= 30%', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$100/mo' }]),
                createMockSnapshot('in', 'USD', [{ name: 'Pro', price_raw: '$50/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.differences[0].severity).toBe('high')
        })

        it('sets medium severity for differences >= 20%', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$100/mo' }]),
                createMockSnapshot('in', 'USD', [{ name: 'Pro', price_raw: '$75/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.differences[0].severity).toBe('medium')
        })

        it('sets low severity for differences >= 10%', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$100/mo' }]),
                createMockSnapshot('in', 'USD', [{ name: 'Pro', price_raw: '$85/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.differences[0].severity).toBe('low')
        })
    })

    describe('currency conversion', () => {
        it('converts prices to USD for comparison', async () => {
            vi.mocked(getRateToUsd).mockImplementation(async (currency) => {
                if (currency === 'EUR') return 1.1 // 1 EUR = 1.1 USD
                if (currency === 'INR') return 0.012 // 1 INR = 0.012 USD
                return 1
            })

            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$100/mo' }]),
                createMockSnapshot('eu', 'EUR', [{ name: 'Pro', price_raw: '€90/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            // €90 * 1.1 = $99, which is within 10% of $100
            expect(result.hasRegionalDifferences).toBe(false)
        })
    })

    describe('plan matching', () => {
        it('compares same plans case-insensitively', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'PRO', price_raw: '$100/mo' }]),
                createMockSnapshot('in', 'USD', [{ name: 'pro', price_raw: '$50/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.hasRegionalDifferences).toBe(true)
        })

        it('compares same plans with whitespace differences', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: '  Pro  ', price_raw: '$100/mo' }]),
                createMockSnapshot('in', 'USD', [{ name: 'Pro', price_raw: '$50/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.hasRegionalDifferences).toBe(true)
        })

        it('handles multiple plans', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [
                    { name: 'Starter', price_raw: '$50/mo' },
                    { name: 'Pro', price_raw: '$100/mo' },
                ]),
                createMockSnapshot('in', 'USD', [
                    { name: 'Starter', price_raw: '$25/mo' },
                    { name: 'Pro', price_raw: '$50/mo' },
                ]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.differences.length).toBe(2)
        })

        it('skips plans without prices', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: null }]),
                createMockSnapshot('in', 'USD', [{ name: 'Pro', price_raw: '$50/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.hasRegionalDifferences).toBe(false)
        })
    })

    describe('summary generation', () => {
        it('includes discount regions in summary', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$100/mo' }]),
                createMockSnapshot('in', 'USD', [{ name: 'Pro', price_raw: '$50/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.summary).toContain('Hidden discounts')
            expect(result.summary).toContain('IN')
        })

        it('includes premium regions in summary', async () => {
            const snapshots = [
                createMockSnapshot('us', 'USD', [{ name: 'Pro', price_raw: '$100/mo' }]),
                createMockSnapshot('eu', 'USD', [{ name: 'Pro', price_raw: '$150/mo' }]),
            ]

            const result = await compareRegionalPricing(snapshots)

            expect(result.summary).toContain('Premium pricing')
            expect(result.summary).toContain('EU')
        })
    })
})

describe('createRegionalDiffAlert', () => {
    it('creates discount alert correctly', () => {
        const diff = {
            planName: 'pro',
            baseRegion: 'US',
            basePrice: 100,
            comparingRegion: 'IN',
            comparingPrice: 50,
            priceDifferencePercent: -50,
            isDiscount: true,
            severity: 'high' as const,
        }

        const alert = createRegionalDiffAlert(diff, 'Competitor Inc')

        expect(alert.type).toBe('regional_difference')
        expect(alert.severity).toBe('high')
        expect(alert.description).toContain('50%')
        expect(alert.description).toContain('lower')
        expect(alert.description).toContain('IN')
    })

    it('creates premium alert correctly', () => {
        const diff = {
            planName: 'pro',
            baseRegion: 'US',
            basePrice: 100,
            comparingRegion: 'EU',
            comparingPrice: 150,
            priceDifferencePercent: 50,
            isDiscount: false,
            severity: 'medium' as const,
        }

        const alert = createRegionalDiffAlert(diff, 'Competitor Inc')

        expect(alert.description).toContain('more')
        expect(alert.description).toContain('EU')
    })

    it('includes before/after with regions', () => {
        const diff = {
            planName: 'pro',
            baseRegion: 'US',
            basePrice: 99.99,
            comparingRegion: 'IN',
            comparingPrice: 49.99,
            priceDifferencePercent: -50,
            isDiscount: true,
            severity: 'high' as const,
        }

        const alert = createRegionalDiffAlert(diff, 'Test')

        expect(alert.before).toContain('$99.99')
        expect(alert.before).toContain('US')
        expect(alert.after).toContain('$49.99')
        expect(alert.after).toContain('IN')
    })
})
