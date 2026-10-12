import { describe, expect, it } from 'vitest';
import { buildLoginPath, sanitizeReturnTo } from './returnTo';

describe('sanitizeReturnTo', () => {
    it.each(['/invite/abc', '/servers/1/channels/2', '/invite/abc?ref=mail', '/'])(
        'accepts the internal path %s',
        (path) => {
            expect(sanitizeReturnTo(path)).toBe(path);
        },
    );

    it.each([
        ['empty', ''],
        ['missing', null],
        ['relative', 'invite/abc'],
        ['protocol-relative', '//evil.com'],
        ['absolute', 'https://evil.com'],
        ['absolute after a slash', '/redirect?to=https://evil.com'],
        ['backslash trick', '/\\evil.com'],
    ])('rejects a %s destination', (_label, value) => {
        expect(sanitizeReturnTo(value)).toBeNull();
    });
});

describe('buildLoginPath', () => {
    it('keeps the destination in the query so it survives a reload', () => {
        expect(buildLoginPath('/invite/abc')).toBe('/home?returnTo=%2Finvite%2Fabc');
    });

    it('does not add a returnTo for the home or for an unsafe destination', () => {
        expect(buildLoginPath('/')).toBe('/home');
        expect(buildLoginPath('//evil.com')).toBe('/home');
    });
});
