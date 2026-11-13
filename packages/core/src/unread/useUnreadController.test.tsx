// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelUnread, InvalidateFrame, MessageCreatedFrame, ReadState, ReadStateUpdatedFrame } from '@discordia/api';
import { RealtimeContext, type RealtimeContextValue } from '../chat/realtimeContext';
import { UnreadContext } from './unreadContext';
import { ACCESS_RELOAD_GROUP_MS, MARK_READ_GROUP_MS, useUnreadController, type UnreadControllerOptions } from './useUnreadController';
import { useChannelUnread, useMarkAllRead, useMarkChannelRead, useServerUnread } from './useUnread';

const ME = 'me';
const at = (n: number) => new Date(Date.UTC(2026, 10, 2, 12, n)).toISOString().replace('.000Z', 'Z');

const item = (overrides: Partial<ChannelUnread> = {}): ChannelUnread => ({
    channelId: 'c1',
    serverId: 's1',
    lastMessageId: 'm2',
    lastMessageAt: at(2),
    lastReadMessageId: 'm1',
    lastReadAt: at(1),
    unread: true,
    mentionCount: 0,
    ...overrides,
});

const created = (n: number, overrides: Partial<MessageCreatedFrame> = {}): MessageCreatedFrame => ({
    type: 'message.created',
    messageId: `m${n}`,
    channelId: 'c1',
    serverId: 's1',
    authorId: 'other',
    content: 'hola',
    createdAt: at(n),
    clientMessageId: `cm${n}`,
    ...overrides,
});

const readOf = (n: number, channelId = 'c1'): ReadState => ({
    channelId,
    serverId: 's1',
    lastReadMessageId: `m${n}`,
    lastReadAt: at(n),
});

// The realtime context with only what the controller reads, and a way to fire each event.
const createFakeRealtime = () => {
    const messages = new Set<(frame: MessageCreatedFrame) => void>();
    const reads = new Set<(frame: ReadStateUpdatedFrame) => void>();
    const reconnects = new Set<() => void>();
    const invalidates = new Set<(frame: InvalidateFrame) => void>();
    const value = {
        onMessageCreated: (h: (frame: MessageCreatedFrame) => void) => {
            messages.add(h);
            return () => void messages.delete(h);
        },
        onReadStateUpdated: (h: (frame: ReadStateUpdatedFrame) => void) => {
            reads.add(h);
            return () => void reads.delete(h);
        },
        onReconnect: (h: () => void) => {
            reconnects.add(h);
            return () => void reconnects.delete(h);
        },
        onInvalidate: (h: (frame: InvalidateFrame) => void) => {
            invalidates.add(h);
            return () => void invalidates.delete(h);
        },
    } as unknown as RealtimeContextValue;
    return {
        value,
        message: (frame: MessageCreatedFrame) => act(() => messages.forEach((h) => h(frame))),
        readState: (...states: ReadState[]) =>
            act(() => reads.forEach((h) => h({ type: 'read-state.updated', userId: ME, states }))),
        reconnect: () => act(() => reconnects.forEach((h) => h())),
        notice: (frame: Omit<InvalidateFrame, 'type'>) =>
            act(() => invalidates.forEach((h) => h({ type: 'invalidate', ...frame }))),
        subscribers: () => messages.size + reads.size + reconnects.size + invalidates.size,
    };
};

describe('useUnreadController', () => {
    let realtime: ReturnType<typeof createFakeRealtime>;
    let service: {
        getUnread: ReturnType<typeof vi.fn>;
        markRead: ReturnType<typeof vi.fn>;
        markAllRead: ReturnType<typeof vi.fn>;
    };
    const logger = { error: vi.fn() };

    beforeEach(() => {
        vi.useFakeTimers();
        realtime = createFakeRealtime();
        logger.error.mockClear();
        service = {
            getUnread: vi.fn(async () => [item()]),
            // The server answers with the state that holds after the request.
            markRead: vi.fn(async (channelId: string, messageId: string) => ({
                channelId,
                serverId: 's1',
                lastReadMessageId: messageId,
                lastReadAt: at(Number(messageId.slice(1))),
            })),
            markAllRead: vi.fn(async () => [readOf(2)]),
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <RealtimeContext.Provider value={realtime.value}>{children}</RealtimeContext.Provider>
    );

    // Renders the controller and lets its first load settle.
    const asService = () => service as unknown as UnreadControllerOptions['service'];
    const setup = async (userId: string | null = ME) => {
        const hook = renderHook(
            (props: { userId: string | null }) => useUnreadController({ service: asService(), userId: props.userId, logger }),
            { wrapper, initialProps: { userId } },
        );
        await act(async () => {});
        return hook;
    };

    const unreadOf = (hook: Awaited<ReturnType<typeof setup>>, channelId = 'c1') =>
        hook.result.current.state.byChannel[channelId]?.unread;

    it('loads the unread state when there is a session', async () => {
        const hook = await setup();

        expect(service.getUnread).toHaveBeenCalledTimes(1);
        expect(unreadOf(hook)).toBe(true);
    });

    it('loads nothing without a session, and forgets what it had when the session ends', async () => {
        const hook = await setup(null);
        expect(service.getUnread).not.toHaveBeenCalled();

        hook.rerender({ userId: ME });
        await act(async () => {});
        expect(unreadOf(hook)).toBe(true);

        hook.rerender({ userId: null });
        expect(hook.result.current.state.byChannel).toEqual({});
    });

    it('loads again when the socket comes back, because the events in between were lost', async () => {
        await setup();

        realtime.reconnect();
        await act(async () => {});

        expect(service.getUnread).toHaveBeenCalledTimes(2);
    });

    describe('loading again when the channels the user can see change', () => {
        const waitForReload = () =>
            act(async () => {
                vi.advanceTimersByTime(ACCESS_RELOAD_GROUP_MS);
            });

        // The bug found in the manual test: a member who joined with the session open saw the
        // history of the new server as read until a reload.
        it('shows the history of a server the user just joined as unread', async () => {
            const hook = await setup();
            service.getUnread.mockResolvedValueOnce([item(), item({ channelId: 'c9', serverId: 's9', lastReadMessageId: null, lastReadAt: null })]);

            realtime.notice({ resources: ['servers'] });
            await waitForReload();

            expect(unreadOf(hook, 'c9')).toBe(true);
        });

        it('turns the notices of a join into a single request', async () => {
            await setup();

            realtime.notice({ resources: ['servers'] });
            realtime.notice({ serverId: 's9', resources: ['permissions', 'channels'] });
            await waitForReload();

            expect(service.getUnread).toHaveBeenCalledTimes(2);
        });

        it('does not load again for notices that do not change what the user sees', async () => {
            await setup();

            realtime.notice({ serverId: 's1', resources: ['members', 'channels', 'bans'] });
            realtime.notice({ resources: ['profile'], userId: 'other' });
            await waitForReload();

            expect(service.getUnread).toHaveBeenCalledTimes(1);
        });

        it('a pending reload is dropped on unmount', async () => {
            const hook = await setup();

            realtime.notice({ resources: ['servers'] });
            hook.unmount();
            await waitForReload();

            expect(service.getUnread).toHaveBeenCalledTimes(1);
        });
    });

    it('applies the messages and the reads that arrive over the socket', async () => {
        service.getUnread.mockResolvedValue([item({ unread: false, lastReadMessageId: 'm2', lastReadAt: at(2) })]);
        const hook = await setup();

        realtime.message(created(3));
        expect(unreadOf(hook)).toBe(true);

        realtime.readState(readOf(3));
        expect(unreadOf(hook)).toBe(false);
    });

    it('a message of the user does not make the channel unread', async () => {
        service.getUnread.mockResolvedValue([item({ unread: false, lastReadMessageId: 'm2', lastReadAt: at(2) })]);
        const hook = await setup();

        realtime.message(created(3, { authorId: ME }));

        expect(unreadOf(hook)).toBe(false);
    });

    it('does not apply an old answer over a newer one', async () => {
        let releaseFirst: (items: ChannelUnread[]) => void = () => {};
        service.getUnread
            .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
            .mockResolvedValueOnce([item({ unread: false })]);
        const hook = renderHook(() => useUnreadController({ service: asService(), userId: ME, logger }), { wrapper });

        realtime.reconnect();
        await act(async () => {});
        await act(async () => releaseFirst([item({ unread: true })]));

        expect(hook.result.current.state.byChannel.c1.unread).toBe(false);
    });

    it('logs and keeps going when the load fails', async () => {
        service.getUnread.mockRejectedValueOnce(new Error('down'));

        const hook = await setup();

        expect(logger.error).toHaveBeenCalled();
        expect(hook.result.current.state.byChannel).toEqual({});
    });

    it('unsubscribes from the socket on unmount', async () => {
        const hook = await setup();
        expect(realtime.subscribers()).toBe(4);

        hook.unmount();

        expect(realtime.subscribers()).toBe(0);
    });

    describe('marking the open channel as read', () => {
        it('opening a channel with news reports it up to its last message', async () => {
            const hook = await setup();

            await act(async () => hook.result.current.setActiveChannel('c1', true));

            expect(service.markRead).toHaveBeenCalledExactlyOnceWith('c1', 'm2');
            expect(unreadOf(hook)).toBe(false);
        });

        it('opening a channel with nothing new sends nothing', async () => {
            service.getUnread.mockResolvedValue([item({ unread: false, lastReadMessageId: 'm2', lastReadAt: at(2) })]);
            const hook = await setup();

            await act(async () => hook.result.current.setActiveChannel('c1', true));

            expect(service.markRead).not.toHaveBeenCalled();
        });

        it('does not report a channel whose tab is hidden', async () => {
            const hook = await setup();

            await act(async () => hook.result.current.setActiveChannel('c1', false));
            await act(async () => vi.advanceTimersByTime(MARK_READ_GROUP_MS * 3));

            expect(service.markRead).not.toHaveBeenCalled();
            expect(unreadOf(hook)).toBe(true);
        });

        it('a message that arrives in a hidden tab is still news, and is reported when the tab is shown', async () => {
            service.getUnread.mockResolvedValue([item({ unread: false, lastReadMessageId: 'm2', lastReadAt: at(2) })]);
            const hook = await setup();
            await act(async () => hook.result.current.setActiveChannel('c1', false));

            realtime.message(created(3));
            await act(async () => vi.advanceTimersByTime(MARK_READ_GROUP_MS * 3));
            expect(unreadOf(hook)).toBe(true);
            expect(service.markRead).not.toHaveBeenCalled();

            await act(async () => hook.result.current.setActiveChannel('c1', true));
            expect(service.markRead).toHaveBeenCalledExactlyOnceWith('c1', 'm3');
            expect(unreadOf(hook)).toBe(false);
        });

        it('a message in the channel that is open and visible never lights the indicator', async () => {
            service.getUnread.mockResolvedValue([item({ unread: false, lastReadMessageId: 'm2', lastReadAt: at(2) })]);
            const hook = await setup();
            await act(async () => hook.result.current.setActiveChannel('c1', true));

            realtime.message(created(3));

            expect(unreadOf(hook)).toBe(false);
        });

        it('five messages in a row become a single request', async () => {
            service.getUnread.mockResolvedValue([item({ unread: false, lastReadMessageId: 'm2', lastReadAt: at(2) })]);
            const hook = await setup();
            await act(async () => hook.result.current.setActiveChannel('c1', true));

            for (const n of [3, 4, 5, 6, 7]) realtime.message(created(n));
            expect(service.markRead).not.toHaveBeenCalled();
            await act(async () => vi.advanceTimersByTime(MARK_READ_GROUP_MS));

            expect(service.markRead).toHaveBeenCalledExactlyOnceWith('c1', 'm7');
        });

        it('a message of the user in the open channel sends no request: the server already counts it', async () => {
            service.getUnread.mockResolvedValue([item({ unread: false, lastReadMessageId: 'm2', lastReadAt: at(2) })]);
            const hook = await setup();
            await act(async () => hook.result.current.setActiveChannel('c1', true));

            realtime.message(created(3, { authorId: ME }));
            await act(async () => vi.advanceTimersByTime(MARK_READ_GROUP_MS * 3));

            expect(service.markRead).not.toHaveBeenCalled();
        });

        it('what is pending goes out right away when the user leaves the channel or hides the tab', async () => {
            service.getUnread.mockResolvedValue([item({ unread: false, lastReadMessageId: 'm2', lastReadAt: at(2) })]);
            const hook = await setup();
            await act(async () => hook.result.current.setActiveChannel('c1', true));
            realtime.message(created(3));

            await act(async () => hook.result.current.setActiveChannel('c1', false));

            expect(service.markRead).toHaveBeenCalledExactlyOnceWith('c1', 'm3');
            await act(async () => vi.advanceTimersByTime(MARK_READ_GROUP_MS * 3));
            expect(service.markRead).toHaveBeenCalledTimes(1);
        });

        it('a message that arrives while a request is on its way is reported afterwards', async () => {
            service.getUnread.mockResolvedValue([item({ unread: false, lastReadMessageId: 'm2', lastReadAt: at(2) })]);
            const hook = await setup();
            await act(async () => hook.result.current.setActiveChannel('c1', true));
            let release: (state: ReadState) => void = () => {};
            service.markRead.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
            realtime.message(created(3));
            await act(async () => vi.advanceTimersByTime(MARK_READ_GROUP_MS));
            // m4 comes in while the request for m3 is still open, and its own timer fires before
            // the answer: that attempt is skipped, so only the follow-up can report it.
            realtime.message(created(4));
            await act(async () => vi.advanceTimersByTime(MARK_READ_GROUP_MS));
            expect(service.markRead).toHaveBeenCalledTimes(1);

            await act(async () => release(readOf(3)));
            await act(async () => vi.advanceTimersByTime(MARK_READ_GROUP_MS));

            expect(service.markRead).toHaveBeenNthCalledWith(2, 'c1', 'm4');
        });

        it('a failed request is logged and does not clear the indicator', async () => {
            const hook = await setup();
            service.markRead.mockRejectedValueOnce(new Error('down'));

            await act(async () => hook.result.current.setActiveChannel('c1', true));

            expect(logger.error).toHaveBeenCalled();
            expect(unreadOf(hook)).toBe(true);
        });

        it('applies the state the server answers even when it is ahead of what was asked', async () => {
            const hook = await setup();
            service.markRead.mockResolvedValueOnce(readOf(5));

            await act(async () => hook.result.current.setActiveChannel('c1', true));

            expect(hook.result.current.state.byChannel.c1.lastReadMessageId).toBe('m5');
            expect(unreadOf(hook)).toBe(false);
        });

        it('what a reload brings for the open channel is reported too', async () => {
            const hook = await setup();
            await act(async () => hook.result.current.setActiveChannel('c1', true));
            service.markRead.mockClear();
            service.getUnread.mockResolvedValue([item({ lastMessageId: 'm9', lastMessageAt: at(9), unread: true })]);

            realtime.reconnect();
            await act(async () => {});
            await act(async () => vi.advanceTimersByTime(MARK_READ_GROUP_MS));

            expect(service.markRead).toHaveBeenCalledExactlyOnceWith('c1', 'm9');
        });
    });

    describe('markAllRead', () => {
        it('applies the states the server answers', async () => {
            const hook = await setup();

            await act(async () => hook.result.current.markAllRead());

            expect(service.markAllRead).toHaveBeenCalledTimes(1);
            expect(unreadOf(hook)).toBe(false);
        });

        it('does not switch off a message that arrived after the server built its answer', async () => {
            const hook = await setup();
            let release: (states: ReadState[]) => void = () => {};
            service.markAllRead.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));

            let pending: Promise<void> = Promise.resolve();
            act(() => { pending = hook.result.current.markAllRead(); });
            realtime.message(created(4));
            await act(async () => { release([readOf(2)]); await pending; });

            expect(unreadOf(hook)).toBe(true);
        });

        it('rejects when the request fails, so the caller can say so', async () => {
            const hook = await setup();
            service.markAllRead.mockRejectedValueOnce(new Error('down'));

            await expect(act(async () => hook.result.current.markAllRead())).rejects.toThrow('down');
        });
    });
});

describe('unread hooks', () => {
    const state = {
        byChannel: {
            c1: { serverId: 's1', lastMessageId: 'm2', lastMessageAt: at(2), lastReadMessageId: null, lastReadAt: null, unread: true, mentionCount: 3 },
            c2: { serverId: 's2', lastMessageId: 'm1', lastMessageAt: at(1), lastReadMessageId: 'm1', lastReadAt: at(1), unread: false, mentionCount: 0 },
        },
    };
    const setActiveChannel = vi.fn();
    const markAllRead = vi.fn(async () => {});
    const provider = ({ children }: { children: ReactNode }) => (
        <UnreadContext.Provider value={{ state, setActiveChannel, markAllRead }}>{children}</UnreadContext.Provider>
    );

    beforeEach(() => {
        setActiveChannel.mockClear();
    });

    it('useChannelUnread and useServerUnread read the indicator, with the mentions', () => {
        const channel = renderHook(() => useChannelUnread('c1'), { wrapper: provider });
        const server = renderHook(() => useServerUnread('s1'), { wrapper: provider });
        const quiet = renderHook(() => useServerUnread('s2'), { wrapper: provider });

        expect(channel.result.current).toEqual({ unread: true, mentionCount: 3 });
        expect(server.result.current).toEqual({ unread: true, mentionCount: 3 });
        expect(quiet.result.current).toEqual({ unread: false, mentionCount: 0 });
    });

    it('useMarkAllRead says whether anything is unread and exposes the action', async () => {
        const { result } = renderHook(() => useMarkAllRead(), { wrapper: provider });

        expect(result.current.anyUnread).toBe(true);
        await result.current.markAllRead();
        expect(markAllRead).toHaveBeenCalledTimes(1);
    });

    it('useMarkChannelRead reports the channel as active, and as none when it unmounts', () => {
        const { unmount } = renderHook(() => useMarkChannelRead('c1', true), { wrapper: provider });
        expect(setActiveChannel).toHaveBeenLastCalledWith('c1', true);

        unmount();

        expect(setActiveChannel).toHaveBeenLastCalledWith(null, false);
    });

    it('useMarkChannelRead follows the visibility', () => {
        const { rerender } = renderHook(({ visible }) => useMarkChannelRead('c1', visible), {
            wrapper: provider,
            initialProps: { visible: true },
        });

        rerender({ visible: false });

        expect(setActiveChannel).toHaveBeenCalledWith('c1', false);
    });

    it('without a provider nothing is unread and nothing breaks', async () => {
        const channel = renderHook(() => useChannelUnread('c1'));
        const all = renderHook(() => useMarkAllRead());

        expect(channel.result.current).toEqual({ unread: false, mentionCount: 0 });
        expect(all.result.current.anyUnread).toBe(false);
        await expect(all.result.current.markAllRead()).resolves.toBeUndefined();
        expect(() => renderHook(() => useMarkChannelRead('c1', true))).not.toThrow();
    });
});
