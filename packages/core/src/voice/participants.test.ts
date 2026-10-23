import { describe, expect, it } from 'vitest';
import { buildParticipantSnapshot, readServerReason } from './participants';
import type { ParticipantLike, RoomLike } from './types';

const participant = (identity: string, joinedAtSeconds?: number, isMicrophoneEnabled = true): ParticipantLike => ({
    identity,
    joinedAt: joinedAtSeconds === undefined ? undefined : new Date(joinedAtSeconds * 1000),
    isMicrophoneEnabled,
    attributes: {},
});

const room = (local: ParticipantLike, ...remotes: ParticipantLike[]): RoomLike => ({
    localParticipant: local,
    remoteParticipants: new Map(remotes.map((p) => [p.identity, p])),
});

describe('buildParticipantSnapshot', () => {
    it('includes the local participant marked as local', () => {
        const snapshot = buildParticipantSnapshot(room(participant('me', 10), participant('ana', 5)), new Map());

        expect(snapshot.map((p) => [p.userId, p.isLocal])).toEqual([
            ['ana', false],
            ['me', true],
        ]);
    });

    it('marks as muted whoever has no enabled microphone', () => {
        const snapshot = buildParticipantSnapshot(
            room(participant('me', 1, false), participant('ana', 2, true)),
            new Map(),
        );

        expect(snapshot.map((p) => [p.userId, p.muted])).toEqual([
            ['me', true],
            ['ana', false],
        ]);
    });

    it('sorts by joinedAt and breaks ties by the order seen, remembered across calls', () => {
        const seen = new Map<string, number>();
        buildParticipantSnapshot(room(participant('me', 10), participant('bruno', 10)), seen);

        const snapshot = buildParticipantSnapshot(
            room(participant('me', 10), participant('ana', 10), participant('bruno', 10), participant('carla', 3)),
            seen,
        );

        expect(snapshot.map((p) => p.userId)).toEqual(['carla', 'me', 'bruno', 'ana']);
        expect(snapshot.find((p) => p.userId === 'me')?.joinedAt).toBe(10_000);
    });

    it('lists each identity once', () => {
        const snapshot = buildParticipantSnapshot(room(participant('me', 1), participant('me', 1)), new Map());

        expect(snapshot.map((p) => p.userId)).toEqual(['me']);
    });
});

describe('readServerReason', () => {
    it.each([
        'other_device',
        'left_server',
        'kicked',
        'banned',
        'suspended',
        'permissions_revoked',
        'channel_deleted',
    ] as const)('reads %s', (reason) => {
        expect(readServerReason({ disconnectReason: reason })).toBe(reason);
    });

    it('returns null without the attribute or with an unknown value', () => {
        expect(readServerReason({})).toBeNull();
        expect(readServerReason({ disconnectReason: 'something_else' })).toBeNull();
    });
});
