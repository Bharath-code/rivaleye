import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    decideScraper,
    isFirecrawlAvailable,
    shouldUpgradeToPlaywright,
    determinebestScraper,
} from '../decideScraper'
import type { PricingContext, PricingSnapshot } from '@/lib/types'

// Helper to create mock PricingContext
function createMockContext(overrides: Partial<PricingContext> = {}): PricingContext {
    return {
        key: 'us',
        locale: 'en-US',
        timezone: 'America/New_York',
        currency: 'USD',
        requires_browser: false,
        ...overrides,
    } as PricingContext
}

// Helper to create mock PricingSnapshot
function createMockSnapshot(overrides: Partial<PricingSnapshot> = {}): PricingSnapshot {
    return {
        id: 'snapshot-id',
        competitor_id: 'competitor-id',
        source: 'firecrawl',
        created_at: new Date().toISOString(),
        ...overrides,
    } as PricingSnapshot
}

describe('decideScraper', () => {
    describe('decideScraper function', () => {
        it('returns playwright when context requires browser', () => {
            const context = createMockContext({ requires_browser: true })
            const result = decideScraper({
                context,
                lastSnapshot: null,
            })
            expect(result).toBe('playwright')
        })

        it('returns firecrawl for first crawl (no previous snapshot)', () => {
            const context = createMockContext()
            const result = decideScraper({
                context,
                lastSnapshot: null,
            })
            expect(result).toBe('firecrawl')
        })

        it('returns playwright if previous snapshot used playwright', () => {
            const context = createMockContext()
            const lastSnapshot = createMockSnapshot({ source: 'playwright' })
            const result = decideScraper({
                context,
                lastSnapshot,
            })
            expect(result).toBe('playwright')
        })

        it('returns proven best scraper when available', () => {
            const context = createMockContext()
            const lastSnapshot = createMockSnapshot({ source: 'firecrawl' })
            const result = decideScraper({
                context,
                lastSnapshot,
                competitorBestScraper: 'playwright',
            })
            expect(result).toBe('playwright')
        })

        it('returns firecrawl as default', () => {
            const context = createMockContext()
            const lastSnapshot = createMockSnapshot({ source: 'firecrawl' })
            const result = decideScraper({
                context,
                lastSnapshot,
            })
            expect(result).toBe('firecrawl')
        })

        it('prioritizes browser requirement over previous snapshot', () => {
            const context = createMockContext({ requires_browser: true })
            const lastSnapshot = createMockSnapshot({ source: 'firecrawl' })
            const result = decideScraper({
                context,
                lastSnapshot,
                competitorBestScraper: 'firecrawl',
            })
            expect(result).toBe('playwright')
        })
    })

    describe('isFirecrawlAvailable', () => {
        let originalEnv: string | undefined

        beforeEach(() => {
            originalEnv = process.env.FIRECRAWL_API_KEY
        })

        afterEach(() => {
            if (originalEnv !== undefined) {
                process.env.FIRECRAWL_API_KEY = originalEnv
            } else {
                delete process.env.FIRECRAWL_API_KEY
            }
        })

        it('returns true when API key is set', () => {
            process.env.FIRECRAWL_API_KEY = 'test-api-key'
            expect(isFirecrawlAvailable()).toBe(true)
        })

        it('returns false when API key is not set', () => {
            delete process.env.FIRECRAWL_API_KEY
            expect(isFirecrawlAvailable()).toBe(false)
        })

        it('returns false when API key is empty string', () => {
            process.env.FIRECRAWL_API_KEY = ''
            expect(isFirecrawlAvailable()).toBe(false)
        })
    })

    describe('shouldUpgradeToPlaywright', () => {
        it('returns true when content is too short', () => {
            const shortContent = 'a'.repeat(100)
            expect(shouldUpgradeToPlaywright(shortContent, ['$'])).toBe(true)
        })

        it('returns false when content has sufficient length', () => {
            const content = '$99/month for enterprise plan. '.repeat(50) // > 500 chars
            expect(shouldUpgradeToPlaywright(content, ['$'])).toBe(false)
        })

        it('returns true when no pricing numbers detected', () => {
            const content = 'This is some content without any pricing. '.repeat(20)
            expect(shouldUpgradeToPlaywright(content, ['$'])).toBe(true)
        })

        it('returns false when dollar prices detected', () => {
            const content = 'Our pricing starts at $99/mo and goes up to $499/mo. '.repeat(15)
            expect(shouldUpgradeToPlaywright(content, ['$'])).toBe(false)
        })

        it('returns false when euro prices detected', () => {
            const content = 'Pricing: €49 per month for all features included. '.repeat(15)
            expect(shouldUpgradeToPlaywright(content, ['€'])).toBe(false)
        })

        it('returns false when rupee prices detected', () => {
            const content = 'Only ₹999/month for unlimited access to our platform. '.repeat(15)
            expect(shouldUpgradeToPlaywright(content, ['₹'])).toBe(false)
        })

        it('returns false when pound prices detected', () => {
            const content = 'Subscribe for £79/year and get all premium features. '.repeat(15)
            expect(shouldUpgradeToPlaywright(content, ['£'])).toBe(false)
        })

        it('returns true for month/year pattern without expected currency symbol', () => {
            // Content has pricing numbers (99/month) but no $ symbol
            // Since expected currency ($) is not found, should upgrade
            const content = 'Enterprise plan: 99/month, or 999/year for full access. '.repeat(15)
            expect(shouldUpgradeToPlaywright(content, ['$'])).toBe(true)
        })

        it('returns true when expected currency not found', () => {
            const content = '€99/month for premium access to all features available. '.repeat(15)
            expect(shouldUpgradeToPlaywright(content, ['$', 'USD'])).toBe(true)
        })

        it('returns false when expected currency is found', () => {
            const content = '$99/month for premium access to all features available. '.repeat(15)
            expect(shouldUpgradeToPlaywright(content, ['$'])).toBe(false)
        })
    })

    describe('determinebestScraper', () => {
        it('returns null when not enough snapshots', () => {
            const snapshots = [createMockSnapshot()]
            expect(determinebestScraper(snapshots)).toBeNull()
        })

        it('returns null when snapshots empty', () => {
            expect(determinebestScraper([])).toBeNull()
        })

        it('returns firecrawl when consecutive firecrawl snapshots', () => {
            const snapshots = [
                createMockSnapshot({ source: 'firecrawl' }),
                createMockSnapshot({ source: 'firecrawl' }),
            ]
            expect(determinebestScraper(snapshots)).toBe('firecrawl')
        })

        it('returns playwright when consecutive playwright snapshots', () => {
            const snapshots = [
                createMockSnapshot({ source: 'playwright' }),
                createMockSnapshot({ source: 'playwright' }),
            ]
            expect(determinebestScraper(snapshots)).toBe('playwright')
        })

        it('returns null when scrapers are mixed', () => {
            const snapshots = [
                createMockSnapshot({ source: 'firecrawl' }),
                createMockSnapshot({ source: 'playwright' }),
            ]
            expect(determinebestScraper(snapshots)).toBeNull()
        })

        it('uses custom minConsecutive value', () => {
            const snapshots = [
                createMockSnapshot({ source: 'playwright' }),
                createMockSnapshot({ source: 'playwright' }),
                createMockSnapshot({ source: 'playwright' }),
            ]
            expect(determinebestScraper(snapshots, 3)).toBe('playwright')
        })

        it('returns null when not meeting custom minConsecutive', () => {
            const snapshots = [
                createMockSnapshot({ source: 'playwright' }),
                createMockSnapshot({ source: 'playwright' }),
            ]
            expect(determinebestScraper(snapshots, 3)).toBeNull()
        })

        it('only considers first N snapshots', () => {
            const snapshots = [
                createMockSnapshot({ source: 'playwright' }),
                createMockSnapshot({ source: 'playwright' }),
                createMockSnapshot({ source: 'firecrawl' }), // This should be ignored
            ]
            expect(determinebestScraper(snapshots, 2)).toBe('playwright')
        })
    })
})
