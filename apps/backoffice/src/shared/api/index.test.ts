import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createApiClient } = vi.hoisted(() => ({
    createApiClient: vi.fn<(config: { onSessionExpired: () => void }) => object>(() => ({})),
}));

vi.mock('@discordia/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/api')>()),
    createApiClient,
}));

describe('shared api wiring', () => {
    let unsubscribe: (() => void) | undefined;

    // `./index` and `sessionExpiry` are singletons: a fresh module graph per test keeps them from leaking.
    beforeEach(() => vi.resetModules());

    afterEach(() => {
        unsubscribe?.();
        unsubscribe = undefined;
        vi.clearAllMocks();
    });

    it('tells the session expiry signal when the HTTP client loses the session', async () => {
        await import('./index');
        const { sessionExpiry } = await import('@/shared/session/sessionExpiry');
        const { onSessionExpired } = createApiClient.mock.calls[0][0];
        const listener = vi.fn();
        unsubscribe = sessionExpiry.subscribe(listener);

        onSessionExpired();

        expect(listener).toHaveBeenCalledTimes(1);
    });
});
