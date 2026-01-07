import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AIInsight } from '@/lib/types'

// Mock Send function
const mockSend = vi.fn().mockResolvedValue({ data: { id: 'email-id' } })

// Mock Resend as a class
vi.mock('resend', () => ({
    Resend: class {
        emails = {
            send: mockSend
        }
    }
}))

// Import after mock
import { sendAlertEmail } from '../sendEmail'

// Helper to create mock AIInsight
function createMockInsight(overrides: Partial<AIInsight> = {}): AIInsight {
    return {
        whatChanged: 'Price increased from $99 to $129',
        whyItMatters: 'This signals strong demand or cost pressure',
        whatToDo: 'Consider reviewing your own pricing strategy',
        confidence: 'medium',
        ...overrides,
    }
}

describe('sendEmail', () => {
    let originalEnv: string | undefined

    beforeEach(() => {
        originalEnv = process.env.RESEND_API_KEY
        process.env.RESEND_API_KEY = 'test-api-key'

        mockSend.mockClear()
        mockSend.mockResolvedValue({ data: { id: 'email-id' } })

        vi.spyOn(console, 'log').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
        vi.spyOn(console, 'warn').mockImplementation(() => { })
    })

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.RESEND_API_KEY = originalEnv
        } else {
            delete process.env.RESEND_API_KEY
        }
        vi.restoreAllMocks()
    })

    describe('sendAlertEmail', () => {
        it('returns false when RESEND_API_KEY is missing', async () => {
            delete process.env.RESEND_API_KEY

            const result = await sendAlertEmail({
                to: 'test@example.com',
                competitorName: 'TestCompetitor',
                pageUrl: 'https://example.com/pricing',
                insight: createMockInsight(),
            })

            expect(result).toBe(false)
        })

        it('sends email with correct parameters', async () => {
            const result = await sendAlertEmail({
                to: 'user@example.com',
                competitorName: 'Acme Corp',
                pageUrl: 'https://acme.com/pricing',
                insight: createMockInsight(),
            })

            expect(result).toBe(true)
            expect(mockSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'user@example.com',
                    subject: expect.stringContaining('Acme Corp'),
                })
            )
        })

        it('returns false when Resend returns error', async () => {
            mockSend.mockResolvedValue({
                error: { message: 'Invalid email address' },
            })

            const result = await sendAlertEmail({
                to: 'invalid',
                competitorName: 'Test',
                pageUrl: 'https://test.com',
                insight: createMockInsight(),
            })

            expect(result).toBe(false)
        })

        it('returns false on exception', async () => {
            mockSend.mockRejectedValue(new Error('Network error'))

            const result = await sendAlertEmail({
                to: 'user@example.com',
                competitorName: 'Test',
                pageUrl: 'https://test.com',
                insight: createMockInsight(),
            })

            expect(result).toBe(false)
        })

        it('handles different confidence levels', async () => {
            const confidences: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low']

            for (const confidence of confidences) {
                mockSend.mockClear()
                await sendAlertEmail({
                    to: 'user@example.com',
                    competitorName: 'Test',
                    pageUrl: 'https://test.com',
                    insight: createMockInsight({ confidence }),
                })

                const lastCall = mockSend.mock.calls[0][0]
                expect(lastCall.html).toBeTruthy()

                if (confidence === 'high') expect(lastCall.html).toContain('High confidence')
                if (confidence === 'medium') expect(lastCall.html).toContain('Notable signal')
                if (confidence === 'low') expect(lastCall.html).toContain('Possible signal')
            }
        })
    })
})
