import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createCategoriesService } from './service';
import type { Category } from './types';

const category: Category = {
    id: 'cat-1',
    server_id: 'srv',
    name: 'General',
    position: 0,
    created_at: '2026-11-10T00:00:00Z',
};

const setup = () => {
    const apiClient = {
        post: vi.fn(async () => ({ data: { data: category } })),
        patch: vi.fn(async () => ({ data: { data: category } })),
        delete: vi.fn(async () => ({ data: undefined })),
    };
    return { apiClient, service: createCategoriesService(apiClient as unknown as AxiosInstance) };
};

describe('createCategory', () => {
    it('posts to the server categories endpoint', async () => {
        const { apiClient, service } = setup();

        await service.createCategory('srv', 'General');

        expect(apiClient.post).toHaveBeenCalledWith(
            '/api/v1/servers/srv/categories/',
            expect.any(FormData),
        );
    });

    it('returns the created category', async () => {
        const { service } = setup();

        const result = await service.createCategory('srv', 'General');

        expect(result).toEqual(category);
    });
});

describe('renameCategory', () => {
    it('patches the category endpoint', async () => {
        const { apiClient, service } = setup();

        await service.renameCategory('srv', 'cat-1', 'Renamed');

        expect(apiClient.patch).toHaveBeenCalledWith(
            '/api/v1/servers/srv/categories/cat-1',
            expect.any(FormData),
        );
    });

    it('returns the updated category', async () => {
        const { service } = setup();

        const result = await service.renameCategory('srv', 'cat-1', 'Renamed');

        expect(result).toEqual(category);
    });
});

describe('deleteCategory', () => {
    it('deletes the category endpoint', async () => {
        const { apiClient, service } = setup();

        await service.deleteCategory('srv', 'cat-1');

        expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/servers/srv/categories/cat-1');
    });

    it('returns no body', async () => {
        const { service } = setup();

        await expect(service.deleteCategory('srv', 'cat-1')).resolves.toBeUndefined();
    });
});
