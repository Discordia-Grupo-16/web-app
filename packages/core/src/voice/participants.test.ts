import { describe, expect, it } from 'vitest';
import { buildParticipantSnapshot, NO_SPEAKERS, readServerReason, sameIds, speakerIds } from './participants';
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

describe('NO_SPEAKERS', () => {
    it('is empty', () => {
        expect(NO_SPEAKERS.size).toBe(0);
    });
});

describe('speakerIds', () => {
    it('returns the identities without repeating them', () => {
        const ids = speakerIds([participant('me'), participant('ana'), participant('me')]);

        expect([...ids].sort()).toEqual(['ana', 'me']);
    });

    it('returns an empty set without speakers', () => {
        expect(speakerIds([]).size).toBe(0);
    });
});

describe('sameIds', () => {
    it('is true with the same members in another order and in another instance', () => {
        expect(sameIds(new Set(['me', 'ana']), new Set(['ana', 'me']))).toBe(true);
    });

    it('is true for two empty sets', () => {
        expect(sameIds(new Set(), NO_SPEAKERS)).toBe(true);
    });

    it('is false when the size changes', () => {
        expect(sameIds(new Set(['me']), new Set(['me', 'ana']))).toBe(false);
        expect(sameIds(new Set(['me', 'ana']), new Set(['me']))).toBe(false);
    });

    it('is false when a member changes', () => {
        expect(sameIds(new Set(['me', 'ana']), new Set(['me', 'leo']))).toBe(false);
    });
});
