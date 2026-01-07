import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
});

// Mock Trigdev
vi.mock('@trigger.dev/sdk/v3', () => ({
    schedules: {
        task: vi.fn((opts) => opts),
    },
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock Supabase
const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockResolvedValue({ count: 5, error: null }),
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

import { dataRetentionCleanup } from '../dataRetention';

describe('dataRetentionCleanupTask', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.eq.mockReturnThis();
        mockSupabase.delete.mockReturnThis();
        mockSupabase.in.mockReturnThis();
        mockSupabase.lt.mockResolvedValue({ count: 5, error: null });
    });

    it('cleans up data for free users', async () => {
        // Mock one free user and one pro user
        mockSupabase.from.mockImplementation((table) => {
            if (table === 'users') {
                return {
                    select: vi.fn().mockResolvedValue({
                        data: [
                            { id: 'u1', plan: 'free' },
                            { id: 'u2', plan: 'pro' },
                        ],
                        error: null,
                    }),
                };
            }
            if (table === 'competitors') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [{ id: 'c1' }],
                        error: null,
                    }),
                };
            }
            return mockSupabase;
        });

        const result = await (dataRetentionCleanup as any).run();

        expect(result.success).toBe(true);
        expect(mockSupabase.delete).toHaveBeenCalledTimes(2);
    });

    it('falls back to "free" logic if plan is missing', async () => {
        mockSupabase.from.mockImplementation((table) => {
            if (table === 'users') {
                return {
                    select: vi.fn().mockResolvedValue({
                        data: [{ id: 'u1', plan: null }], // Missing plan
                        error: null,
                    }),
                };
            }
            if (table === 'competitors') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [{ id: 'c1' }],
                        error: null,
                    }),
                };
            }
            return mockSupabase;
        });

        const result = await (dataRetentionCleanup as any).run();
        expect(result.success).toBe(true);
        expect(mockSupabase.delete).toHaveBeenCalled();
    });

    it('skips processing if user has no competitors', async () => {
        mockSupabase.from.mockImplementation((table) => {
            if (table === 'users') {
                return {
                    select: vi.fn().mockResolvedValue({
                        data: [{ id: 'u1', plan: 'free' }],
                        error: null,
                    }),
                };
            }
            if (table === 'competitors') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [], // No competitors
                        error: null,
                    }),
                };
            }
            return mockSupabase;
        });

        const result = await (dataRetentionCleanup as any).run();
        expect(result.success).toBe(true);
        expect(mockSupabase.delete).not.toHaveBeenCalled();
    });

    it('handles no users found', async () => {
        mockSupabase.from.mockImplementation((table) => {
            if (table === 'users') {
                return {
                    select: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            return mockSupabase;
        });

        const result = await (dataRetentionCleanup as any).run();

        expect(result.totalDeleted).toBe(0);
    });

    it('handles database error', async () => {
        mockSupabase.from.mockImplementation(() => ({
            select: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),
        }));

        const result = await (dataRetentionCleanup as any).run();

        expect(result.error).toBe('Failed to fetch users');
    });
});
