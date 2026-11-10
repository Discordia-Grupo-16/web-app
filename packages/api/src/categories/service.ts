import type { AxiosInstance } from 'axios';
import type { Category } from './types';

export const createCategoriesService = (apiClient: AxiosInstance) => ({
    createCategory: (serverId: string, name: string): Promise<Category> => {
        const form = new FormData();
        form.append('name', name);
        return apiClient
            .post<{ data: Category }>(`/api/v1/servers/${serverId}/categories/`, form)
            .then(r => r.data.data);
    },

    renameCategory: (serverId: string, categoryId: string, name: string): Promise<Category> => {
        const form = new FormData();
        form.append('name', name);
        return apiClient
            .patch<{ data: Category }>(`/api/v1/servers/${serverId}/categories/${categoryId}`, form)
            .then(r => r.data.data);
    },

    deleteCategory: (serverId: string, categoryId: string): Promise<void> =>
        apiClient
            .delete(`/api/v1/servers/${serverId}/categories/${categoryId}`)
            .then(() => undefined),
});
