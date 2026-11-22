import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createAuthService, isMfaChallenge } from './service';

const user = { id: '1', email: 'a@b.com', name: 'Ana', role: 'user' };

const setup = (impl: () => Promise<unknown>) => {
    const apiClient = { post: vi.fn(impl) };
    return { apiClient, auth: createAuthService(apiClient as unknown as AxiosInstance) };
};

describe('authService.loginWithGoogle', () => {
    it('sends the ID token to POST /sessions/google and maps the session', async () => {
        const { apiClient, auth } = setup(async () => ({
            data: { data: { accessToken: 'a', refreshToken: 'r', user } },
        }));

        const result = await auth.loginWithGoogle('google-id-token');

        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/sessions/google', { idToken: 'google-id-token' });
        expect(isMfaChallenge(result)).toBe(false);
        expect(result).toEqual({ token: 'a', refreshToken: 'r', user });
    });

    it('returns the challenge when the account has 2FA', async () => {
        const { auth } = setup(async () => ({ data: { data: { mfaRequired: true, mfaToken: 'mfa-1' } } }));

        const result = await auth.loginWithGoogle('google-id-token');

        expect(isMfaChallenge(result)).toBe(true);
        expect(result).toEqual({ mfaRequired: true, mfaToken: 'mfa-1' });
    });

    it('rejects with the server error when Google is unavailable (503)', async () => {
        const error = Object.assign(new Error('Service Unavailable'), {
            response: { status: 503, data: { detail: 'No pudimos conectar con Google.' } },
        });
        const { auth } = setup(async () => {
            throw error;
        });

        await expect(auth.loginWithGoogle('google-id-token')).rejects.toBe(error);
    });
});
