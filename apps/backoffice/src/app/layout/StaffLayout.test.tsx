import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffLayout } from './StaffLayout';

const signOut = vi.fn().mockResolvedValue(undefined);
const navigate = vi.fn();

vi.mock('@discordia/core', () => ({
    useAuth: () => ({
        user: { id: '1', name: 'Ana', email: 'ana@discordia.dev', role: 'staff' },
        signOut,
    }),
}));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));

const renderLayout = () =>
    render(
        <MemoryRouter>
            <StaffLayout />
        </MemoryRouter>,
    );

describe('StaffLayout', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows the name and email of the staff member', () => {
        renderLayout();

        expect(screen.getByText('Ana')).toBeInTheDocument();
        expect(screen.getByText('ana@discordia.dev')).toBeInTheDocument();
    });

    it('links Usuarios to /users', () => {
        renderLayout();

        expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('href', '/users');
    });

    it('signs out and goes back to the login', async () => {
        renderLayout();

        await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

        expect(signOut).toHaveBeenCalledOnce();
        expect(navigate).toHaveBeenCalledWith('/login');
    });
});
