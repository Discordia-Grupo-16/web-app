import { describe, expect, it } from 'vitest';
import {
    buildParticipantSnapshot,
    NO_LOCAL_MUTES,
    NO_SPEAKERS,
    readServerReason,
    sameIds,
    speakerIds,
    toggleId,
} from './participants';
import type { ParticipantLike, RoomLike } from './types';

type VideoPublications = ParticipantLike['videoTrackPublications'];

const participant = (
    identity: string,
    joinedAtSeconds?: number,
    isMicrophoneEnabled = true,
    videoTrackPublications: VideoPublications = new Map(),
): ParticipantLike => ({
    identity,
    joinedAt: joinedAtSeconds === undefined ? undefined : new Date(joinedAtSeconds * 1000),
    isMicrophoneEnabled,
    videoTrackPublications,
    attributes: {},
});

const publications = (source: string, track: unknown, isMuted: boolean): VideoPublications =>
    new Map([['TR_1', { source, track, isMuted }]]);

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

    describe('cameraOn (SCRUM-59, C3)', () => {
        const cameraOf = (videoTrackPublications: VideoPublications) =>
            buildParticipantSnapshot(room(participant('me', 1, true, videoTrackPublications)), new Map())[0].cameraOn;

        it('is false without a camera publication', () => {
            expect(cameraOf(new Map())).toBe(false);
        });

        it('is false with a camera track that is muted', () => {
            expect(cameraOf(publications('camera', {}, true))).toBe(false);
        });

        it('is false with a publication that has no track yet, like a remote one not subscribed', () => {
            expect(cameraOf(publications('camera', undefined, false))).toBe(false);
        });

        it('is true with a camera track that is not muted', () => {
            expect(cameraOf(publications('camera', {}, false))).toBe(true);
        });

        it('does not count a screen share', () => {
            expect(cameraOf(publications('screen_share', {}, false))).toBe(false);
        });

        it('is read for the remote participants too', () => {
            const snapshot = buildParticipantSnapshot(
                room(participant('me', 1), participant('ana', 2, true, publications('camera', {}, false))),
                new Map(),
            );

            expect(snapshot.map((p) => [p.userId, p.cameraOn])).toEqual([
                ['me', false],
                ['ana', true],
            ]);
        });
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

describe('NO_LOCAL_MUTES', () => {
    it('is empty', () => {
        expect(NO_LOCAL_MUTES.size).toBe(0);
    });
});

describe('toggleId', () => {
    it('adds the id when it is missing', () => {
        expect([...toggleId(new Set(['ana']), 'bob')].sort()).toEqual(['ana', 'bob']);
    });

    it('removes the id when it is there', () => {
        expect([...toggleId(new Set(['ana', 'bob']), 'ana')]).toEqual(['bob']);
    });

    it('returns another instance and leaves the input as it was', () => {
        const input: ReadonlySet<string> = new Set(['ana']);

        const added = toggleId(input, 'bob');
        const removed = toggleId(input, 'ana');

        expect(added).not.toBe(input);
        expect(removed).not.toBe(input);
        expect([...input]).toEqual(['ana']);
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
