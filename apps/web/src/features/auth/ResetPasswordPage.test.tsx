import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordPage } from './ResetPasswordPage';
import { authService } from '@/shared/api';
import { consumeLoginNotice } from '@/shared/session/loginNotice';

const navigate = vi.fn();

vi.mock('@/shared/api', () => ({
    authService: { checkPasswordReset: vi.fn(), confirmPasswordReset: vi.fn() },
}));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));

const check = vi.mocked(authService.checkPasswordReset);
const confirm = vi.mocked(authService.confirmPasswordReset);

const renderPage = (hash = '#token=abc123') => {
    window.history.replaceState(null, '', `/reset-password${hash}`);
    return render(
        <MemoryRouter>
            <ResetPasswordPage />
        </MemoryRouter>,
    );
};

const badLink = { isAxiosError: true, response: { status: 400, data: {} } };

describe('ResetPasswordPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        consumeLoginNotice();
    });

    it('checks the token from the fragment and removes it from the address bar', async () => {
        check.mockResolvedValue();
        renderPage();

        expect(await screen.findByLabelText('Contraseña nueva')).toBeInTheDocument();
        expect(check).toHaveBeenCalledWith('abc123');
        expect(window.location.hash).toBe('');
        expect(window.location.pathname).toBe('/reset-password');
    });

    it('shows the invalid-link state and offers a new request when the token does not work', async () => {
        check.mockRejectedValue(badLink);
        renderPage();

        expect(await screen.findByText('El enlace no es válido o ya venció.')).toBeInTheDocument();
        await userEvent.setup().click(screen.getByRole('button', { name: 'Pedir uno nuevo' }));
        expect(navigate).toHaveBeenCalledWith('/home', { replace: true, state: { forgotPassword: true } });
    });

    it('treats a missing token as an invalid link without calling the API', async () => {
        renderPage('');

        expect(await screen.findByText('El enlace no es válido o ya venció.')).toBeInTheDocument();
        expect(check).not.toHaveBeenCalled();
    });

    it('validates the new password before calling the API', async () => {
        check.mockResolvedValue();
        renderPage();
        const user = userEvent.setup();

        await user.type(await screen.findByLabelText('Contraseña nueva'), 'corta');
        await user.type(screen.getByLabelText('Repetí la contraseña'), 'corta');
        await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
        expect(await screen.findByText(/al menos 8 caracteres/)).toBeInTheDocument();

        await user.clear(screen.getByLabelText('Contraseña nueva'));
        await user.type(screen.getByLabelText('Contraseña nueva'), 'Nueva1234');
        await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
        expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();

        expect(confirm).not.toHaveBeenCalled();
    });

    it('changes the password and sends the user to the login with a notice', async () => {
        check.mockResolvedValue();
        confirm.mockResolvedValue();
        renderPage();
        const user = userEvent.setup();

        await user.type(await screen.findByLabelText('Contraseña nueva'), 'Nueva1234');
        await user.type(screen.getByLabelText('Repetí la contraseña'), 'Nueva1234');
        await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/home', { replace: true }));
        expect(confirm).toHaveBeenCalledWith('abc123', 'Nueva1234');
        expect(consumeLoginNotice()).toBe('Actualizamos tu contraseña. Iniciá sesión.');
    });

    it('falls back to the invalid-link state when the token expires while typing', async () => {
        check.mockResolvedValue();
        confirm.mockRejectedValue(badLink);
        renderPage();
        const user = userEvent.setup();

        await user.type(await screen.findByLabelText('Contraseña nueva'), 'Nueva1234');
        await user.type(screen.getByLabelText('Repetí la contraseña'), 'Nueva1234');
        await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

        expect(await screen.findByText('El enlace no es válido o ya venció.')).toBeInTheDocument();
    });
});
