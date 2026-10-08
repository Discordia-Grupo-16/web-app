import type { AxiosInstance } from 'axios';
import { createPublicProfileCache } from './publicProfileCache';
import type { editProfileRequest, PublicProfiles, publicUsersResponse, userResponse } from './types';

export const createUserService = (apiClient: AxiosInstance) => {
    // One cache per service instance: web and mobile create a single userService, so every screen shares it.
    const publicProfiles = createPublicProfileCache({
        fetchBatch: async (ids) => {
            const { data } = await apiClient.get<publicUsersResponse>('/api/v1/users', {
                params: { ids: ids.join(',') },
            });
            return data.data;
        },
    });

    return {
        async getOwnProfile(): Promise<userResponse> {
            const { data } = await apiClient.get<userResponse>('/api/v1/users/me');
            return data;
        },

        async editOwnProfile(name: string, bio: string): Promise<userResponse> {
            const request: editProfileRequest = { name, bio };
            const { data } = await apiClient.patch<userResponse>('/api/v1/users/me', request);
            publicProfiles.invalidate(data.data.id);
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
            publicProfiles.invalidate(data.data.id);
            return data;
        },

        getPublicProfiles: (ids: string[]): Promise<PublicProfiles> => publicProfiles.get(ids),
        peekPublicProfile: publicProfiles.peek,
        clearPublicProfiles: publicProfiles.clear,
    };
};
