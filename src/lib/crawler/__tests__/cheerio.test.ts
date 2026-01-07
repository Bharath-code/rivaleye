import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPageCheerio } from '../cheerio'

describe('cheerio crawler', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        vi.spyOn(global, 'fetch')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('successfully fetches and parses a simple page', async () => {
        const mockHtml = `
            <html>
                <head><title>Test</title></head>
                <body>
                    <h1>This is a very long title that should be extracted</h1>
                    <p>This is a test paragraph with enough text to be extracted.</p>
                    <div class="price">$99/mo</div>
                    <table>
                        <tr><th>Plan</th><th>Cost</th></tr>
                        <tr><td>Pro</td><td>$99</td></tr>
                    </table>
                </body>
            </html>
        `

        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve(mockHtml)
        } as any)

        const result = await fetchPageCheerio('https://test.com')

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.markdown).toContain('# This is a very long title')
            expect(result.markdown).toContain('$99/mo')
            expect(result.markdown).toContain('| Pro | $99 |')
        }
    })

    it('handles HTTP error status', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 404,
            text: () => Promise.resolve('Not Found')
        } as any)

        const result = await fetchPageCheerio('https://test.com')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.code).toBe('API_ERROR')
        }
    })

    it('handles blocked status (403)', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 403,
            text: () => Promise.resolve('Forbidden')
        } as any)

        const result = await fetchPageCheerio('https://test.com')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.code).toBe('BLOCKED')
        }
    })

    it('handles timeout', async () => {
        const abortError = new Error('The operation was aborted')
        abortError.name = 'AbortError'

        vi.mocked(fetch).mockRejectedValue(abortError)

        const result = await fetchPageCheerio('https://test.com')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.code).toBe('TIMEOUT')
        }
    })

    it('returns EMPTY if not enough content extracted', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<html><body>short</body></html>')
        } as any)

        const result = await fetchPageCheerio('https://test.com')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.code).toBe('EMPTY')
        }
    })

    it('handles unknown fetch error', async () => {
        vi.mocked(fetch).mockRejectedValue(new Error('Network crash'))

        const result = await fetchPageCheerio('https://test.com')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.code).toBe('UNKNOWN')
        }
    })
})
