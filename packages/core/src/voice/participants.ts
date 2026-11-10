import type { ParticipantLike, RoomLike, VoiceParticipant, VoiceServerReason } from './types';

const DISCONNECT_REASON_ATTRIBUTE = 'disconnectReason';

const SERVER_REASONS: ReadonlySet<string> = new Set<VoiceServerReason>([
    'other_device',
    'left_server',
    'kicked',
    'banned',
    'suspended',
    'permissions_revoked',
    'channel_deleted',
]);

// Shared empty set: the same reference every time, so memoized readers do not re-render.
export const NO_SPEAKERS: ReadonlySet<string> = new Set();

// Shared empty set of local mutes: the same reference every time, so memoized readers do not re-render.
export const NO_LOCAL_MUTES: ReadonlySet<string> = new Set();

// A new set with the id added if it was missing or removed if it was there. Never mutates the input:
// it is React state.
export const toggleId = (ids: ReadonlySet<string>, id: string): ReadonlySet<string> => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
};

export const speakerIds =(speakers: readonly Pick<ParticipantLike, 'identity'>[]): ReadonlySet<string> =>
    new Set(speakers.map((s) => s.identity));

// Same members, whatever the order: LiveKit repeats the event when only the loudness order changes.
export const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
    a.size === b.size && [...a].every((id) => b.has(id));

// A participant whose joinedAt is not known yet goes after the rest.
const sortKey = (p: VoiceParticipant): number => (p.joinedAt > 0 ? p.joinedAt : Number.MAX_SAFE_INTEGER);

// The whole list of the call: the local participant and the remote ones, once each, sorted by
// joinedAt and, on a tie, by the order in which this client first saw them. `seen` keeps that order
// across calls, so the caller keeps the same map for the whole call.
export const buildParticipantSnapshot = (room: RoomLike, seen: Map<string, number>): VoiceParticipant[] => {
    const byIdentity = new Map<string, VoiceParticipant>();
    const add = (p: ParticipantLike, isLocal: boolean) => {
        if (byIdentity.has(p.identity)) return;
        if (!seen.has(p.identity)) seen.set(p.identity, seen.size);
        byIdentity.set(p.identity, {
            userId: p.identity,
            isLocal,
            muted: !p.isMicrophoneEnabled,
            joinedAt: p.joinedAt?.getTime() ?? 0,
            seenOrder: seen.get(p.identity) ?? 0,
        });
    };
    add(room.localParticipant, true);
    room.remoteParticipants.forEach((p) => add(p, false));
    return [...byIdentity.values()].sort((a, b) => sortKey(a) - sortKey(b) || a.seenOrder - b.seenOrder);
};

export const readServerReason = (attributes: Readonly<Record<string, string>>): VoiceServerReason | null => {
    const value = attributes[DISCONNECT_REASON_ATTRIBUTE];
    return value !== undefined && SERVER_REASONS.has(value) ? (value as VoiceServerReason) : null;
};
