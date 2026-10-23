// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeClient, RealtimeEventMap } from '@discordia/api';
import { useSuspensionSignOut } from './useSuspensionSignOut';

const signOut = vi.fn(async () => {});

vi.mock('../session/AuthProvider', () => ({
    useAuth: () => ({ signOut }),
}));

// Only on() matters here: it records the 'terminated' handlers so the test can fire them.
function fakeClient() {
    const handlers = new Set<RealtimeEventMap['terminated']>();
    const client = {
        on: vi.fn((event: string, handler: RealtimeEventMap['terminated']) => {
            if (event === 'terminated') handlers.add(handler);
            return () => handlers.delete(handler);
        }),
    } as unknown as RealtimeClient;
    const terminate = (code: number, reason = '') => handlers.forEach((h) => h({ code, reason }));
    return { client, terminate, handlers };
}

beforeEach(() => {
    signOut.mockClear();
});

describe('useSuspensionSignOut', () => {
    it('on a 4403 close calls onSuspended and signOut, once each', () => {
        const { client, terminate } = fakeClient();
        const onSuspended = vi.fn();
        renderHook(() => useSuspensionSignOut(client, onSuspended));

        terminate(4403, 'account_suspended');

        expect(onSuspended).toHaveBeenCalledTimes(1);
        expect(signOut).toHaveBeenCalledTimes(1);
    });

    it.each([4000, 1001])('a %i close calls nothing', (code) => {
        const { client, terminate } = fakeClient();
        const onSuspended = vi.fn();
        renderHook(() => useSuspensionSignOut(client, onSuspended));

        terminate(code);

        expect(onSuspended).not.toHaveBeenCalled();
        expect(signOut).not.toHaveBeenCalled();
    });

    it('unsubscribes on unmount: a later terminated event calls nothing', () => {
        const { client, terminate, handlers } = fakeClient();
        const onSuspended = vi.fn();
        const { unmount } = renderHook(() => useSuspensionSignOut(client, onSuspended));

        unmount();
        terminate(4403);

        expect(handlers.size).toBe(0);
        expect(onSuspended).not.toHaveBeenCalled();
        expect(signOut).not.toHaveBeenCalled();
    });

    it('does not re-subscribe when onSuspended changes identity, and calls the latest one', () => {
        const { client, terminate } = fakeClient();
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(({ cb }) => useSuspensionSignOut(client, cb), {
            initialProps: { cb: first },
        });

        rerender({ cb: second });
        terminate(4403);

        expect(client.on).toHaveBeenCalledTimes(1);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('with a null client (realtime disabled) does not break', () => {
        const onSuspended = vi.fn();

        expect(() => renderHook(() => useSuspensionSignOut(null, onSuspended))).not.toThrow();
        expect(onSuspended).not.toHaveBeenCalled();
    });
});
