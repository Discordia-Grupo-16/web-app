import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';
import { authService } from '@/shared/api';

const signIn = vi.fn();
const navigate = vi.fn();

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ signIn }),
}));
vi.mock('@/shared/api', () => ({ authService: { login: vi.fn() } }));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));

const login = vi.mocked(authService.login);

const renderForm = () =>
    render(
        <MemoryRouter>
            <LoginForm onSwitch={vi.fn()} />
        </MemoryRouter>,
    );

// The labels have no htmlFor, so getByLabelText cannot reach the inputs: use the placeholder.
const fillAndSubmit = async (email: string, password: string) => {
    const user = userEvent.setup();
    if (email) await user.type(screen.getByPlaceholderText('tu@correo.com'), email);
    if (password) await user.type(screen.getByPlaceholderText('••••••••'), password);
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
};

describe('LoginForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows a validation error and does not call the API when the email is empty', async () => {
        renderForm();

        await fillAndSubmit('', 'secret123');

        expect(await screen.findByText('Por favor ingresa tu correo electrónico.')).toBeInTheDocument();
        expect(login).not.toHaveBeenCalled();
    });

    it('signs in with the trimmed email and navigates home on success', async () => {
        login.mockResolvedValue({ token: 't', refreshToken: 'r', user: { id: '1', name: 'Milton' } } as never);
        renderForm();

        await fillAndSubmit('milton@correo.com', 'secret123');

        expect(login).toHaveBeenCalledWith({ email: 'milton@correo.com', password: 'secret123' });
        expect(signIn).toHaveBeenCalledWith('t', { id: '1', name: 'Milton' }, 'r');
        expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    });

    it('shows the error message when the login fails', async () => {
        login.mockRejectedValue(new Error('Credenciales incorrectas'));
        renderForm();

        await fillAndSubmit('milton@correo.com', 'wrong-password');

        expect(await screen.findByText('Credenciales incorrectas')).toBeInTheDocument();
        expect(signIn).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });
});
