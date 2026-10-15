import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '@discordia/api';
import { UsersPage } from './UsersPage';

const listUsers = vi.fn();
vi.mock('@/shared/api', () => ({ adminUserService: { listUsers: (...args: unknown[]) => listUsers(...args) } }));

const user = (id: string, overrides: Partial<AdminUser> = {}): AdminUser => ({
    id,
    email: `${id}@example.com`,
    name: `Name ${id}`,
    role: 'user',
    status: 'active',
    createdAt: '2026-10-01T10:00:00',
    ...overrides,
});

const page = (users: AdminUser[], total = users.length, offset = 0) => ({
    data: users,
    meta: { total, limit: 20, offset },
});

describe('UsersPage', () => {
    beforeEach(() => {
        listUsers.mockReset();
        listUsers.mockResolvedValue(page([user('ana'), user('bob', { status: 'suspended' })]));
    });

    it('loads the first page on mount and shows the rows with their status badge', async () => {
        render(<UsersPage />);

        expect(screen.getByText('Cargando usuarios…')).toBeInTheDocument();
        expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
        expect(listUsers).toHaveBeenCalledWith({ limit: 20, offset: 0 }, expect.anything());
        expect(screen.getByText('Activo')).toBeInTheDocument();
        expect(screen.getByText('Suspendido')).toBeInTheDocument();
    });

    it('searches once after the debounce, however many letters were typed (CA1)', async () => {
        render(<UsersPage />);
        await screen.findByText('ana@example.com');

        await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por email o nombre' }), 'ana');

        await waitFor(() =>
            expect(listUsers).toHaveBeenCalledWith({ search: 'ana', limit: 20, offset: 0 }, expect.anything()),
        );
        const searches = listUsers.mock.calls.filter(([params]) => params.search !== undefined);
        expect(searches).toHaveLength(1);
    });

    it('filters by status and goes back to the first page (CA2)', async () => {
        render(<UsersPage />);
        await screen.findByText('ana@example.com');

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'suspended');

        await waitFor(() =>
            expect(listUsers).toHaveBeenLastCalledWith(
                { status: 'suspended', limit: 20, offset: 0 },
                expect.anything(),
            ),
        );
    });

    it('asks for the next page and disables Siguiente on the last one', async () => {
        listUsers.mockResolvedValueOnce(page([user('ana')], 25, 0));
        listUsers.mockResolvedValueOnce(page([user('zoe')], 25, 20));
        render(<UsersPage />);
        await screen.findByText('ana@example.com');

        await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

        expect(await screen.findByText('zoe@example.com')).toBeInTheDocument();
        expect(listUsers).toHaveBeenLastCalledWith({ limit: 20, offset: 20 }, expect.anything());
        expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    });

    it('returns to the first page when a filter changes', async () => {
        listUsers.mockResolvedValueOnce(page([user('ana')], 45, 0));
        listUsers.mockResolvedValueOnce(page([user('zoe')], 45, 20));
        render(<UsersPage />);
        await screen.findByText('ana@example.com');
        await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        await screen.findByText('zoe@example.com');

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'active');

        await waitFor(() =>
            expect(listUsers).toHaveBeenLastCalledWith({ status: 'active', limit: 20, offset: 0 }, expect.anything()),
        );
    });

    it('says nothing matches when the list is empty with filters', async () => {
        listUsers.mockResolvedValue(page([]));
        render(<UsersPage />);
        await screen.findByText('Todavía no hay usuarios registrados.');

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'suspended');

        expect(await screen.findByText('Ningún usuario coincide con la búsqueda.')).toBeInTheDocument();
    });

    it('shows the error and retries on Reintentar', async () => {
        listUsers.mockRejectedValueOnce({});
        render(<UsersPage />);

        expect(await screen.findByText('No se pudieron cargar los usuarios.')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

        expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
        expect(listUsers).toHaveBeenCalledTimes(2);
    });

    it('explains the lost permissions on a 403', async () => {
        listUsers.mockRejectedValueOnce({ response: { status: 403 } });
        render(<UsersPage />);

        expect(
            await screen.findByText('Tu cuenta ya no tiene permisos de staff. Volvé a iniciar sesión.'),
        ).toBeInTheDocument();
    });
});
