import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '@discordia/core';
import { createSessionExpirySignal } from '@discordia/api';
import { backofficeAuthStorage, TOKEN_KEY, USER_KEY } from '@/shared/session/authStorage';
import { StaffRoute } from './StaffRoute';

const staff = { id: '1', email: 'staff@discordia.dev', name: 'Staff', role: 'staff' };

// A staff session that was already open when the page loaded.
const renderOpenSession = () => {
    localStorage.setItem(TOKEN_KEY, 't');
    localStorage.setItem(USER_KEY, JSON.stringify(staff));
    const sessionExpiry = createSessionExpirySignal();
    render(
        <MemoryRouter initialEntries={['/users']}>
            <AuthProvider storage={backofficeAuthStorage} sessionExpiry={sessionExpiry}>
                <Routes>
                    <Route path="/login" element={<p>login page</p>} />
                    <Route element={<StaffRoute />}>
                        <Route path="/users" element={<p>users</p>} />
                    </Route>
                </Routes>
            </AuthProvider>
        </MemoryRouter>,
    );
    return sessionExpiry;
};

describe('expired session', () => {
    beforeEach(() => localStorage.clear());

    it('sends the staff user to /login when the refresh fails, without reloading', async () => {
        const sessionExpiry = renderOpenSession();
        expect(await screen.findByText('users')).toBeInTheDocument();

        act(() => sessionExpiry.notify());

        expect(await screen.findByText('login page')).toBeInTheDocument();
        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
        expect(localStorage.getItem(USER_KEY)).toBeNull();
    });
});
