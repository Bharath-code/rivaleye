import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'fake-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn((url, key, config) => ({ url, key, config })),
}));

import { supabase, createServerClient } from '../supabase';
import { createClient } from '@supabase/supabase-js';

describe('supabase client utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize the default client with correct config', () => {
        expect(supabase).toBeDefined();
        expect(supabase.url).toBe('https://fake.supabase.co');
        expect((supabase as any).config.auth.persistSession).toBe(true);
    });

    it('should create a server client with service role key', () => {
        const client = createServerClient();
        expect(client.key).toBe('service-key');
    });

    it('should fallback to publishable key if service role is missing', () => {
        const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        const client = createServerClient();
        expect(client.key).toBe('fake-key');

        process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });
});
