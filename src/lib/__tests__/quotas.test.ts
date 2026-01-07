import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    canScheduledCrawl,
    canManualCheck,
    canAddPage,
    incrementCrawlCount,
    incrementManualCheckCount,
    getUserWithQuota,
    GLOBAL_LIMITS
} from '../quotas';
import type { User } from '@/lib/types';

describe('quotas', () => {
    describe('GLOBAL_LIMITS', () => {
        it('has correct default values', () => {
            expect(GLOBAL_LIMITS.maxDailyCrawls).toBe(100000);
            expect(GLOBAL_LIMITS.crawlSpikeMultiplier).toBe(1.5);
        });
    });

    describe('canScheduledCrawl', () => {
        it('allows crawl when under limit', () => {
            const user = { plan: 'pro', crawls_today: 10 } as User;
            expect(canScheduledCrawl(user).allowed).toBe(true);
        });

        it('blocks crawl when at limit', () => {
            const user = { plan: 'free', crawls_today: 50 } as User;
            const result = canScheduledCrawl(user);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Daily crawl limit reached');
        });

        it('suggests upgrade for free users', () => {
            const user = { plan: 'free', crawls_today: 50 } as User;
            expect(canScheduledCrawl(user).upgradePrompt).toBe(true);
        });
    });

    describe('canManualCheck', () => {
        it('allows check when under limit', () => {
            const user = { plan: 'free', manual_checks_today: 0 } as User;
            expect(canManualCheck(user).allowed).toBe(true);
        });

        it('blocks check when at limit for free', () => {
            const user = { plan: 'free', manual_checks_today: 1 } as User;
            const result = canManualCheck(user);
            expect(result.allowed).toBe(false);
            expect(result.upgradePrompt).toBe(true);
        });

        it('has higher limit for pro users', () => {
            const user = { plan: 'pro', manual_checks_today: 4 } as User;
            expect(canManualCheck(user).allowed).toBe(true);
        });

        it('blocks pro users at their limit', () => {
            const user = { plan: 'pro', manual_checks_today: 5 } as User;
            expect(canManualCheck(user).allowed).toBe(false);
        });
    });

    describe('canAddPage', () => {
        it('allows adding page when under limit', async () => {
            const mockSupabase = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({ count: 0, error: null })
                        })
                    })
                })
            };

            const result = await canAddPage(mockSupabase as any, 'u1', 'free');
            expect(result.allowed).toBe(true);
        });

        it('blocks free user at limit', async () => {
            const mockSupabase = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({ count: 1, error: null })
                        })
                    })
                })
            };

            const result = await canAddPage(mockSupabase as any, 'u1', 'free');
            expect(result.allowed).toBe(false);
            expect(result.upgradePrompt).toBe(true);
        });

        it('blocks pro user at limit without upgrade prompt', async () => {
            const mockSupabase = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({ count: 5, error: null })
                        })
                    })
                })
            };

            const result = await canAddPage(mockSupabase as any, 'u1', 'pro');
            expect(result.allowed).toBe(false);
            expect(result.upgradePrompt).toBe(false);
        });
    });

    describe('incrementCrawlCount', () => {
        it('calls rpc to increment', async () => {
            const mockRpc = vi.fn().mockResolvedValue({});
            const mockSupabase = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { last_quota_reset: new Date().toISOString() },
                                error: null
                            })
                        })
                    }),
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ error: null })
                    })
                }),
                rpc: mockRpc
            };

            await incrementCrawlCount(mockSupabase as any, 'u1');
            expect(mockRpc).toHaveBeenCalledWith('increment_crawl_count', { user_id: 'u1' });
        });
    });

    describe('incrementManualCheckCount', () => {
        it('updates user record', async () => {
            const mockUpdate = vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null })
            });
            const mockSupabase = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { last_quota_reset: new Date().toISOString() },
                                error: null
                            })
                        })
                    }),
                    update: mockUpdate
                }),
                rpc: vi.fn()
            };

            await incrementManualCheckCount(mockSupabase as any, 'u1');
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    describe('getUserWithQuota', () => {
        it('returns user after checking quota reset', async () => {
            const mockUser = { id: 'u1', plan: 'pro', crawls_today: 5, last_quota_reset: new Date().toISOString() };
            const mockSupabase = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: mockUser, error: null })
                        })
                    }),
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ error: null })
                    })
                })
            };

            const result = await getUserWithQuota(mockSupabase as any, 'u1');
            expect(result?.id).toBe('u1');
        });

        it('resets quotas if new day', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const mockUpdate = vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null })
            });
            const mockSupabase = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { last_quota_reset: yesterday.toISOString() },
                                error: null
                            })
                        })
                    }),
                    update: mockUpdate
                })
            };

            await getUserWithQuota(mockSupabase as any, 'u1');
            expect(mockUpdate).toHaveBeenCalled();
        });
    });
});
