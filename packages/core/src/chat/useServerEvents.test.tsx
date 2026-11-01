// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvalidateFrame } from '@discordia/api';
import { RealtimeContext, type RealtimeContextValue, type RealtimeStatus } from './realtimeContext';
import {
    BACKUP_POLL_INTERVAL_MS,
    FALLBACK_POLL_INTERVAL_MS,
    useServerEvents,
    usePollIntervalMs,
    type UseServerEventsOptions,
} from './useServerEvents';

// A realtime context with only what the hook reads: who is subscribed to the notices and to the
// reconnections, and a way to fire both.
const createFakeRealtime = (status: RealtimeStatus = 'open') => {
    const noticeHandlers = new Set<(frame: InvalidateFrame) => void>();
    const reconnectHandlers = new Set<() => void>();
    const value = {
        status,
        onInvalidate: (handler: (frame: InvalidateFrame) => void) => {
            noticeHandlers.add(handler);
            return () => {
                noticeHandlers.delete(handler);
            };
        },
        onReconnect: (handler: () => void) => {
            reconnectHandlers.add(handler);
            return () => {
                reconnectHandlers.delete(handler);
            };
        },
    } as unknown as RealtimeContextValue;
    return {
        value,
        notice: (frame: Partial<InvalidateFrame> & { resources: string[] }) =>
            act(() => noticeHandlers.forEach((h) => h({ type: 'invalidate', ...frame }))),
        reconnect: () => act(() => reconnectHandlers.forEach((h) => h())),
        subscribers: () => noticeHandlers.size + reconnectHandlers.size,
    };
};

describe('useServerEvents', () => {
    let realtime: ReturnType<typeof createFakeRealtime>;
    const onInvalidate = vi.fn();

    beforeEach(() => {
        vi.useFakeTimers();
        realtime = createFakeRealtime();
        onInvalidate.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // random: () => 0 leaves only the coalescing window, so the delay is exactly 300 ms.
    const render = (options: Partial<UseServerEventsOptions> = {}) =>
        renderHook(
            (props: UseServerEventsOptions) => useServerEvents(props),
            {
                wrapper: ({ children }: { children: ReactNode }) => (
                    <RealtimeContext.Provider value={realtime.value}>{children}</RealtimeContext.Provider>
                ),
                initialProps: { resources: ['channels'], onInvalidate, random: () => 0, ...options },
            },
        );

    const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

    it('refetches after the coalescing window when a notice for a resource it has arrives', () => {
        render();

        realtime.notice({ serverId: 's1', resources: ['channels'] });
        wait(299);
        expect(onInvalidate).not.toHaveBeenCalled();

        wait(1);
        expect(onInvalidate).toHaveBeenCalledTimes(1);
    });

    it('adds a random delay on top, up to the jitter bound', () => {
        render({ random: () => 0.5 });

        realtime.notice({ resources: ['channels'] });
        wait(799);
        expect(onInvalidate).not.toHaveBeenCalled();

        wait(1);
        expect(onInvalidate).toHaveBeenCalledTimes(1);
    });

    it('turns several notices into one refetch, and a later one starts another', () => {
        render();

        realtime.notice({ resources: ['channels'] });
        wait(100);
        realtime.notice({ resources: ['channels'] });
        realtime.notice({ resources: ['channels'] });
        wait(200);
        expect(onInvalidate).toHaveBeenCalledTimes(1);

        realtime.notice({ resources: ['channels'] });
        wait(300);
        expect(onInvalidate).toHaveBeenCalledTimes(2);
    });

    it('ignores a notice for a resource it does not have', () => {
        render({ resources: ['members'] });

        realtime.notice({ resources: ['channels', 'bans'] });
        wait(2000);

        expect(onInvalidate).not.toHaveBeenCalled();
    });

    it('matches any of its resources, and ignores a resource it does not know', () => {
        render({ resources: ['server', 'channels', 'permissions'] });

        realtime.notice({ resources: ['a-future-resource', 'permissions'] });
        wait(300);

        expect(onInvalidate).toHaveBeenCalledTimes(1);
    });

    it('ignores a notice about another server, but not one without a server', () => {
        render({ resources: ['members', 'profile'], serverId: 's1' });

        realtime.notice({ serverId: 's2', resources: ['members'] });
        wait(2000);
        expect(onInvalidate).not.toHaveBeenCalled();

        realtime.notice({ resources: ['profile'] });
        wait(300);
        expect(onInvalidate).toHaveBeenCalledTimes(1);
    });

    it('without a serverId it takes the notice of any server', () => {
        render({ resources: ['members'] });

        realtime.notice({ serverId: 's9', resources: ['members'] });
        wait(300);

        expect(onInvalidate).toHaveBeenCalledTimes(1);
    });

    it('refetches when the socket comes back, since the notices that went by are lost', () => {
        render();

        realtime.reconnect();
        wait(300);

        expect(onInvalidate).toHaveBeenCalledTimes(1);
    });

    it('does nothing and does not subscribe while disabled', () => {
        render({ enabled: false });

        expect(realtime.subscribers()).toBe(0);
        realtime.notice({ resources: ['channels'] });
        wait(2000);
        expect(onInvalidate).not.toHaveBeenCalled();
    });

    it('drops a pending refetch when it unmounts, and unsubscribes', () => {
        const { unmount } = render();
        realtime.notice({ resources: ['channels'] });

        unmount();
        wait(2000);

        expect(onInvalidate).not.toHaveBeenCalled();
        expect(realtime.subscribers()).toBe(0);
    });

    it('calls the latest onInvalidate, not the one from the render that subscribed', () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = render({ onInvalidate: first });
        rerender({ resources: ['channels'], onInvalidate: second, random: () => 0 });

        realtime.notice({ resources: ['channels'] });
        wait(300);

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('does not resubscribe when the resources array is a new one with the same contents', () => {
        const { rerender } = render({ resources: ['channels', 'members'] });
        const before = realtime.subscribers();

        rerender({ resources: ['channels', 'members'], onInvalidate, random: () => 0 });

        expect(realtime.subscribers()).toBe(before);
    });

    it('does nothing, and does not throw, without a realtime provider', () => {
        expect(() =>
            renderHook(() => useServerEvents({ resources: ['channels'], onInvalidate })),
        ).not.toThrow();
        wait(2000);
        expect(onInvalidate).not.toHaveBeenCalled();
    });
});

describe('usePollIntervalMs', () => {
    const intervalWith = (status: RealtimeStatus | null) =>
        renderHook(() => usePollIntervalMs(), {
            wrapper: ({ children }: { children: ReactNode }) =>
                status === null ? (
                    <>{children}</>
                ) : (
                    <RealtimeContext.Provider value={createFakeRealtime(status).value}>{children}</RealtimeContext.Provider>
                ),
        }).result.current;

    it('is the slow backup while realtime pushes the changes', () => {
        expect(intervalWith('open')).toBe(BACKUP_POLL_INTERVAL_MS);
        expect(intervalWith('reconnecting')).toBe(BACKUP_POLL_INTERVAL_MS);
    });

    it('goes back to the old 5 seconds when realtime is disabled or there is no provider', () => {
        expect(intervalWith('disabled')).toBe(FALLBACK_POLL_INTERVAL_MS);
        expect(intervalWith(null)).toBe(FALLBACK_POLL_INTERVAL_MS);
    });
});
