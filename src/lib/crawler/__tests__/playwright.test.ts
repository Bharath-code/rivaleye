import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to ensure these are available in the mock factory
const { mockPage, mockBrowser } = vi.hoisted(() => {
    const page = {
        setViewportSize: vi.fn(),
        goto: vi.fn(),
        waitForTimeout: vi.fn(),
        evaluate: vi.fn(),
        locator: vi.fn(),
        close: vi.fn(),
    }
    const browser = {
        isConnected: vi.fn(),
        newPage: vi.fn(),
        close: vi.fn(),
    }
    return { mockPage: page, mockBrowser: browser }
})

vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn().mockImplementation(() => Promise.resolve(mockBrowser))
    }
}))

// Re-import after mock
import { fetchPagePlaywright, closeBrowser } from '../playwright'
import { chromium } from 'playwright'

describe('playwright crawler', () => {
    beforeEach(() => {
        vi.resetAllMocks()

        // Setup default behaviors for every test
        mockPage.setViewportSize.mockResolvedValue(undefined)
        mockPage.goto.mockResolvedValue(undefined)
        mockPage.waitForTimeout.mockResolvedValue(undefined)
        mockPage.evaluate.mockResolvedValue({ markdown: 'a'.repeat(100), rawText: 'a'.repeat(100) })
        mockPage.locator.mockReturnValue({
            first: vi.fn().mockReturnThis(),
            isVisible: vi.fn().mockResolvedValue(false),
            click: vi.fn().mockResolvedValue(undefined)
        })
        mockPage.close.mockResolvedValue(undefined)

        mockBrowser.isConnected.mockReturnValue(true)
        mockBrowser.newPage.mockResolvedValue(mockPage)
        mockBrowser.close.mockResolvedValue(undefined)

        vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as any)

        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
        vi.spyOn(console, 'warn').mockImplementation(() => { })
    })

    afterEach(async () => {
        await closeBrowser()
        vi.restoreAllMocks()
    })

    it('successfully fetches a page', async () => {
        mockPage.evaluate.mockResolvedValue({
            markdown: '# Price Plan\n' + 'a'.repeat(50),
            rawText: 'Price Plan ' + 'a'.repeat(50)
        })

        const result = await fetchPagePlaywright('https://test.com')

        expect(result.success).toBe(true)
    })

    it('handles timeout error', async () => {
        mockPage.goto.mockRejectedValue(new Error('Timeout 30000ms exceeded'))

        const result = await fetchPagePlaywright('https://test.com')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.code).toBe('TIMEOUT')
        }
    })

    it('handles blocked status', async () => {
        mockPage.goto.mockRejectedValue(new Error('Access Denied 403'))

        const result = await fetchPagePlaywright('https://test.com')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.code).toBe('BLOCKED')
        }
    })

    it('returns EMPTY if not enough content extracted', async () => {
        mockPage.evaluate.mockResolvedValue({
            markdown: 'short',
            rawText: 'short'
        })

        const result = await fetchPagePlaywright('https://test.com')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.code).toBe('EMPTY')
        }
    })

    it('handles browser launch failure', async () => {
        // Clear global instance
        await closeBrowser()
        vi.mocked(chromium.launch).mockRejectedValueOnce(new Error('Launch failed'))

        const result = await fetchPagePlaywright('https://test.com')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBe('Launch failed')
        }
    })
})
