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
