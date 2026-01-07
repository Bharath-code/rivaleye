import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shouldCrawl, isEligibleUrl, recordSuccess, recordFailure, isHashSeenRecently } from '../guardrails'
import type { Competitor } from '@/lib/types'

// Helper to create mock competitor
function createMockCompetitor(overrides: Partial<Competitor> = {}): Competitor {
    return {
        id: 'test-competitor-id',
        user_id: 'test-user-id',
        url: 'https://example.com/pricing',
        name: 'Test Competitor',
        status: 'active',
        failure_count: 0,
        last_checked_at: null,
        last_failure_at: null,
        created_at: new Date().toISOString(),
        ...overrides,
    } as Competitor
}

// Helper to create mock Supabase client
function createMockSupabase() {
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSelect = vi.fn().mockReturnThis()
    const mockGte = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue({ data: [] })

    return {
        from: vi.fn().mockReturnValue({
            update: mockUpdate,
            select: mockSelect,
            eq: mockEq,
            gte: mockGte,
            limit: mockLimit,
        }),
        _mocks: { mockUpdate, mockEq, mockSelect, mockGte, mockLimit },
    }
}

describe('guardrails', () => {
    describe('shouldCrawl', () => {
        it('returns eligible for active competitor with no prior crawl', () => {
            const competitor = createMockCompetitor()
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(true)
        })

        it('returns ineligible when status is not active', () => {
            const competitor = createMockCompetitor({ status: 'paused' })
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(false)
            expect(result.reason).toContain('Status is paused')
        })

        it('returns ineligible when status is error', () => {
            const competitor = createMockCompetitor({ status: 'error' })
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(false)
            expect(result.reason).toContain('Status is error')
        })

        it('returns ineligible when failure count reaches threshold', () => {
            const competitor = createMockCompetitor({ failure_count: 3 })
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(false)
            expect(result.reason).toContain('Paused due to repeated failures')
        })

        it('returns ineligible when failure count exceeds threshold', () => {
            const competitor = createMockCompetitor({ failure_count: 5 })
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(false)
        })

        it('returns ineligible when in failure cooldown period', () => {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
            const competitor = createMockCompetitor({
                failure_count: 1,
                last_failure_at: oneHourAgo,
            })
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(false)
            expect(result.reason).toContain('In failure cooldown period')
        })

        it('returns eligible when cooldown period has passed', () => {
            const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()
            const competitor = createMockCompetitor({
                failure_count: 1,
                last_failure_at: thirtyHoursAgo,
            })
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(true)
        })

        it('returns ineligible when already checked today', () => {
            const now = new Date()
            const competitor = createMockCompetitor({
                last_checked_at: now.toISOString(),
            })
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(false)
            expect(result.reason).toContain('Already checked today')
        })

        it('returns eligible when last check was yesterday', () => {
            const yesterday = new Date()
            yesterday.setUTCDate(yesterday.getUTCDate() - 1)
            const competitor = createMockCompetitor({
                last_checked_at: yesterday.toISOString(),
            })
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(true)
        })

        it('handles competitor with no last_checked_at', () => {
            const competitor = createMockCompetitor({ last_checked_at: null })
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(true)
        })

        it('handles competitor with no last_failure_at', () => {
            const competitor = createMockCompetitor({
                failure_count: 1,
                last_failure_at: null,
            })
            const result = shouldCrawl(competitor)
            expect(result.eligible).toBe(true)
        })
    })

    describe('isEligibleUrl', () => {
        it('returns true for homepage', () => {
            expect(isEligibleUrl('https://example.com/')).toBe(true)
            expect(isEligibleUrl('https://example.com')).toBe(true)
        })

        it('returns true for pricing page', () => {
            expect(isEligibleUrl('https://example.com/pricing')).toBe(true)
            expect(isEligibleUrl('https://example.com/pricing/')).toBe(true)
        })

        it('returns true for plans page', () => {
            expect(isEligibleUrl('https://example.com/plans')).toBe(true)
        })

        it('returns true for features page', () => {
            expect(isEligibleUrl('https://example.com/features')).toBe(true)
        })

        it('returns true for nested eligible paths', () => {
            expect(isEligibleUrl('https://example.com/app/pricing/enterprise')).toBe(true)
        })

        it('returns false for blog page', () => {
            expect(isEligibleUrl('https://example.com/blog')).toBe(false)
        })

        it('returns false for about page', () => {
            expect(isEligibleUrl('https://example.com/about')).toBe(false)
        })

        it('returns false for random page', () => {
            expect(isEligibleUrl('https://example.com/random-page')).toBe(false)
        })

        it('returns false for invalid URL', () => {
            expect(isEligibleUrl('not-a-valid-url')).toBe(false)
        })

        it('handles case insensitivity', () => {
            expect(isEligibleUrl('https://example.com/PRICING')).toBe(true)
            expect(isEligibleUrl('https://example.com/Pricing')).toBe(true)
        })

        it('handles URL with query parameters', () => {
            expect(isEligibleUrl('https://example.com/pricing?ref=google')).toBe(true)
        })

        it('handles URL with hash', () => {
            expect(isEligibleUrl('https://example.com/pricing#enterprise')).toBe(true)
        })
    })

    describe('recordSuccess', () => {
        it('calls supabase with correct update parameters', async () => {
            const mockSupabase = createMockSupabase()

            await recordSuccess(mockSupabase as any, 'test-id')

            expect(mockSupabase.from).toHaveBeenCalledWith('competitors')
            expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    failure_count: 0,
                    last_failure_at: null,
                })
            )
            expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('id', 'test-id')
        })

        it('sets last_checked_at to current time', async () => {
            const mockSupabase = createMockSupabase()
            const before = new Date().toISOString()

            await recordSuccess(mockSupabase as any, 'test-id')

            expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    last_checked_at: expect.any(String),
                })
            )
        })
    })

    describe('recordFailure', () => {
        it('increments failure count', async () => {
            const mockSupabase = createMockSupabase()

            await recordFailure(mockSupabase as any, 'test-id', 0)

            expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    failure_count: 1,
                })
            )
        })

        it('returns paused: false when below threshold', async () => {
            const mockSupabase = createMockSupabase()

            const result = await recordFailure(mockSupabase as any, 'test-id', 0)

            expect(result.paused).toBe(false)
        })

        it('returns paused: true when reaching threshold', async () => {
            const mockSupabase = createMockSupabase()

            // Current count is 2, incrementing to 3 (threshold)
            const result = await recordFailure(mockSupabase as any, 'test-id', 2)

            expect(result.paused).toBe(true)
        })

        it('sets status to error when threshold reached', async () => {
            const mockSupabase = createMockSupabase()

            await recordFailure(mockSupabase as any, 'test-id', 2)

            expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'error',
                })
            )
        })

        it('does not set status when below threshold', async () => {
            const mockSupabase = createMockSupabase()

            await recordFailure(mockSupabase as any, 'test-id', 0)

            expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: undefined,
                })
            )
        })

        it('sets last_failure_at to current time', async () => {
            const mockSupabase = createMockSupabase()

            await recordFailure(mockSupabase as any, 'test-id', 0)

            expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    last_failure_at: expect.any(String),
                })
            )
        })
    })

    describe('isHashSeenRecently', () => {
        it('returns false when no matching hash found', async () => {
            const mockSupabase = createMockSupabase()

            const result = await isHashSeenRecently(
                mockSupabase as any,
                'competitor-id',
                'hash123'
            )

            expect(result).toBe(false)
        })

        it('returns true when matching hash found', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockLimit.mockResolvedValue({
                data: [{ id: 'snapshot-id' }],
            })

            const result = await isHashSeenRecently(
                mockSupabase as any,
                'competitor-id',
                'hash123'
            )

            expect(result).toBe(true)
        })

        it('queries correct table and fields', async () => {
            const mockSupabase = createMockSupabase()

            await isHashSeenRecently(mockSupabase as any, 'comp-123', 'hash-abc')

            expect(mockSupabase.from).toHaveBeenCalledWith('snapshots')
            expect(mockSupabase._mocks.mockSelect).toHaveBeenCalledWith('id')
        })

        it('handles null data response', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockLimit.mockResolvedValue({ data: null })

            const result = await isHashSeenRecently(
                mockSupabase as any,
                'competitor-id',
                'hash123'
            )

            expect(result).toBe(false)
        })
    })
})
