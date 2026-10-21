import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import type { AuthStorageStrategy } from './storage';

const unauthorized = (config: InternalAxiosRequestConfig) =>
    new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config,
    });

const setup = ({ token = 'old-access', refreshToken = 'old-refresh' as string | null } = {}) => {
    let storedToken = token;
    const storage: AuthStorageStrategy = {
        getToken: vi.fn(async () => storedToken),
        setToken: vi.fn(async (value: string) => { storedToken = value; }),
        getRefreshToken: vi.fn(async () => refreshToken),
        setRefreshToken: vi.fn(async () => undefined),
        getUser: vi.fn(async () => null),
        setUser: vi.fn(async () => undefined),
        clearSession: vi.fn(async () => undefined),
    };
    const onSessionExpired = vi.fn();
    const api = createApiClient({ baseURL: 'http://gateway', storage, onSessionExpired });

    // Answers 401 to anything that does not carry the renewed token, without touching the network.
    api.defaults.adapter = async (config) => {
        if (config.headers.Authorization === 'Bearer new-access') {
            return { status: 200, statusText: 'OK', data: { data: 'ok' }, headers: {}, config };
        }
        throw unauthorized(config);
    };
    return { api, storage, onSessionExpired };
};

describe('createApiClient session expiry (login CA 4)', () => {
    let refresh: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        refresh = vi.spyOn(axios, 'post');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renews the session and retries the request without reporting an expiry', async () => {
        refresh.mockResolvedValue({ data: { data: { accessToken: 'new-access', refreshToken: 'new-refresh' } } });
        const { api, storage, onSessionExpired } = setup();

        const response = await api.get('/api/v1/servers');

        expect(response.data).toEqual({ data: 'ok' });
        expect(storage.setToken).toHaveBeenCalledWith('new-access');
        expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it('reports the expiry once the refresh token is rejected, and clears the stored session', async () => {
        refresh.mockRejectedValue(
            new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, null, {
                status: 401,
                statusText: 'Unauthorized',
                data: {},
                headers: {},
                config: {} as InternalAxiosRequestConfig,
            }),
        );
        const { api, storage, onSessionExpired } = setup();

        await expect(api.get('/api/v1/servers')).rejects.toMatchObject({ response: { status: 401 } });

        expect(storage.clearSession).toHaveBeenCalled();
        expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });

    it('keeps the session when the refresh fails without an answer from the server', async () => {
        refresh.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
        const { api, storage, onSessionExpired } = setup();

        await expect(api.get('/api/v1/servers')).rejects.toMatchObject({ code: 'ERR_NETWORK' });

        expect(storage.clearSession).not.toHaveBeenCalled();
        expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it.each([401, 403])('drops the session when the refresh token is refused with %s', async (status) => {
        refresh.mockRejectedValue(
            new AxiosError('Refused', 'ERR_BAD_REQUEST', undefined, null, {
                status,
                statusText: 'Refused',
                data: {},
                headers: {},
                config: {} as InternalAxiosRequestConfig,
            }),
        );
        const { api, storage, onSessionExpired } = setup();

        await expect(api.get('/api/v1/servers')).rejects.toBeDefined();

        expect(storage.clearSession).toHaveBeenCalled();
        expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });

    it.each([429, 500, 502, 503])(
        'keeps the session when the refresh fails with a server error (%s)',
        async (status) => {
            refresh.mockRejectedValue(
                new AxiosError('Server error', 'ERR_BAD_RESPONSE', undefined, null, {
                    status,
                    statusText: 'Server error',
                    data: {},
                    headers: {},
                    config: {} as InternalAxiosRequestConfig,
                }),
            );
            const { api, storage, onSessionExpired } = setup();

            await expect(api.get('/api/v1/servers')).rejects.toMatchObject({ response: { status } });

            expect(storage.clearSession).not.toHaveBeenCalled();
            expect(onSessionExpired).not.toHaveBeenCalled();
        },
    );

    it('reports the expiry when the access token is rejected and there is no refresh token', async () => {
        const { api, onSessionExpired } = setup({ refreshToken: null });

        await expect(api.get('/api/v1/servers')).rejects.toMatchObject({ response: { status: 401 } });

        expect(refresh).not.toHaveBeenCalled();
        expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });

    it('does not report an expiry for wrong credentials at login', async () => {
        const { api, onSessionExpired } = setup();

        await expect(api.post('/api/v1/sessions', { email: 'a@b.c', password: 'x' })).rejects.toMatchObject({
            response: { status: 401 },
        });

        expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it('does not report an expiry for a request that was sent without a session', async () => {
        const { api, onSessionExpired } = setup({ token: '', refreshToken: null });

        await expect(api.get('/api/v1/invitations/abc')).rejects.toMatchObject({ response: { status: 401 } });

        expect(onSessionExpired).not.toHaveBeenCalled();
    });
});
