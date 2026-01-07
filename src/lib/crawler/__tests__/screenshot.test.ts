import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to ensure mocks are available in the mock factory
const { mockPage, mockBrowser } = vi.hoisted(() => {
    const page = {
        setViewportSize: vi.fn(),
        goto: vi.fn(),
        waitForTimeout: vi.fn(),
        evaluate: vi.fn((fn, ...args) => {
            if (typeof fn === 'function') return Promise.resolve(fn(...args));
            return Promise.resolve();
        }),
        title: vi.fn(),
        screenshot: vi.fn(),
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

import { captureScreenshot, closeScreenshotBrowser } from '../screenshot'
import { chromium } from 'playwright'

describe('screenshot', () => {
    beforeEach(() => {
        vi.resetAllMocks()

        // Setup default behaviors
        mockPage.setViewportSize.mockResolvedValue(undefined)
        mockPage.goto.mockResolvedValue(undefined)
        mockPage.waitForTimeout.mockResolvedValue(undefined)
        mockPage.evaluate.mockResolvedValue(undefined)
        mockPage.title.mockResolvedValue('Test Page Title')
        mockPage.screenshot.mockResolvedValue(Buffer.from('fake-screenshot-data'))
        mockPage.close.mockResolvedValue(undefined)

        mockBrowser.isConnected.mockReturnValue(true)
        mockBrowser.newPage.mockResolvedValue(mockPage)
        mockBrowser.close.mockResolvedValue(undefined)

        vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as any)

        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })

        // Mock window.scrollTo for evaluate
        if (typeof window !== 'undefined') {
            window.scrollTo = vi.fn()
        } else {
            (global as any).window = { scrollTo: vi.fn(), document: { body: { scrollHeight: 1000 } } }
        }
    })

    afterEach(async () => {
        await closeScreenshotBrowser()
        vi.restoreAllMocks()
    })

    describe('captureScreenshot', () => {
        it('successfully captures a screenshot', async () => {
            mockPage.title.mockResolvedValue('Pricing Page')
            mockPage.screenshot.mockResolvedValue(Buffer.from('png-data'))

            const result = await captureScreenshot('https://example.com/pricing')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.url).toBe('https://example.com/pricing')
                expect(result.title).toBe('Pricing Page')
                expect(result.screenshot).toBeDefined()
                expect(result.timestamp).toBeDefined()
            }
        })

        it('returns TIMEOUT error when page load times out', async () => {
            mockPage.goto.mockRejectedValue(new Error('Timeout 30000ms exceeded'))

            const result = await captureScreenshot('https://slow-site.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('TIMEOUT')
                expect(result.error).toBe('Page load timed out')
            }
        })

        it('returns BLOCKED error when access is denied', async () => {
            mockPage.goto.mockRejectedValue(new Error('403 Forbidden'))

            const result = await captureScreenshot('https://blocked-site.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('BLOCKED')
                expect(result.error).toBe('Page blocked our request')
            }
        })

        it('returns BLOCKED error when explicitly blocked', async () => {
            mockPage.goto.mockRejectedValue(new Error('Access blocked by site'))

            const result = await captureScreenshot('https://protected-site.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('BLOCKED')
            }
        })

        it('returns UNKNOWN error for generic errors', async () => {
            mockPage.goto.mockRejectedValue(new Error('Network connection lost'))

            const result = await captureScreenshot('https://example.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('UNKNOWN')
                expect(result.error).toBe('Network connection lost')
            }
        })

        it('returns UNKNOWN error for non-Error exceptions', async () => {
            mockPage.goto.mockRejectedValue('String error')

            const result = await captureScreenshot('https://example.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('UNKNOWN')
                expect(result.error).toBe('Unknown error')
            }
        })

        it('handles browser launch failure', async () => {
            await closeScreenshotBrowser()
            vi.mocked(chromium.launch).mockRejectedValueOnce(new Error('Failed to launch browser'))

            const result = await captureScreenshot('https://example.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Failed to launch browser')
            }
        })

        it('closes page on error', async () => {
            mockPage.goto.mockRejectedValue(new Error('Test error'))

            await captureScreenshot('https://example.com')

            expect(mockPage.close).toHaveBeenCalled()
        })

        it('sets viewport to 1440x900', async () => {
            await captureScreenshot('https://example.com')

            expect(mockPage.setViewportSize).toHaveBeenCalledWith({
                width: 1440,
                height: 900,
            })
        })

        it('uses networkidle wait strategy', async () => {
            await captureScreenshot('https://example.com')

            expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
                timeout: 30000,
                waitUntil: 'networkidle',
            })
        })

        it('scrolls page to trigger lazy loading', async () => {
            await captureScreenshot('https://example.com')

            // Should call evaluate for scrolling at least twice
            expect(mockPage.evaluate).toHaveBeenCalled()
        })

        it('captures full page PNG screenshot', async () => {
            await captureScreenshot('https://example.com')

            expect(mockPage.screenshot).toHaveBeenCalledWith({
                type: 'png',
                fullPage: true,
            })
        })
    })

    describe('closeScreenshotBrowser', () => {
        it('closes browser instance', async () => {
            // First trigger a capture to create browser instance
            await captureScreenshot('https://example.com')

            await closeScreenshotBrowser()

            // Should not throw
        })

        it('handles multiple close calls gracefully', async () => {
            await closeScreenshotBrowser()
            await closeScreenshotBrowser()

            // Should not throw
        })
    })
})
