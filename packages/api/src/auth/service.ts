import type { AxiosInstance } from 'axios';
import type {
    AuthApiResponse,
    AuthResponse,
    LoginCredentials,
    LoginResult,
    MfaAuthResponse,
    MfaChallenge,
    MfaLoginApiResponse,
    MfaLoginPayload,
    RegisterUserData,
} from './types';

export const isMfaChallenge = (result: LoginResult): result is MfaChallenge =>
    'mfaRequired' in result && result.mfaRequired === true;

export const createAuthService = (apiClient: AxiosInstance) => ({
    async login(credentials: LoginCredentials): Promise<LoginResult> {
        const { data } = await apiClient.post<AuthApiResponse | { data: MfaChallenge }>(
            '/api/v1/sessions',
            credentials,
        );
        const body = data.data;
        if ('mfaRequired' in body) {
            return { mfaRequired: true, mfaToken: body.mfaToken };
        }
        return {
            token: body.accessToken,
            user: body.user,
            refreshToken: body.refreshToken,
        };
    },

    async verifyMfa(payload: MfaLoginPayload): Promise<MfaAuthResponse> {
        const { data } = await apiClient.post<MfaLoginApiResponse>('/api/v1/sessions/mfa', payload);
        const result: MfaAuthResponse = {
            token: data.data.accessToken,
            user: data.data.user,
            refreshToken: data.data.refreshToken,
        };
        if (data.data.recoveryCodesRemaining !== undefined) {
            result.recoveryCodesRemaining = data.data.recoveryCodesRemaining;
        }
        return result;
    },

    async register(userData: RegisterUserData): Promise<AuthResponse> {
        const { data } = await apiClient.post<AuthApiResponse>('/api/v1/users', userData);
        return {
            token: data.data.accessToken,
            user: data.data.user,
            refreshToken: data.data.refreshToken,
        };
    },

    async refreshSession(refreshToken: string): Promise<AuthResponse> {
        const { data } = await apiClient.post<AuthApiResponse>('/api/v1/sessions/refresh', {
            refreshToken,
        });
        return {
            token: data.data.accessToken,
            user: data.data.user,
            refreshToken: data.data.refreshToken,
        };
    },

    async logout(): Promise<void> {
        await apiClient.delete('/api/v1/sessions');
    },
});
