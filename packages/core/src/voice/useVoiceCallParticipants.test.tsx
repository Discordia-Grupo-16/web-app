// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicProfiles, User } from '@discordia/api';
import { UNAVAILABLE_USER_NAME } from '../chat/authorName';
import { PublicProfilesProvider, type PublicProfileSource } from '../profiles/PublicProfilesProvider';
import { useAuth } from '../session/AuthProvider';
import type { VoiceParticipant } from './types';
import { useVoiceCallParticipants, VOICE_NAME_PLACEHOLDER } from './useVoiceCallParticipants';

vi.mock('../session/AuthProvider', () => ({ useAuth: vi.fn() }));

const ME_ID = '11111111-1111-1111-1111-111111111111';
const ANA_ID = '22222222-2222-2222-2222-222222222222';
const GONE_ID = '33333333-3333-3333-3333-333333333333';

const participant = (userId: string, muted = false): VoiceParticipant => ({
    userId,
    isLocal: userId === ME_ID,
    muted,
    joinedAt: 1000,
    seenOrder: 0,
});

const setup = (getPublicProfiles: PublicProfileSource['getPublicProfiles']) => {
    const source: PublicProfileSource = { getPublicProfiles: vi.fn(getPublicProfiles), peekPublicProfile: () => undefined };
    const wrapper = ({ children }: { children: ReactNode }) => (
        <PublicProfilesProvider source={source}>{children}</PublicProfilesProvider>
    );
    return { source, wrapper };
};

describe('useVoiceCallParticipants', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ user: { id: ME_ID, name: 'Milton' } as User } as ReturnType<typeof useAuth>);
    });

    it('names everyone, with the own name from the session and the unavailable name for a missing profile', async () => {
        const { source, wrapper } = setup(
            async (): Promise<PublicProfiles> =>
                new Map([
                    [ANA_ID, { id: ANA_ID, name: 'Ana', avatarUrl: null, bio: null }],
                    [GONE_ID, null],
                ]),
        );
        const participants = [participant(ME_ID), participant(ANA_ID, true), participant(GONE_ID)];

        const { result } = renderHook(() => useVoiceCallParticipants(participants), { wrapper });

        await waitFor(() => expect(result.current[1].loading).toBe(false));
        expect(result.current).toEqual([
            { userId: ME_ID, name: 'Milton', loading: false, muted: false },
            { userId: ANA_ID, name: 'Ana', loading: false, muted: true },
            { userId: GONE_ID, name: UNAVAILABLE_USER_NAME, loading: false, muted: false },
        ]);
        expect(source.getPublicProfiles).toHaveBeenCalledWith([ANA_ID, GONE_ID]);
    });

    it('shows the placeholder while the profiles load, never the id', () => {
        const { wrapper } = setup(() => new Promise(() => undefined));

        const { result } = renderHook(() => useVoiceCallParticipants([participant(ANA_ID)]), { wrapper });

        expect(result.current).toEqual([{ userId: ANA_ID, name: VOICE_NAME_PLACEHOLDER, loading: true, muted: false }]);
        result.current.forEach((view) => expect(view.name).not.toContain(view.userId.slice(0, 8)));
    });

    it('keeps the placeholder when loading the profiles failed', async () => {
        const { source, wrapper } = setup(async () => Promise.reject(new Error('down')));

        const { result } = renderHook(() => useVoiceCallParticipants([participant(ANA_ID)]), { wrapper });

        await waitFor(() => expect(source.getPublicProfiles).toHaveBeenCalled());
        expect(result.current[0]).toMatchObject({ name: VOICE_NAME_PLACEHOLDER, loading: true });
        expect(result.current[0].name).not.toContain(ANA_ID.slice(0, 8));
    });
});
