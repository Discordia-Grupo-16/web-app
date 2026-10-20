import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@discordia/core';
import { backofficeAuthStorage, TOKEN_KEY, USER_KEY } from '@/shared/session/authStorage';
import { LoginPage } from './LoginPage';

vi.mock('@/shared/api', () => ({ authService: { login: vi.fn() } }));

const staff = { id: '1', email: 'staff@discordia.dev', name: 'Staff', role: 'staff' };

const renderLogin = () =>
    render(
        <MemoryRouter initialEntries={['/login']}>
            <AuthProvider storage={backofficeAuthStorage}>
                <Routes>
                    <Route path="/" element={<p>home</p>} />
                    <Route path="/login" element={<LoginPage />} />
                </Routes>
            </AuthProvider>
        </MemoryRouter>,
    );

describe('LoginPage', () => {
    beforeEach(() => localStorage.clear());

    it('shows the login form when there is no session', async () => {
        renderLogin();

        expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    });

    it('redirects to the home when a staff session exists', async () => {
        localStorage.setItem(TOKEN_KEY, 't');
        localStorage.setItem(USER_KEY, JSON.stringify(staff));

        renderLogin();

        expect(await screen.findByText('home')).toBeInTheDocument();
    });
});
