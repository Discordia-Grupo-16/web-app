import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { useServer } from './useServer';

const navigate = vi.fn();

vi.mock('@/shared/api', () => ({ serversService: { getServer: vi.fn() } }));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));

const server: Server = {
    id: 'srv',
    name: 'Discordia',
    description: null,
    owner_id: 'owner',
    avatar_url: null,
    created_at: '2026-10-01T00:00:00Z',
    my_permissions: 7,
    my_permission_names: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'CONNECT'],
    channels: [
        { id: 'c1', server_id: 'srv', name: 'general', type: 'text', topic: null, position: 0, created_at: '2026-10-01T00:00:00Z' },
    ],
};

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe('useServer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads the server', async () => {
        vi.mocked(serversService.getServer).mockResolvedValue(server);
        const { result } = renderHook(() => useServer('srv', 'c1'), { wrapper });

        await waitFor(() => expect(result.current.server).toEqual(server));
        expect(result.current.loading).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
    });

    it.each([404, 403])('goes home when the server answers %i', async (status) => {
        vi.mocked(serversService.getServer).mockRejectedValue({ response: { status } });
        renderHook(() => useServer('srv', undefined), { wrapper });

        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    });

    it('falls back to the server view when the open channel no longer exists', async () => {
        vi.mocked(serversService.getServer).mockResolvedValue(server);
        renderHook(() => useServer('srv', 'deleted'), { wrapper });

        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/servers/srv'));
    });

    it('picks up a permission someone else revoked, on the next poll', async () => {
        // This is how the panel finds out: nothing is pushed over the socket for permissions, so
        // without this the user keeps seeing buttons the backend already refuses.
        vi.mocked(serversService.getServer).mockResolvedValue(server);
        const { result } = renderHook(() => useServer('srv', 'c1'), { wrapper });
        await waitFor(() => expect(result.current.server).not.toBeNull());

        vi.mocked(serversService.getServer).mockResolvedValue({
            ...server,
            my_permissions: 1,
            my_permission_names: ['VIEW_CHANNEL'],
        });
        document.dispatchEvent(new Event('visibilitychange'));

        await waitFor(() => expect(result.current.server?.my_permissions).toBe(1));
        expect(result.current.server?.my_permission_names).toEqual(['VIEW_CHANNEL']);
    });

    it('applies channel updates to the loaded server', async () => {
        vi.mocked(serversService.getServer).mockResolvedValue(server);
        const { result } = renderHook(() => useServer('srv', 'c1'), { wrapper });
        await waitFor(() => expect(result.current.server).not.toBeNull());

        result.current.updateChannels(() => []);

        await waitFor(() => expect(result.current.server?.channels).toEqual([]));
    });
});
