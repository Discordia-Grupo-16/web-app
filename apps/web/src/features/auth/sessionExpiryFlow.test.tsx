import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider, useAuth } from '@discordia/core';
import { createSessionExpirySignal, type AuthStorageStrategy } from '@discordia/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginRegisterPage } from './LoginRegisterPage';
import { ProtectedRoute } from './ProtectedRoute';
import { authService } from '@/shared/api';

vi.mock('@/shared/api', () => ({ authService: { login: vi.fn(), register: vi.fn() } }));

const login = vi.mocked(authService.login);
const felipe = { id: '1', name: 'Felipe' };

// A session that was already open when the page loaded.
const openSessionStorage = (): AuthStorageStrategy => {
    let token: string | null = 'access';
    let user: unknown = felipe;
    return {
        getToken: async () => token,
        setToken: async (value) => { token = value; },
        getUser: async <T,>() => user as T | null,
        setUser: async (value) => { user = value; },
        clearSession: async () => { token = null; user = null; },
    };
};

const SignOutButton = () => {
    const { signOut } = useAuth();
    return <button onClick={() => void signOut()}>Cerrar sesión</button>;
};

const renderApp = (initialEntry: string) => {
    const sessionExpiry = createSessionExpirySignal();
    const router = createMemoryRouter(
        [
            { path: '/home', element: <LoginRegisterPage /> },
            {
                element: <ProtectedRoute />,
                children: [
                    { index: true, element: <p>Pantalla de inicio</p> },
                    {
                        path: 'servers/:serverId/channels/:channelId',
                        element: (
                            <>
                                <p>Canal abierto</p>
                                <SignOutButton />
                            </>
                        ),
                    },
                ],
            },
        ],
        { initialEntries: [initialEntry] },
    );
    render(
        <AuthProvider storage={openSessionStorage()} sessionExpiry={sessionExpiry}>
            <RouterProvider router={router} />
        </AuthProvider>,
    );
    return { router, sessionExpiry };
};

const logIn = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(await screen.findByPlaceholderText('tu@correo.com'), 'felipe@correo.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'Secret123');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
};

describe('expired session', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        login.mockResolvedValue({ token: 't', refreshToken: 'r', user: felipe } as never);
    });

    it('sends the user to the login and brings them back to the screen they were on', async () => {
        const { router, sessionExpiry } = renderApp('/servers/s1/channels/c1');
        expect(await screen.findByText('Canal abierto')).toBeInTheDocument();

        act(() => sessionExpiry.notify());

        expect(await screen.findByPlaceholderText('tu@correo.com')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/home');
        expect(router.state.location.search).toBe('?returnTo=%2Fservers%2Fs1%2Fchannels%2Fc1');

        await logIn(userEvent.setup());

        expect(await screen.findByText('Canal abierto')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/servers/s1/channels/c1');
    });

    it('does not keep a destination when the user signs out on purpose', async () => {
        const { router } = renderApp('/servers/s1/channels/c1');
        const user = userEvent.setup();

        await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

        expect(await screen.findByPlaceholderText('tu@correo.com')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/home');
        expect(router.state.location.search).toBe('');

        await logIn(user);

        expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
    });
});
