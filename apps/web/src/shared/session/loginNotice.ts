const LOGIN_NOTICE_KEY = 'discordia.loginNotice';

// sessionStorage can throw (private mode, blocked site data): the notice is a nicety, never worth
// breaking the sign-out or the login screen for, so every access is guarded.

export function setLoginNotice(message: string): void {
    try {
        sessionStorage.setItem(LOGIN_NOTICE_KEY, message);
    } catch {
        // Without storage the user just lands on the login screen without the explanation.
    }
}

/** Reads and deletes the notice, so it shows once. */
export function consumeLoginNotice(): string | null {
    let message: string | null;
    try {
        message = sessionStorage.getItem(LOGIN_NOTICE_KEY);
    } catch {
        return null;
    }
    try {
        sessionStorage.removeItem(LOGIN_NOTICE_KEY);
    } catch {
        // Already read; a failed delete only risks showing it once more.
    }
    return message;
}
