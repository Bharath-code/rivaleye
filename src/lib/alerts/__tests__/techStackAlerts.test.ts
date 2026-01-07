import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase to avoid env var requirements
vi.mock('@/lib/supabase', () => ({
    createServerClient: vi.fn(() => ({
        from: vi.fn(() => ({
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
    })),
}))

import {
    analyzeTechStackChanges,
    formatTechStackAlertsForNotification,
    type TechStackAlertData,
} from '../techStackAlerts'
import type { DetectedTech, TechCategory } from '@/lib/crawler/techStackDetector'

// ──────────────────────────────────────────────────────────────────────────────
// MOCKS
// ──────────────────────────────────────────────────────────────────────────────

// Mock Gemini AI to avoid API calls
vi.mock('@google/genai', () => ({
    GoogleGenAI: class {
        models = {
            generateContent: vi.fn().mockResolvedValue({
                text: JSON.stringify({
                    addedMessage: 'Added test tech',
                    removedMessage: 'Removed test tech',
                    strategicImplication: 'Strategic move',
                }),
            }),
        }
    },
}))

// ──────────────────────────────────────────────────────────────────────────────
// MOCK DATA FACTORIES
// ──────────────────────────────────────────────────────────────────────────────

function createMockTech(overrides: Partial<DetectedTech> = {}): DetectedTech {
    return {
        name: 'React',
        category: 'framework',
        confidence: 'high',
        evidence: 'Found in page source',
        ...overrides,
    }
}

describe('techStackAlerts', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('analyzeTechStackChanges', () => {
        it('returns empty array when no changes', async () => {
            const techs = [createMockTech({ name: 'React' })]
            const alerts = await analyzeTechStackChanges(techs, techs)
            expect(alerts).toEqual([])
        })

        it('detects added technology', async () => {
            const oldTech: DetectedTech[] = []
            const newTech: DetectedTech[] = [createMockTech({ name: 'Stripe', category: 'payment' })]

            const alerts = await analyzeTechStackChanges(oldTech, newTech)

            expect(alerts).toHaveLength(1)
            expect(alerts[0].type).toBe('added')
            expect(alerts[0].techName).toBe('Stripe')
            expect(alerts[0].category).toBe('payment')
        })

        it('detects removed technology', async () => {
            const oldTech: DetectedTech[] = [createMockTech({ name: 'Intercom', category: 'chat' })]
            const newTech: DetectedTech[] = []

            const alerts = await analyzeTechStackChanges(oldTech, newTech)

            expect(alerts).toHaveLength(1)
            expect(alerts[0].type).toBe('removed')
            expect(alerts[0].techName).toBe('Intercom')
        })

        it('assigns high severity to payment tech changes', async () => {
            const oldTech: DetectedTech[] = []
            const newTech: DetectedTech[] = [createMockTech({ name: 'Stripe', category: 'payment' })]

            const alerts = await analyzeTechStackChanges(oldTech, newTech)

            expect(alerts[0].severity).toBe('high')
        })

        it('assigns medium severity to analytics tech changes', async () => {
            const oldTech: DetectedTech[] = []
            const newTech: DetectedTech[] = [createMockTech({ name: 'Mixpanel', category: 'analytics' })]

            const alerts = await analyzeTechStackChanges(oldTech, newTech)

            expect(alerts[0].severity).toBe('medium')
        })

        it('assigns medium severity to marketing tech changes', async () => {
            const oldTech: DetectedTech[] = []
            const newTech: DetectedTech[] = [createMockTech({ name: 'HubSpot', category: 'marketing' })]

            const alerts = await analyzeTechStackChanges(oldTech, newTech)

            expect(alerts[0].severity).toBe('medium')
        })

        it('assigns low severity to framework tech changes', async () => {
            const oldTech: DetectedTech[] = []
            const newTech: DetectedTech[] = [createMockTech({ name: 'Next.js', category: 'framework' })]

            const alerts = await analyzeTechStackChanges(oldTech, newTech)

            expect(alerts[0].severity).toBe('low')
        })

        it('uses hardcoded meanings for known tech', async () => {
            const oldTech: DetectedTech[] = []
            const newTech: DetectedTech[] = [createMockTech({ name: 'Stripe', category: 'payment' })]

            const alerts = await analyzeTechStackChanges(oldTech, newTech)

            expect(alerts[0].message).toContain('Stripe')
            expect(alerts[0].strategicImplication).toContain('paid')
            expect(alerts[0].aiGenerated).toBeFalsy()
        })

        it('handles multiple changes simultaneously', async () => {
            const oldTech: DetectedTech[] = [
                createMockTech({ name: 'Intercom', category: 'chat' }),
            ]
            const newTech: DetectedTech[] = [
                createMockTech({ name: 'Stripe', category: 'payment' }),
                createMockTech({ name: 'Mixpanel', category: 'analytics' }),
            ]

            const alerts = await analyzeTechStackChanges(oldTech, newTech)

            expect(alerts).toHaveLength(3) // 1 removed + 2 added
            expect(alerts.filter(a => a.type === 'added')).toHaveLength(2)
            expect(alerts.filter(a => a.type === 'removed')).toHaveLength(1)
        })

        it('ignores unchanged technologies', async () => {
            const oldTech: DetectedTech[] = [
                createMockTech({ name: 'React', category: 'framework' }),
                createMockTech({ name: 'Vercel', category: 'hosting' }),
            ]
            const newTech: DetectedTech[] = [
                createMockTech({ name: 'React', category: 'framework' }),
                createMockTech({ name: 'Vercel', category: 'hosting' }),
                createMockTech({ name: 'Stripe', category: 'payment' }),
            ]

            const alerts = await analyzeTechStackChanges(oldTech, newTech)

            expect(alerts).toHaveLength(1)
            expect(alerts[0].techName).toBe('Stripe')
        })
    })

    describe('formatTechStackAlertsForNotification', () => {
        it('returns empty string when no alerts', () => {
            const result = formatTechStackAlertsForNotification('Acme Corp', [])
            expect(result).toBe('')
        })

        it('formats added tech with plus icon', () => {
            const alerts: TechStackAlertData[] = [{
                type: 'added',
                techName: 'Stripe',
                category: 'payment',
                message: 'Added Stripe payment processing',
                strategicImplication: 'Launching paid plans',
                severity: 'high',
            }]

            const result = formatTechStackAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('Acme Corp')
            expect(result).toContain('➕')
            expect(result).toContain('Stripe')
            expect(result).toContain('💡')
        })

        it('formats removed tech with minus icon', () => {
            const alerts: TechStackAlertData[] = [{
                type: 'removed',
                techName: 'Intercom',
                category: 'chat',
                message: 'Removed Intercom',
                strategicImplication: 'Changing support approach',
                severity: 'medium',
            }]

            const result = formatTechStackAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('➖')
            expect(result).toContain('Intercom')
        })

        it('groups added and removed separately', () => {
            const alerts: TechStackAlertData[] = [
                {
                    type: 'added',
                    techName: 'Stripe',
                    category: 'payment',
                    message: 'Added Stripe',
                    strategicImplication: 'Paid plans',
                    severity: 'high',
                },
                {
                    type: 'removed',
                    techName: 'PayPal',
                    category: 'payment',
                    message: 'Removed PayPal',
                    strategicImplication: 'Consolidating payments',
                    severity: 'high',
                },
            ]

            const result = formatTechStackAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('**Added:**')
            expect(result).toContain('**Removed:**')
            expect(result.indexOf('Added:')).toBeLessThan(result.indexOf('Removed:'))
        })

        it('includes strategic implications for added tech', () => {
            const alerts: TechStackAlertData[] = [{
                type: 'added',
                techName: 'Sentry',
                category: 'monitoring',
                message: 'Added Sentry error tracking',
                strategicImplication: 'Improving reliability',
                severity: 'low',
            }]

            const result = formatTechStackAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('Improving reliability')
        })
    })
})
