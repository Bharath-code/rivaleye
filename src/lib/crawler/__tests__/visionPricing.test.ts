import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted for shared mocks
const { mockPage, mockContext, mockBrowser, mockGenerateContent } = vi.hoisted(() => {
    const page = {
        setViewportSize: vi.fn(),
        goto: vi.fn(),
        waitForTimeout: vi.fn(),
        evaluate: vi.fn(),
        screenshot: vi.fn(),
        close: vi.fn(),
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
    return {
        mockPage: page,
        mockContext: context,
        mockBrowser: browser,
        mockGenerateContent: vi.fn()
    }
})

// Mock Playwright
vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn().mockImplementation(() => Promise.resolve(mockBrowser))
    }
}))

// Mock Gemini
vi.mock('@google/genai', () => ({
    GoogleGenAI: class {
        models = {
            generateContent: mockGenerateContent
        }
    }
}))

// Mock Sharp
vi.mock('sharp', () => ({
    default: vi.fn().mockImplementation(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 1440 }),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('compressed-image'))
    }))
}))

// Mock geoContext
vi.mock('../geoContext', () => ({
    getGeoContextConfig: vi.fn().mockReturnValue({ geolocation: { latitude: 0, longitude: 0 } })
}))

// Import after mocks
import { extractPricingWithVision, extractPricingMultiRegion, closeVisionBrowser } from '../visionPricing'
import { chromium } from 'playwright'

describe('visionPricing', () => {
    let originalEnv: string | undefined

    beforeEach(() => {
        originalEnv = process.env.GEMINI_API_KEY
        process.env.GEMINI_API_KEY = 'test-key'

        vi.resetAllMocks()
        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
        vi.spyOn(console, 'warn').mockImplementation(() => { })

        // Restore mock implementations to return promises
        mockBrowser.isConnected.mockReturnValue(true)
        mockBrowser.newContext.mockResolvedValue(mockContext)
        mockBrowser.close.mockResolvedValue(undefined)

        mockContext.newPage.mockResolvedValue(mockPage)
        mockContext.close.mockResolvedValue(undefined)

        mockPage.setViewportSize.mockResolvedValue(undefined)
        mockPage.goto.mockResolvedValue(undefined)
        mockPage.waitForTimeout.mockResolvedValue(undefined)
        mockPage.evaluate.mockResolvedValue(undefined)
        mockPage.screenshot.mockResolvedValue(Buffer.from('fake-screenshot'))
        mockPage.close.mockResolvedValue(undefined)

        vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as any)
    })

    afterEach(async () => {
        if (originalEnv !== undefined) {
            process.env.GEMINI_API_KEY = originalEnv
        } else {
            delete process.env.GEMINI_API_KEY
        }
        await closeVisionBrowser()
        vi.restoreAllMocks()
    })

    describe('extractPricingWithVision', () => {
        it('returns error if GEMINI_API_KEY is missing', async () => {
            delete process.env.GEMINI_API_KEY
            const result = await extractPricingWithVision('https://test.com')
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('AI_ERROR')
            }
        })

        it('successfully extracts pricing on valid AI response', async () => {
            const mockPricing = {
                currency: 'USD',
                currencySymbol: '$',
                plans: [{ name: 'Pro', price: '$49', priceNumeric: 49, period: 'month', features: [], isHighlighted: true, isFree: false, isEnterprise: false }],
                hasFreeTier: false,
                billingOptions: ['monthly'],
                promotions: [],
                confidence: 'high'
            }

            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify(mockPricing)
            })

            const result = await extractPricingWithVision('https://test.com')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.pricing.currency).toBe('USD')
                expect(result.pricing.plans[0].name).toBe('Pro')
            }
        })

        it('handles case where no plans are found', async () => {
            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify({ currency: 'USD', plans: [], hasFreeTier: false, billingOptions: [], promotions: [], confidence: 'low' })
            })

            const result = await extractPricingWithVision('https://test.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('NO_PRICING')
            }
        })

        it('handles AI response parsing error', async () => {
            mockGenerateContent.mockResolvedValue({
                text: 'Invalid JSON'
            })

            const result = await extractPricingWithVision('https://test.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('AI_ERROR')
            }
        })

        it('handles page load timeout', async () => {
            mockPage.goto.mockRejectedValue(new Error('Timeout of 30000ms exceeded'))

            const result = await extractPricingWithVision('https://test.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('TIMEOUT')
            }
        })
    })

    describe('extractPricingMultiRegion', () => {
        it('extracts from multiple regions', async () => {
            const contexts = [
                { key: 'us', name: 'US', country: 'US', currency: 'USD' },
                { key: 'eu', name: 'EU', country: 'DE', currency: 'EUR' }
            ]

            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify({ currency: 'USD', plans: [{ name: 'Pro', price: '$49' }], hasFreeTier: false, billingOptions: [], promotions: [], confidence: 'high' })
            })

            const results = await extractPricingMultiRegion('https://test.com', contexts as any)

            expect(results.size).toBe(2)
            expect(results.get('us')?.success).toBe(true)
            expect(results.get('eu')?.success).toBe(true)
        })
    })
})
