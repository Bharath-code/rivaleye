import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateInsight } from '../generateInsight'
import type { DiffResult, MeaningfulnessResult } from '@/lib/types'

// Mock the aiProvider module
vi.mock('../aiProvider', () => ({
    generateText: vi.fn(),
    isAIAvailable: vi.fn(),
}))

import { generateText, isAIAvailable } from '../aiProvider'

// Helper to create mock DiffResult
function createMockDiff(overrides: Partial<DiffResult> = {}): DiffResult {
    return {
        hasChanges: true,
        changedBlocks: [
            { oldText: 'old text', newText: 'new text' },
        ],
        ...overrides,
    }
}

// Helper to create mock MeaningfulnessResult
function createMockMeaningfulness(
    overrides: Partial<MeaningfulnessResult> = {}
): MeaningfulnessResult {
    return {
        isMeaningful: true,
        reason: 'Pricing information changed',
        signalType: 'pricing',
        ...overrides,
    }
}

describe('generateInsight', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('when change is not meaningful', () => {
        it('returns canned no-signal response', async () => {
            const diff = createMockDiff()
            const meaningfulness = createMockMeaningfulness({ isMeaningful: false })

            const result = await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(result.whatChanged).toBe('Minor content updates detected.')
            expect(result.confidence).toBe('low')
        })

        it('does not call AI providers', async () => {
            const diff = createMockDiff()
            const meaningfulness = createMockMeaningfulness({ isMeaningful: false })

            await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(generateText).not.toHaveBeenCalled()
        })
    })

    describe('when AI is not available', () => {
        it('returns fallback response with reason', async () => {
            vi.mocked(isAIAvailable).mockReturnValue(false)

            const diff = createMockDiff()
            const meaningfulness = createMockMeaningfulness()

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const result = await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(result.whatChanged).toBe('Pricing information changed')
            expect(result.confidence).toBe('low')
            expect(consoleSpy).toHaveBeenCalled()

            consoleSpy.mockRestore()
        })

        it('uses signal type in fallback message', async () => {
            vi.mocked(isAIAvailable).mockReturnValue(false)

            const diff = createMockDiff()
            const meaningfulness = createMockMeaningfulness({ signalType: 'feature' })

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const result = await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(result.whyItMatters).toContain('feature')

            consoleSpy.mockRestore()
        })
    })

    describe('when AI is available', () => {
        beforeEach(() => {
            vi.mocked(isAIAvailable).mockReturnValue(true)
        })

        it('calls generateText with proper prompts', async () => {
            vi.mocked(generateText).mockResolvedValue({
                content: `WHAT CHANGED: The price increased.
WHY THIS MAY MATTER: This signals market positioning.
WHAT TO CONSIDER: Review your pricing.`,
                provider: 'gemini',
                model: 'gemini-2.0-flash',
            })

            const diff = createMockDiff()
            const meaningfulness = createMockMeaningfulness()

            await generateInsight(diff, meaningfulness, 'Competitor Inc')

            expect(generateText).toHaveBeenCalledWith(
                expect.objectContaining({
                    systemPrompt: expect.stringContaining('competitive intelligence'),
                    userPrompt: expect.stringContaining('Competitor Inc'),
                    maxTokens: 500,
                    temperature: 0.3,
                })
            )
        })

        it('parses AI response correctly', async () => {
            vi.mocked(generateText).mockResolvedValue({
                content: `WHAT CHANGED: Price went from $99 to $129.
WHY THIS MAY MATTER: This indicates strong market demand.
WHAT TO CONSIDER: Consider your own pricing strategy.`,
                provider: 'gemini',
                model: 'gemini-2.0-flash',
            })

            const diff = createMockDiff()
            const meaningfulness = createMockMeaningfulness()

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            const result = await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(result.whatChanged).toBe('Price went from $99 to $129.')
            expect(result.whyItMatters).toBe('This indicates strong market demand.')
            expect(result.whatToDo).toBe('Consider your own pricing strategy.')

            consoleSpy.mockRestore()
        })

        it('sets high confidence for pricing signals', async () => {
            vi.mocked(generateText).mockResolvedValue({
                content: `WHAT CHANGED: Test
WHY THIS MAY MATTER: Test
WHAT TO CONSIDER: Test`,
                provider: 'gemini',
                model: 'gemini-2.0-flash',
            })

            const diff = createMockDiff()
            const meaningfulness = createMockMeaningfulness({ signalType: 'pricing' })

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            const result = await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(result.confidence).toBe('high')

            consoleSpy.mockRestore()
        })

        it('sets low confidence for positioning signals', async () => {
            vi.mocked(generateText).mockResolvedValue({
                content: `WHAT CHANGED: Test
WHY THIS MAY MATTER: Test
WHAT TO CONSIDER: Test`,
                provider: 'gemini',
                model: 'gemini-2.0-flash',
            })

            const diff = createMockDiff()
            const meaningfulness = createMockMeaningfulness({ signalType: 'positioning' })

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            const result = await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(result.confidence).toBe('low')

            consoleSpy.mockRestore()
        })

        it('handles malformed AI response', async () => {
            vi.mocked(generateText).mockResolvedValue({
                content: 'This is not in the expected format at all',
                provider: 'gemini',
                model: 'gemini-2.0-flash',
            })

            const diff = createMockDiff()
            const meaningfulness = createMockMeaningfulness()

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            const result = await generateInsight(diff, meaningfulness, 'TestCompetitor')

            // Should use fallback values
            expect(result.whatChanged).toBe(meaningfulness.reason)
            expect(result.whyItMatters).toContain('competitive strategy')

            consoleSpy.mockRestore()
        })

        it('handles AI errors gracefully', async () => {
            vi.mocked(generateText).mockRejectedValue(new Error('API Error'))

            const diff = createMockDiff()
            const meaningfulness = createMockMeaningfulness()

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
            const result = await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(result.whatChanged).toBe(meaningfulness.reason)
            expect(result.confidence).toBe('low')
            expect(consoleSpy).toHaveBeenCalled()

            consoleSpy.mockRestore()
        })
    })

    describe('changed blocks formatting', () => {
        beforeEach(() => {
            vi.mocked(isAIAvailable).mockReturnValue(true)
            vi.mocked(generateText).mockResolvedValue({
                content: 'WHAT CHANGED: X\nWHY THIS MAY MATTER: Y\nWHAT TO CONSIDER: Z',
                provider: 'gemini',
                model: 'gemini-2.0-flash',
            })
        })

        it('includes changed blocks in prompt', async () => {
            const diff = createMockDiff({
                changedBlocks: [
                    { oldText: 'old', newText: 'new' },
                ],
            })
            const meaningfulness = createMockMeaningfulness()

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(generateText).toHaveBeenCalledWith(
                expect.objectContaining({
                    userPrompt: expect.stringContaining('Before: "old"'),
                })
            )
            expect(generateText).toHaveBeenCalledWith(
                expect.objectContaining({
                    userPrompt: expect.stringContaining('After: "new"'),
                })
            )

            consoleSpy.mockRestore()
        })

        it('formats additions correctly', async () => {
            const diff = createMockDiff({
                changedBlocks: [{ oldText: '', newText: 'added content' }],
            })
            const meaningfulness = createMockMeaningfulness()

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(generateText).toHaveBeenCalledWith(
                expect.objectContaining({
                    userPrompt: expect.stringContaining('Addition'),
                })
            )

            consoleSpy.mockRestore()
        })

        it('formats removals correctly', async () => {
            const diff = createMockDiff({
                changedBlocks: [{ oldText: 'removed content', newText: '' }],
            })
            const meaningfulness = createMockMeaningfulness()

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            await generateInsight(diff, meaningfulness, 'TestCompetitor')

            expect(generateText).toHaveBeenCalledWith(
                expect.objectContaining({
                    userPrompt: expect.stringContaining('Removal'),
                })
            )

            consoleSpy.mockRestore()
        })

        it('limits to 5 blocks', async () => {
            const diff = createMockDiff({
                changedBlocks: Array(10).fill({ oldText: 'old', newText: 'new' }),
            })
            const meaningfulness = createMockMeaningfulness()

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
            await generateInsight(diff, meaningfulness, 'TestCompetitor')

            const call = vi.mocked(generateText).mock.calls[0][0]
            // Count occurrences of "Change" in the prompt
            const changeCount = (call.userPrompt.match(/Change \d+:/g) || []).length
            expect(changeCount).toBeLessThanOrEqual(5)

            consoleSpy.mockRestore()
        })
    })
})
