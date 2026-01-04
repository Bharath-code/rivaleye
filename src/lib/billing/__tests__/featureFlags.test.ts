import { describe, it, expect } from 'vitest'
import {
    getFeatureFlags,
    canPerformAction,
    PLAN_LIMITS,
    type UserPlan,
} from '../featureFlags'

describe('featureFlags', () => {
    describe('getFeatureFlags', () => {
        it('returns free tier limits by default', () => {
            const flags = getFeatureFlags()
            expect(flags.maxCompetitors).toBe(1)
            expect(flags.canViewAiInsights).toBe(false)
            expect(flags.canViewGraphs).toBe(false)
            expect(flags.alertHistoryDays).toBe(7)
        })

        it('returns free tier limits for "free" plan', () => {
            const flags = getFeatureFlags('free')
            expect(flags.maxCompetitors).toBe(1)
            expect(flags.maxRegions).toBe(1)
            expect(flags.canUseGeoAware).toBe(false)
            expect(flags.manualChecksPerDay).toBe(1)
        })

        it('returns pro tier limits for "pro" plan', () => {
            const flags = getFeatureFlags('pro')
            expect(flags.maxCompetitors).toBe(5)
            expect(flags.maxRegions).toBe(4)
            expect(flags.canUseGeoAware).toBe(true)
            expect(flags.canViewAiInsights).toBe(true)
            expect(flags.canViewScreenshots).toBe(true)
            expect(flags.canViewGraphs).toBe(true)
            expect(flags.canViewRadar).toBe(true)
            expect(flags.manualChecksPerDay).toBe(5)
        })

        it('returns enterprise tier limits for "enterprise" plan', () => {
            const flags = getFeatureFlags('enterprise')
            expect(flags.maxCompetitors).toBe(50)
            expect(flags.manualChecksPerDay).toBe(50)
            expect(flags.scheduledCrawlsPerDay).toBe(500)
        })

        it('falls back to free tier for invalid plan', () => {
            const flags = getFeatureFlags('invalid' as UserPlan)
            expect(flags.maxCompetitors).toBe(1)
        })
    })

    describe('canPerformAction', () => {
        it('allows adding first competitor on free plan', () => {
            const result = canPerformAction('addCompetitor', 0, 'free')
            expect(result.allowed).toBe(true)
        })

        it('blocks adding second competitor on free plan', () => {
            const result = canPerformAction('addCompetitor', 1, 'free')
            expect(result.allowed).toBe(false)
            expect(result.reason).toContain('limit')
        })

        it('allows adding up to 5 competitors on pro plan', () => {
            expect(canPerformAction('addCompetitor', 0, 'pro').allowed).toBe(true)
            expect(canPerformAction('addCompetitor', 4, 'pro').allowed).toBe(true)
        })

        it('blocks adding 6th competitor on pro plan', () => {
            const result = canPerformAction('addCompetitor', 5, 'pro')
            expect(result.allowed).toBe(false)
        })
    })

    describe('PLAN_LIMITS', () => {
        it('has all required properties for each plan', () => {
            const requiredProps = [
                'maxCompetitors',
                'maxPagesPerCompetitor',
                'maxRegions',
                'canUseGeoAware',
                'canViewAiInsights',
                'canViewScreenshots',
                'alertHistoryDays',
                'checkFrequency',
                'supportPriority',
                'manualChecksPerDay',
                'scheduledCrawlsPerDay',
                'canViewGraphs',
                'canViewRadar',
            ]

            for (const plan of ['free', 'pro', 'enterprise'] as const) {
                for (const prop of requiredProps) {
                    expect(PLAN_LIMITS[plan]).toHaveProperty(prop)
                }
            }
        })
    })
})
