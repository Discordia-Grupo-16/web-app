import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
const editAvatar = vi.mocked(userService.editAvatar);

const renderModal = () => render(<UserProfileEditModal isOpen={true} onClose={vi.fn()} />);

beforeAll(() => {
    vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:http://localhost/test-image'),
        revokeObjectURL: vi.fn(),
    });
});

describe('UserProfileEditModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Renderizado y validaciones básicas', () => {
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

        it('muestra errores de validación si el nombre es demasiado largo', async () => {
            renderModal();
            const user = userEvent.setup();

            const nameInput = screen.getByDisplayValue('Milton');
            await user.clear(nameInput);
            await user.type(nameInput, 'a'.repeat(81));

            expect(await screen.findByText('El nombre de usuario no puede superar los 80 caracteres.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
        });

        it('muestra errores de validación si la biografía es demasiado larga', async () => {
            renderModal();
            const user = userEvent.setup();

            const bioInput = screen.getByDisplayValue('Mi bio original');
            await user.clear(bioInput);
            await user.type(bioInput, 'b'.repeat(241));

            expect(await screen.findByText('La biografia no puede superar los 240 caracteres.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
        });

        it('restablece los valores y limpia la previsualización al hacer clic en Restablecer', async () => {
            renderModal();
            const user = userEvent.setup();

            const nameInput = screen.getByDisplayValue('Milton');
            await user.clear(nameInput);
            await user.type(nameInput, 'Nombre Temporal');

            const file = new File(['fake'], 'fake.png', { type: 'image/png' });
            const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
            await user.upload(fileInput, file);

            const resetButton = screen.getByRole('button', { name: /restablecer/i });

            await user.click(resetButton);
            expect(screen.getByDisplayValue('Milton')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /restablecer/i })).not.toBeInTheDocument();
        });
    });

    describe('Flujo de guardado', () => {
        it('envía los cambios de texto a la API y actualiza el contexto', async () => {
            const updatedUser = { ...mockUser, name: 'Milton Editado' };
            editOwnProfile.mockResolvedValue({ data: updatedUser } as never);

            renderModal();
            const user = userEvent.setup();

            const nameInput = screen.getByDisplayValue('Milton');
            await user.clear(nameInput);
            await user.type(nameInput, 'Milton Editado');

            await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

            expect(editOwnProfile).toHaveBeenCalledWith('Milton Editado', 'Mi bio original');
            expect(editAvatar).not.toHaveBeenCalled();

            await waitFor(() => {
                expect(updateUser).toHaveBeenCalledWith(updatedUser);
            });
        });

        it('guarda exitosamente un nuevo avatar', async () => {
            const updatedUser = { ...mockUser, avatarUrl: 'http://cdn/avatar.png' };
            editAvatar.mockResolvedValue({ data: updatedUser } as never);

            renderModal();
            const user = userEvent.setup();

            const file = new File(['hello'], 'hello.png', { type: 'image/png' });
            const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
            await user.upload(fileInput, file);

            await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

            expect(editOwnProfile).not.toHaveBeenCalled();
            expect(editAvatar).toHaveBeenCalledWith(file);

            await waitFor(() => {
                expect(updateUser).toHaveBeenCalledWith(updatedUser);
            });
        });

        it('maneja el guardado parcial: texto exitoso pero avatar fallido', async () => {
            const updatedTextUser = { ...mockUser, name: 'Nombre Nuevo' };

            editOwnProfile.mockResolvedValue({ data: updatedTextUser } as never);
            editAvatar.mockRejectedValue(Object.assign(new Error(), {
                isAxiosError: true,
                response: { data: { detail: 'Archivo muy grande' } }
            }));

            renderModal();
            const user = userEvent.setup();

            const nameInput = screen.getByDisplayValue('Milton');
            await user.clear(nameInput);
            await user.type(nameInput, 'Nombre Nuevo');

            const file = new File(['hello'], 'hello.png', { type: 'image/png' });
            const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
            await user.upload(fileInput, file);

            await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

            expect(editOwnProfile).toHaveBeenCalledWith('Nombre Nuevo', 'Mi bio original');

            await waitFor(() => {
                expect(updateUser).toHaveBeenCalledWith(updatedTextUser);
            });

            expect(editAvatar).toHaveBeenCalledWith(file);

            expect(await screen.findByText('Datos guardados, pero falló la imagen: Archivo muy grande')).toBeInTheDocument();
        });

        it('muestra el mensaje de error cuando la API falla en el primer paso', async () => {
            editOwnProfile.mockRejectedValue(Object.assign(new Error(), {
                isAxiosError: true,
                response: { data: { detail: 'Error interno de prueba' } }
            }));

            renderModal();
            const user = userEvent.setup();

            const nameInput = screen.getByDisplayValue('Milton');
            await user.type(nameInput, ' modificado');

            await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

            expect(await screen.findByText('Error interno de prueba')).toBeInTheDocument();
            expect(updateUser).not.toHaveBeenCalled();
            expect(editAvatar).not.toHaveBeenCalled();
        });

        it('previsualiza y guarda exitosamente un nuevo avatar', async () => {
            const updatedUser = { ...mockUser, avatarUrl: 'blob:http://localhost/test-image' };
            editAvatar.mockResolvedValue({ data: updatedUser } as never);

            renderModal();
            const user = userEvent.setup();

            expect(screen.getByText('M')).toBeInTheDocument();

            const file = new File(['fake-image-content'], 'foto.jpg', { type: 'image/jpeg' });
            const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
            await user.upload(fileInput, file);

            const avatarImage = await screen.findByAltText('Avatar');
            expect(avatarImage).toHaveAttribute('src', 'blob:http://localhost/test-image');
            expect(URL.createObjectURL).toHaveBeenCalledWith(file);

            await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
            expect(editOwnProfile).not.toHaveBeenCalled();

            expect(editAvatar).toHaveBeenCalledWith(file);

            await waitFor(() => {
                expect(updateUser).toHaveBeenCalledWith(updatedUser);
            });
        });

        it('muestra error si la subida del avatar falla', async () => {
            editAvatar.mockRejectedValue(Object.assign(new Error(), {
                isAxiosError: true,
                response: { data: { detail: 'El archivo es demasiado grande (máximo 5MB)' } }
            }));

            renderModal();
            const user = userEvent.setup();

            const file = new File(['fake-huge-image'], 'huge.png', { type: 'image/png' });
            const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
            await user.upload(fileInput, file);

            await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

            expect(await screen.findByText('Avatar: El archivo es demasiado grande (máximo 5MB)')).toBeInTheDocument();

            expect(updateUser).not.toHaveBeenCalled();
        });
    });
});