import { useContext, useEffect, useMemo, useState } from 'react';
import type { VoiceRoomParticipants, VoiceRosterParticipant } from '@discordia/api';
import { RealtimeContext } from '../chat/realtimeContext';
import { useVoiceCallParticipants, type ChannelParticipantView } from './useVoiceCallParticipants';

/** Who is connected to each voice channel of a server. A channel that is not in the map is empty. */
export type VoiceRoster = ReadonlyMap<string, VoiceRosterParticipant[]>;

/** `getServerVoiceParticipants` of the voice service: the app hands it over, core does not own HTTP. */
export type VoiceRosterSource = (serverId: string) => Promise<VoiceRoomParticipants[]>;

const EMPTY_ROSTER: VoiceRoster = new Map();

// Core compiles without lib DOM because it is shared with React Native, which has no document.
// Only what the hook uses of it, read from globalThis so mobile gets undefined.
interface PageVisibility {
    readonly visibilityState: string;
    addEventListener(type: 'visibilitychange', listener: () => void): void;
    removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

// The date, never the string: the backend serializes with Go's time.Time, which trims trailing
// zeros ("…:05Z" vs "…:05.5Z"), so comparing strings can order two instants the wrong way round.
const instantOf = (syncedAt: string): number => Date.parse(syncedAt);

/**
 * Who is in each voice channel of a server, without being in the call (SCRUM-54, ADR-0017).
 *
 * Asks for the snapshot on mount, when the socket comes back (the frames that went by are lost) and
 * when the tab becomes visible. In between, `voice-participants.updated` frames replace a channel's
 * list. A list, from a frame or a snapshot, is applied only if its `syncedAt` is newer than the one
 * held for that channel (W13); the mark outlives an empty channel, so a late old list cannot bring
 * back someone who left.
 *
 * A failed snapshot is silent: the next frame, reconnection or return to the tab asks again.
 */
export const useServerVoiceRoster = (serverId: string | undefined, getSnapshot: VoiceRosterSource): VoiceRoster => {
    const realtime = useContext(RealtimeContext);
    const subscribeFrames = realtime?.onVoiceParticipants;
    const subscribeReconnects = realtime?.onReconnect;

    // Tagged with its server: when serverId changes, the old map is no longer shown, with no reset in an effect.
    const [held, setHeld] = useState<{ serverId: string | undefined; roster: VoiceRoster }>({
        serverId,
        roster: EMPTY_ROSTER,
    });

    useEffect(() => {
        if (!serverId) return;
        let active = true;

        // Per effect run, so each server starts from nothing.
        const syncedAtByChannel = new Map<string, number>();
        // When (on `clock`) a frame last changed each channel, to tell a snapshot's silence from a
        // channel that filled up after the request left.
        const touchedByChannel = new Map<string, number>();
        let clock = 0;
        let lastAppliedRequest = 0;

        const update = (change: (roster: Map<string, VoiceRosterParticipant[]>) => void) =>
            setHeld((previous) => {
                const next = new Map(previous.serverId === serverId ? previous.roster : EMPTY_ROSTER);
                change(next);
                return { serverId, roster: next };
            });

        // Returns whether it was newer. An empty list takes the channel out of the map.
        const place = (channelId: string, participants: VoiceRosterParticipant[], syncedAt: string): boolean => {
            const at = instantOf(syncedAt);
            if (Number.isNaN(at)) return false;
            const known = syncedAtByChannel.get(channelId);
            if (known !== undefined && at <= known) return false;
            syncedAtByChannel.set(channelId, at);
            update((roster) => {
                if (participants.length === 0) roster.delete(channelId);
                else roster.set(channelId, participants);
            });
            return true;
        };

        const refresh = () => {
            const request = ++clock;
            getSnapshot(serverId)
                .then((rooms) => {
                    // A snapshot that started before one already applied is older as a whole.
                    if (!active || request < lastAppliedRequest) return;
                    lastAppliedRequest = request;
                    for (const room of rooms) place(room.channelId, room.participants, room.syncedAt);
                    // The snapshot lists only rooms with people: the rest are empty, unless a
                    // frame landed after the request left and may know something newer.
                    const present = new Set(rooms.map((room) => room.channelId));
                    update((roster) => {
                        for (const channelId of [...roster.keys()]) {
                            if (!present.has(channelId) && (touchedByChannel.get(channelId) ?? 0) <= request) {
                                roster.delete(channelId);
                            }
                        }
                    });
                })
                .catch(() => undefined);
        };

        const offFrames = subscribeFrames?.((frame) => {
            if (frame.serverId !== serverId) return;
            if (place(frame.channelId, frame.participants, frame.syncedAt)) {
                touchedByChannel.set(frame.channelId, ++clock);
            }
        });
        const offReconnects = subscribeReconnects?.(refresh);

        // Mobile has no document: there the app coming back goes through the reconnection.
        const page = (globalThis as { document?: PageVisibility }).document;
        const onVisibility = () => {
            if (page?.visibilityState === 'visible') refresh();
        };
        page?.addEventListener('visibilitychange', onVisibility);

        refresh();

        return () => {
            active = false;
            offFrames?.();
            offReconnects?.();
            page?.removeEventListener('visibilitychange', onVisibility);
        };
    }, [serverId, getSnapshot, subscribeFrames, subscribeReconnects]);

    return held.serverId === serverId ? held.roster : EMPTY_ROSTER;
};

/**
 * The names for a whole roster, with `useVoiceCallParticipants` underneath so the own name, the
 * placeholder and the unavailable name behave the same as in the call. One hook for every channel
 * because a hook cannot run once per channel; it flattens, names, and splits back. No `muted` (W15).
 */
export const useVoiceRosterViews = (roster: VoiceRoster): ReadonlyMap<string, ChannelParticipantView[]> => {
    const flat = useMemo(() => [...roster.values()].flat(), [roster]);
    const views = useVoiceCallParticipants(flat);

    return useMemo(() => {
        const byChannel = new Map<string, ChannelParticipantView[]>();
        let offset = 0;
        for (const [channelId, participants] of roster) {
            byChannel.set(channelId, views.slice(offset, offset + participants.length));
            offset += participants.length;
        }
        return byChannel;
    }, [roster, views]);
};
