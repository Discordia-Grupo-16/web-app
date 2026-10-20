import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@discordia/core';
import { backofficeAuthStorage, TOKEN_KEY, USER_KEY } from '@/shared/session/authStorage';
import { routes } from './router';

vi.mock('@/shared/api', () => ({ authService: { login: vi.fn() }, api: { delete: vi.fn() } }));

const staff = { id: '1', email: 'staff@discordia.dev', name: 'Staff', role: 'staff' };

const renderAt = (path: string) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(
        <AuthProvider storage={backofficeAuthStorage}>
            <RouterProvider router={router} />
        </AuthProvider>,
    );
    return router;
};

describe('router', () => {
    beforeEach(() => localStorage.clear());

    it('sends an unknown route to / and, without a session, ends at /login', async () => {
        const router = renderAt('/does-not-exist');

        expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/login');
    });

    it('sends an unknown route to the home when there is a staff session', async () => {
        localStorage.setItem(TOKEN_KEY, 't');
        localStorage.setItem(USER_KEY, JSON.stringify(staff));

        const router = renderAt('/does-not-exist');

        expect(await screen.findByRole('heading', { name: 'Hola, Staff' })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
    });
});
