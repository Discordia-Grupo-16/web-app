import { describe, expect, it } from 'vitest';
import { sanitizeReturnTo } from './returnTo';

describe('sanitizeReturnTo', () => {
    it.each(['/invite/abc', '/server/1/channel/2', '/invite/abc?ref=mail', '/'])(
        'accepts the internal path %s',
        (path) => {
            expect(sanitizeReturnTo(path)).toBe(path);
        },
    );

    it.each([
        ['empty', ''],
        ['missing', null],
        ['undefined', undefined],
        ['relative', 'invite/abc'],
        ['protocol-relative', '//evil.com'],
        ['absolute', 'https://evil.com'],
        ['custom scheme', 'discordia://invite/abc'],
        ['absolute after a slash', '/redirect?to=https://evil.com'],
        ['backslash trick', '/\\evil.com'],
    ])('rejects a %s destination', (_label, value) => {
        expect(sanitizeReturnTo(value)).toBeNull();
    });
});
