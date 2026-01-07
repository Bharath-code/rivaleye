import { describe, it, expect, vi } from 'vitest'

// Mock Playwright to avoid browser launches
vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn(),
    },
}))

import {
    comparePerformance,
    type PerformanceInsights,
    type CoreWebVitals,
    type PerformanceMetrics,
    type ResourceMetrics,
    type PerformanceScore,
} from '../performanceInsights'

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
