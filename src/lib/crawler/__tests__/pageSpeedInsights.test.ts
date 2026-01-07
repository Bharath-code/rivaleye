import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getPageSpeedInsights, getPerformanceGrade, getCoreWebVitalsStatus, isPSIKeyConfigured } from '../pageSpeedInsights'

describe('pageSpeedInsights', () => {
    let originalEnv: string | undefined

    beforeEach(() => {
        originalEnv = process.env.GOOGLE_PSI_API_KEY
        vi.resetAllMocks()
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                lighthouseResult: {
                    categories: {
                        performance: { score: 0.95 },
                        accessibility: { score: 0.8 },
                        'best-practices': { score: 0.7 },
                        seo: { score: 0.9 },
                    },
                    audits: {
                        'largest-contentful-paint': { numericValue: 1200 },
                        'cumulative-layout-shift': { numericValue: 0.05 },
                        'server-response-time': { numericValue: 200 },
                    },
                },
                loadingExperience: {
                    metrics: {
                        LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1300 },
                        FIRST_INPUT_DELAY_MS: { percentile: 50 },
                        CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 0.06 },
                    },
                },
            }),
        } as Response)
    })

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.GOOGLE_PSI_API_KEY = originalEnv
        } else {
            delete process.env.GOOGLE_PSI_API_KEY
        }
        vi.restoreAllMocks()
    })

    describe('getPageSpeedInsights', () => {
        it('calls Google PSI API with correct parameters', async () => {
            await getPageSpeedInsights('https://competitor.com')

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('url=https%3A%2F%2Fcompetitor.com'),
                expect.any(Object)
            )
        })

        it('includes API key when configured', async () => {
            process.env.GOOGLE_PSI_API_KEY = 'test-key'
            await getPageSpeedInsights('https://competitor.com')

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('key=test-key'),
                expect.any(Object)
            )
        })

        it('returns success and parsed data on valid response', async () => {
            const result = await getPageSpeedInsights('https://competitor.com')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.categories.performance).toBe(95)
                expect(result.coreWebVitals.lcp).toBe(1300)
            }
        })

        it('handles API errors gracefully', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: false,
                status: 429,
                json: async () => ({ error: { message: 'Quota exceeded' } }),
            } as Response)

            const result = await getPageSpeedInsights('https://competitor.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('RATE_LIMITED')
            }
        })

        it('handles bad request error', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: false,
                status: 400,
                json: async () => ({ error: { message: 'Invalid URL' } }),
            } as Response)

            const result = await getPageSpeedInsights('https://competitor.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('INVALID_URL')
            }
        })

        it('handles network timeout', async () => {
            const abortError = new Error('Abort')
            abortError.name = 'AbortError'
            vi.spyOn(global, 'fetch').mockRejectedValue(abortError)

            const result = await getPageSpeedInsights('https://competitor.com')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.code).toBe('TIMEOUT')
            }
        })
    })

    describe('getPerformanceGrade', () => {
        it('returns correct grades for scores', () => {
            expect(getPerformanceGrade(95)).toBe('A')
            expect(getPerformanceGrade(80)).toBe('B')
            expect(getPerformanceGrade(60)).toBe('C')
            expect(getPerformanceGrade(30)).toBe('D')
            expect(getPerformanceGrade(10)).toBe('F')
        })
    })

    describe('getCoreWebVitalsStatus', () => {
        it('returns good status for competitive metrics', () => {
            const status = getCoreWebVitalsStatus({
                lcp: 1000,
                fid: 50,
                cls: 0.05,
                fcp: 800,
                ttfb: 100,
                inp: null
            })
            expect(status.lcp).toBe('good')
            expect(status.fid).toBe('good')
            expect(status.cls).toBe('good')
        })

        it('returns poor status for slow metrics', () => {
            const status = getCoreWebVitalsStatus({
                lcp: 5000,
                fid: 500,
                cls: 0.5,
                fcp: 3000,
                ttfb: 2000,
                inp: null
            })
            expect(status.lcp).toBe('poor')
            expect(status.fid).toBe('poor')
            expect(status.cls).toBe('poor')
        })
    })

    describe('isPSIKeyConfigured', () => {
        it('returns true when key exists', () => {
            process.env.GOOGLE_PSI_API_KEY = 'something'
            expect(isPSIKeyConfigured()).toBe(true)
        })

        it('returns false when key missing', () => {
            delete process.env.GOOGLE_PSI_API_KEY
            expect(isPSIKeyConfigured()).toBe(false)
        })
    })
})
