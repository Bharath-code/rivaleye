import { describe, it, expect } from 'vitest'
import { isMeaningful } from '../isMeaningful'
import type { DiffResult } from '@/lib/types'

// Helper to create a diff with specific changed text
function createDiff(oldText: string, newText: string): DiffResult {
    return {
        hasChanges: true,
        changedBlocks: [{ oldText, newText }],
    }
}

describe('isMeaningful', () => {
    describe('basic behavior', () => {
        it('returns false for empty diff', () => {
            const diff: DiffResult = { hasChanges: false, changedBlocks: [] }
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(false)
        })
    })

    describe('pricing detection', () => {
        it('detects dollar amount changes', () => {
            const diff = createDiff('Pro plan $49', 'Pro plan $79')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('pricing')
        })

        it('detects euro amount changes', () => {
            const diff = createDiff('€49/month', '€79/month')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('pricing')
        })

        it('detects percentage discounts', () => {
            const diff = createDiff('10% off', '20% off')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('pricing')
        })

        it('detects free trial mentions', () => {
            const diff = createDiff('', 'Start your free trial')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('pricing')
        })
    })

    describe('plan detection', () => {
        it('detects plan tier changes', () => {
            const diff = createDiff('Basic plan', 'Pro plan')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('plan')
        })

        it('detects enterprise tier mention', () => {
            const diff = createDiff('', 'Enterprise tier now available')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('plan')
        })

        it('detects upgrade mentions', () => {
            const diff = createDiff('', 'Upgrade to unlock more features')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('plan')
        })
    })

    describe('CTA detection', () => {
        it('detects "Get started" CTA', () => {
            // Use text without 'free' which matches plan keywords
            const diff = createDiff('Learn more', 'Get started now')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('cta')
        })

        it('detects "Contact sales" CTA', () => {
            // Use text without 'pricing' which matches pricing keywords
            const diff = createDiff('', 'Contact sales today')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('cta')
        })

        it('detects "Book a demo" CTA', () => {
            const diff = createDiff('', 'Book a demo today')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('cta')
        })
    })

    describe('feature detection', () => {
        it('detects feature list changes', () => {
            const diff = createDiff('5 GB storage', '10 GB storage')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('feature')
        })

        it('detects checkmark symbols', () => {
            const diff = createDiff('❌ API access', '✅ API access')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('feature')
        })

        it('detects unlimited mentions', () => {
            const diff = createDiff('5 users', 'Unlimited users')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('feature')
        })
    })

    describe('positioning detection', () => {
        it('detects headline-style positioning changes', () => {
            // Use text that matches positioning keywords but not pricing/plan/cta/feature
            const diff = createDiff('Welcome to our product', 'The #1 best product in the market.')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('positioning')
        })

        it('detects introducing/announcing language', () => {
            const diff = createDiff('', 'Introducing our new innovative solution.')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.signalType).toBe('positioning')
        })
    })

    describe('noise filtering', () => {
        it('filters out copyright/footer noise', () => {
            const diff = createDiff('© 2023 All rights reserved', '© 2024 All rights reserved')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(false)
        })

        it('filters privacy/terms noise', () => {
            const diff = createDiff('Our privacy policy has been updated', 'Our terms have been updated')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(false)
        })
    })

    describe('substantial content changes', () => {
        it('flags large text changes as meaningful', () => {
            const longText = 'A'.repeat(150)
            const diff = createDiff('', longText)
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(true)
            expect(result.reason).toContain('Substantial')
        })
    })

    describe('minor changes', () => {
        it('returns not meaningful for small grammar edits', () => {
            // Small text change that doesn't match any keywords
            const diff = createDiff('Hello there', 'Hi there')
            const result = isMeaningful(diff)
            expect(result.isMeaningful).toBe(false)
            expect(result.reason).toContain('minor')
        })
    })
})

