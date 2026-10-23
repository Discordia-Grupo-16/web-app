import { describe, expect, it } from 'vitest';
import { canRejoin } from './texts';
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
