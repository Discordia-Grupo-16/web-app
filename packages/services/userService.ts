import type { AxiosInstance } from 'axios';
import type { editProfileRequest, userResponse } from '@discordia/types/user';

export const createUserService = (apiClient: AxiosInstance) => ({
    async getOwnProfile(): Promise<userResponse> {
        const { data } = await apiClient.get<userResponse>('/api/v1/users/me');
        return data;
    },

    async editOwnProfile(name: string, bio: string): Promise<userResponse> {
        const request: editProfileRequest = { name, bio };
        const { data } = await apiClient.patch<userResponse>('/api/v1/users/me', request);
        return data;
    },

    async editAvatar(file: File): Promise<userResponse> {
        const { data } = await apiClient.put<userResponse>("/api/v1/users/me/avatar", file);
        return data;
    }
});