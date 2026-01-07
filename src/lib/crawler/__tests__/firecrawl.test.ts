import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted for FirecrawlApp mock
const { mockScrape } = vi.hoisted(() => ({
    mockScrape: vi.fn()
}))

vi.mock('@mendable/firecrawl-js', () => ({
    default: class {
        scrape = mockScrape
    }
}))

// Import after mocks
import { fetchPage, fetchPageWithRetry } from '../firecrawl'

describe('firecrawl fetcher', () => {
    let originalEnv: string | undefined

    beforeEach(() => {
        originalEnv = process.env.FIRECRAWL_API_KEY
        process.env.FIRECRAWL_API_KEY = 'test-key'
        mockScrape.mockReset()

        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.FIRECRAWL_API_KEY = originalEnv
        } else {
            delete process.env.FIRECRAWL_API_KEY
        }
        vi.restoreAllMocks()
    })

    describe('fetchPage', () => {
        it('returns success:false if API key is missing', async () => {
            delete process.env.FIRECRAWL_API_KEY
            const result = await fetchPage('https://test.com')
            expect(result.success).toBe(false)
            expect(result.error).toContain('Missing FIRECRAWL_API_KEY')
        })

        it('successfully fetches and parses page', async () => {
            const mockMarkdown = '# Test Page\n' + 'a'.repeat(60)
            mockScrape.mockResolvedValue({
                markdown: mockMarkdown
            })

            const result = await fetchPage('https://test.com')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.markdown).toBe(mockMarkdown)
                expect(result.rawText).toContain('Test Page')
            }
        })

        it('handles empty response from Firecrawl', async () => {
            mockScrape.mockResolvedValue(null)
            const result = await fetchPage('https://test.com')
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('API_ERROR')
            }
        })

        it('handles minimal content', async () => {
            mockScrape.mockResolvedValue({ markdown: 'too short' })
            const result = await fetchPage('https://test.com')
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('EMPTY')
            }
        })

        it('handles blocked error', async () => {
            mockScrape.mockRejectedValue(new Error('Blocked by Cloudflare 403'))
            const result = await fetchPage('https://test.com')
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('BLOCKED')
            }
        })

        it('handles time out', async () => {
            mockScrape.mockRejectedValue(new Error('TIMEOUT'))
            const result = await fetchPage('https://test.com')
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('TIMEOUT')
            }
        })
    })

    describe('fetchPageWithRetry', () => {
        it('retries on failure', async () => {
            mockScrape
                .mockRejectedValueOnce(new Error('API error'))
                .mockResolvedValueOnce({
                    markdown: '# Success after retry\n' + 'a'.repeat(60)
                })

            const result = await fetchPageWithRetry('https://test.com')
            expect(result.success).toBe(true)
            expect(mockScrape).toHaveBeenCalledTimes(2)
        })

        it('stops retrying on BLOCKED', async () => {
            mockScrape.mockRejectedValue(new Error('403 Forbidden'))
            await fetchPageWithRetry('https://test.com', 3)
            expect(mockScrape).toHaveBeenCalledTimes(1)
        })
    })
})
