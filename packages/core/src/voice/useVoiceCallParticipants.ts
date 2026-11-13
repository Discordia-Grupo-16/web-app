import { useMemo } from 'react';
import { UNAVAILABLE_USER_NAME } from '../chat/authorName';
import { usePublicProfiles } from '../profiles/usePublicProfiles';
import { useAuth } from '../session/AuthProvider';
import type { VoiceParticipant } from './types';

export interface ChannelParticipantView {
    userId: string;
    name: string; // name, UNAVAILABLE_USER_NAME or the neutral placeholder
    userAvatar: string;
    loading: boolean; // true while the name is the placeholder
    muted?: boolean; // absent when the list has no mute icon
    isSelf?: boolean; // true only for the own row
}

// Never the id: a partial id is not a name.
export const VOICE_NAME_PLACEHOLDER = 'Cargando…';

// What the hook reads of a participant. The call's list has the mute; the roster of `chat` does not
// (SCRUM-54, W15), and then the view carries no `muted`.
export type NamedParticipant = Pick<VoiceParticipant, 'userId'> & Partial<Pick<VoiceParticipant, 'muted'>>;

// The own name comes from the session, so an edit shows up without waiting for the profile cache.
export const useVoiceCallParticipants = (participants: readonly NamedParticipant[]): ChannelParticipantView[] => {
    const { user } = useAuth();
    const ids = useMemo(
        () => participants.filter((p) => p.userId !== user?.id).map((p) => p.userId),
        [participants, user?.id],
    );
    const profiles = usePublicProfiles(ids);

    return useMemo(
        () =>
            participants.map((p) => {
                if (user && p.userId === user.id) {
                    return { userId: p.userId, name: user.name || 'Vos', userAvatar: user.avatarUrl ?? '', loading: false, muted: p.muted, isSelf: true };
                }
                const profile = profiles.get(p.userId);
                if (profile === undefined) {
                    return { userId: p.userId, name: VOICE_NAME_PLACEHOLDER, userAvatar: '', loading: true, muted: p.muted, isSelf: false };
                }
                return {
                    userId: p.userId,
                    name: profile?.name ?? UNAVAILABLE_USER_NAME,
                    userAvatar: profile?.avatarUrl ?? '',
                    loading: false,
                    muted: p.muted,
                    isSelf: false,
                };
            }),
        [participants, profiles, user],
    );
};
