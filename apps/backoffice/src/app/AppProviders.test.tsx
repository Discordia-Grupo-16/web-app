import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOKEN_KEY, USER_KEY } from '@/shared/session/authStorage';
import { sessionExpiry } from '@/shared/session/sessionExpiry';
import { StaffRoute } from '@/features/auth/StaffRoute';
import { AppProviders } from './AppProviders';

const { logout } = vi.hoisted(() => ({ logout: vi.fn<() => Promise<void>>() }));

vi.mock('@/shared/api', () => ({ authService: { logout } }));

const staff = { id: '1', email: 'staff@discordia.dev', name: 'Staff', role: 'staff' };

describe('AppProviders', () => {
    beforeEach(() => {
        localStorage.clear();
        logout.mockReset();
    });

    // Uses the real `sessionExpiry` singleton that `shared/api` notifies: the wiring `main.tsx` relies on.
    it('drops the session and sends the staff user to /login when the shared signal fires', async () => {
        localStorage.setItem(TOKEN_KEY, 't');
        localStorage.setItem(USER_KEY, JSON.stringify(staff));
        render(
            <MemoryRouter initialEntries={['/users']}>
                <AppProviders>
                    <Routes>
                        <Route path="/login" element={<p>login page</p>} />
                        <Route element={<StaffRoute />}>
                            <Route path="/users" element={<p>users</p>} />
                        </Route>
                    </Routes>
                </AppProviders>
            </MemoryRouter>,
        );
        expect(await screen.findByText('users')).toBeInTheDocument();

        act(() => sessionExpiry.notify());

        expect(await screen.findByText('login page')).toBeInTheDocument();
        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
        expect(logout).not.toHaveBeenCalled();
    });
});
