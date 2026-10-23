import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@discordia/api';
import { ProfilePopup } from './ProfilePopup';

const signOut = vi.fn();

// The popup now reads signOut from the auth context, which these tests do not provide.
vi.mock('@discordia/core', () => ({ useAuth: () => ({ signOut }) }));

describe('ProfilePopup', () => {
    const mockUser: User = {
        id: '1',
        email: 'milton@example.com',
        role: 'user',
        name: 'Milton',
        bio: 'Desarrollador de software',
        createdAt: '2023-10-01T12:00:00Z',
    };

    it('renderiza la información del usuario correctamente', () => {
        render(
            <ProfilePopup
                user={mockUser}
                onClose={vi.fn()}
                onEditProfile={vi.fn()}
            />
        );

        expect(screen.getByText('Milton')).toBeInTheDocument();
        expect(screen.getByText('Sobre mí')).toBeInTheDocument();
        expect(screen.getByText('Desarrollador de software')).toBeInTheDocument();
        expect(screen.getByText('Miembro desde')).toBeInTheDocument();

        expect(screen.getByText(/1 de octubre de 2023/i)).toBeInTheDocument();
    });

    it('llama a onClose y onEditProfile cuando se hace clic en "Editar perfil"', async () => {
        const onClose = vi.fn();
        const onEditProfile = vi.fn();
        const user = userEvent.setup();

        render(
            <ProfilePopup
                user={mockUser}
                onClose={onClose}
                onEditProfile={onEditProfile}
            />
        );

        const editButton = screen.getByRole('button', { name: /editar perfil/i });
        await user.click(editButton);

        expect(onClose).toHaveBeenCalledOnce();
        expect(onEditProfile).toHaveBeenCalledOnce();
    });

    it('muestra "Cerrar sesión" y cierra la sesión al hacer clic', async () => {
        render(<ProfilePopup user={mockUser} onClose={vi.fn()} onEditProfile={vi.fn()} />);

        await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));

        expect(signOut).toHaveBeenCalledOnce();
    });
});