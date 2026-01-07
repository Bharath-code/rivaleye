import { describe, it, expect, vi } from 'vitest';

// Test only the simple, non-chained function
import { detectManualSpam } from '../abuseDetection';

describe('abuseDetection', () => {
    it('detectManualSpam flags when user hits limit', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { manual_checks_today: 5, plan: 'free' },
                            error: null
                        })
                    })
                })
            })
        };

        const result = await detectManualSpam(mockSupabase as any, 'u1');
        expect(result.flagged).toBe(true);
        expect(result.flag).toBe('manual_spam');
    });

    it('detectManualSpam does not flag when below limit', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { manual_checks_today: 0, plan: 'free' },
                            error: null
                        })
                    })
                })
            })
        };

        const result = await detectManualSpam(mockSupabase as any, 'u1');
        expect(result.flagged).toBe(false);
    });

    it('detectManualSpam handles missing user', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: null, error: null })
                    })
                })
            })
        };

        const result = await detectManualSpam(mockSupabase as any, 'u1');
        expect(result.flagged).toBe(false);
    });
});
