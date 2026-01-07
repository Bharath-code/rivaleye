import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted for shared mock functions
const { mockGenerateContent } = vi.hoisted(() => ({
    mockGenerateContent: vi.fn()
}))

// Mock Gemini
vi.mock('@google/genai', () => ({
    GoogleGenAI: class {
        models = {
            generateContent: mockGenerateContent
        }
    }
}))

// Mock Sharp
vi.mock('sharp', () => ({
    default: vi.fn().mockImplementation(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 1440 }),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('compressed-image'))
    }))
}))

// Mock Screenshot utility
vi.mock('@/lib/crawler/screenshot', () => ({
    captureScreenshot: vi.fn()
}))

// Import after mocks
import { analyzeScreenshot, captureAndAnalyze } from '../visionAnalyzer'
import { captureScreenshot } from '@/lib/crawler/screenshot'

describe('visionAnalyzer', () => {
    let originalEnv: string | undefined
    const mockBuffer = Buffer.from('fake-image-data')

    beforeEach(() => {
        originalEnv = process.env.GEMINI_API_KEY
        process.env.GEMINI_API_KEY = 'test-key'
        mockGenerateContent.mockReset()
        vi.mocked(captureScreenshot).mockReset()

        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
        vi.spyOn(console, 'warn').mockImplementation(() => { })
    })

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.GEMINI_API_KEY = originalEnv
        } else {
            delete process.env.GEMINI_API_KEY
        }
        vi.restoreAllMocks()
    })

    describe('analyzeScreenshot', () => {
        it('returns error if GEMINI_API_KEY is missing', async () => {
            delete process.env.GEMINI_API_KEY
            const result = await analyzeScreenshot(mockBuffer)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('not configured')
            }
        })

        it('returns success and parsed analysis on valid AI response', async () => {
            const mockAnalysis = {
                companyName: 'Test Corp',
                pricing: { plans: [{ name: 'Free', price: '0', period: 'monthly', features: [] }] },
                features: { highlighted: ['Fast'], differentiators: [] },
                positioning: {},
                insights: ['Great product'],
                summary: 'An executive summary.'
            }

            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify(mockAnalysis)
            })

            const result = await analyzeScreenshot(mockBuffer, 'https://test.com', 'Test Page')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.analysis.companyName).toBe('Test Corp')
                expect(result.screenshotSize).toBeDefined()
            }
        })

        it('handles case where Gemini returns markdown-wrapped JSON', async () => {
            const mockAnalysis = { companyName: 'Markdown Corp', pricing: { plans: [] }, features: { highlighted: [] }, positioning: {}, insights: [], summary: 'Summary' }
            mockGenerateContent.mockResolvedValue({
                text: '```json\n' + JSON.stringify(mockAnalysis) + '\n```'
            })

            const result = await analyzeScreenshot(mockBuffer)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.analysis.companyName).toBe('Markdown Corp')
            }
        })

        it('creates fallback if JSON parsing fails', async () => {
            mockGenerateContent.mockResolvedValue({
                text: 'This is not JSON text at all.'
            })

            const result = await analyzeScreenshot(mockBuffer)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.analysis.companyName).toBe('Unknown')
                expect(result.analysis.summary).toContain('parsing failed')
            }
        })

        it('returns success:false on AI exception', async () => {
            mockGenerateContent.mockRejectedValue(new Error('AI crash'))
            const result = await analyzeScreenshot(mockBuffer)
            expect(result.success).toBe(false)
        })
    })

    describe('captureAndAnalyze', () => {
        it('returns error if capture fails', async () => {
            vi.mocked(captureScreenshot).mockResolvedValue({
                success: false,
                error: 'Browser error'
            })

            const result = await captureAndAnalyze('https://fail.com')
            expect(result.analysis.success).toBe(false)
            if (!result.analysis.success) {
                expect(result.analysis.error).toBe('Browser error')
            }
        })

        it('proceeds to analysis if capture succeeds', async () => {
            vi.mocked(captureScreenshot).mockResolvedValue({
                success: true,
                screenshot: mockBuffer,
                url: 'https://success.com',
                title: 'Success'
            })

            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify({ companyName: 'Success Co', pricing: { plans: [] }, features: { highlighted: [] }, positioning: {}, insights: [], summary: 'Summary' })
            })

            const result = await captureAndAnalyze('https://success.com')
            expect(result.screenshot).toBeDefined()
            expect(result.analysis.success).toBe(true)
        })
    })
})
