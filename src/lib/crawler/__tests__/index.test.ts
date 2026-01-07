import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPageWithFallback, fetchPageWithRetry } from '../index'
import { fetchPage as fetchFirecrawl } from '../firecrawl'
import { fetchPageCheerio } from '../cheerio'
import { fetchPagePlaywright } from '../playwright'

vi.mock('../firecrawl', () => ({
    fetchPage: vi.fn(),
}))

vi.mock('../cheerio', () => ({
    fetchPageCheerio: vi.fn(),
}))

vi.mock('../playwright', () => ({
    fetchPagePlaywright: vi.fn(),
    closeBrowser: vi.fn(),
}))

describe('Crawler Orchestrator', () => {
    let originalFirecrawlKey: string | undefined

    beforeEach(() => {
        originalFirecrawlKey = process.env.FIRECRAWL_API_KEY
        vi.resetAllMocks()
        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(() => {
        if (originalFirecrawlKey !== undefined) {
            process.env.FIRECRAWL_API_KEY = originalFirecrawlKey
        } else {
            delete process.env.FIRECRAWL_API_KEY
        }
        vi.restoreAllMocks()
    })

    describe('fetchPageWithFallback', () => {
        it('uses Firecrawl as first tier if available', async () => {
            process.env.FIRECRAWL_API_KEY = 'test-key'
            vi.mocked(fetchFirecrawl).mockResolvedValue({
                success: true,
                url: 'https://test.com',
                rawText: 'Firecrawl content',
                hash: 'hash1',
                timestamp: new Date().toISOString()
            })

            const result = await fetchPageWithFallback('https://test.com')

            expect(result.success).toBe(true)
            if (result.success && 'source' in result) {
                expect(result.source).toBe('firecrawl')
            }
            expect(fetchFirecrawl).toHaveBeenCalled()
            expect(fetchPageCheerio).not.toHaveBeenCalled()
        })

        it('falls back to Cheerio if Firecrawl fails', async () => {
            process.env.FIRECRAWL_API_KEY = 'test-key'
            vi.mocked(fetchFirecrawl).mockResolvedValue({
                success: false,
                error: 'Firecrawl failed',
                code: 'API_ERROR'
            })
            vi.mocked(fetchPageCheerio).mockResolvedValue({
                success: true,
                url: 'https://test.com',
                rawText: 'Cheerio content with $100 price and enough length to pass the quality check.',
                hash: 'hash2',
                timestamp: new Date().toISOString()
            })

            const result = await fetchPageWithFallback('https://test.com')

            expect(result.success).toBe(true)
            if (result.success && 'source' in result) {
                expect(result.source).toBe('cheerio')
            }
            expect(fetchFirecrawl).toHaveBeenCalled()
            expect(fetchPageCheerio).toHaveBeenCalled()
        })

        it('falls back to Playwright if Cheerio content quality is low', async () => {
            vi.mocked(fetchPageCheerio).mockResolvedValue({
                success: true,
                url: 'https://test.com',
                rawText: 'Too short',
                hash: 'hash2',
                timestamp: new Date().toISOString()
            })
            vi.mocked(fetchPagePlaywright).mockResolvedValue({
                success: true,
                url: 'https://test.com',
                rawText: 'Playwright full content',
                hash: 'hash3',
                timestamp: new Date().toISOString()
            })

            const result = await fetchPageWithFallback('https://test.com')

            expect(result.success).toBe(true)
            if (result.success && 'source' in result) {
                expect(result.source).toBe('playwright')
            }
            expect(fetchPagePlaywright).toHaveBeenCalled()
        })

        it('returns final error if all tiers fail', async () => {
            vi.mocked(fetchPageCheerio).mockResolvedValue({
                success: false,
                error: 'Cheerio failed',
                code: 'NETWORK_ERROR'
            })
            vi.mocked(fetchPagePlaywright).mockResolvedValue({
                success: false,
                error: 'Playwright failed',
                code: 'BROWSER_ERROR'
            })

            const result = await fetchPageWithFallback('https://test.com')

            expect(result.success).toBe(false)
            if (!result.success && 'source' in result) {
                expect(result.source).toBe('playwright')
                expect(result.code).toBe('BROWSER_ERROR')
            }
        })
    })

    describe('fetchPageWithRetry', () => {
        it('retries on failure and eventually succeeds', async () => {
            // Setup sequence of results for Playwright (since Cheerio always fails in this test)
            vi.mocked(fetchPageCheerio).mockResolvedValue({
                success: false,
                error: 'Fail',
                code: 'UNKNOWN'
            })

            vi.mocked(fetchPagePlaywright)
                .mockResolvedValueOnce({ success: false, error: 'Fail', code: 'UNKNOWN' })
                .mockResolvedValueOnce({
                    success: true,
                    url: 'https://test.com',
                    rawText: 'Success',
                    hash: 'h',
                    timestamp: 't'
                })

            const result = await fetchPageWithRetry('https://test.com', 2)

            expect(result.success).toBe(true)
            expect(fetchPagePlaywright).toHaveBeenCalledTimes(2)
        })

        it('stops retrying on BLOCKED code', async () => {
            vi.mocked(fetchPageCheerio).mockResolvedValue({
                success: false,
                error: 'Blocked',
                code: 'BLOCKED'
            })
            vi.mocked(fetchPagePlaywright).mockResolvedValue({
                success: false,
                error: 'Blocked',
                code: 'BLOCKED'
            })

            await fetchPageWithRetry('https://test.com', 3)

            // Should only call once because BLOCKED is terminal
            expect(fetchPageCheerio).toHaveBeenCalledTimes(1)
        })
    })
})
