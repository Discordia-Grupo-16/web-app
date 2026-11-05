const LOGIN_NOTICE_KEY = 'discordia.loginNotice';
const LOGIN_NOTICE_TONE_KEY = 'discordia.loginNoticeTone';

export type LoginNoticeTone = 'error' | 'success';

export interface LoginNotice {
    message: string;
    tone: LoginNoticeTone;
}

// sessionStorage can throw (private mode, blocked site data): the notice is a nicety, never worth
// breaking the sign-out or the login screen for, so every access is guarded.

export function setLoginNotice(message: string, tone: LoginNoticeTone = 'error'): void {
    try {
        sessionStorage.setItem(LOGIN_NOTICE_KEY, message);
        if (tone === 'success') sessionStorage.setItem(LOGIN_NOTICE_TONE_KEY, tone);
        else sessionStorage.removeItem(LOGIN_NOTICE_TONE_KEY);
    } catch {
        // Without storage the user just lands on the login screen without the explanation.
    }
}

/** Reads and deletes the notice with its tone, so it shows once. */
export function consumeLoginNoticeWithTone(): LoginNotice | null {
    let message: string | null;
    let tone: string | null;
    try {
        message = sessionStorage.getItem(LOGIN_NOTICE_KEY);
        tone = sessionStorage.getItem(LOGIN_NOTICE_TONE_KEY);
    } catch {
        return null;
    }
    try {
        sessionStorage.removeItem(LOGIN_NOTICE_KEY);
        sessionStorage.removeItem(LOGIN_NOTICE_TONE_KEY);
    } catch {
        // Already read; a failed delete only risks showing it once more.
    }
    return message === null ? null : { message, tone: tone === 'success' ? 'success' : 'error' };
}

/** Reads and deletes the notice, so it shows once. */
export function consumeLoginNotice(): string | null {
    return consumeLoginNoticeWithTone()?.message ?? null;
}
