import { describe, it, expect, vi } from 'vitest'

// Mock supabase to avoid env var requirements
vi.mock('@/lib/supabase', () => ({
    createServerClient: vi.fn(() => ({
        from: vi.fn(() => ({
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
    })),
}))

import {
    mapPSIToUnified,
    checkPerformanceChanges,
    formatPerformanceAlertsForNotification,
    type UnifiedPerformanceData,
} from '../performanceAlerts'
import type { PSIResult } from '@/lib/crawler/pageSpeedInsights'

// ──────────────────────────────────────────────────────────────────────────────
// MOCK DATA FACTORIES
// ──────────────────────────────────────────────────────────────────────────────

function createMockPSIResult(overrides: Partial<PSIResult> = {}): PSIResult {
    return {
        url: 'https://example.com',
        fetchTime: new Date().toISOString(),
        categories: {
            performance: 85,
            accessibility: 90,
            bestPractices: 80,
            seo: 95,
        },
        coreWebVitals: {
            lcp: 2500,
            fid: 100,
            cls: 0.1,
            inp: 200,
            ttfb: 500,
        },
        audits: {},
        ...overrides,
    }
}

function createMockUnifiedData(overrides: Partial<UnifiedPerformanceData> = {}): UnifiedPerformanceData {
    return {
        source: 'pagespeed_insights',
        score: 85,
        grade: 'B',
        coreWebVitals: {
            lcp: { value: 2500, status: 'good' },
            fid: { value: 100, status: 'good' },
            cls: { value: 0.1, status: 'good' },
        },
        fetchTime: new Date().toISOString(),
        ...overrides,
    }
}

describe('performanceAlerts', () => {
    describe('mapPSIToUnified', () => {
        it('maps PSI result to unified format correctly', () => {
            const psi = createMockPSIResult({
                categories: { performance: 92, accessibility: 90, bestPractices: 80, seo: 95 },
                coreWebVitals: { lcp: 1800, fid: 50, cls: 0.05, inp: 150, ttfb: 400 },
            })

            const result = mapPSIToUnified(psi)

            expect(result.source).toBe('pagespeed_insights')
            expect(result.score).toBe(92)
            expect(result.grade).toBe('A')
            expect(result.coreWebVitals.lcp.value).toBe(1800)
            expect(result.coreWebVitals.fid.value).toBe(50)
            expect(result.coreWebVitals.cls.value).toBe(0.05)
        })

        it('assigns correct grades based on score', () => {
            // A grade (90+)
            expect(mapPSIToUnified(createMockPSIResult({ categories: { performance: 95, accessibility: 90, bestPractices: 80, seo: 95 } })).grade).toBe('A')

            // B grade (80-89)
            expect(mapPSIToUnified(createMockPSIResult({ categories: { performance: 80, accessibility: 90, bestPractices: 80, seo: 95 } })).grade).toBe('B')

            // C grade (50-79)
            expect(mapPSIToUnified(createMockPSIResult({ categories: { performance: 60, accessibility: 90, bestPractices: 80, seo: 95 } })).grade).toBe('C')

            // D grade (25-49)
            expect(mapPSIToUnified(createMockPSIResult({ categories: { performance: 30, accessibility: 90, bestPractices: 80, seo: 95 } })).grade).toBe('D')

            // F grade (<25)
            expect(mapPSIToUnified(createMockPSIResult({ categories: { performance: 10, accessibility: 90, bestPractices: 80, seo: 95 } })).grade).toBe('F')
        })
    })

    describe('checkPerformanceChanges', () => {
        it('returns empty array when no significant changes', () => {
            const oldData = createMockUnifiedData({ score: 85 })
            const newData = createMockUnifiedData({ score: 87 })

            const alerts = checkPerformanceChanges(oldData, newData)

            expect(alerts).toEqual([])
        })

        it('detects score improvement of 10+ points', () => {
            const oldData = createMockUnifiedData({ score: 70 })
            const newData = createMockUnifiedData({ score: 85 })

            const alerts = checkPerformanceChanges(oldData, newData)

            expect(alerts).toHaveLength(1)
            expect(alerts[0].type).toBe('improvement')
            expect(alerts[0].metric).toBe('Performance Score')
            expect(alerts[0].change).toBe(15)
            expect(alerts[0].severity).toBe('medium')
        })

        it('detects score degradation of 10+ points', () => {
            const oldData = createMockUnifiedData({ score: 85 })
            const newData = createMockUnifiedData({ score: 70 })

            const alerts = checkPerformanceChanges(oldData, newData)

            expect(alerts).toHaveLength(1)
            expect(alerts[0].type).toBe('degradation')
            expect(alerts[0].severity).toBe('high')
            expect(alerts[0].message).toContain('opportunity')
        })

        it('detects LCP degradation of 1000ms+', () => {
            const oldData = createMockUnifiedData({
                coreWebVitals: {
                    lcp: { value: 2000, status: 'good' },
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.1, status: 'good' },
                },
            })
            const newData = createMockUnifiedData({
                coreWebVitals: {
                    lcp: { value: 3500, status: 'needs-improvement' },
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.1, status: 'good' },
                },
            })

            const alerts = checkPerformanceChanges(oldData, newData)

            const lcpAlert = alerts.find(a => a.metric === 'LCP')
            expect(lcpAlert).toBeDefined()
            expect(lcpAlert?.type).toBe('degradation')
            expect(lcpAlert?.severity).toBe('high')
        })

        it('detects LCP improvement of 1000ms+', () => {
            const oldData = createMockUnifiedData({
                coreWebVitals: {
                    lcp: { value: 4000, status: 'poor' },
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.1, status: 'good' },
                },
            })
            const newData = createMockUnifiedData({
                coreWebVitals: {
                    lcp: { value: 2500, status: 'good' },
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.1, status: 'good' },
                },
            })

            const alerts = checkPerformanceChanges(oldData, newData)

            const lcpAlert = alerts.find(a => a.metric === 'LCP')
            expect(lcpAlert).toBeDefined()
            expect(lcpAlert?.type).toBe('improvement')
            expect(lcpAlert?.severity).toBe('medium')
        })

        it('detects CLS degradation of 0.1+', () => {
            const oldData = createMockUnifiedData({
                coreWebVitals: {
                    lcp: { value: 2500, status: 'good' },
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.05, status: 'good' },
                },
            })
            const newData = createMockUnifiedData({
                coreWebVitals: {
                    lcp: { value: 2500, status: 'good' },
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.2, status: 'poor' },
                },
            })

            const alerts = checkPerformanceChanges(oldData, newData)

            const clsAlert = alerts.find(a => a.metric === 'CLS')
            expect(clsAlert).toBeDefined()
            expect(clsAlert?.type).toBe('degradation')
            expect(clsAlert?.message).toContain('Layout shift')
        })

        it('detects CLS improvement of 0.1+', () => {
            const oldData = createMockUnifiedData({
                coreWebVitals: {
                    lcp: { value: 2500, status: 'good' },
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.25, status: 'poor' },
                },
            })
            const newData = createMockUnifiedData({
                coreWebVitals: {
                    lcp: { value: 2500, status: 'good' },
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.08, status: 'good' },
                },
            })

            const alerts = checkPerformanceChanges(oldData, newData)

            const clsAlert = alerts.find(a => a.metric === 'CLS')
            expect(clsAlert).toBeDefined()
            expect(clsAlert?.type).toBe('improvement')
            expect(clsAlert?.severity).toBe('low')
        })

        it('handles null CWV values gracefully', () => {
            const oldData = createMockUnifiedData({
                coreWebVitals: {
                    lcp: { value: null, status: 'unknown' },
                    fid: { value: null, status: 'unknown' },
                    cls: { value: null, status: 'unknown' },
                },
            })
            const newData = createMockUnifiedData({
                coreWebVitals: {
                    lcp: { value: 2500, status: 'good' },
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.1, status: 'good' },
                },
            })

            const alerts = checkPerformanceChanges(oldData, newData)

            // Should not crash, may or may not produce alerts for score change
            expect(Array.isArray(alerts)).toBe(true)
        })

        it('detects multiple changes simultaneously', () => {
            const oldData = createMockUnifiedData({
                score: 90,
                coreWebVitals: {
                    lcp: { value: 2000, status: 'good' },
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.05, status: 'good' },
                },
            })
            const newData = createMockUnifiedData({
                score: 65, // -25 points
                coreWebVitals: {
                    lcp: { value: 4000, status: 'poor' }, // +2000ms
                    fid: { value: 100, status: 'good' },
                    cls: { value: 0.25, status: 'poor' }, // +0.2
                },
            })

            const alerts = checkPerformanceChanges(oldData, newData)

            expect(alerts.length).toBeGreaterThanOrEqual(3)
            expect(alerts.some(a => a.metric === 'Performance Score')).toBe(true)
            expect(alerts.some(a => a.metric === 'LCP')).toBe(true)
            expect(alerts.some(a => a.metric === 'CLS')).toBe(true)
        })
    })

    describe('formatPerformanceAlertsForNotification', () => {
        it('returns empty string when no alerts', () => {
            const result = formatPerformanceAlertsForNotification('Acme Corp', [])
            expect(result).toBe('')
        })

        it('formats degradation alert with downward icon', () => {
            const alerts = [{
                type: 'degradation' as const,
                metric: 'Performance Score',
                oldValue: 85,
                newValue: 70,
                change: -15,
                message: 'Performance degraded by 15 points',
                severity: 'high' as const,
            }]

            const result = formatPerformanceAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('Acme Corp')
            expect(result).toContain('📉')
            expect(result).toContain('15 points')
        })

        it('formats improvement alert with upward icon', () => {
            const alerts = [{
                type: 'improvement' as const,
                metric: 'LCP',
                oldValue: '4000ms',
                newValue: '2500ms',
                change: -1500,
                message: 'Competitor improved LCP by 1500ms',
                severity: 'medium' as const,
            }]

            const result = formatPerformanceAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('📈')
            expect(result).toContain('1500ms')
        })

        it('includes opportunity tip when degradation detected', () => {
            const alerts = [{
                type: 'degradation' as const,
                metric: 'Performance Score',
                oldValue: 85,
                newValue: 70,
                change: -15,
                message: 'Performance degraded',
                severity: 'high' as const,
            }]

            const result = formatPerformanceAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('💡')
            expect(result).toContain('opportunity')
        })

        it('formats multiple alerts correctly', () => {
            const alerts = [
                {
                    type: 'degradation' as const,
                    metric: 'LCP',
                    oldValue: '2000ms',
                    newValue: '3500ms',
                    change: 1500,
                    message: 'LCP slowed by 1500ms',
                    severity: 'high' as const,
                },
                {
                    type: 'improvement' as const,
                    metric: 'CLS',
                    oldValue: '0.25',
                    newValue: '0.08',
                    change: -0.17,
                    message: 'CLS improved',
                    severity: 'low' as const,
                },
            ]

            const result = formatPerformanceAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('📉')
            expect(result).toContain('📈')
            expect(result).toContain('LCP')
            expect(result).toContain('CLS')
        })
    })
})
