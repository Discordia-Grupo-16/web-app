import { afterEach, describe, expect, it } from 'vitest';
import { dismissedRejections } from './dismissedRejections';

describe('dismissedRejections (web)', () => {
    afterEach(() => localStorage.clear());

    it('has nothing for a server where no rejection was closed', async () => {
        await expect(dismissedRejections.get('srv')).resolves.toBeNull();
    });

    it('keeps the closed rejection in localStorage, separately for each server', async () => {
        await dismissedRejections.set('srv', '2026-11-05T10:00:00Z');

        // What survives a reload is what localStorage has, not what the module keeps in memory.
        expect(Object.values(localStorage)).toEqual(['2026-11-05T10:00:00Z']);
        await expect(dismissedRejections.get('srv')).resolves.toBe('2026-11-05T10:00:00Z');
        await expect(dismissedRejections.get('other')).resolves.toBeNull();
    });

    it('keeps only the last rejection closed in a server', async () => {
        await dismissedRejections.set('srv', '2026-11-05T10:00:00Z');
        await dismissedRejections.set('srv', '2026-11-06T09:00:00Z');

        await expect(dismissedRejections.get('srv')).resolves.toBe('2026-11-06T09:00:00Z');
    });
});
