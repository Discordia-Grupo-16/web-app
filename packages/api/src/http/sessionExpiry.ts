export type SessionExpiryListener = () => void;

export interface SessionExpirySignal {
    /** Called by the HTTP client when the server rejects the session for good. */
    notify: () => void;
    /** Subscribes a listener (the auth provider) and returns the unsubscribe function. */
    subscribe: (listener: SessionExpiryListener) => () => void;
}

/**
 * Bridges the HTTP client and the auth state. The client is created at module level, before any
 * React tree exists, so it cannot hold a reference to the provider: both sides share this signal.
 */
export function createSessionExpirySignal(): SessionExpirySignal {
    const listeners = new Set<SessionExpiryListener>();
    return {
        notify: () => listeners.forEach((listener) => listener()),
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
