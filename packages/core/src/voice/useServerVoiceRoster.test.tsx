// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicProfiles, User, VoiceParticipantsUpdatedFrame, VoiceRoomParticipants } from '@discordia/api';
import { UNAVAILABLE_USER_NAME } from '../chat/authorName';
import { RealtimeContext, type RealtimeContextValue } from '../chat/realtimeContext';
import { PublicProfilesProvider, type PublicProfileSource } from '../profiles/PublicProfilesProvider';
import { useAuth } from '../session/AuthProvider';
import { useServerVoiceRoster, useVoiceRosterViews, type VoiceRoster } from './useServerVoiceRoster';
import { VOICE_NAME_PLACEHOLDER } from './useVoiceCallParticipants';

vi.mock('../session/AuthProvider', () => ({ useAuth: vi.fn() }));

const SERVER = 'server-1';
const VOICE_A = 'channel-a';
const VOICE_B = 'channel-b';
const ME = '11111111-1111-1111-1111-111111111111';
const ANA = '22222222-2222-2222-2222-222222222222';
const BETO = '33333333-3333-3333-3333-333333333333';

const person = (userId: string) => ({ userId, joinedAt: '2026-11-05T10:00:00Z' });

const room = (channelId: string, userIds: string[], syncedAt: string): VoiceRoomParticipants => ({
    channelId,
    participants: userIds.map(person),
    syncedAt,
});

const frame = (
    channelId: string,
    userIds: string[],
    syncedAt: string,
    serverId = SERVER,
): VoiceParticipantsUpdatedFrame => ({
    type: 'voice-participants.updated',
    serverId,
    channelId,
    participants: userIds.map(person),
    syncedAt,
});

// A realtime context with only what the hook reads, and a way to fire the frames and the reconnection.
const createFakeRealtime = () => {
    const frameHandlers = new Set<(f: VoiceParticipantsUpdatedFrame) => void>();
    const reconnectHandlers = new Set<() => void>();
    const value = {
        onVoiceParticipants: (handler: (f: VoiceParticipantsUpdatedFrame) => void) => {
            frameHandlers.add(handler);
            return () => frameHandlers.delete(handler);
        },
        onReconnect: (handler: () => void) => {
            reconnectHandlers.add(handler);
            return () => reconnectHandlers.delete(handler);
        },
    } as unknown as RealtimeContextValue;
    return {
        value,
        send: (f: VoiceParticipantsUpdatedFrame) => act(() => frameHandlers.forEach((h) => h(f))),
        reconnect: () => act(() => reconnectHandlers.forEach((h) => h())),
        subscribers: () => frameHandlers.size + reconnectHandlers.size,
    };
};

const idsOf = (roster: VoiceRoster, channelId: string) => roster.get(channelId)?.map((p) => p.userId);

describe('useServerVoiceRoster', () => {
    let realtime: ReturnType<typeof createFakeRealtime>;
    let getSnapshot: ReturnType<typeof vi.fn<(serverId: string) => Promise<VoiceRoomParticipants[]>>>;

    beforeEach(() => {
        realtime = createFakeRealtime();
        getSnapshot = vi.fn(async () => []);
    });

    // Vitest runs here without globals, so Testing Library does not unmount by itself, and a hook
    // left mounted keeps its document listener for the next test.
    afterEach(cleanup);

    const render = (serverId: string | undefined | null = SERVER) =>
        renderHook((props: { serverId: string | undefined }) => useServerVoiceRoster(props.serverId, getSnapshot), {
            wrapper: ({ children }: { children: ReactNode }) => (
                <RealtimeContext.Provider value={realtime.value}>{children}</RealtimeContext.Provider>
            ),
            initialProps: { serverId: serverId ?? undefined },
        });

    // The initial snapshot has been asked for and applied.
    const settled = async () => waitFor(() => expect(getSnapshot).toHaveBeenCalled());

    describe('snapshot', () => {
        it('asks for the snapshot of the server on mount and fills the map with it', async () => {
            getSnapshot.mockResolvedValue([room(VOICE_A, [ANA, BETO], '2026-11-05T10:00:05Z')]);

            const { result } = render();

            await waitFor(() => expect(idsOf(result.current, VOICE_A)).toEqual([ANA, BETO]));
            expect(getSnapshot).toHaveBeenCalledWith(SERVER);
        });

        it('asks again when the socket comes back and takes what changed meanwhile', async () => {
            getSnapshot.mockResolvedValueOnce([room(VOICE_A, [ANA, BETO], '2026-11-05T10:00:05Z')]);
            const { result } = render();
            await waitFor(() => expect(idsOf(result.current, VOICE_A)).toEqual([ANA, BETO]));

            getSnapshot.mockResolvedValueOnce([room(VOICE_A, [ANA], '2026-11-05T10:00:09Z')]);
            realtime.reconnect();

            await waitFor(() => expect(idsOf(result.current, VOICE_A)).toEqual([ANA]));
            expect(getSnapshot).toHaveBeenCalledTimes(2);
        });

        it('asks again when the tab becomes visible, and not while it is hidden', async () => {
            render();
            await settled();
            getSnapshot.mockClear();

            const visibility = vi.spyOn(document, 'visibilityState', 'get');
            visibility.mockReturnValue('hidden');
            act(() => void document.dispatchEvent(new Event('visibilitychange')));
            expect(getSnapshot).not.toHaveBeenCalled();

            visibility.mockReturnValue('visible');
            act(() => void document.dispatchEvent(new Event('visibilitychange')));
            expect(getSnapshot).toHaveBeenCalledTimes(1);
            visibility.mockRestore();
        });

        it('takes out a channel the snapshot no longer lists: it is empty', async () => {
            getSnapshot.mockResolvedValueOnce([room(VOICE_A, [ANA], '2026-11-05T10:00:05Z')]);
            const { result } = render();
            await waitFor(() => expect(idsOf(result.current, VOICE_A)).toEqual([ANA]));

            getSnapshot.mockResolvedValueOnce([]);
            realtime.reconnect();

            await waitFor(() => expect(result.current.has(VOICE_A)).toBe(false));
        });

        it('does not let an older snapshot overwrite a newer frame, per channel', async () => {
            getSnapshot.mockResolvedValue([
                room(VOICE_A, [ANA, BETO], '2026-11-05T10:00:05Z'),
                room(VOICE_B, [BETO], '2026-11-05T10:00:05Z'),
            ]);
            const { result } = render();
            await waitFor(() => expect(result.current.size).toBe(2));

            realtime.send(frame(VOICE_A, [ANA], '2026-11-05T10:00:20Z'));
            // A snapshot read before that frame: A is older, B is newer.
            getSnapshot.mockResolvedValueOnce([
                room(VOICE_A, [ANA, BETO], '2026-11-05T10:00:10Z'),
                room(VOICE_B, [ANA], '2026-11-05T10:00:11Z'),
            ]);
            realtime.reconnect();

            await waitFor(() => expect(idsOf(result.current, VOICE_B)).toEqual([ANA]));
            expect(idsOf(result.current, VOICE_A)).toEqual([ANA]);
        });

        it('keeps a channel a frame filled after the snapshot request left, though the snapshot omits it', async () => {
            const { result } = render();
            await settled();

            let answer: (rooms: VoiceRoomParticipants[]) => void = () => undefined;
            getSnapshot.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
            realtime.reconnect();
            realtime.send(frame(VOICE_A, [ANA], '2026-11-05T10:00:05Z'));
            await act(async () => answer([]));

            expect(idsOf(result.current, VOICE_A)).toEqual([ANA]);
        });

        it('ignores the answer of a request that started before one already applied', async () => {
            const { result } = render();
            await settled();

            let first: (rooms: VoiceRoomParticipants[]) => void = () => undefined;
            getSnapshot.mockReturnValueOnce(new Promise((resolve) => (first = resolve)));
            realtime.reconnect();
            getSnapshot.mockResolvedValueOnce([room(VOICE_A, [ANA], '2026-11-05T10:00:09Z')]);
            realtime.reconnect();
            await waitFor(() => expect(idsOf(result.current, VOICE_A)).toEqual([ANA]));

            await act(async () => first([]));

            expect(idsOf(result.current, VOICE_A)).toEqual([ANA]);
        });

        it('stays quiet when the snapshot fails and tries again with the next trigger', async () => {
            getSnapshot.mockRejectedValueOnce(new Error('down'));
            const { result } = render();
            await settled();
            expect(result.current.size).toBe(0);

            getSnapshot.mockResolvedValueOnce([room(VOICE_A, [ANA], '2026-11-05T10:00:05Z')]);
            realtime.reconnect();

            await waitFor(() => expect(idsOf(result.current, VOICE_A)).toEqual([ANA]));
        });
    });

    describe('frames', () => {
        it('a newer frame replaces the list of its channel and leaves the others alone', async () => {
            getSnapshot.mockResolvedValue([
                room(VOICE_A, [ANA], '2026-11-05T10:00:05Z'),
                room(VOICE_B, [BETO], '2026-11-05T10:00:05Z'),
            ]);
            const { result } = render();
            await waitFor(() => expect(result.current.size).toBe(2));

            realtime.send(frame(VOICE_A, [ANA, ME], '2026-11-05T10:00:06Z'));

            expect(idsOf(result.current, VOICE_A)).toEqual([ANA, ME]);
            expect(idsOf(result.current, VOICE_B)).toEqual([BETO]);
        });

        it('adds a channel that was not in the map', async () => {
            const { result } = render();
            await settled();

            realtime.send(frame(VOICE_A, [ANA], '2026-11-05T10:00:06Z'));

            expect(idsOf(result.current, VOICE_A)).toEqual([ANA]);
        });

        it('ignores an older frame', async () => {
            getSnapshot.mockResolvedValue([room(VOICE_A, [ANA, BETO], '2026-11-05T10:00:10Z')]);
            const { result } = render();
            await waitFor(() => expect(result.current.size).toBe(1));

            realtime.send(frame(VOICE_A, [ANA], '2026-11-05T10:00:09Z'));
            // The same instant is a repeat, not news.
            realtime.send(frame(VOICE_A, [BETO], '2026-11-05T10:00:10Z'));

            expect(idsOf(result.current, VOICE_A)).toEqual([ANA, BETO]);
        });

        it('compares syncedAt as dates: "…:05Z" is older than "…:05.5Z" though the string says the opposite', async () => {
            const { result } = render();
            await settled();
            realtime.send(frame(VOICE_A, [ANA], '2026-11-05T10:00:05.5Z'));

            // As strings '…05Z' > '…05.5Z' ('Z' sorts after '.'): a string comparison would apply it.
            expect('2026-11-05T10:00:05Z' > '2026-11-05T10:00:05.5Z').toBe(true);
            realtime.send(frame(VOICE_A, [BETO], '2026-11-05T10:00:05Z'));
            expect(idsOf(result.current, VOICE_A)).toEqual([ANA]);

            // And the reverse: a string comparison would drop this one, which is newer.
            realtime.send(frame(VOICE_A, [BETO], '2026-11-05T10:00:05.75Z'));
            expect(idsOf(result.current, VOICE_A)).toEqual([BETO]);
            realtime.send(frame(VOICE_B, [ANA], '2026-11-05T10:00:05Z'));
            realtime.send(frame(VOICE_B, [BETO], '2026-11-05T10:00:05.5Z'));
            expect(idsOf(result.current, VOICE_B)).toEqual([BETO]);
        });

        it('ignores a frame of another server', async () => {
            const { result } = render();
            await settled();

            realtime.send(frame(VOICE_A, [ANA], '2026-11-05T10:00:06Z', 'server-2'));

            expect(result.current.size).toBe(0);
        });

        it('ignores a frame whose syncedAt is not a date', async () => {
            const { result } = render();
            await settled();

            realtime.send(frame(VOICE_A, [ANA], 'yesterday'));

            expect(result.current.size).toBe(0);
        });

        it('an empty list takes the channel out of the map', async () => {
            getSnapshot.mockResolvedValue([room(VOICE_A, [ANA], '2026-11-05T10:00:05Z')]);
            const { result } = render();
            await waitFor(() => expect(result.current.has(VOICE_A)).toBe(true));

            realtime.send(frame(VOICE_A, [], '2026-11-05T10:00:06Z'));

            expect(result.current.has(VOICE_A)).toBe(false);
        });

        it('an empty channel keeps its mark: a late older frame does not bring someone back', async () => {
            getSnapshot.mockResolvedValue([room(VOICE_A, [ANA], '2026-11-05T10:00:05Z')]);
            const { result } = render();
            await waitFor(() => expect(result.current.has(VOICE_A)).toBe(true));
            realtime.send(frame(VOICE_A, [], '2026-11-05T10:00:08Z'));

            realtime.send(frame(VOICE_A, [ANA], '2026-11-05T10:00:07Z'));

            expect(result.current.has(VOICE_A)).toBe(false);
        });
    });

    describe('lifecycle', () => {
        it('starts over with another server: the old map is not shown and its frames stop mattering', async () => {
            getSnapshot.mockResolvedValueOnce([room(VOICE_A, [ANA], '2026-11-05T10:00:05Z')]);
            const { result, rerender } = render('server-1');
            await waitFor(() => expect(result.current.has(VOICE_A)).toBe(true));

            getSnapshot.mockResolvedValueOnce([]);
            rerender({ serverId: 'server-2' });
            expect(result.current.size).toBe(0);
            await waitFor(() => expect(getSnapshot).toHaveBeenLastCalledWith('server-2'));

            realtime.send(frame(VOICE_A, [BETO], '2026-11-05T10:00:06Z', 'server-1'));
            expect(result.current.size).toBe(0);
        });

        it('does nothing without a server', () => {
            const { result } = render(null);

            expect(getSnapshot).not.toHaveBeenCalled();
            expect(realtime.subscribers()).toBe(0);
            expect(result.current.size).toBe(0);
        });

        it('unsubscribes on unmount and drops a late snapshot', async () => {
            let answer: (rooms: VoiceRoomParticipants[]) => void = () => undefined;
            getSnapshot.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
            const { unmount } = render();
            await settled();

            unmount();

            expect(realtime.subscribers()).toBe(0);
            await expect(act(async () => answer([room(VOICE_A, [ANA], '2026-11-05T10:00:05Z')]))).resolves.not.toThrow();
        });

        it('still loads the snapshot without a realtime provider', async () => {
            getSnapshot.mockResolvedValue([room(VOICE_A, [ANA], '2026-11-05T10:00:05Z')]);

            const { result } = renderHook(() => useServerVoiceRoster(SERVER, getSnapshot));

            await waitFor(() => expect(idsOf(result.current, VOICE_A)).toEqual([ANA]));
        });
    });
});

describe('useVoiceRosterViews', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ user: { id: ME, name: 'Milton' } as User } as ReturnType<typeof useAuth>);
    });

    const setup = (getPublicProfiles: PublicProfileSource['getPublicProfiles']) => {
        const source: PublicProfileSource = { getPublicProfiles: vi.fn(getPublicProfiles), peekPublicProfile: () => undefined };
        const wrapper = ({ children }: { children: ReactNode }) => (
            <PublicProfilesProvider source={source}>{children}</PublicProfilesProvider>
        );
        return { source, wrapper };
    };

    it('names the people of each channel, without mute, and asks for each profile once', async () => {
        const { source, wrapper } = setup(
            async (): Promise<PublicProfiles> =>
                new Map([
                    [ANA, { id: ANA, name: 'Ana', avatarUrl: null, bio: null }],
                    [BETO, null],
                ]),
        );
        const roster: VoiceRoster = new Map([
            [VOICE_A, [person(ME), person(ANA)]],
            [VOICE_B, [person(ANA), person(BETO)]],
        ]);

        const { result } = renderHook(() => useVoiceRosterViews(roster), { wrapper });

        await waitFor(() => expect(result.current.get(VOICE_B)?.[1].loading).toBe(false));
        expect(result.current.get(VOICE_A)).toEqual([
            { userId: ME, name: 'Milton', loading: false },
            { userId: ANA, name: 'Ana', loading: false },
        ]);
        expect(result.current.get(VOICE_B)).toEqual([
            { userId: ANA, name: 'Ana', loading: false },
            { userId: BETO, name: UNAVAILABLE_USER_NAME, loading: false },
        ]);
        expect(result.current.get(VOICE_A)?.every((view) => view.muted === undefined)).toBe(true);
        expect(source.getPublicProfiles).toHaveBeenCalledTimes(1);
    });

    it('shows the placeholder while the names load, never the id', () => {
        const { wrapper } = setup(() => new Promise(() => undefined));
        const roster: VoiceRoster = new Map([[VOICE_A, [person(ANA)]]]);

        const { result } = renderHook(() => useVoiceRosterViews(roster), { wrapper });

        expect(result.current.get(VOICE_A)).toEqual([{ userId: ANA, name: VOICE_NAME_PLACEHOLDER, loading: true }]);
    });

    it('is empty for an empty roster', () => {
        const { wrapper } = setup(async () => new Map());

        const { result } = renderHook(() => useVoiceRosterViews(new Map()), { wrapper });

        expect(result.current.size).toBe(0);
    });
});
