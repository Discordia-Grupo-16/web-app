import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '@discordia/core';
import { backofficeAuthStorage, TOKEN_KEY, USER_KEY } from '@/shared/session/authStorage';
import { StaffRoute } from './StaffRoute';

const staff = { id: '1', email: 'staff@discordia.dev', name: 'Staff', role: 'staff' };

// The real AuthProvider reads the session from localStorage on mount, as it does after a reload.
const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <AuthProvider storage={backofficeAuthStorage}>
                <Routes>
                    <Route path="/login" element={<p>login page</p>} />
                    <Route element={<StaffRoute />}>
                        <Route path="/" element={<p>panel</p>} />
                        <Route path="/users" element={<p>users</p>} />
                    </Route>
                </Routes>
            </AuthProvider>
        </MemoryRouter>,
    );

const storeSession = (user: object, keys = { token: TOKEN_KEY, user: USER_KEY }) => {
    localStorage.setItem(keys.token, 't');
    localStorage.setItem(keys.user, JSON.stringify(user));
};

describe('StaffRoute', () => {
    beforeEach(() => localStorage.clear());

    it.each(['/', '/users'])('redirects %s to /login when there is no session', async (path) => {
        renderAt(path);

        expect(await screen.findByText('login page')).toBeInTheDocument();
    });

    it('redirects to /login when the stored user is not staff', async () => {
        storeSession({ ...staff, role: 'user' });

        renderAt('/');

        expect(await screen.findByText('login page')).toBeInTheDocument();
    });

    it('renders the child when a staff session is stored (reload keeps you in)', async () => {
        storeSession(staff);

        renderAt('/');

        expect(await screen.findByText('panel')).toBeInTheDocument();
    });

    it('does not accept a staff session stored under the web keys', async () => {
        storeSession(staff, { token: 'discordia_token', user: 'discordia_user' });

        renderAt('/');

        expect(await screen.findByText('login page')).toBeInTheDocument();
    });
});
