import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateText, isAIAvailable } from '../aiProvider'

describe('aiProvider', () => {
    let originalGeminiKey: string | undefined
    let originalOpenRouterKey: string | undefined

    beforeEach(() => {
        originalGeminiKey = process.env.GEMINI_API_KEY
        originalOpenRouterKey = process.env.OPENROUTER_API_KEY
        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(() => {
        if (originalGeminiKey !== undefined) {
            process.env.GEMINI_API_KEY = originalGeminiKey
        } else {
            delete process.env.GEMINI_API_KEY
        }
        if (originalOpenRouterKey !== undefined) {
            process.env.OPENROUTER_API_KEY = originalOpenRouterKey
        } else {
            delete process.env.OPENROUTER_API_KEY
        }
        vi.restoreAllMocks()
    })

    describe('isAIAvailable', () => {
        it('returns true when GEMINI_API_KEY is set', () => {
            process.env.GEMINI_API_KEY = 'test-key'
            delete process.env.OPENROUTER_API_KEY
            expect(isAIAvailable()).toBe(true)
        })

        it('returns true when OPENROUTER_API_KEY is set', () => {
            delete process.env.GEMINI_API_KEY
            process.env.OPENROUTER_API_KEY = 'test-key'
            expect(isAIAvailable()).toBe(true)
        })

        it('returns true when both keys are set', () => {
            process.env.GEMINI_API_KEY = 'test-key'
            process.env.OPENROUTER_API_KEY = 'test-key'
            expect(isAIAvailable()).toBe(true)
        })

        it('returns false when no keys are set', () => {
            delete process.env.GEMINI_API_KEY
            delete process.env.OPENROUTER_API_KEY
            expect(isAIAvailable()).toBe(false)
        })

        it('returns false when keys are empty strings', () => {
            process.env.GEMINI_API_KEY = ''
            process.env.OPENROUTER_API_KEY = ''
            expect(isAIAvailable()).toBe(false)
        })
    })

    describe('generateText', () => {
        it('throws error when no AI providers available', async () => {
            delete process.env.GEMINI_API_KEY
            delete process.env.OPENROUTER_API_KEY

            await expect(
                generateText({
                    systemPrompt: 'You are a helpful assistant',
                    userPrompt: 'Hello',
                })
            ).rejects.toThrow('All AI providers failed')
        })
    })
})
