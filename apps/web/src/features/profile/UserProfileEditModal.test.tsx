import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfileEditModal } from './UserProfileEditModal';
import { userService } from '@/shared/api';

const updateUser = vi.fn();
const mockUser = { id: '1', name: 'Milton', email: 'milton@correo.com', bio: 'Mi bio original' };

vi.mock('@discordia/core', () => ({
    useAuth: () => ({ user: mockUser, updateUser }),
}));

vi.mock('@/shared/api', () => ({
    userService: {
        editOwnProfile: vi.fn(),
        editAvatar: vi.fn(),
    },
}));

const editOwnProfile = vi.mocked(userService.editOwnProfile);

const renderModal = () => render(<UserProfileEditModal isOpen={true} onClose={vi.fn()} />);

describe('UserProfileEditModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('no renderiza nada si isOpen es false', () => {
        const { container } = render(<UserProfileEditModal isOpen={false} onClose={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('muestra errores de validación y bloquea el envío si el nombre está vacío', async () => {
        renderModal();
        const user = userEvent.setup();

        const nameInput = screen.getByDisplayValue('Milton');
        await user.clear(nameInput);

        expect(await screen.findByText('El nombre de usuario no puede estar vacío.')).toBeInTheDocument();
        const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
        expect(saveButton).toBeDisabled();
        expect(editOwnProfile).not.toHaveBeenCalled();
    });

    it('envía los cambios a la API y actualiza el usuario si todo es válido', async () => {
        editOwnProfile.mockResolvedValue({ data: { ...mockUser, name: 'Milton Editado' } } as never);
        renderModal();
        const user = userEvent.setup();

        const nameInput = screen.getByDisplayValue('Milton');
        await user.clear(nameInput);
        await user.type(nameInput, 'Milton Editado');

        const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
        await user.click(saveButton);

        expect(editOwnProfile).toHaveBeenCalledWith('Milton Editado', 'Mi bio original');

        await waitFor(() => {
            expect(updateUser).toHaveBeenCalledWith({ ...mockUser, name: 'Milton Editado' });
        });
    });

    it('muestra el mensaje de error cuando la API falla', async () => {
        editOwnProfile.mockRejectedValue(Object.assign(new Error(), {
            isAxiosError: true,
            response: { data: { detail: 'Error interno de prueba' } }
        }));

        renderModal();
        const user = userEvent.setup();

        const nameInput = screen.getByDisplayValue('Milton');
        await user.type(nameInput, ' modificado');

        const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
        await user.click(saveButton);

        expect(await screen.findByText('Error interno de prueba')).toBeInTheDocument();
        expect(updateUser).not.toHaveBeenCalled();
    });
});