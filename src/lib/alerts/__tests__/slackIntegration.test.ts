import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pushToSlack } from '../slackIntegration'

// Mock the encryption module
vi.mock('@/lib/encryption', () => ({
    decryptWebhookUrl: vi.fn((url) => url), // Pass through by default
}))

import { decryptWebhookUrl } from '@/lib/encryption'

describe('slackIntegration', () => {
    let originalEnv: string | undefined

    beforeEach(() => {
        originalEnv = process.env.SLACK_WEBHOOK_URL
        vi.resetAllMocks()
    })

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.SLACK_WEBHOOK_URL = originalEnv
        } else {
            delete process.env.SLACK_WEBHOOK_URL
        }
        vi.restoreAllMocks()
    })

    describe('pushToSlack', () => {
        it('returns error when no webhook URL configured', async () => {
            delete process.env.SLACK_WEBHOOK_URL
            vi.mocked(decryptWebhookUrl).mockReturnValue(null)

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            const result = await pushToSlack({
                title: 'Test Alert',
                description: 'Test description',
                competitorName: 'TestCompetitor',
            })

            expect(result.success).toBe(false)
            expect(result.error).toContain('No Slack webhook URL')
            expect(consoleSpy).toHaveBeenCalled()

            consoleSpy.mockRestore()
        })

        it('uses provided webhook URL over environment variable', async () => {
            process.env.SLACK_WEBHOOK_URL = 'https://default-webhook.com'
            vi.mocked(decryptWebhookUrl).mockReturnValue('https://custom-webhook.com')

            const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
            } as Response)

            await pushToSlack({
                title: 'Test Alert',
                description: 'Test description',
                competitorName: 'TestCompetitor',
                webhookUrl: 'encrypted-url',
            })

            expect(fetchSpy).toHaveBeenCalledWith(
                'https://custom-webhook.com',
                expect.any(Object)
            )

            fetchSpy.mockRestore()
        })

        it('uses environment variable when no webhookUrl provided', async () => {
            process.env.SLACK_WEBHOOK_URL = 'https://env-webhook.com'

            const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
            } as Response)

            await pushToSlack({
                title: 'Test Alert',
                description: 'Test description',
                competitorName: 'TestCompetitor',
            })

            expect(fetchSpy).toHaveBeenCalledWith(
                'https://env-webhook.com',
                expect.any(Object)
            )

            fetchSpy.mockRestore()
        })

        it('sends correct Slack message format', async () => {
            process.env.SLACK_WEBHOOK_URL = 'https://webhook.test.com'

            const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
            } as Response)

            await pushToSlack({
                title: 'Price Increase Detected',
                description: 'The price went up by 20%',
                competitorName: 'Acme Corp',
                link: 'https://rivaleye.com/alert/123',
            })

            expect(fetchSpy).toHaveBeenCalledWith(
                'https://webhook.test.com',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
            )

            const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
            expect(body.blocks).toBeDefined()
            expect(body.blocks[0].text.text).toContain('Acme Corp')

            fetchSpy.mockRestore()
        })

        it('includes playbook when provided', async () => {
            process.env.SLACK_WEBHOOK_URL = 'https://webhook.test.com'

            const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
            } as Response)

            await pushToSlack({
                title: 'Alert',
                description: 'Description',
                competitorName: 'Competitor',
                playbook: {
                    salesDraft: 'Call your top customers...',
                },
            })

            const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
            const hasPlaybook = body.blocks.some((b: any) =>
                b.text?.text?.includes('Tactical Sales Draft')
            )
            expect(hasPlaybook).toBe(true)

            fetchSpy.mockRestore()
        })

        it('returns success on successful post', async () => {
            process.env.SLACK_WEBHOOK_URL = 'https://webhook.test.com'

            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
            } as Response)

            const result = await pushToSlack({
                title: 'Test',
                description: 'Test',
                competitorName: 'Test',
            })

            expect(result.success).toBe(true)
        })

        it('returns error on failed post', async () => {
            process.env.SLACK_WEBHOOK_URL = 'https://webhook.test.com'

            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: false,
                statusText: 'Bad Request',
            } as Response)

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            const result = await pushToSlack({
                title: 'Test',
                description: 'Test',
                competitorName: 'Test',
            })

            expect(result.success).toBe(false)
            expect(result.error).toContain('Slack API error')

            consoleSpy.mockRestore()
        })

        it('handles fetch errors gracefully', async () => {
            process.env.SLACK_WEBHOOK_URL = 'https://webhook.test.com'

            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            const result = await pushToSlack({
                title: 'Test',
                description: 'Test',
                competitorName: 'Test',
            })

            expect(result.success).toBe(false)
            expect(result.error).toContain('Network error')

            consoleSpy.mockRestore()
        })

        it('uses default link when not provided', async () => {
            process.env.SLACK_WEBHOOK_URL = 'https://webhook.test.com'

            const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
            } as Response)

            await pushToSlack({
                title: 'Test',
                description: 'Test',
                competitorName: 'Test',
            })

            const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
            const buttonBlock = body.blocks.find((b: any) => b.type === 'actions')
            expect(buttonBlock.elements[0].url).toBe('https://rivaleye.com/dashboard')

            fetchSpy.mockRestore()
        })
    })
})
