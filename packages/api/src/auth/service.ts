import type { AxiosInstance } from 'axios';
import type {
    AuthApiResponse,
    AuthResponse,
    LoginCredentials,
    RegisterUserData,
} from './types';

export const createAuthService = (apiClient: AxiosInstance) => ({
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const { data } = await apiClient.post<AuthApiResponse>('/api/v1/sessions', credentials);
        return {
            token: data.data.accessToken,
            user: data.data.user,
            refreshToken: data.data.refreshToken,
        };
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