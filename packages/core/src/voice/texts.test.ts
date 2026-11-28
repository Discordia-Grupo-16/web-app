import { describe, expect, it } from 'vitest';
import { canRejoin, VOICE_TEXTS } from './texts';
import type { VoiceDisconnectReason } from './types';

describe('canRejoin', () => {
    it.each([
        ['connection_lost', true],
        ['app_backgrounded', true],
        ['other_device', false],
        ['left_server', false],
        ['kicked', false],
        ['banned', false],
        ['suspended', false],
        ['permissions_revoked', false],
        ['channel_deleted', false],
    ] as const)('offers to rejoin after %s: %s', (reason: VoiceDisconnectReason, expected) => {
        expect(canRejoin(reason)).toBe(expected);
    });
});

describe('VOICE_TEXTS server mute', () => {
    it('says a moderator did it and that the others cannot hear them', () => {
        expect(VOICE_TEXTS.serverMuted).toMatch(/moderador/);
        expect(VOICE_TEXTS.serverMuted).toMatch(/no te escuchan/);
    });

    it('adds the time the mute ends', () => {
        expect(VOICE_TEXTS.serverMutedUntil('18:30')).toContain('hasta 18:30');
    });

    it('has a short version for the bars, shorter than the full phrase', () => {
        expect(VOICE_TEXTS.serverMutedShort).toBe('Silenciado por un moderador');
        expect(VOICE_TEXTS.serverMutedShortUntil('18:30')).toBe('Silenciado hasta 18:30');
        expect(VOICE_TEXTS.serverMutedShortUntil('18:30').length).toBeLessThan(VOICE_TEXTS.serverMutedUntil('18:30').length);
    });
});
