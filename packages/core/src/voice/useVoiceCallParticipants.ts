import type { VoiceParticipant } from './types';

export interface ChannelParticipantView {
    userId: string;
    name: string; // name, UNAVAILABLE_USER_NAME or the neutral placeholder
    loading: boolean; // true while the name is the placeholder
    muted?: boolean; // absent when the list has no mute icon
}

// Never the id: a partial id is not a name.
export const VOICE_NAME_PLACEHOLDER = 'Cargando…';

export const useVoiceCallParticipants = (_participants: VoiceParticipant[]): ChannelParticipantView[] => [];
