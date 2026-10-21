/** Query parameter that carries the pending destination through the login and register screens. */
export const RETURN_TO_PARAM = 'returnTo';

const hasControlCharacter = (value: string): boolean =>
    Array.from(value).some((char) => {
        const code = char.charCodeAt(0);
        return code < 0x20 || code === 0x7f;
    });

/**
 * Only internal paths are valid destinations: otherwise the login link would be an open redirect
 * (`?returnTo=//evil.com` or `?returnTo=https://evil.com`). Control characters are refused too:
 * browsers drop tabs and line breaks inside a URL, so `/\t/evil.com` would read as `//evil.com`.
 * Shared by web and mobile so both apply the same rule.
 */
export const sanitizeReturnTo = (value: string | null | undefined): string | null => {
    if (!value) return null;
    if (!value.startsWith('/') || value.startsWith('//')) return null;
    if (value.includes('://') || value.includes('\\')) return null;
    if (hasControlCharacter(value)) return null;
    return value;
};
