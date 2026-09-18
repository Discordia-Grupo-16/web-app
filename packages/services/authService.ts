import type { AxiosInstance } from 'axios';
import type { AuthResponse, LoginCredentials } from '../types/auth';

export const createAuthService = (apiClient: AxiosInstance) => ({
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
        return data;
    },
});