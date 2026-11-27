// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ManualPresence, PresenceStatus } from '@discordia/api';
import { useManualPresence } from './useManualPresence';

const setup = (initial: ManualPresence = null, observed: PresenceStatus | null = null) => {
    const save = vi.fn(async () => undefined);
    const remember = vi.fn();
    const hook = renderHook(
        ({ current }: { current: PresenceStatus | null }) =>
            useManualPresence({ initial, observed: current, save, remember }),
        { initialProps: { current: observed } },
    );
    const observe = (current: PresenceStatus | null) => hook.rerender({ current });
    return { result: hook.result, observe, save, remember };
};

describe('useManualPresence', () => {
    it('starts from what was remembered', () => {
        const { result } = setup('invisible');

        expect(result.current.manual).toBe('invisible');
        expect(result.current.status).toBe('offline');
    });

    it('saves and remembers a choice', async () => {
        const { result, save, remember } = setup();

        await act(() => result.current.choose('dnd'));

        expect(save).toHaveBeenCalledWith('dnd');
        expect(remember).toHaveBeenLastCalledWith('dnd');
        expect(result.current.status).toBe('dnd');
    });

    it('keeps the choice while the observed status is still the old one', async () => {
        const { result, observe } = setup(null, 'online');

        await act(() => result.current.choose('dnd'));
        observe('online');

        expect(result.current.manual).toBe('dnd');
    });

    it('follows a change made somewhere else', () => {
        const { result, observe, remember } = setup(null, 'online');

        observe('dnd');
        expect(result.current.manual).toBe('dnd');

        observe('online');
        expect(result.current.manual).toBeNull();
        expect(remember).toHaveBeenLastCalledWith(null);
    });

    it('does not take offline as invisible', () => {
        const { result } = setup(null, 'offline');

        expect(result.current.manual).toBeNull();
        expect(result.current.status).toBe('online');
    });

    it('shows idle while there is no manual status', () => {
        const { result } = setup(null, 'idle');

        expect(result.current.status).toBe('idle');
    });

    it('keeps the previous choice when saving fails', async () => {
        const { result, save } = setup();
        save.mockRejectedValueOnce(new Error('chat down'));

        await act(() => result.current.choose('invisible'));

        expect(result.current.manual).toBeNull();
        expect(result.current.failed).toBe(true);
        expect(result.current.saving).toBe(false);
    });
});
