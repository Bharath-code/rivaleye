import { describe, it, expect } from 'vitest'
import { computeDiff, summarizeDiff } from '../diffEngine'
import type { DiffResult } from '@/lib/types'

describe('diffEngine', () => {
    describe('computeDiff', () => {
        it('returns no changes for identical text', () => {
            const result = computeDiff('Hello world.', 'Hello world.')
            expect(result.hasChanges).toBe(false)
            expect(result.changedBlocks).toHaveLength(0)
        })

        it('returns no changes when hashes match', () => {
            const result = computeDiff('Different text', 'Other text', 'abc123', 'abc123')
            expect(result.hasChanges).toBe(false)
        })

        it('detects changes when text differs', () => {
            const oldText = 'Our Pro plan costs $49 per month. Get started today.'
            const newText = 'Our Pro plan costs $79 per month. Get started today.'
            const result = computeDiff(oldText, newText)
            expect(result.hasChanges).toBe(true)
            expect(result.changedBlocks.length).toBeGreaterThan(0)
        })

        it('ignores very small changes (under threshold)', () => {
            const result = computeDiff('Hello.', 'Hi.')
            expect(result.hasChanges).toBe(false)
        })

        it('detects added content', () => {
            const oldText = 'We offer basic features.'
            const newText = 'We offer basic features. Plus enterprise support for large teams.'
            const result = computeDiff(oldText, newText)
            expect(result.hasChanges).toBe(true)
        })

        it('detects removed content', () => {
            const oldText = 'Free trial available. No credit card required. Cancel anytime.'
            const newText = 'Free trial available.'
            const result = computeDiff(oldText, newText)
            expect(result.hasChanges).toBe(true)
        })
    })

    describe('summarizeDiff', () => {
        it('returns "No changes detected" for empty diff', () => {
            const diff: DiffResult = { hasChanges: false, changedBlocks: [] }
            expect(summarizeDiff(diff)).toBe('No changes detected')
        })

        it('summarizes changed blocks', () => {
            const diff: DiffResult = {
                hasChanges: true,
                changedBlocks: [
                    { oldText: '$49/month', newText: '$79/month' },
                ],
            }
            const summary = summarizeDiff(diff)
            expect(summary).toContain('Changed')
            expect(summary).toContain('$49')
            expect(summary).toContain('$79')
        })

        it('summarizes added content', () => {
            const diff: DiffResult = {
                hasChanges: true,
                changedBlocks: [
                    { oldText: '', newText: 'New enterprise tier available' },
                ],
            }
            const summary = summarizeDiff(diff)
            expect(summary).toContain('Added')
        })

        it('summarizes removed content', () => {
            const diff: DiffResult = {
                hasChanges: true,
                changedBlocks: [
                    { oldText: 'Free tier discontinued', newText: '' },
                ],
            }
            const summary = summarizeDiff(diff)
            expect(summary).toContain('Removed')
        })

        it('truncates long summaries with "more changes"', () => {
            const diff: DiffResult = {
                hasChanges: true,
                changedBlocks: [
                    { oldText: 'Change 1', newText: 'New 1' },
                    { oldText: 'Change 2', newText: 'New 2' },
                    { oldText: 'Change 3', newText: 'New 3' },
                    { oldText: 'Change 4', newText: 'New 4' },
                ],
            }
            const summary = summarizeDiff(diff)
            expect(summary).toContain('more changes')
        })

        it('truncates long block text with ellipsis', () => {
            const longText = 'A'.repeat(100)
            const diff: DiffResult = {
                hasChanges: true,
                changedBlocks: [
                    { oldText: longText, newText: 'Short' },
                ],
            }
            const summary = summarizeDiff(diff)
            expect(summary).toContain('...')
        })
    })
})

