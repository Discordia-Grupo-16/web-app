import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createAuthService } from './service';

const setup = () => {
    const apiClient = { post: vi.fn(async () => ({ data: undefined })) };
    return { apiClient, service: createAuthService(apiClient as unknown as AxiosInstance) };
};

describe('createAuthService password recovery', () => {
    it('requests the reset link with POST /password-resets', async () => {
        const { apiClient, service } = setup();

        await service.requestPasswordReset('milton@correo.com');

        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/password-resets', { email: 'milton@correo.com' });
    });

    it('checks the token with POST /password-resets/check', async () => {
        const { apiClient, service } = setup();

        await service.checkPasswordReset('tok');

        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/password-resets/check', { token: 'tok' });
    });

    it('confirms the new password with POST /password-resets/confirm', async () => {
        const { apiClient, service } = setup();

        await service.confirmPasswordReset('tok', 'Nueva1234');

        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/password-resets/confirm', {
            token: 'tok',
            newPassword: 'Nueva1234',
        });
    });

    it('lets the error of a rejected check reach the caller', async () => {
        const { apiClient, service } = setup();
        apiClient.post.mockRejectedValueOnce({ response: { status: 400 } });

        await expect(service.checkPasswordReset('bad')).rejects.toMatchObject({ response: { status: 400 } });
    });
});
