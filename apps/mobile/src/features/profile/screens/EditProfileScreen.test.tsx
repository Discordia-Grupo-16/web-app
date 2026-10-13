import { render, screen, userEvent } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import type { User } from '@discordia/api';
import { userService } from '@/shared/api';
import { EditProfileScreen } from './EditProfileScreen';

const mockBack = jest.fn();
const mockUpdateUser = jest.fn();

let mockUser: User | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  Stack: { Screen: () => null },
}));

jest.mock('@discordia/core', () => ({
  useAuth: () => ({
    user: mockUser,
    updateUser: mockUpdateUser,
  }),
}));

jest.mock('@/shared/api', () => ({
  userService: {
    editOwnProfile: jest.fn(),
    editAvatar: jest.fn(),
  },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

const baseUser: User = {
  id: 'u1',
  email: 'test@example.com',
  name: 'Juan Perez',
  role: 'user',
  avatarUrl: null,
  bio: 'Hola mundo!',
  createdAt: '2026-01-15T00:00:00Z',
};

const renderScreen = async (user: User | null = baseUser) => {
  mockUser = user;
  const actor = userEvent.setup();
  await render(<EditProfileScreen />);
  return { user: actor };
};

const nameInput = () => screen.getByPlaceholderText('Tu nombre de usuario');
const bioInput = () => screen.getByPlaceholderText('¡Cuéntanos algo sobre ti!');

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sección de Renderizado Inicial', () => {
    it('no renderiza nada si no hay usuario autenticado', async () => {
      await renderScreen(null);
      expect(screen.queryByPlaceholderText('Tu nombre de usuario')).not.toBeOnTheScreen();
    });

    it('muestra los datos actuales del perfil del usuario', async () => {
      await renderScreen();

      expect(nameInput()).toHaveDisplayValue('Juan Perez');
      expect(bioInput()).toHaveDisplayValue('Hola mundo!');
      expect(screen.getByText('J')).toBeOnTheScreen();
      expect(screen.getByText(/Miembro desde:/)).toBeOnTheScreen();
      expect(screen.queryByText('Guardar cambios')).not.toBeOnTheScreen();
      expect(screen.queryByText('Restablecer')).not.toBeOnTheScreen();
    });
  });

  describe('Sección de Nombre de Usuario', () => {
    it('muestra error y deshabilita guardar cuando el nombre está vacío', async () => {
      const { user } = await renderScreen();

      await user.clear(nameInput());

      expect(screen.getByText('El nombre de usuario no puede estar vacío.')).toBeOnTheScreen();
      expect(screen.getByText('Guardar cambios')).toBeDisabled();
    });

    it('muestra error y deshabilita guardar cuando supera los 80 caracteres', async () => {
      const { user } = await renderScreen();

      await user.clear(nameInput());
      await user.paste(nameInput(), 'a'.repeat(81));

      expect(screen.getByText('El nombre de usuario no puede superar los 80 caracteres.')).toBeOnTheScreen();
      expect(screen.getByText('Guardar cambios')).toBeDisabled();
    });
  });

  describe('Sección de Biografía', () => {
    it('muestra error y deshabilita guardar cuando supera los 240 caracteres', async () => {
      const { user } = await renderScreen();

      await user.clear(bioInput());
      await user.paste(bioInput(), 'b'.repeat(241));

      expect(screen.getByText('La biografía no puede superar los 240 caracteres.')).toBeOnTheScreen();
      expect(screen.getByText('Guardar cambios')).toBeDisabled();
    });
  });

  describe('Sección de Avatar', () => {
    it('permite seleccionar un nuevo avatar de la galería', async () => {
      jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///data/new-avatar.png', width: 200, height: 200 }],
      });

      const { user } = await renderScreen();

      await user.press(screen.getByText('Editar'));

      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      expect(screen.getByText('Guardar cambios')).toBeOnTheScreen();
    });

    it('no activa cambios si el usuario cancela la selección de imagen', async () => {
      jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
        canceled: true,
        assets: null,
      });

      const { user } = await renderScreen();

      await user.press(screen.getByText('Editar'));

      expect(screen.queryByText('Guardar cambios')).not.toBeOnTheScreen();
    });
  });

  describe('Sección de Restablecer', () => {
    it('restaura los valores originales y oculta los botones de acción', async () => {
      const { user } = await renderScreen();

      await user.clear(nameInput());
      await user.paste(nameInput(), 'Nombre Temporal');
      expect(screen.getByText('Guardar cambios')).toBeOnTheScreen();

      await user.press(screen.getByText('Restablecer'));

      expect(nameInput()).toHaveDisplayValue('Juan Perez');
      expect(screen.queryByText('Guardar cambios')).not.toBeOnTheScreen();
      expect(screen.queryByText('Restablecer')).not.toBeOnTheScreen();
    });
  });

  describe('Sección de Guardar Cambios', () => {
    it('guarda los cambios de nombre y biografía exitosamente', async () => {
      const updatedUser: User = { ...baseUser, name: 'Juan Carlos', bio: 'Nueva biografía' };
      jest.mocked(userService.editOwnProfile).mockResolvedValue({ data: updatedUser } as never);

      const { user } = await renderScreen();

      await user.clear(nameInput());
      await user.paste(nameInput(), 'Juan Carlos');
      await user.clear(bioInput());
      await user.paste(bioInput(), 'Nueva biografía');

      await user.press(screen.getByText('Guardar cambios'));

      expect(userService.editOwnProfile).toHaveBeenCalledWith('Juan Carlos', 'Nueva biografía');
      expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);
      expect(mockBack).toHaveBeenCalled();
    });

    it('guarda únicamente el nuevo avatar exitosamente', async () => {
      const updatedUser: User = { ...baseUser, avatarUrl: 'http://cdn/avatar.jpg' };
      jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///path/profile.jpg', width: 200, height: 200 }],
      });
      jest.mocked(userService.editAvatar).mockResolvedValue({ data: updatedUser } as never);

      const { user } = await renderScreen();

      await user.press(screen.getByText('Editar'));
      await user.press(screen.getByText('Guardar cambios'));

      expect(userService.editAvatar).toHaveBeenCalledWith({
        uri: 'file:///path/profile.jpg',
        name: 'profile.jpg',
        type: 'image/jpeg',
      });
      expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);
      expect(mockBack).toHaveBeenCalled();
    });

    it('muestra el mensaje de error de la API cuando la actualización falla', async () => {
      jest.mocked(userService.editOwnProfile).mockRejectedValue({
        isAxiosError: true,
        response: { data: { detail: 'El nombre ya está en uso' } },
      });

      const { user } = await renderScreen();

      await user.paste(nameInput(), ' Modificado');
      await user.press(screen.getByText('Guardar cambios'));

      expect(screen.getByText('El nombre ya está en uso')).toBeOnTheScreen();
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('muestra el mensaje de error genérico cuando ocurre un error inesperado', async () => {
      jest.mocked(userService.editOwnProfile).mockRejectedValue(new Error('Network failure'));

      const { user } = await renderScreen();

      await user.paste(nameInput(), ' Modificado');
      await user.press(screen.getByText('Guardar cambios'));

      expect(
        screen.getByText('Hubo un error al actualizar tu perfil. Intenta de nuevo más tarde.'),
      ).toBeOnTheScreen();
      expect(mockBack).not.toHaveBeenCalled();
    });
  });
});
