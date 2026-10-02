import type { AxiosInstance } from 'axios';
import type { editProfileRequest, userResponse } from './types';

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
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await apiClient.put<userResponse>("/api/v1/users/me/avatar", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return data;
    }
});