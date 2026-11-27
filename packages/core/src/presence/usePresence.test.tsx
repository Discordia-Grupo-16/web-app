// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvalidateFrame, MemberPresence, PresenceFrame, PresenceStatus } from '@discordia/api';
import { RealtimeContext, type RealtimeContextValue } from '../chat/realtimeContext';
import { NOTICE_COALESCE_MS } from '../chat/useServerEvents';
import { usePresence, type PresenceMap } from './usePresence';

const SERVER = 'server-1';
const ANA = 'user-ana';
const BETO = 'user-beto';

const at = (second: number) => `2026-11-23T12:00:${String(second).padStart(2, '0')}Z`;

const member = (userId: string, status: PresenceStatus, second: number): MemberPresence => ({
    userId,
    status,
    updatedAt: at(second),
});

const frame = (userId: string, status: PresenceStatus, second: number): PresenceFrame => ({
    type: 'presence',
    ...member(userId, status, second),
});

const createFakeRealtime = () => {
    const frameHandlers = new Set<(f: PresenceFrame) => void>();
    const noticeHandlers = new Set<(f: InvalidateFrame) => void>();
    const reconnectHandlers = new Set<() => void>();
    const subscribe = <T,>(handlers: Set<T>) => (handler: T) => {
        handlers.add(handler);
        return () => {
            handlers.delete(handler);
        };
    };
    const value = {
        onPresence: subscribe(frameHandlers),
        onInvalidate: subscribe(noticeHandlers),
        onReconnect: subscribe(reconnectHandlers),
    } as unknown as RealtimeContextValue;
    return {
        value,
        send: (f: PresenceFrame) => act(() => frameHandlers.forEach((h) => h(f))),
        notice: (resources: string[], serverId = SERVER) =>
            act(() => noticeHandlers.forEach((h) => h({ type: 'invalidate', serverId, resources }))),
        reconnect: () => act(() => reconnectHandlers.forEach((h) => h())),
        subscribers: () => frameHandlers.size + noticeHandlers.size + reconnectHandlers.size,
    };
};

const asObject = (map: PresenceMap | null) => (map ? Object.fromEntries(map) : null);

describe('usePresence', () => {
    let realtime: ReturnType<typeof createFakeRealtime>;
    let getSnapshot: ReturnType<typeof vi.fn<(serverId: string) => Promise<MemberPresence[]>>>;

    beforeEach(() => {
        vi.useFakeTimers();
        realtime = createFakeRealtime();
        getSnapshot = vi.fn(async () => []);
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    // null stands for "no server": undefined would take the default.
    const render = (serverId: string | null = SERVER) =>
        renderHook(
            (props: { serverId: string | undefined }) => usePresence(props.serverId, getSnapshot, () => 0),
            {
                initialProps: { serverId: serverId ?? undefined } as { serverId: string | undefined },
                wrapper: ({ children }: { children: ReactNode }) => (
                    <RealtimeContext.Provider value={realtime.value}>{children}</RealtimeContext.Provider>
                ),
            },
        );

    const settle = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

    // A snapshot whose answer the test releases when it wants.
    const deferred = () => {
        let resolve!: (members: MemberPresence[]) => void;
        getSnapshot.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
        return (members: MemberPresence[]) => act(async () => resolve(members));
    };

    it('is null until the snapshot arrives, and then lists who is not offline', async () => {
        const answer = deferred();
        const { result } = render();
        expect(result.current).toBeNull();

        await answer([member(ANA, 'online', 1), member(BETO, 'dnd', 1)]);

        expect(getSnapshot).toHaveBeenCalledWith(SERVER);
        expect(asObject(result.current)).toEqual({ [ANA]: 'online', [BETO]: 'dnd' });
    });

    it('applies frames on top of the snapshot, and offline takes the user out', async () => {
        getSnapshot.mockResolvedValue([member(ANA, 'online', 1)]);
        const { result } = render();
        await settle();

        realtime.send(frame(ANA, 'idle', 2));
        realtime.send(frame(BETO, 'online', 2));
        expect(asObject(result.current)).toEqual({ [ANA]: 'idle', [BETO]: 'online' });
        realtime.send(frame(ANA, 'offline', 3));

        expect(asObject(result.current)).toEqual({ [BETO]: 'online' });
    });

    it('ignores a frame that is not newer, also after the user went offline', async () => {
        getSnapshot.mockResolvedValue([member(ANA, 'online', 1)]);
        const { result } = render();
        await settle();
        realtime.send(frame(ANA, 'offline', 5));

        realtime.send(frame(ANA, 'online', 4));
        realtime.send(frame(ANA, 'idle', 5));

        expect(asObject(result.current)).toEqual({});
    });

    it('compares instants, not strings', async () => {
        getSnapshot.mockResolvedValue([{ userId: ANA, status: 'online', updatedAt: '2026-11-23T12:00:05Z' }]);
        const { result } = render();
        await settle();

        realtime.send({ type: 'presence', userId: ANA, status: 'dnd', updatedAt: '2026-11-23T12:00:05.5Z' });

        expect(asObject(result.current)).toEqual({ [ANA]: 'dnd' });
    });

    it('keeps what a frame said while the snapshot was on its way', async () => {
        const answer = deferred();
        const { result } = render();
        realtime.send(frame(ANA, 'dnd', 9));
        realtime.send(frame(BETO, 'online', 9));

        // The snapshot is older for Ana and does not know Beto yet.
        await answer([member(ANA, 'online', 1)]);

        expect(asObject(result.current)).toEqual({ [ANA]: 'dnd', [BETO]: 'online' });
    });

    it('asks again after a reconnection and drops who is no longer there', async () => {
        getSnapshot.mockResolvedValueOnce([member(ANA, 'online', 1), member(BETO, 'online', 1)]);
        getSnapshot.mockResolvedValueOnce([member(ANA, 'idle', 2)]);
        const { result } = render();
        await settle();

        realtime.reconnect();
        await settle(NOTICE_COALESCE_MS);

        expect(getSnapshot).toHaveBeenCalledTimes(2);
        expect(asObject(result.current)).toEqual({ [ANA]: 'idle' });
    });

    it('shows again who left the snapshot and comes back with the same state', async () => {
        getSnapshot.mockResolvedValueOnce([member(ANA, 'online', 1)]);
        getSnapshot.mockResolvedValueOnce([]);
        getSnapshot.mockResolvedValueOnce([member(ANA, 'online', 1)]);
        const { result } = render();
        await settle();
        realtime.notice(['members']);
        await settle(NOTICE_COALESCE_MS);

        realtime.notice(['members']);
        await settle(NOTICE_COALESCE_MS);

        expect(asObject(result.current)).toEqual({ [ANA]: 'online' });
    });

    it('asks again only for notices about the members of this server', async () => {
        render();
        await settle();

        realtime.notice(['channels']);
        realtime.notice(['members'], 'another-server');
        await settle(NOTICE_COALESCE_MS);
        expect(getSnapshot).toHaveBeenCalledTimes(1);
        realtime.notice(['members']);
        await settle(NOTICE_COALESCE_MS);

        expect(getSnapshot).toHaveBeenCalledTimes(2);
    });

    it('asks again when the tab becomes visible', async () => {
        render();
        await settle();

        document.dispatchEvent(new Event('visibilitychange'));

        expect(getSnapshot).toHaveBeenCalledTimes(2);
    });

    it('ignores a snapshot older than one already applied', async () => {
        const first = deferred();
        const { result } = render();
        getSnapshot.mockResolvedValueOnce([member(ANA, 'idle', 2)]);
        document.dispatchEvent(new Event('visibilitychange'));
        await settle();

        await first([member(ANA, 'online', 1), member(BETO, 'online', 1)]);

        expect(asObject(result.current)).toEqual({ [ANA]: 'idle' });
    });

    it('does not show the previous server while the next one loads', async () => {
        getSnapshot.mockResolvedValueOnce([member(ANA, 'online', 1)]);
        const { result, rerender } = render();
        await settle();
        deferred();

        rerender({ serverId: 'server-2' });

        expect(result.current).toBeNull();
        expect(getSnapshot).toHaveBeenLastCalledWith('server-2');
    });

    it('stays silent when the snapshot fails', async () => {
        getSnapshot.mockRejectedValue(new Error('403'));
        const { result } = render();

        await settle();

        expect(result.current).toBeNull();
    });

    it('does not ask without a server, and unsubscribes on unmount', async () => {
        render(null);
        await settle();
        expect(getSnapshot).not.toHaveBeenCalled();
        cleanup();

        const { unmount } = render();
        unmount();

        expect(realtime.subscribers()).toBe(0);
    });
});
