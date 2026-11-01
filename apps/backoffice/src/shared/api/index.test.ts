import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionExpiry } from '@/shared/session/sessionExpiry';

const { createApiClient } = vi.hoisted(() => ({
    createApiClient: vi.fn<(config: { onSessionExpired: () => void }) => object>(() => ({})),
}));

vi.mock('@discordia/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/api')>()),
    createApiClient,
}));

describe('shared api wiring', () => {
    afterEach(() => vi.clearAllMocks());

    it('tells the session expiry signal when the HTTP client loses the session', async () => {
        await import('./index');
        const { onSessionExpired } = createApiClient.mock.calls[0][0];
        const listener = vi.fn();
        sessionExpiry.subscribe(listener);

        onSessionExpired();

        expect(listener).toHaveBeenCalledTimes(1);
    });
});
