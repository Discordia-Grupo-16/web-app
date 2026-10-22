import { useSearchParams } from 'react-router-dom';
import { RETURN_TO_PARAM, sanitizeReturnTo } from '@discordia/core';

export { RETURN_TO_PARAM, sanitizeReturnTo };
export const LOGIN_PATH = '/home';

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
