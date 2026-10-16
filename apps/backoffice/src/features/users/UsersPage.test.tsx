import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AdminUser } from '@discordia/api';
import { UsersPage } from './UsersPage';

const listUsers = vi.fn();
const suspendUser = vi.fn();
vi.mock('@/shared/api', () => ({
    adminUserService: {
        listUsers: (...args: unknown[]) => listUsers(...args),
        suspendUser: (...args: unknown[]) => suspendUser(...args),
    },
}));

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
        suspendUser.mockReset();
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

describe('UsersPage suspension', () => {
    const httpError = (status: number, detail: string) =>
        new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, {
            status,
            data: { detail },
        } as never);

    const openDialog = async () => {
        render(<UsersPage />);
        await screen.findByText('ana@example.com');
        await userEvent.click(screen.getByRole('button', { name: 'Suspender a Name ana' }));
    };

    beforeEach(() => {
        listUsers.mockResolvedValue(page([user('ana'), user('bob', { status: 'suspended' })]));
        suspendUser.mockResolvedValue(user('ana', { status: 'suspended' }));
    });

    it('opens the dialog with the account data and does not call the API until confirmed (CA1)', async () => {
        await openDialog();

        expect(screen.getByRole('dialog', { name: '¿Suspender a Name ana?' })).toBeInTheDocument();
        expect(
            screen.getByText(
                'ana@example.com no va a poder iniciar sesión, se cierran todas sus sesiones abiertas y su perfil deja de estar visible. Podés reactivarla después.',
            ),
        ).toBeInTheDocument();
        expect(suspendUser).not.toHaveBeenCalled();
    });

    it('confirming calls suspendUser(id), closes the dialog, reloads the list and announces it', async () => {
        await openDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Suspender cuenta' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Cuenta suspendida.');
        expect(suspendUser).toHaveBeenCalledTimes(1);
        expect(suspendUser).toHaveBeenCalledWith('ana');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(listUsers).toHaveBeenCalledTimes(2);
    });

    it('Cancelar does not call the API and closes the dialog', async () => {
        await openDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(suspendUser).not.toHaveBeenCalled();
    });

    it('Escape does not call the API and closes the dialog', async () => {
        await openDialog();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(suspendUser).not.toHaveBeenCalled();
    });

    it('on a 409 closes the dialog, reloads, and shows the detail above the table without announcing a suspension', async () => {
        suspendUser.mockRejectedValueOnce(httpError(409, 'La cuenta ya está suspendida.'));
        await openDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Suspender cuenta' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('La cuenta ya está suspendida.');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.queryByText('Cuenta suspendida.')).not.toBeInTheDocument();
    });

    it('on a server error keeps the dialog open with confirm enabled to retry, and does not reload', async () => {
        suspendUser.mockRejectedValueOnce(httpError(500, 'Error interno.'));
        await openDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Suspender cuenta' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Error interno.');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Suspender cuenta' })).toBeEnabled();
        expect(listUsers).toHaveBeenCalledTimes(1);
    });

    const conflictAlert = async () => {
        suspendUser.mockRejectedValueOnce(httpError(409, 'La cuenta ya está suspendida.'));
        await openDialog();
        await userEvent.click(screen.getByRole('button', { name: 'Suspender cuenta' }));
        await screen.findByRole('alert');
        // The reload that follows the 409 must not erase the alert by itself.
        await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2));
        await screen.findByRole('button', { name: 'Suspender a Name ana' });
        expect(screen.getByRole('alert')).toBeInTheDocument();
    };

    it('changing the status filter clears the conflict alert', async () => {
        await conflictAlert();

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'active');

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('typing in the search clears the conflict alert', async () => {
        await conflictAlert();

        await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por email o nombre' }), 'a');

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('changing the page clears the success status', async () => {
        listUsers.mockResolvedValue(page([user('ana')], 25, 0));
        await openDialog();
        await userEvent.click(screen.getByRole('button', { name: 'Suspender cuenta' }));
        await screen.findByRole('status');
        await screen.findByRole('button', { name: 'Siguiente' });

        await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('opening another dialog clears an earlier conflict alert', async () => {
        suspendUser.mockRejectedValueOnce(httpError(409, 'La cuenta ya está suspendida.'));
        await openDialog();
        await userEvent.click(screen.getByRole('button', { name: 'Suspender cuenta' }));
        await screen.findByRole('alert');

        await userEvent.click(await screen.findByRole('button', { name: 'Suspender a Name ana' }));

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('on a 403 shows the detail in the dialog and does not reload', async () => {
        suspendUser.mockRejectedValueOnce(httpError(403, 'No tenés permisos para suspender cuentas.'));
        await openDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Suspender cuenta' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('No tenés permisos para suspender cuentas.');
        expect(listUsers).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
