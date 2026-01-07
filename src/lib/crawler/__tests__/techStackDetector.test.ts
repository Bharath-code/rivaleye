import { describe, it, expect, vi } from 'vitest'

// Mock Playwright to avoid browser launches
vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn(),
    },
}))

import {
    compareTechStacks,
    type DetectedTech,
    type TechCategory,
} from '../techStackDetector'

// ──────────────────────────────────────────────────────────────────────────────
// MOCK DATA FACTORIES
// ──────────────────────────────────────────────────────────────────────────────

function createMockTech(overrides: Partial<DetectedTech> = {}): DetectedTech {
    return {
        name: 'React',
        category: 'framework',
        confidence: 'high',
        evidence: 'Found React globals',
        ...overrides,
    }
}

describe('techStackDetector', () => {
    describe('compareTechStacks', () => {
        it('returns no changes when stacks are identical', () => {
            const stack = [createMockTech({ name: 'React' })]
            const diff = compareTechStacks(stack, stack)

            expect(diff.added).toHaveLength(0)
            expect(diff.removed).toHaveLength(0)
            expect(diff.summary).toBe('No tech stack changes')
        })

        it('detects added technology', () => {
            const oldStack: DetectedTech[] = [createMockTech({ name: 'React' })]
            const newStack: DetectedTech[] = [
                createMockTech({ name: 'React' }),
                createMockTech({ name: 'Stripe', category: 'payment' }),
            ]

            const diff = compareTechStacks(oldStack, newStack)

            expect(diff.added).toHaveLength(1)
            expect(diff.added[0].name).toBe('Stripe')
            expect(diff.removed).toHaveLength(0)
            expect(diff.summary).toContain('Added: Stripe')
        })

        it('detects removed technology', () => {
            const oldStack: DetectedTech[] = [
                createMockTech({ name: 'React' }),
                createMockTech({ name: 'Intercom', category: 'chat' }),
            ]
            const newStack: DetectedTech[] = [createMockTech({ name: 'React' })]

            const diff = compareTechStacks(oldStack, newStack)

            expect(diff.added).toHaveLength(0)
            expect(diff.removed).toHaveLength(1)
            expect(diff.removed[0]).toBe('Intercom')
            expect(diff.summary).toContain('Removed: Intercom')
        })

        it('detects both added and removed technologies', () => {
            const oldStack: DetectedTech[] = [
                createMockTech({ name: 'React' }),
                createMockTech({ name: 'Intercom', category: 'chat' }),
            ]
            const newStack: DetectedTech[] = [
                createMockTech({ name: 'React' }),
                createMockTech({ name: 'Stripe', category: 'payment' }),
            ]

            const diff = compareTechStacks(oldStack, newStack)

            expect(diff.added).toHaveLength(1)
            expect(diff.removed).toHaveLength(1)
            expect(diff.summary).toContain('Added: Stripe')
            expect(diff.summary).toContain('Removed: Intercom')
        })

        it('handles empty old stack', () => {
            const oldStack: DetectedTech[] = []
            const newStack: DetectedTech[] = [
                createMockTech({ name: 'React' }),
                createMockTech({ name: 'Stripe' }),
            ]

            const diff = compareTechStacks(oldStack, newStack)

            expect(diff.added).toHaveLength(2)
            expect(diff.removed).toHaveLength(0)
        })

        it('handles empty new stack', () => {
            const oldStack: DetectedTech[] = [
                createMockTech({ name: 'React' }),
                createMockTech({ name: 'Stripe' }),
            ]
            const newStack: DetectedTech[] = []

            const diff = compareTechStacks(oldStack, newStack)

            expect(diff.added).toHaveLength(0)
            expect(diff.removed).toHaveLength(2)
        })

        it('handles multiple additions correctly', () => {
            const oldStack: DetectedTech[] = []
            const newStack: DetectedTech[] = [
                createMockTech({ name: 'Stripe', category: 'payment' }),
                createMockTech({ name: 'Mixpanel', category: 'analytics' }),
                createMockTech({ name: 'Sentry', category: 'monitoring' }),
            ]

            const diff = compareTechStacks(oldStack, newStack)

            expect(diff.added).toHaveLength(3)
            expect(diff.summary).toContain('Stripe')
            expect(diff.summary).toContain('Mixpanel')
            expect(diff.summary).toContain('Sentry')
        })

        it('preserves category information in added technologies', () => {
            const oldStack: DetectedTech[] = []
            const newStack: DetectedTech[] = [
                createMockTech({ name: 'Stripe', category: 'payment', confidence: 'high' }),
            ]

            const diff = compareTechStacks(oldStack, newStack)

            expect(diff.added[0].category).toBe('payment')
            expect(diff.added[0].confidence).toBe('high')
        })
    })
})
