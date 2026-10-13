import type { RoomLike, VoiceParticipant, VoiceServerReason } from './types';

export const buildParticipantSnapshot = (_room: RoomLike, _seen: Map<string, number>): VoiceParticipant[] => [];

export const readServerReason = (_attributes: Readonly<Record<string, string>>): VoiceServerReason | null => null;
