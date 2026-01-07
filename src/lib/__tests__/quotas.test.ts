import { describe, it, expect, vi } from 'vitest'
import { canScheduledCrawl, canManualCheck, canAddPage, GLOBAL_LIMITS } from '../quotas'
import type { User } from '@/lib/types'

// Mock user factory
function createMockUser(overrides: Partial<User> = {}): User {
    return {
        id: 'test-user-id',
        email: 'test@example.com',
        plan: 'free',
        crawls_today: 0,
        manual_checks_today: 0,
        last_quota_reset: new Date().toISOString(),
        created_at: new Date().toISOString(),
        ...overrides,
    } as User
}

// Mock Supabase client factory
function createMockSupabase(competitorCount: number = 0) {
    return {
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ count: competitorCount }),
                }),
            }),
        }),
    } as any
}

describe('quotas', () => {
    describe('canScheduledCrawl', () => {
        it('allows crawl when under limit for free user', () => {
            const user = createMockUser({ plan: 'free', crawls_today: 0 })
            const result = canScheduledCrawl(user)
            expect(result.allowed).toBe(true)
        })

        it('blocks crawl when at limit for free user', () => {
            const user = createMockUser({ plan: 'free', crawls_today: 1 })
            const result = canScheduledCrawl(user)
            expect(result.allowed).toBe(false)
            expect(result.upgradePrompt).toBe(true)
        })

        it('allows more crawls for pro user', () => {
            const user = createMockUser({ plan: 'pro', crawls_today: 49 })
            const result = canScheduledCrawl(user)
            expect(result.allowed).toBe(true)
        })

        it('blocks crawl when pro user hits 50 limit', () => {
            const user = createMockUser({ plan: 'pro', crawls_today: 50 })
            const result = canScheduledCrawl(user)
            expect(result.allowed).toBe(false)
            expect(result.upgradePrompt).toBe(false) // Pro users don't get upgrade prompt
        })
    })

    describe('canManualCheck', () => {
        it('allows first manual check for free user', () => {
            const user = createMockUser({ plan: 'free', manual_checks_today: 0 })
            const result = canManualCheck(user)
            expect(result.allowed).toBe(true)
        })

        it('blocks second manual check for free user', () => {
            const user = createMockUser({ plan: 'free', manual_checks_today: 1 })
            const result = canManualCheck(user)
            expect(result.allowed).toBe(false)
            expect(result.upgradePrompt).toBe(true)
            expect(result.reason).toContain('limit')
        })

        it('allows up to 5 manual checks for pro user', () => {
            const user = createMockUser({ plan: 'pro', manual_checks_today: 4 })
            const result = canManualCheck(user)
            expect(result.allowed).toBe(true)
        })

        it('blocks 6th manual check for pro user', () => {
            const user = createMockUser({ plan: 'pro', manual_checks_today: 5 })
            const result = canManualCheck(user)
            expect(result.allowed).toBe(false)
        })
    })

    describe('canAddPage', () => {
        it('allows free user to add first competitor', async () => {
            const supabase = createMockSupabase(0)
            const result = await canAddPage(supabase, 'user-id', 'free')
            expect(result.allowed).toBe(true)
        })

        it('blocks free user from adding second competitor', async () => {
            const supabase = createMockSupabase(1)
            const result = await canAddPage(supabase, 'user-id', 'free')
            expect(result.allowed).toBe(false)
            expect(result.upgradePrompt).toBe(true)
            expect(result.reason).toContain('Free plan')
        })

        it('allows pro user to add up to 5 competitors', async () => {
            const supabase = createMockSupabase(4)
            const result = await canAddPage(supabase, 'user-id', 'pro')
            expect(result.allowed).toBe(true)
        })

        it('blocks pro user from adding 6th competitor', async () => {
            const supabase = createMockSupabase(5)
            const result = await canAddPage(supabase, 'user-id', 'pro')
            expect(result.allowed).toBe(false)
            expect(result.upgradePrompt).toBe(false)
            expect(result.reason).toContain('reached the limit')
        })

        it('allows enterprise user to add up to 50 competitors', async () => {
            const supabase = createMockSupabase(49)
            const result = await canAddPage(supabase, 'user-id', 'enterprise')
            expect(result.allowed).toBe(true)
        })

        it('blocks enterprise user from adding 51st competitor', async () => {
            const supabase = createMockSupabase(50)
            const result = await canAddPage(supabase, 'user-id', 'enterprise')
            expect(result.allowed).toBe(false)
        })
    })

    describe('GLOBAL_LIMITS', () => {
        it('has safety limits defined', () => {
            expect(GLOBAL_LIMITS.maxDailyCrawls).toBe(100000)
            expect(GLOBAL_LIMITS.crawlSpikeMultiplier).toBe(1.5)
        })
    })
})

