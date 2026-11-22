import type { AxiosInstance } from 'axios';
import type {
    AuthApiResponse,
    AuthResponse,
    AuthResult,
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

const toLoginResult = (body: AuthResult | MfaChallenge): LoginResult => {
    if ('mfaRequired' in body) {
        return { mfaRequired: true, mfaToken: body.mfaToken };
    }
    return {
        token: body.accessToken,
        user: body.user,
        refreshToken: body.refreshToken,
    };
};

export const createAuthService =(apiClient: AxiosInstance) => ({
    async login(credentials: LoginCredentials): Promise<LoginResult> {
        const { data } = await apiClient.post<AuthApiResponse | { data: MfaChallenge }>(
            '/api/v1/sessions',
            credentials,
        );
        return toLoginResult(data.data);
    },

    /**
     * Exchanges the Google ID token (the `credential` of Google Identity Services) for a session.
     * Same answer as `login`: the session, or the 2FA challenge when the account has it on.
     * Rejects with a 401 for an invalid token and a 503 when Google cannot be reached.
     */
    async loginWithGoogle(idToken: string): Promise<LoginResult> {
        const { data } = await apiClient.post<AuthApiResponse | { data: MfaChallenge }>(
            '/api/v1/sessions/google',
            { idToken },
        );
        return toLoginResult(data.data);
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

    // Always resolves the same way whether or not the account exists (the server answers 202 either way).
    async requestPasswordReset(email: string): Promise<void> {
        await apiClient.post('/api/v1/password-resets', { email });
    },

    // Rejects with a 400 when the token does not exist, expired or was already used.
    async checkPasswordReset(token: string): Promise<void> {
        await apiClient.post('/api/v1/password-resets/check', { token });
    },

    async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
        await apiClient.post('/api/v1/password-resets/confirm', { token, newPassword });
    },
});
