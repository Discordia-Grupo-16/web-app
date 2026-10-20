import { render, screen } from '@testing-library/react-native';
import { RegisterScreen } from './RegisterScreen';

jest.mock('@/shared/api', () => ({ authService: { register: jest.fn() } }));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
  useAuth: () => ({ signIn: jest.fn() }),
}));

describe('RegisterScreen', () => {
  it('asks for email, then name, then password, with the same labels as the web', async () => {
    await render(<RegisterScreen />);
    const labels = ['Correo electrónico', 'Nombre completo o apodo', 'Contraseña'].map((label) =>
      screen.getByText(label),
    );
    const placeholders = ['tu@correo.com', 'ej. Jane Doe', '••••••••'].map((placeholder) =>
      screen.getByPlaceholderText(placeholder),
    );
    expect(labels).toHaveLength(3);
    expect(placeholders).toHaveLength(3);

    const order = screen.toJSON();
    const text = JSON.stringify(order);
    const positions = ['Correo electrónico', 'Nombre completo o apodo', 'Contraseña'].map((l) => text.indexOf(l));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
