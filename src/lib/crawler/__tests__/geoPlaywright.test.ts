import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to ensure mocks are available in the mock factory
const { mockPage, mockBrowser, mockContext } = vi.hoisted(() => {
    const page = {
        setViewportSize: vi.fn(),
        goto: vi.fn(),
        waitForTimeout: vi.fn(),
        evaluate: vi.fn(),
        content: vi.fn(),
        locator: vi.fn(),
        screenshot: vi.fn(),
        close: vi.fn(),
        route: vi.fn(),
    }
    const context = {
        newPage: vi.fn(),
        close: vi.fn(),
    }
    const browser = {
        isConnected: vi.fn(),
        newContext: vi.fn(),
        close: vi.fn(),
    }
    return { mockPage: page, mockBrowser: browser, mockContext: context }
})

vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn().mockImplementation(() => Promise.resolve(mockBrowser))
    }
}))

import { scrapeWithGeoContext, closeGeoBrowser, type GeoScrapeResult } from '../geoPlaywright'
import { chromium } from 'playwright'
import type { PricingContext } from '@/lib/types'

// ──────────────────────────────────────────────────────────────────────────────
// MOCK FACTORIES
// ──────────────────────────────────────────────────────────────────────────────

function createMockContext(overrides: Partial<PricingContext> = {}): PricingContext {
    return {
        key: 'us',
        label: 'United States',
        locale: 'en-US',
        currency: 'USD',
        timezone: 'America/New_York',
        ...overrides,
    }
}

describe('geoPlaywright', () => {
    beforeEach(() => {
        vi.resetAllMocks()

        // Setup default behaviors
        mockPage.goto.mockResolvedValue(undefined)
        mockPage.waitForTimeout.mockResolvedValue(undefined)
        mockPage.evaluate.mockResolvedValue({ plans: [], currency: 'USD', has_free_tier: false, highlighted_plan: null })
        mockPage.content.mockResolvedValue('<html><body>Test content</body></html>')
        mockPage.screenshot.mockResolvedValue(Buffer.from('fake-screenshot'))
        mockPage.close.mockResolvedValue(undefined)
        mockPage.route.mockImplementation((_pattern, handler) => {
            // Don't actually call handler in tests
            return Promise.resolve()
        })
        mockPage.locator.mockReturnValue({
            first: vi.fn().mockReturnThis(),
            isVisible: vi.fn().mockResolvedValue(false),
            screenshot: vi.fn().mockResolvedValue(Buffer.from('section-screenshot')),
        })

        mockContext.newPage.mockResolvedValue(mockPage)
        mockContext.close.mockResolvedValue(undefined)

        mockBrowser.isConnected.mockReturnValue(true)
        mockBrowser.newContext.mockResolvedValue(mockContext)
        mockBrowser.close.mockResolvedValue(undefined)

        vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as any)

        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(async () => {
        await closeGeoBrowser()
        vi.restoreAllMocks()
    })

    describe('scrapeWithGeoContext', () => {
        it('returns EMPTY error when no pricing plans detected', async () => {
            mockPage.evaluate.mockResolvedValue({
                plans: [],
                currency: 'USD',
                has_free_tier: false,
                highlighted_plan: null,
            })

            const result = await scrapeWithGeoContext('https://example.com/pricing', createMockContext())

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('EMPTY')
                expect(result.error).toBe('No pricing plans detected')
            }
        })

        it('returns success when pricing plans are detected', async () => {
            mockPage.evaluate.mockResolvedValue({
                plans: [{ id: 'plan-1', name: 'Pro', price_raw: '$49' }],
                currency: 'USD',
                has_free_tier: false,
                highlighted_plan: 'plan-1',
            })

            const result = await scrapeWithGeoContext('https://example.com/pricing', createMockContext())

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.pricingSchema.plans).toHaveLength(1)
                expect(result.domHash).toBeDefined()
                expect(result.screenshot).toBeDefined()
            }
        })

        it('returns TIMEOUT error when page load times out', async () => {
            mockPage.goto.mockRejectedValue(new Error('Timeout 30000ms exceeded'))

            const result = await scrapeWithGeoContext('https://slow-site.com', createMockContext())

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('TIMEOUT')
            }
        })

        it('returns BLOCKED error when access is denied', async () => {
            mockPage.goto.mockRejectedValue(new Error('403 Forbidden'))

            const result = await scrapeWithGeoContext('https://example.com', createMockContext())

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('BLOCKED')
            }
        })

        it('returns BLOCKED error when explicitly blocked', async () => {
            mockPage.goto.mockRejectedValue(new Error('Access blocked'))

            const result = await scrapeWithGeoContext('https://example.com', createMockContext())

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('BLOCKED')
            }
        })

        it('returns UNKNOWN error for generic errors', async () => {
            mockPage.goto.mockRejectedValue(new Error('Network error'))

            const result = await scrapeWithGeoContext('https://example.com', createMockContext())

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('UNKNOWN')
                expect(result.error).toBe('Network error')
            }
        })

        it('returns UNKNOWN error for non-Error exceptions', async () => {
            mockPage.goto.mockRejectedValue('String error')

            const result = await scrapeWithGeoContext('https://example.com', createMockContext())

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('UNKNOWN')
                expect(result.error).toBe('Unknown error')
            }
        })

        it('creates browser context with geo configuration', async () => {
            mockPage.evaluate.mockResolvedValue({
                plans: [{ id: 'plan-1', name: 'Pro', price_raw: '$49' }],
                currency: 'USD',
                has_free_tier: false,
                highlighted_plan: null,
            })

            await scrapeWithGeoContext('https://example.com', createMockContext({ key: 'us' }))

            expect(mockBrowser.newContext).toHaveBeenCalled()
        })

        it('closes page and context on success', async () => {
            mockPage.evaluate.mockResolvedValue({
                plans: [{ id: 'plan-1', name: 'Pro', price_raw: '$49' }],
                currency: 'USD',
                has_free_tier: false,
                highlighted_plan: null,
            })

            await scrapeWithGeoContext('https://example.com', createMockContext())

            expect(mockPage.close).toHaveBeenCalled()
            expect(mockContext.close).toHaveBeenCalled()
        })

        it('closes page and context on error', async () => {
            mockPage.goto.mockRejectedValue(new Error('Test error'))

            await scrapeWithGeoContext('https://example.com', createMockContext())

            expect(mockPage.close).toHaveBeenCalled()
            expect(mockContext.close).toHaveBeenCalled()
        })

        it('uses domcontentloaded wait strategy for speed', async () => {
            mockPage.evaluate.mockResolvedValue({
                plans: [{ id: 'plan-1', name: 'Pro', price_raw: '$49' }],
                currency: 'USD',
                has_free_tier: false,
                highlighted_plan: null,
            })

            await scrapeWithGeoContext('https://example.com', createMockContext())

            expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
                timeout: 30000,
                waitUntil: 'domcontentloaded',
            })
        })

        it('handles browser launch failure', async () => {
            await closeGeoBrowser()
            vi.mocked(chromium.launch).mockRejectedValueOnce(new Error('Browser launch failed'))

            const result = await scrapeWithGeoContext('https://example.com', createMockContext())

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Browser launch failed')
            }
        })
    })

    describe('closeGeoBrowser', () => {
        it('closes browser instance', async () => {
            // Trigger scrape to create browser instance
            mockPage.evaluate.mockResolvedValue({
                plans: [{ id: 'plan-1', name: 'Pro', price_raw: '$49' }],
                currency: 'USD',
                has_free_tier: false,
                highlighted_plan: null,
            })
            await scrapeWithGeoContext('https://example.com', createMockContext())

            await closeGeoBrowser()

            // Should not throw
        })

        it('handles multiple close calls gracefully', async () => {
            await closeGeoBrowser()
            await closeGeoBrowser()

            // Should not throw
        })
    })
})
