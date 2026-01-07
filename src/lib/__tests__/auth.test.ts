import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'fake-key';
});

const mockGet = vi.fn();
vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({
        get: mockGet,
    })),
}));

const mockSupabase = {
    auth: {
        getUser: vi.fn(),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase),
}));

import { getCurrentUser, isAuthenticated, getUserId } from '../auth';

describe('auth utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('isAuthenticated returns true if access token exists', async () => {
        mockGet.mockReturnValue({ value: 'token' });
        const result = await isAuthenticated();
        expect(result).toBe(true);
    });

    it('isAuthenticated returns false if access token missing', async () => {
        mockGet.mockReturnValue(null);
        const result = await isAuthenticated();
        expect(result).toBe(false);
    });

    it('getUserId returns user id from session', async () => {
        mockGet.mockReturnValue({ value: 'token' });
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

        const id = await getUserId();
        expect(id).toBe('u1');
    });

    it('getCurrentUser returns existing user from DB', async () => {
        mockGet.mockImplementation((name) => {
            if (name === 'sb-access-token') return { value: 'at' };
            if (name === 'sb-refresh-token') return { value: 'rt' };
            return null;
        });

        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 't@t.com' } }, error: null });
        mockSupabase.single.mockResolvedValue({ data: { id: 'u1', plan: 'pro' }, error: null });

        const user = await getCurrentUser();
        expect(user?.id).toBe('u1');
        expect(user?.plan).toBe('pro');
    });

    it('getCurrentUser creates user record if not found in DB', async () => {
        mockGet.mockReturnValue({ value: 'token' });
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u2', email: 'new@t.com' } }, error: null });

        // First select returns null (user not found)
        mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
            // Second select (after insert) returns the new user
            .mockResolvedValueOnce({ data: { id: 'u2', plan: 'free' }, error: null });

        const user = await getCurrentUser();
        expect(user?.id).toBe('u2');
        expect(mockSupabase.insert).toHaveBeenCalled();
    });
});
