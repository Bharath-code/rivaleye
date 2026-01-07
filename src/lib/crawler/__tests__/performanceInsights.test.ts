import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to ensure mocks are available
const { mockPage, mockBrowser, mockContext, mockCdpSession } = vi.hoisted(() => {
    const cdpSession = {
        send: vi.fn(),
    }
    const page = {
        goto: vi.fn(),
        waitForTimeout: vi.fn(),
        evaluate: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
    }
    const context = {
        newPage: vi.fn(),
        newCDPSession: vi.fn(),
        close: vi.fn(),
    }
    const browser = {
        isConnected: vi.fn(),
        newContext: vi.fn(),
        close: vi.fn(),
    }
    return { mockPage: page, mockBrowser: browser, mockContext: context, mockCdpSession: cdpSession }
})

vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn().mockImplementation(() => Promise.resolve(mockBrowser))
    }
}))

import {
    analyzePerformance,
    closePerformanceBrowser,
    comparePerformance,
    type PerformanceInsights,
} from '../performanceInsights'
import { chromium } from 'playwright'

// ──────────────────────────────────────────────────────────────────────────────
// MOCK DATA FACTORIES
// ──────────────────────────────────────────────────────────────────────────────

function createMockInsights(overrides: Partial<PerformanceInsights> = {}): PerformanceInsights {
    return {
        url: 'https://example.com',
        coreWebVitals: {
            lcp: 2500,
            fid: 100,
            cls: 0.1,
            inp: 200,
        },
        metrics: {
            ttfb: 500,
            fcp: 1800,
            domContentLoaded: 2000,
            loadComplete: 3000,
            speedIndex: 2100,
        },
        resources: {
            totalRequests: 50,
            totalSize: 500000,
            jsSize: 200000,
            cssSize: 50000,
            imageSize: 200000,
            fontCount: 3,
            thirdPartyRequests: 10,
        },
        score: {
            overall: 85,
            grade: 'B',
            issues: [],
        },
        extractedAt: new Date().toISOString(),
        ...overrides,
    }
}

describe('performanceInsights', () => {
    beforeEach(() => {
        vi.resetAllMocks()

        mockPage.goto.mockResolvedValue(undefined)
        mockPage.waitForTimeout.mockResolvedValue(undefined)
        mockPage.evaluate.mockResolvedValue({
            ttfb: 500,
            fcp: 1800,
            domContentLoaded: 2000,
            loadComplete: 3000,
            lcp: 2500,
            cls: 0.1,
        })
        mockPage.close.mockResolvedValue(undefined)
        mockPage.on.mockReturnValue(undefined)

        mockCdpSession.send.mockResolvedValue(undefined)

        mockContext.newPage.mockResolvedValue(mockPage)
        mockContext.newCDPSession.mockResolvedValue(mockCdpSession)
        mockContext.close.mockResolvedValue(undefined)

        mockBrowser.isConnected.mockReturnValue(true)
        mockBrowser.newContext.mockResolvedValue(mockContext)
        mockBrowser.close.mockResolvedValue(undefined)

        vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as any)

        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(async () => {
        await closePerformanceBrowser()
        vi.restoreAllMocks()
    })

    describe('analyzePerformance', () => {
        it('returns TIMEOUT error when page load times out', async () => {
            mockPage.goto.mockRejectedValue(new Error('Timeout 60000ms exceeded'))

            const result = await analyzePerformance('https://slow-site.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('TIMEOUT')
            }
        })

        it('returns BLOCKED error when access is denied', async () => {
            mockPage.goto.mockRejectedValue(new Error('403 Forbidden'))

            const result = await analyzePerformance('https://blocked-site.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('BLOCKED')
            }
        })

        it('returns BLOCKED error when explicitly blocked', async () => {
            mockPage.goto.mockRejectedValue(new Error('Access blocked'))

            const result = await analyzePerformance('https://protected-site.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('BLOCKED')
            }
        })

        it('returns UNKNOWN error for generic errors', async () => {
            mockPage.goto.mockRejectedValue(new Error('Network connection lost'))

            const result = await analyzePerformance('https://example.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('UNKNOWN')
                expect(result.error).toBe('Network connection lost')
            }
        })

        it('handles browser launch failure', async () => {
            await closePerformanceBrowser()
            vi.mocked(chromium.launch).mockRejectedValueOnce(new Error('Browser launch failed'))

            const result = await analyzePerformance('https://example.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Browser launch failed')
            }
        })

        it('closes page and context on error', async () => {
            mockPage.goto.mockRejectedValue(new Error('Test error'))

            await analyzePerformance('https://example.com')

            expect(mockPage.close).toHaveBeenCalled()
            expect(mockContext.close).toHaveBeenCalled()
        })
    })

    describe('closePerformanceBrowser', () => {
        it('closes browser instance', async () => {
            await closePerformanceBrowser()
            // Should not throw
        })

        it('handles multiple close calls gracefully', async () => {
            await closePerformanceBrowser()
            await closePerformanceBrowser()
            // Should not throw
        })
    })
    describe('comparePerformance', () => {
        it('returns stable when no significant changes', () => {
            const oldInsights = createMockInsights()
            const newInsights = createMockInsights()

            const diff = comparePerformance(oldInsights, newInsights)

            expect(diff.improved).toHaveLength(0)
            expect(diff.degraded).toHaveLength(0)
            expect(diff.summary).toBe('Performance metrics stable')
        })

        it('detects LCP improvement of 500ms+', () => {
            const oldInsights = createMockInsights({
                coreWebVitals: { lcp: 3500, fid: 100, cls: 0.1, inp: 200 },
            })
            const newInsights = createMockInsights({
                coreWebVitals: { lcp: 2500, fid: 100, cls: 0.1, inp: 200 },
            })

            const diff = comparePerformance(oldInsights, newInsights)

            expect(diff.improved.length).toBeGreaterThan(0)
            expect(diff.improved.some(i => i.includes('LCP'))).toBe(true)
        })

        it('detects LCP degradation of 500ms+', () => {
            const oldInsights = createMockInsights({
                coreWebVitals: { lcp: 2500, fid: 100, cls: 0.1, inp: 200 },
            })
            const newInsights = createMockInsights({
                coreWebVitals: { lcp: 3500, fid: 100, cls: 0.1, inp: 200 },
            })

            const diff = comparePerformance(oldInsights, newInsights)

            expect(diff.degraded.length).toBeGreaterThan(0)
            expect(diff.degraded.some(d => d.includes('LCP'))).toBe(true)
        })

        it('detects CLS improvement', () => {
            const oldInsights = createMockInsights({
                coreWebVitals: { lcp: 2500, fid: 100, cls: 0.2, inp: 200 },
            })
            const newInsights = createMockInsights({
                coreWebVitals: { lcp: 2500, fid: 100, cls: 0.1, inp: 200 },
            })

            const diff = comparePerformance(oldInsights, newInsights)

            expect(diff.improved.some(i => i.includes('CLS'))).toBe(true)
        })

        it('detects CLS degradation', () => {
            const oldInsights = createMockInsights({
                coreWebVitals: { lcp: 2500, fid: 100, cls: 0.1, inp: 200 },
            })
            const newInsights = createMockInsights({
                coreWebVitals: { lcp: 2500, fid: 100, cls: 0.2, inp: 200 },
            })

            const diff = comparePerformance(oldInsights, newInsights)

            expect(diff.degraded.some(d => d.includes('CLS'))).toBe(true)
        })

        it('detects overall score improvement of 10+ points', () => {
            const oldInsights = createMockInsights({
                score: { overall: 70, grade: 'C', issues: [] },
            })
            const newInsights = createMockInsights({
                score: { overall: 85, grade: 'B', issues: [] },
            })

            const diff = comparePerformance(oldInsights, newInsights)

            expect(diff.improved.some(i => i.includes('score'))).toBe(true)
        })

        it('detects overall score degradation of 10+ points', () => {
            const oldInsights = createMockInsights({
                score: { overall: 85, grade: 'B', issues: [] },
            })
            const newInsights = createMockInsights({
                score: { overall: 70, grade: 'C', issues: [] },
            })

            const diff = comparePerformance(oldInsights, newInsights)

            expect(diff.degraded.some(d => d.includes('score'))).toBe(true)
        })

        it('handles null LCP values gracefully', () => {
            const oldInsights = createMockInsights({
                coreWebVitals: { lcp: null, fid: 100, cls: 0.1, inp: 200 },
            })
            const newInsights = createMockInsights({
                coreWebVitals: { lcp: 2500, fid: 100, cls: 0.1, inp: 200 },
            })

            const diff = comparePerformance(oldInsights, newInsights)

            // Should not crash, LCP not compared when one is null
            expect(Array.isArray(diff.improved)).toBe(true)
            expect(Array.isArray(diff.degraded)).toBe(true)
        })

        it('handles null CLS values gracefully', () => {
            const oldInsights = createMockInsights({
                coreWebVitals: { lcp: 2500, fid: 100, cls: null, inp: 200 },
            })
            const newInsights = createMockInsights({
                coreWebVitals: { lcp: 2500, fid: 100, cls: 0.1, inp: 200 },
            })

            const diff = comparePerformance(oldInsights, newInsights)

            expect(Array.isArray(diff.improved)).toBe(true)
        })

        it('summarizes pure improvement correctly', () => {
            const oldInsights = createMockInsights({
                score: { overall: 70, grade: 'C', issues: [] },
            })
            const newInsights = createMockInsights({
                score: { overall: 85, grade: 'B', issues: [] },
            })

            const diff = comparePerformance(oldInsights, newInsights)

            expect(diff.summary).toBe('Performance improved')
        })

        it('summarizes pure degradation correctly', () => {
            const oldInsights = createMockInsights({
                score: { overall: 85, grade: 'B', issues: [] },
            })
            const newInsights = createMockInsights({
                score: { overall: 70, grade: 'C', issues: [] },
            })

            const diff = comparePerformance(oldInsights, newInsights)

            expect(diff.summary).toContain('degraded')
            expect(diff.summary).toContain('opportunity')
        })

        it('summarizes mixed changes correctly', () => {
            const oldInsights = createMockInsights({
                coreWebVitals: { lcp: 2500, fid: 100, cls: 0.05, inp: 200 },
                score: { overall: 85, grade: 'B', issues: [] },
            })
            const newInsights = createMockInsights({
                coreWebVitals: { lcp: 3500, fid: 100, cls: 0.05, inp: 200 }, // LCP worse
                score: { overall: 95, grade: 'A', issues: [] }, // Score better
            })

            const diff = comparePerformance(oldInsights, newInsights)

            expect(diff.summary).toContain('Mixed')
        })
    })
})
