import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfileSection } from './UserProfileSection';
import { userService } from '@/shared/api';

const signOut = vi.fn();
const updateUser = vi.fn();
const mockUser = { id: '1', name: 'Milton', avatarUrl: null };

vi.mock('@discordia/core', () => ({
    useAuth: () => ({ user: mockUser, signOut, updateUser }),
}));

vi.mock('@/shared/api', () => ({
    userService: {
        getOwnProfile: vi.fn(),
    },
}));

const getOwnProfile = vi.mocked(userService.getOwnProfile);

describe('UserProfileSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getOwnProfile.mockResolvedValue({ data: mockUser } as never);
    });

    it('obtiene el perfil al montar el componente', async () => {
        render(<UserProfileSection />);

        await waitFor(() => {
            expect(getOwnProfile).toHaveBeenCalled();
            expect(updateUser).toHaveBeenCalledWith(mockUser);
        });

        expect(screen.getByText('Milton')).toBeInTheDocument();
        expect(screen.getByText('● En línea')).toBeInTheDocument();
    });

    it('abre el popup del perfil al hacer clic en la sección y permite cerrar sesión', async () => {
        render(<UserProfileSection />);
        const user = userEvent.setup();

        const logoutButton = screen.getByTitle('Cerrar sesión');
        await user.click(logoutButton);
        expect(signOut).toHaveBeenCalledOnce();

        const container = screen.getByText('Milton');
        await user.click(container);

        expect(await screen.findByRole('button', { name: /editar perfil/i })).toBeInTheDocument();
    });

    it('maneja silenciosamente los errores al obtener el perfil (catch)', async () => {
        // Simulamos un error de red
        getOwnProfile.mockRejectedValue(new Error('Network Error') as never);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(<UserProfileSection />);

        await waitFor(() => {
            expect(getOwnProfile).toHaveBeenCalled();
        });

        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(updateUser).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});