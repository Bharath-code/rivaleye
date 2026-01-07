import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PSIResult } from '@/lib/crawler/pageSpeedInsights'

// Use vi.hoisted for shared mock functions
const { mockGenerateContent } = vi.hoisted(() => ({
    mockGenerateContent: vi.fn()
}))

// Mock Resend as a class
vi.mock('@google/genai', () => ({
    GoogleGenAI: class {
        models = {
            generateContent: mockGenerateContent
        }
    }
}))

// Import after mock
import { generatePerformanceRecommendations, generateFallbackSummary } from '../performanceRecommendations'

// Helper for Mock PSI data
function createMockPSIData(overrides: Partial<PSIResult> = {}): PSIResult {
    return {
        success: true,
        url: 'https://competitor.com',
        strategy: 'mobile',
        categories: {
            performance: 45,
            accessibility: 88,
            bestPractices: 90,
            seo: 92
        },
        coreWebVitals: {
            lcp: 3500,
            fid: 120,
            cls: 0.15,
            fcp: 2000,
            ttfb: 1200,
            inp: null
        },
        opportunities: [
            { id: 'image-alt', title: 'Add alt text to images', description: 'Alt text is key for SEO.', score: 0.2, displayValue: '1.5s' }
        ],
        diagnostics: [],
        audits: [],
        fetchTime: new Date().toISOString(),
        ...overrides
    } as PSIResult
}

describe('performanceRecommendations', () => {
    let originalEnv: string | undefined

    beforeEach(() => {
        originalEnv = process.env.GEMINI_API_KEY
        process.env.GEMINI_API_KEY = 'test-key'
        mockGenerateContent.mockReset()

        // Suppress expected logs/errors during tests
        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.GEMINI_API_KEY = originalEnv
        } else {
            delete process.env.GEMINI_API_KEY
        }
        vi.restoreAllMocks()
    })

    describe('generatePerformanceRecommendations', () => {
        it('returns null if GEMINI_API_KEY is missing', async () => {
            delete process.env.GEMINI_API_KEY
            const result = await generatePerformanceRecommendations(createMockPSIData(), 'Competitor')
            expect(result).toBeNull()
        })

        it('returns parsed analysis on successful AI response', async () => {
            const mockAnalysis = {
                summary: 'Poor mobile performance due to heavy images',
                grade: 'D',
                recommendations: [
                    { priority: 'high', category: 'speed', issue: 'Large images', action: 'Optimize images', impact: '2s saved' }
                ],
                competitiveInsights: ['Slow LCP is an opportunity'],
                quickWins: ['Compress PNGs']
            }

            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify(mockAnalysis)
            })

            const result = await generatePerformanceRecommendations(createMockPSIData(), 'Acme')

            expect(result).toEqual(mockAnalysis)
            expect(mockGenerateContent).toHaveBeenCalled()
        })

        it('handles non-JSON text surrounding the JSON in AI response', async () => {
            const mockAnalysis = { summary: 'OK', grade: 'C', recommendations: [], competitiveInsights: [], quickWins: [] }
            mockGenerateContent.mockResolvedValue({
                text: "Here is your analysis: " + JSON.stringify(mockAnalysis) + " I hope this helps!"
            })

            const result = await generatePerformanceRecommendations(createMockPSIData(), 'Acme')
            expect(result).toEqual(mockAnalysis)
        })

        it('returns null if AI response contains no JSON', async () => {
            mockGenerateContent.mockResolvedValue({
                text: "I cannot analyze this data right now."
            })
            const result = await generatePerformanceRecommendations(createMockPSIData(), 'Acme')
            expect(result).toBeNull()
        })

        it('returns null on AI error', async () => {
            mockGenerateContent.mockRejectedValue(new Error('AI failure'))
            const result = await generatePerformanceRecommendations(createMockPSIData(), 'Acme')
            expect(result).toBeNull()
        })
    })

    describe('generateFallbackSummary', () => {
        it('correctly generates summary and recommendations from PSI data', () => {
            const psi = createMockPSIData()
            const result = generateFallbackSummary(psi)

            expect(result.summary).toContain('45/100')
            expect(result.grade).toBe('Poor')
            expect(result.recommendations.length).toBeGreaterThan(0)
            expect(result.recommendations[0].issue).toBe('Add alt text to images')
        })
    })
})
