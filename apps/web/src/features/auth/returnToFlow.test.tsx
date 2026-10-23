import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@discordia/core';
import type { AuthStorageStrategy } from '@discordia/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginRegisterPage } from './LoginRegisterPage';
import { ProtectedRoute } from './ProtectedRoute';
import { authService } from '@/shared/api';

vi.mock('@/shared/api', () => ({ authService: { login: vi.fn(), register: vi.fn() } }));

const login = vi.mocked(authService.login);
const register = vi.mocked(authService.register);

const memoryStorage = (): AuthStorageStrategy => {
    let token: string | null = null;
    let user: unknown = null;
    return {
        getToken: async () => token,
        setToken: async (value) => { token = value; },
        getUser: async <T,>() => user as T | null,
        setUser: async (value) => { user = value; },
        clearSession: async () => { token = null; user = null; },
    };
};

const renderApp = (initialEntry: string) => {
    const router = createMemoryRouter(
        [
            { path: '/home', element: <LoginRegisterPage /> },
            {
                element: <ProtectedRoute />,
                children: [
                    { index: true, element: <p>Pantalla de inicio</p> },
                    { path: 'invite/:code', element: <p>Procesando invitación</p> },
                ],
            },
        ],
        { initialEntries: [initialEntry] },
    );
    render(
        <AuthProvider storage={memoryStorage()}>
            <RouterProvider router={router} />
        </AuthProvider>,
    );
    return router;
};

const fillLogin = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(await screen.findByPlaceholderText('tu@correo.com'), 'felipe@correo.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'Secret123');
};

describe('invitation opened without a session', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        login.mockResolvedValue({ token: 't', refreshToken: 'r', user: { id: '1', name: 'Felipe' } } as never);
        register.mockResolvedValue({ token: 't', user: { id: '1', name: 'Felipe' } } as never);
    });

    it('goes through the login and ends in the invitation', async () => {
        const router = renderApp('/invite/abc');
        const user = userEvent.setup();

        await fillLogin(user);
        expect(router.state.location.pathname).toBe('/home');
        expect(router.state.location.search).toBe('?returnTo=%2Finvite%2Fabc');

        await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

        expect(await screen.findByText('Procesando invitación')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/invite/abc');
    });

    it('keeps the destination when the user switches from the login to the register form', async () => {
        const router = renderApp('/invite/abc');
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Regístrate' }));
        await user.type(screen.getByPlaceholderText('tu@correo.com'), 'felipe@correo.com');
        await user.type(screen.getByPlaceholderText('ej. Jane Doe'), 'Felipe');
        await user.type(screen.getByPlaceholderText('••••••••'), 'Secret123');
        await user.click(screen.getByRole('button', { name: 'Registrarse' }));

        expect(await screen.findByText('Procesando invitación')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/invite/abc');
    });

    it('still lands in the invitation after a reload of the login page', async () => {
        const router = renderApp('/home?returnTo=%2Finvite%2Fabc');
        const user = userEvent.setup();

        await fillLogin(user);
        await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

        expect(await screen.findByText('Procesando invitación')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/invite/abc');
    });

    it('goes to the home when the destination is not an internal path', async () => {
        const router = renderApp('/home?returnTo=https%3A%2F%2Fevil.com');
        const user = userEvent.setup();

        await fillLogin(user);
        await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

        expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
    });

    it('goes to the home when the login was opened directly', async () => {
        const router = renderApp('/home');
        const user = userEvent.setup();

        await fillLogin(user);
        await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

        expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
    });
});
