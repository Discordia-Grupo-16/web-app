import type { AxiosInstance } from 'axios';
import type {
    AuthApiResponse,
    AuthResponse,
    LoginCredentials,
    RegisterUserData,
} from '../types/auth';

export const createAuthService = (apiClient: AxiosInstance) => ({
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const { data } = await apiClient.post<AuthApiResponse | AuthResponse>('/api/v1/sessions', credentials);
        if ('data' in data && data.data) {
            return {
                token: data.data.accessToken,
                user: data.data.user,
                refreshToken: data.data.refreshToken,
            };
        }
        return data as AuthResponse;
    },

    async register(userData: RegisterUserData): Promise<AuthResponse> {
        const { data } = await apiClient.post<AuthApiResponse | AuthResponse>('/api/v1/users', userData);
        if ('data' in data && data.data) {
            return {
                token: data.data.accessToken,
                user: data.data.user,
                refreshToken: data.data.refreshToken,
            };
        }
        return data as AuthResponse;
    },
});