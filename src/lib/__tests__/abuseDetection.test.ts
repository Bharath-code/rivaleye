import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    detectManualSpam,
    detectPageHoarding,
    detectVolatilePage,
    checkGlobalThrottle,
    runAbuseChecks,
} from '../abuseDetection'

// Helper to create mock Supabase client with chained methods
function createMockSupabase() {
    const mockSingle = vi.fn()
    const mockLimit = vi.fn()
    const mockOrder = vi.fn().mockReturnThis()
    const mockGte = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSelect = vi.fn().mockReturnThis()
    const mockFrom = vi.fn()

    // Chain setup
    mockLimit.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({
        eq: mockEq,
        gte: mockGte,
        order: mockOrder,
        single: mockSingle,
        limit: mockLimit,
    })
    mockEq.mockReturnValue({
        eq: mockEq,
        gte: mockGte,
        order: mockOrder,
        single: mockSingle,
        limit: mockLimit,
    })
    mockGte.mockReturnValue({
        eq: mockEq,
        order: mockOrder,
        limit: mockLimit,
    })
    mockOrder.mockReturnValue({
        limit: mockLimit,
    })
    mockFrom.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
    })

    return {
        from: mockFrom,
        _mocks: { mockFrom, mockSelect, mockEq, mockGte, mockOrder, mockLimit, mockSingle },
    }
}

describe('abuseDetection', () => {
    describe('detectManualSpam', () => {
        it('returns not flagged when user not found', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockSingle.mockResolvedValue({ data: null })

            const result = await detectManualSpam(mockSupabase as any, 'user-123')

            expect(result.flagged).toBe(false)
        })

        it('returns not flagged when free user below limit', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockSingle.mockResolvedValue({
                data: { manual_checks_today: 0, plan: 'free' },
            })

            const result = await detectManualSpam(mockSupabase as any, 'user-123')

            expect(result.flagged).toBe(false)
        })

        it('returns flagged when free user at limit', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockSingle.mockResolvedValue({
                data: { manual_checks_today: 1, plan: 'free' },
            })

            const result = await detectManualSpam(mockSupabase as any, 'user-123')

            expect(result.flagged).toBe(true)
            expect(result.flag).toBe('manual_spam')
            expect(result.action).toBe('soft_block')
        })

        it('returns not flagged when pro user below limit', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockSingle.mockResolvedValue({
                data: { manual_checks_today: 4, plan: 'pro' },
            })

            const result = await detectManualSpam(mockSupabase as any, 'user-123')

            expect(result.flagged).toBe(false)
        })

        it('returns flagged when pro user at limit', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockSingle.mockResolvedValue({
                data: { manual_checks_today: 5, plan: 'pro' },
            })

            const result = await detectManualSpam(mockSupabase as any, 'user-123')

            expect(result.flagged).toBe(true)
            expect(result.flag).toBe('manual_spam')
        })
    })

    describe('detectPageHoarding', () => {
        it('returns not flagged when less than 20 pages added', async () => {
            const mockSupabase = createMockSupabase()
            // Mock for competitors count
            mockSupabase._mocks.mockGte.mockReturnValue({ count: 10 })

            const result = await detectPageHoarding(mockSupabase as any, 'user-123')

            expect(result.flagged).toBe(false)
        })
    })

    describe('detectVolatilePage', () => {
        it('returns not flagged when fewer than 5 snapshots', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockLimit.mockResolvedValue({
                data: [{ hash: 'a' }, { hash: 'b' }],
            })

            const result = await detectVolatilePage(mockSupabase as any, 'comp-123')

            expect(result.flagged).toBe(false)
        })

        it('returns not flagged when no snapshots', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockLimit.mockResolvedValue({ data: null })

            const result = await detectVolatilePage(mockSupabase as any, 'comp-123')

            expect(result.flagged).toBe(false)
        })
    })

    describe('checkGlobalThrottle', () => {
        it('returns not flagged when below threshold', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockGte.mockReturnValue({ count: 1000 })

            const result = await checkGlobalThrottle(mockSupabase as any, 10000)

            expect(result.flagged).toBe(false)
        })

        it('returns flagged when above threshold', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockGte.mockReturnValue({ count: 20000 })

            const result = await checkGlobalThrottle(mockSupabase as any, 10000)

            expect(result.flagged).toBe(true)
            expect(result.flag).toBe('global_throttle')
            expect(result.action).toBe('throttle')
        })

        it('uses default expected crawls when not provided', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockGte.mockReturnValue({ count: 20000 })

            const result = await checkGlobalThrottle(mockSupabase as any)

            // Default is 10000, threshold is 10000 * 1.5 = 15000
            expect(result.flagged).toBe(true)
        })
    })

    describe('runAbuseChecks', () => {
        it('runs user-level checks without competitor', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockSingle.mockResolvedValue({
                data: { manual_checks_today: 0, plan: 'free' },
            })
            mockSupabase._mocks.mockGte.mockReturnValue({ count: 0 })

            const results = await runAbuseChecks(mockSupabase as any, 'user-123')

            // All checks should return not flagged
            expect(results).toHaveLength(0) // Only flagged results are returned
        })

        it('includes competitor checks when competitorId provided', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockSingle.mockResolvedValue({
                data: { manual_checks_today: 1, plan: 'free' },
            })
            mockSupabase._mocks.mockLimit.mockResolvedValue({ data: [] })
            mockSupabase._mocks.mockGte.mockReturnValue({ count: 0 })

            const results = await runAbuseChecks(mockSupabase as any, 'user-123', 'comp-123')

            // Manual spam should be flagged
            expect(results.some(r => r.flag === 'manual_spam')).toBe(true)
        })

        it('filters to only flagged results', async () => {
            const mockSupabase = createMockSupabase()
            mockSupabase._mocks.mockSingle.mockResolvedValue({
                data: { manual_checks_today: 5, plan: 'pro' },
            })
            mockSupabase._mocks.mockGte.mockReturnValue({ count: 20000 })

            const results = await runAbuseChecks(mockSupabase as any, 'user-123')

            // All returned results should be flagged
            expect(results.every(r => r.flagged === true)).toBe(true)
        })
    })
})
