/** Query parameter that carries the pending destination through the login and register screens. */
export const RETURN_TO_PARAM = 'returnTo';

/**
 * Only internal paths are valid destinations: otherwise the login link would be an open redirect
 * (`?returnTo=//evil.com` or `?returnTo=https://evil.com`). Shared by web and mobile so both
 * apply the same rule.
 */
export const sanitizeReturnTo = (value: string | null | undefined): string | null => {
    if (!value) return null;
    if (!value.startsWith('/') || value.startsWith('//')) return null;
    if (value.includes('://') || value.includes('\\')) return null;
    return value;
};
