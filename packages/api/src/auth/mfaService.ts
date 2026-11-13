import type { AxiosInstance } from 'axios';
import type { MfaRecoveryCodes, MfaSetup } from './types';

export const createMfaService = (apiClient: AxiosInstance) => ({
    /** Starts the activation: a pending secret, and the URI the client draws as a QR. */
    async setup(): Promise<MfaSetup> {
        const { data } = await apiClient.post<{ data: MfaSetup }>('/api/v1/users/me/mfa/setup');
        return data.data;
    },

    /** Turns 2FA on with the first code. The recovery codes come back once, in the clear. */
    async enable(code: string): Promise<MfaRecoveryCodes> {
        const { data } = await apiClient.post<{ data: MfaRecoveryCodes }>(
            '/api/v1/users/me/mfa/enable',
            { code },
        );
        return data.data;
    },

    /** Replaces the recovery codes. Needs a current TOTP code, not a recovery one. */
    async regenerateRecoveryCodes(code: string): Promise<MfaRecoveryCodes> {
        const { data } = await apiClient.post<{ data: MfaRecoveryCodes }>(
            '/api/v1/users/me/mfa/recovery-codes',
            { code },
        );
        return data.data;
    },

    async disable(password: string): Promise<void> {
        await apiClient.post('/api/v1/users/me/mfa/disable', { password });
    },
});
