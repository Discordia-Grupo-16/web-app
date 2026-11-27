import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfileSection } from './UserProfileSection';
import { presenceService, userService } from '@/shared/api';

const signOut = vi.fn();
const updateUser = vi.fn();
const mockUser = { id: '1', name: 'Milton', avatarUrl: null };

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: mockUser, signOut, updateUser }),
    // Sin tiempo real, como en este test: no llega ningún aviso y el poll vuelve a los 5 s.
    useServerEvents: vi.fn(),
    usePollIntervalMs: () => 5000,
}));

vi.mock('@/shared/api', () => ({
    userService: {
        getOwnProfile: vi.fn(),
    },
    presenceService: {
        getServerPresence: vi.fn(),
        setManual: vi.fn(),
    },
}));

const getOwnProfile = vi.mocked(userService.getOwnProfile);

describe('UserProfileSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.mocked(presenceService.setManual).mockResolvedValue(undefined);
        getOwnProfile.mockResolvedValue({ data: mockUser } as never);
    });

    it('obtiene el perfil al montar el componente', async () => {
        render(<UserProfileSection />);

        await waitFor(() => {
            expect(getOwnProfile).toHaveBeenCalled();
            expect(updateUser).toHaveBeenCalledWith(mockUser);
        });

        expect(screen.getByText('Milton')).toBeInTheDocument();
        expect(screen.getByText('En línea')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'En línea' })).toBeInTheDocument();
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

    it('fija "No molestar" desde el perfil y lo recuerda al volver a montar', async () => {
        const { unmount } = render(<UserProfileSection />);
        const user = userEvent.setup();

        await user.click(screen.getByText('Milton'));
        await user.click(screen.getByRole('radio', { name: 'No molestar' }));

        expect(presenceService.setManual).toHaveBeenCalledWith('dnd');
        await waitFor(() => expect(screen.getByRole('radio', { name: 'No molestar' })).toBeChecked());

        unmount();
        render(<UserProfileSection />);
        expect(screen.getByRole('img', { name: 'No molestar' })).toBeInTheDocument();
    });

    it('muestra "Invisible" y vuelve al automático con "En línea"', async () => {
        render(<UserProfileSection />);
        const user = userEvent.setup();
        await user.click(screen.getByText('Milton'));

        await user.click(screen.getByRole('radio', { name: 'Invisible' }));
        expect(await screen.findByText('Invisible', { selector: 'p' })).toBeInTheDocument();

        await user.click(screen.getByRole('radio', { name: 'En línea' }));
        expect(presenceService.setManual).toHaveBeenLastCalledWith(null);
        await waitFor(() => expect(screen.getByRole('radio', { name: 'En línea' })).toBeChecked());
    });

    it('avisa si no se pudo cambiar el estado y deja el anterior', async () => {
        vi.mocked(presenceService.setManual).mockRejectedValue(new Error('chat down'));
        render(<UserProfileSection />);
        const user = userEvent.setup();
        await user.click(screen.getByText('Milton'));

        await user.click(screen.getByRole('radio', { name: 'No molestar' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cambiar tu estado');
        expect(screen.getByRole('radio', { name: 'En línea' })).toBeChecked();
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