import { formatMutedUntil, VOICE_TEXTS } from '@discordia/core';

// What a moderator's mute says in the call: with the hour it ends once chat has answered it.
export const serverMutedText = (serverMutedUntil: string | null): string =>
    serverMutedUntil ? VOICE_TEXTS.serverMutedUntil(formatMutedUntil(serverMutedUntil)) : VOICE_TEXTS.serverMuted;
