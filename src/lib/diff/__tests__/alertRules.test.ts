import { describe, it, expect } from 'vitest'
import {
    shouldTriggerAlert,
    filterAlertableDiffs,
    formatAlertContent,
    ALERTABLE_DIFF_TYPES,
} from '../alertRules'
import type { DetectedDiff } from '../pricingDiff'

// Helper to create a mock diff
function createMockDiff(overrides: Partial<DetectedDiff> = {}): DetectedDiff {
    return {
        type: 'price_increase',
        description: 'Pro plan increased from $49 to $79',
        severity: 0.7,
        planName: 'Pro',
        before: '$49/month',
        after: '$79/month',
        ...overrides,
    }
}

describe('alertRules', () => {
    describe('ALERTABLE_DIFF_TYPES', () => {
        it('includes high-signal diff types', () => {
            expect(ALERTABLE_DIFF_TYPES).toContain('price_increase')
            expect(ALERTABLE_DIFF_TYPES).toContain('price_decrease')
            expect(ALERTABLE_DIFF_TYPES).toContain('plan_added')
            expect(ALERTABLE_DIFF_TYPES).toContain('plan_removed')
            expect(ALERTABLE_DIFF_TYPES).toContain('free_tier_removed')
            expect(ALERTABLE_DIFF_TYPES).toContain('free_tier_added')
        })

        it('excludes low-signal diff types', () => {
            expect(ALERTABLE_DIFF_TYPES).not.toContain('cta_changed')
            expect(ALERTABLE_DIFF_TYPES).not.toContain('plan_promoted')
        })
    })

    describe('shouldTriggerAlert', () => {
        it('returns true for valid alertable diff', () => {
            const diff = createMockDiff()
            const decision = shouldTriggerAlert(diff)
            expect(decision.shouldAlert).toBe(true)
        })

        it('returns false for non-alertable diff type', () => {
            const diff = createMockDiff({ type: 'cta_changed' })
            const decision = shouldTriggerAlert(diff)
            expect(decision.shouldAlert).toBe(false)
            expect(decision.reason).toContain('not in alertable types')
        })

        it('returns false when severity is below threshold', () => {
            const diff = createMockDiff({ severity: 0.3 })
            const decision = shouldTriggerAlert(diff)
            expect(decision.shouldAlert).toBe(false)
            expect(decision.reason).toContain('below threshold')
        })

        it('returns false when diff type is suppressed', () => {
            const diff = createMockDiff()
            const decision = shouldTriggerAlert(diff, {
                suppressedTypes: ['price_increase'],
            })
            expect(decision.shouldAlert).toBe(false)
            expect(decision.reason).toContain('suppressed')
        })

        it('returns false within cooldown period', () => {
            const diff = createMockDiff()
            const recentAlert = new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
            const decision = shouldTriggerAlert(diff, {
                lastAlertTimestamp: recentAlert,
            })
            expect(decision.shouldAlert).toBe(false)
            expect(decision.reason).toContain('cooldown')
        })

        it('returns true after cooldown period expires', () => {
            const diff = createMockDiff()
            const oldAlert = new Date(Date.now() - 1000 * 60 * 60 * 48) // 48 hours ago
            const decision = shouldTriggerAlert(diff, {
                lastAlertTimestamp: oldAlert,
            })
            expect(decision.shouldAlert).toBe(true)
        })

        it('maps severity correctly', () => {
            const highSeverity = createMockDiff({ severity: 0.9 })
            expect(shouldTriggerAlert(highSeverity).severity).toBe('high')

            const mediumSeverity = createMockDiff({ severity: 0.6 })
            expect(shouldTriggerAlert(mediumSeverity).severity).toBe('medium')

            const lowSeverity = createMockDiff({ severity: 0.3 })
            // We need to check use mapSeverity directly or via a function that doesn't fail threshold
            // Actually shouldTriggerAlert fails before mapping if severity < 0.5
            // But formatAlertContent calls mapSeverity via buildAlertBody
        })


        it('calculates priority with boost for high-impact types', () => {
            const freeTierRemoved = createMockDiff({
                type: 'free_tier_removed',
                severity: 0.8,
            })
            const decision = shouldTriggerAlert(freeTierRemoved)
            expect(decision.priority).toBeGreaterThanOrEqual(8)
        })
    })

    describe('filterAlertableDiffs', () => {
        it('filters out non-alertable diffs', () => {
            const diffs = [
                createMockDiff({ type: 'price_increase' }),
                createMockDiff({ type: 'cta_changed' }),
                createMockDiff({ type: 'price_decrease' }),
            ]
            const filtered = filterAlertableDiffs(diffs)
            expect(filtered).toHaveLength(2)
        })

        it('sorts by severity (highest first)', () => {
            const diffs = [
                createMockDiff({ severity: 0.6 }),
                createMockDiff({ severity: 0.9 }),
                createMockDiff({ severity: 0.7 }),
            ]
            const filtered = filterAlertableDiffs(diffs)
            expect(filtered[0].severity).toBe(0.9)
        })

        it('limits to maxAlerts', () => {
            const diffs = Array(10)
                .fill(null)
                .map((_, i) => createMockDiff({ severity: 0.5 + i * 0.05 }))
            const filtered = filterAlertableDiffs(diffs, { maxAlerts: 3 })
            expect(filtered).toHaveLength(3)
        })
    })

    describe('formatAlertContent', () => {
        it('formats price increase alert', () => {
            const diff = createMockDiff({ type: 'price_increase' })
            const alert = formatAlertContent(diff, 'Acme Corp')
            expect(alert.title).toBe('Price Increase Detected')
            expect(alert.emoji).toBe('📈')
            expect(alert.headline).toContain('Acme Corp')
        })

        it('formats free tier removed alert with warning emoji', () => {
            const diff = createMockDiff({ type: 'free_tier_removed' })
            const alert = formatAlertContent(diff, 'Competitor')
            expect(alert.emoji).toBe('🚨')
            expect(alert.title).toContain('Free Tier')
        })

        it('includes before/after in body', () => {
            const diff = createMockDiff({
                before: '$49',
                after: '$79',
            })
            const alert = formatAlertContent(diff, 'Test')
            expect(alert.body).toContain('Before')
            expect(alert.body).toContain('After')
        })

        it('handles low severity in formatting', () => {
            const diff = createMockDiff({ severity: 0.3 })
            const alert = formatAlertContent(diff, 'Test')
            expect(alert.body.toLowerCase()).toContain('low')
        })

        it('handles plan_added (no before content)', () => {
            const diff = createMockDiff({ type: 'plan_added', before: null })
            const alert = formatAlertContent(diff, 'Test')
            expect(alert.body).not.toContain('Before')
            expect(alert.body).toContain('After')
        })

        it('handles plan_removed (no after content)', () => {
            const diff = createMockDiff({ type: 'plan_removed', after: null })
            const alert = formatAlertContent(diff, 'Test')
            expect(alert.body).toContain('Before')
            expect(alert.body).not.toContain('After')
        })
    })
})


