import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@discordia/core';
import { api, authService } from '@/shared/api';
import { backofficeAuthStorage, TOKEN_KEY, USER_KEY } from '@/shared/session/authStorage';
import { LoginForm } from './LoginForm';

const navigate = vi.fn();

vi.mock('@/shared/api', () => ({ authService: { login: vi.fn() }, api: { delete: vi.fn() } }));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));

const login = vi.mocked(authService.login);
const revoke = vi.mocked(api.delete);

const staff = { id: '1', email: 'staff@discordia.dev', name: 'Staff', role: 'staff' };
const regularUser = { ...staff, id: '2', role: 'user' };

// The real AuthProvider and storage: what ends up in localStorage is part of what is being tested.
const renderForm = () =>
    render(
        <MemoryRouter>
            <AuthProvider storage={backofficeAuthStorage}>
                <LoginForm />
            </AuthProvider>
        </MemoryRouter>,
    );

const fillAndSubmit = async (email: string, password: string) => {
    const user = userEvent.setup();
    if (email) await user.type(screen.getByLabelText('Correo electrónico'), email);
    if (password) await user.type(screen.getByLabelText('Contraseña'), password);
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
};

const failWith = (status?: number) =>
    login.mockRejectedValue(
        status
            ? new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data: {} } as AxiosResponse)
            : new AxiosError('Network Error', 'ERR_NETWORK'),
    );

describe('LoginForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('does not call the API when the email is empty', async () => {
        renderForm();

        await fillAndSubmit('', 'secret123');

        expect(await screen.findByText('Por favor ingresa tu correo electrónico.')).toBeInTheDocument();
        expect(login).not.toHaveBeenCalled();
    });

    it('stores the session and navigates home when the account is staff', async () => {
        login.mockResolvedValue({ token: 't', refreshToken: 'r', user: staff });
        renderForm();

        await fillAndSubmit(' staff@discordia.dev ', 'secret123');

        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
        expect(login).toHaveBeenCalledWith({ email: 'staff@discordia.dev', password: 'secret123' });
        expect(localStorage.getItem(TOKEN_KEY)).toBe('t');
        expect(JSON.parse(localStorage.getItem(USER_KEY)!)).toEqual(staff);
    });

    it('rejects a non-staff account without storing anything', async () => {
        login.mockResolvedValue({ token: 't', refreshToken: 'r', user: regularUser });
        renderForm();

        await fillAndSubmit('ana@correo.com', 'secret123');

        expect(await screen.findByText('Esta cuenta no tiene acceso al backoffice.')).toBeInTheDocument();
        expect(navigate).not.toHaveBeenCalled();
        expect(localStorage.length).toBe(0);
    });

    it('revokes the orphan session with the token of the login, without storing it', async () => {
        login.mockResolvedValue({ token: 'orphan-token', refreshToken: 'r', user: regularUser });
        revoke.mockResolvedValue({});
        renderForm();

        await fillAndSubmit('ana@correo.com', 'secret123');

        await screen.findByText('Esta cuenta no tiene acceso al backoffice.');
        expect(revoke).toHaveBeenCalledOnce();
        expect(revoke).toHaveBeenCalledWith('/api/v1/sessions', {
            headers: { Authorization: 'Bearer orphan-token' },
        });
        expect(localStorage.length).toBe(0);
    });

    it('shows the same error when revoking the orphan session fails', async () => {
        login.mockResolvedValue({ token: 'orphan-token', refreshToken: 'r', user: regularUser });
        revoke.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
        renderForm();

        await fillAndSubmit('ana@correo.com', 'secret123');

        expect(await screen.findByText('Esta cuenta no tiene acceso al backoffice.')).toBeInTheDocument();
        expect(revoke).toHaveBeenCalledOnce();
        expect(navigate).not.toHaveBeenCalled();
        expect(localStorage.length).toBe(0);
    });

    it('does not revoke anything when the account is staff', async () => {
        login.mockResolvedValue({ token: 't', refreshToken: 'r', user: staff });
        renderForm();

        await fillAndSubmit('staff@discordia.dev', 'secret123');

        await waitFor(() => expect(navigate).toHaveBeenCalled());
        expect(revoke).not.toHaveBeenCalled();
    });

    it.each([
        ['401', 401, 'Email o contraseña incorrectos.'],
        ['403', 403, 'Esta cuenta está suspendida.'],
        ['429', 429, 'Demasiados intentos. Probá de nuevo en unos minutos.'],
        ['a network error', undefined, 'No se pudo conectar con el servidor.'],
    ])('shows the message for %s and stores nothing', async (_label, status, message) => {
        failWith(status);
        renderForm();

        await fillAndSubmit('staff@discordia.dev', 'secret123');

        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(navigate).not.toHaveBeenCalled();
        expect(localStorage.length).toBe(0);
    });
});
