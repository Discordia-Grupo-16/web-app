import { useSearchParams } from 'react-router-dom';

export const RETURN_TO_PARAM = 'returnTo';
export const LOGIN_PATH = '/home';

/**
 * Only internal paths are valid destinations: otherwise the login link would be an open redirect
 * (`/home?returnTo=//evil.com` or `?returnTo=https://evil.com`).
 */
export const sanitizeReturnTo = (value: string | null | undefined): string | null => {
    if (!value) return null;
    if (!value.startsWith('/') || value.startsWith('//')) return null;
    if (value.includes('://') || value.includes('\\')) return null;
    return value;
};

/** The login URL that brings the user back to `destination` once the session is open. */
export const buildLoginPath = (destination: string): string => {
    const safe = sanitizeReturnTo(destination);
    if (!safe || safe === '/') return LOGIN_PATH;
    return `${LOGIN_PATH}?${RETURN_TO_PARAM}=${encodeURIComponent(safe)}`;
};

/** Where to go after authenticating: the pending destination from the URL, or the home. */
export const useReturnTo = (): string => {
    const [params] = useSearchParams();
    return sanitizeReturnTo(params.get(RETURN_TO_PARAM)) ?? '/';
};
