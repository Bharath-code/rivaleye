import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSchedules } = vi.hoisted(() => {
    return {
        mockSchedules: {
            create: vi.fn(() => Promise.resolve({ id: 'sched-1' })),
            deactivate: vi.fn(() => Promise.resolve()),
            activate: vi.fn(() => Promise.resolve()),
            del: vi.fn(() => Promise.resolve()),
            list: vi.fn(() => Promise.resolve([{ id: 's1' }])),
            timezones: vi.fn(() => Promise.resolve(['UTC'])),
        }
    };
});

// Mock Trigdev
vi.mock('@trigger.dev/sdk/v3', () => ({
    schedules: mockSchedules,
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock the task since it's imported in userSchedules.ts
vi.mock('../dailyAnalysis', () => ({
    dailyCompetitorAnalysis: { id: 'daily-task' }
}));

import {
    createUserSchedule,
    updateUserSchedule,
    deactivateUserSchedule,
    activateUserSchedule,
    deleteUserSchedule,
    listAllSchedules,
    getTimezones
} from '../userSchedules';

describe('userSchedules', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSchedules.activate.mockResolvedValue(undefined);
        mockSchedules.deactivate.mockResolvedValue(undefined);
        mockSchedules.del.mockResolvedValue(undefined);
    });

    it('creates a schedule with correct cron for each plan', async () => {
        const free = await createUserSchedule('u1', 'free');
        expect(free.cron).toBe('0 6 * * *');
        expect(mockSchedules.create).toHaveBeenCalledWith(expect.objectContaining({
            cron: '0 6 * * *',
            externalId: 'u1',
        }));

        const pro = await createUserSchedule('u2', 'pro');
        expect(pro.cron).toBe('0 */6 * * *');

        const ent = await createUserSchedule('u3', 'enterprise');
        expect(ent.cron).toBe('0 * * * *');
    });

    it('updates a schedule just calls create (idempotent in Trigger.dev)', async () => {
        await updateUserSchedule('u1', 'pro');
        expect(mockSchedules.create).toHaveBeenCalledWith(expect.objectContaining({
            cron: '0 */6 * * *',
            externalId: 'u1',
        }));
    });

    it('manages schedule states (activate/deactivate/delete)', async () => {
        await activateUserSchedule('s1');
        expect(mockSchedules.activate).toHaveBeenCalledWith('s1');

        await deactivateUserSchedule('s1');
        expect(mockSchedules.deactivate).toHaveBeenCalledWith('s1');

        await deleteUserSchedule('s1');
        expect(mockSchedules.del).toHaveBeenCalledWith('s1');
    });

    it('lists all schedules and timezones', async () => {
        const list = await listAllSchedules();
        expect(list).toEqual([{ id: 's1' }]);

        const tz = await getTimezones();
        expect(tz).toEqual(['UTC']);
    });

    it('handles errors in activation', async () => {
        mockSchedules.activate.mockRejectedValue(new Error('Activate failed'));
        const result = await activateUserSchedule('s1');
        expect(result).toBe(false);
    });

    it('handles errors in deactivation', async () => {
        mockSchedules.deactivate.mockRejectedValue(new Error('Deactivate failed'));
        const result = await deactivateUserSchedule('s1');
        expect(result).toBe(false);
    });

    it('handles errors in deletion', async () => {
        mockSchedules.del.mockRejectedValue(new Error('Delete failed'));
        const result = await deleteUserSchedule('s1');
        expect(result).toBe(false);
    });
});
