import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminServer } from '@discordia/api';
import { ServersPage } from './ServersPage';

const listServers = vi.fn();
vi.mock('@/shared/api', () => ({
    adminServerService: {
        listServers: (...args: unknown[]) => listServers(...args),
    },
}));

const server = (id: string, overrides: Partial<AdminServer> = {}): AdminServer => ({
    id,
    name: `Server ${id}`,
    memberCount: 10,
    createdAt: '2026-10-01T10:00:00Z',
    ...overrides,
});

const page = (servers: AdminServer[], total = servers.length, offset = 0) => ({
    data: servers,
    meta: { total, limit: 20, offset },
});

describe('ServersPage', () => {
    beforeEach(() => {
        listServers.mockReset();
        listServers.mockResolvedValue(page([server('alpha'), server('beta', { memberCount: 42 })]));
    });

    it('loads the first page and displays server data', async () => {
        render(<ServersPage />);

        expect(screen.getByText('Cargando servidores…')).toBeInTheDocument();
        expect(await screen.findByText('Server alpha')).toBeInTheDocument();
        expect(listServers).toHaveBeenCalledWith({ limit: 20, offset: 0 }, expect.anything());
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('searches by trimmed server name after the debounce', async () => {
        render(<ServersPage />);
        await screen.findByText('Server alpha');

        await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nombre de servidor' }), '  guild  ');

        await waitFor(() =>
            expect(listServers).toHaveBeenLastCalledWith(
                { search: 'guild', limit: 20, offset: 0 },
                expect.anything(),
            ),
        );
        const searches = listServers.mock.calls.filter(([params]) => params.search !== undefined);
        expect(searches).toHaveLength(1);
    });

    it('loads the next page and disables Siguiente on the last page', async () => {
        listServers.mockResolvedValueOnce(page([server('alpha')], 25, 0));
        listServers.mockResolvedValueOnce(page([server('omega')], 25, 20));
        render(<ServersPage />);
        await screen.findByText('Server alpha');

        await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

        expect(await screen.findByText('Server omega')).toBeInTheDocument();
        expect(listServers).toHaveBeenLastCalledWith({ limit: 20, offset: 20 }, expect.anything());
        expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    });

    it('returns to the first page when the search changes', async () => {
        listServers.mockResolvedValueOnce(page([server('alpha')], 45, 0));
        listServers.mockResolvedValueOnce(page([server('omega')], 45, 20));
        render(<ServersPage />);
        await screen.findByText('Server alpha');
        await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        await screen.findByText('Server omega');

        await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nombre de servidor' }), 'alpha');

        await waitFor(() =>
            expect(listServers).toHaveBeenLastCalledWith(
                { search: 'alpha', limit: 20, offset: 0 },
                expect.anything(),
            ),
        );
    });

    it('distinguishes an empty list from a search with no matches', async () => {
        listServers.mockResolvedValue(page([]));
        render(<ServersPage />);

        expect(await screen.findByText('Todavía no hay servidores creados.')).toBeInTheDocument();

        await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nombre de servidor' }), 'missing');

        expect(await screen.findByText('Ningún servidor coincide con la búsqueda.')).toBeInTheDocument();
    });

    it('shows a loading error and retries the request', async () => {
        listServers.mockRejectedValueOnce({});
        render(<ServersPage />);

        expect(await screen.findByText('No se pudieron cargar los servidores.')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

        expect(await screen.findByText('Server alpha')).toBeInTheDocument();
        expect(listServers).toHaveBeenCalledTimes(2);
    });

    it('explains that staff permissions are required after a 403', async () => {
        listServers.mockRejectedValueOnce({ response: { status: 403 } });
        render(<ServersPage />);

        expect(
            await screen.findByText('Tu cuenta ya no tiene permisos de staff. Volvé a iniciar sesión.'),
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    });

    it('returns to the previous page when a requested page is empty', async () => {
        listServers.mockResolvedValueOnce(page([server('alpha')], 21, 0));
        listServers.mockResolvedValueOnce(page([], 20, 20));
        listServers.mockResolvedValueOnce(page([server('alpha')], 20, 0));
        render(<ServersPage />);
        await screen.findByText('Server alpha');

        await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

        await waitFor(() =>
            expect(listServers).toHaveBeenLastCalledWith({ limit: 20, offset: 0 }, expect.anything()),
        );
        expect(await screen.findByText('Server alpha')).toBeInTheDocument();
    });
});
