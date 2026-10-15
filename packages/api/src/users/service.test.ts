import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createUserService } from './service';
import type { PublicUser, userResponse } from './types';

const ownResponse: userResponse = { data: { id: 'me', email: 'me@example.com', name: 'Me', role: 'user' } };
const publicUser = (id: string): PublicUser => ({ id, name: `Name ${id}`, avatarUrl: null, bio: null });

const setup = () => {
    const apiClient = {
        get: vi.fn(async (_url: string, config?: { params?: { ids: string } }) => ({
            data: { data: (config?.params?.ids.split(',') ?? []).map(publicUser) },
        })),
        patch: vi.fn(async () => ({ data: ownResponse })),
        put: vi.fn(async () => ({ data: ownResponse })),
    };
    return { apiClient, service: createUserService(apiClient as unknown as AxiosInstance) };
};

describe('createUserService public profiles', () => {
    it('asks GET /users with the ids joined by comma', async () => {
        const { apiClient, service } = setup();

        const profiles = await service.getPublicProfiles(['a', 'b']);

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/users', { params: { ids: 'a,b' } });
        expect(profiles.get('a')).toEqual(publicUser('a'));
        expect(service.peekPublicProfile('b')).toEqual(publicUser('b'));
    });

    it('reuses the cache between calls', async () => {
        const { apiClient, service } = setup();

        await service.getPublicProfiles(['a']);
        await service.getPublicProfiles(['a']);

        expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('drops the own cached profile after editing it', async () => {
        const { service } = setup();
        await service.getPublicProfiles(['me']);

        await service.editOwnProfile('New name', 'New bio');

        expect(service.peekPublicProfile('me')).toBeUndefined();
    });

    it('drops the own cached profile after changing the avatar', async () => {
        const { service } = setup();
        await service.getPublicProfiles(['me']);

        await service.editAvatar({} as File);

        expect(service.peekPublicProfile('me')).toBeUndefined();
    });

    it('keeps other cached profiles when the own one is edited', async () => {
        const { service } = setup();
        await service.getPublicProfiles(['me', 'other']);

        await service.editOwnProfile('New name', 'New bio');

        expect(service.peekPublicProfile('other')).toEqual(publicUser('other'));
    });

    it('clearPublicProfiles empties the cache', async () => {
        const { service } = setup();
        await service.getPublicProfiles(['a']);

        service.clearPublicProfiles();

        expect(service.peekPublicProfile('a')).toBeUndefined();
    });
});

describe('createUserService profile editing', () => {
    it('getOwnProfile asks GET /api/v1/users/me', async () => {
        const { apiClient, service } = setup();

        await service.getOwnProfile();

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/users/me');
    });

    it('editOwnProfile sends name and bio to PATCH /api/v1/users/me', async () => {
        const { apiClient, service } = setup();

        await service.editOwnProfile('Nuevo Nombre', 'Nueva bio');

        expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/users/me', {
            name: 'Nuevo Nombre',
            bio: 'Nueva bio',
        });
    });

    it('editAvatar wraps the file in a FormData and sends it to PUT /api/v1/users/me/avatar', async () => {
        const { apiClient, service } = setup();
        const fakeFile = new File(['fake content'], 'avatar.png', { type: 'image/png' });

        await service.editAvatar(fakeFile);

        expect(apiClient.put).toHaveBeenCalledTimes(1);

        const [url, body, config] = vi.mocked(apiClient.put).mock.calls[0] as unknown as [string, FormData, any];

        expect(url).toBe('/api/v1/users/me/avatar');

        expect(body).toBeInstanceOf(FormData);

        expect(body.get('file')).toBe(fakeFile);

        expect(config?.headers?.['Content-Type']).toBe('multipart/form-data');
    });
});