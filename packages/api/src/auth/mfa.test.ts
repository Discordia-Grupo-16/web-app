import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createMfaService } from './mfaService';
import { createAuthService, isMfaChallenge } from './service';

const user = { id: '1', email: 'a@b.com', name: 'Ana', role: 'user' };

const setup = (response: unknown = { data: { data: undefined } }) => {
    const apiClient = { post: vi.fn(async () => response) };
    const client = apiClient as unknown as AxiosInstance;
    return { apiClient, auth: createAuthService(client), mfa: createMfaService(client) };
};

describe('authService.login with 2FA', () => {
    it('returns the session when the account has no 2FA', async () => {
        const { auth } = setup({ data: { data: { accessToken: 'a', refreshToken: 'r', user } } });

        const result = await auth.login({ email: 'a@b.com', password: 'x' });

        expect(isMfaChallenge(result)).toBe(false);
        expect(result).toEqual({ token: 'a', refreshToken: 'r', user });
    });

    it('returns the challenge when the account has 2FA', async () => {
        const { auth } = setup({ data: { data: { mfaRequired: true, mfaToken: 'mfa-1' } } });

        const result = await auth.login({ email: 'a@b.com', password: 'x' });

        expect(isMfaChallenge(result)).toBe(true);
        expect(result).toEqual({ mfaRequired: true, mfaToken: 'mfa-1' });
    });
});

describe('authService.verifyMfa', () => {
    it('sends the TOTP code to POST /sessions/mfa and maps the session', async () => {
        const { apiClient, auth } = setup({ data: { data: { accessToken: 'a', refreshToken: 'r', user } } });

        const result = await auth.verifyMfa({ mfaToken: 'm', code: '123456' });

        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/sessions/mfa', { mfaToken: 'm', code: '123456' });
        expect(result).toEqual({ token: 'a', refreshToken: 'r', user });
        expect(result).not.toHaveProperty('recoveryCodesRemaining');
    });

    it('returns recoveryCodesRemaining when a recovery code was used', async () => {
        const { apiClient, auth } = setup({
            data: { data: { accessToken: 'a', refreshToken: 'r', user, recoveryCodesRemaining: 0 } },
        });

        const result = await auth.verifyMfa({ mfaToken: 'm', recoveryCode: 'abcd-2345' });

        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/sessions/mfa', {
            mfaToken: 'm',
            recoveryCode: 'abcd-2345',
        });
        expect(result.recoveryCodesRemaining).toBe(0);
    });
});

describe('mfaService', () => {
    it('setup returns the secret and the otpauth URI', async () => {
        const setupResult = { secret: 'ABC', otpauthUri: 'otpauth://totp/Discordia:a' };
        const { apiClient, mfa } = setup({ data: { data: setupResult } });

        expect(await mfa.setup()).toEqual(setupResult);
        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/users/me/mfa/setup');
    });

    it('enable sends the code and returns the recovery codes', async () => {
        const { apiClient, mfa } = setup({ data: { data: { recoveryCodes: ['aaaa-1111'] } } });

        expect(await mfa.enable('123456')).toEqual({ recoveryCodes: ['aaaa-1111'] });
        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/users/me/mfa/enable', { code: '123456' });
    });

    it('regenerateRecoveryCodes sends a TOTP code', async () => {
        const { apiClient, mfa } = setup({ data: { data: { recoveryCodes: ['bbbb-2222'] } } });

        expect(await mfa.regenerateRecoveryCodes('654321')).toEqual({ recoveryCodes: ['bbbb-2222'] });
        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/users/me/mfa/recovery-codes', { code: '654321' });
    });

    it('disable sends the password', async () => {
        const { apiClient, mfa } = setup();

        await mfa.disable('Secreta123');

        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/users/me/mfa/disable', { password: 'Secreta123' });
    });

    it('lets a rejected call reach the caller', async () => {
        const { apiClient, mfa } = setup();
        apiClient.post.mockRejectedValueOnce({ response: { status: 400 } });

        await expect(mfa.enable('000000')).rejects.toMatchObject({ response: { status: 400 } });
    });
});
