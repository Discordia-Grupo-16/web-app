import type { AxiosInstance } from 'axios';
import type {
    AuthApiResponse,
    AuthResponse,
    LoginCredentials,
    RegisterUserData,
} from '../types/auth';

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
});