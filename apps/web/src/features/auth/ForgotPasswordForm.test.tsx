import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { authService } from '@/shared/api';

vi.mock('@/shared/api', () => ({ authService: { requestPasswordReset: vi.fn() } }));

const requestPasswordReset = vi.mocked(authService.requestPasswordReset);

const submit = async (email: string) => {
    const user = userEvent.setup();
    if (email) await user.type(screen.getByLabelText('Correo electrónico'), email);
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
};

describe('ForgotPasswordForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not call the API when the email is invalid', async () => {
        render(<ForgotPasswordForm onBack={vi.fn()} />);

        await submit('no-es-un-correo');

        expect(await screen.findByText('El correo electrónico no tiene un formato válido.')).toBeInTheDocument();
        expect(requestPasswordReset).not.toHaveBeenCalled();
    });

    it('sends the trimmed email and shows the neutral confirmation', async () => {
        requestPasswordReset.mockResolvedValue();
        render(<ForgotPasswordForm onBack={vi.fn()} />);

        await submit('  milton@correo.com ');

        expect(requestPasswordReset).toHaveBeenCalledWith('milton@correo.com');
        expect(
            await screen.findByText('Si el correo está registrado, te llega un link para cambiar la contraseña.'),
        ).toBeInTheDocument();
    });

    it('shows the too-many-requests message on a 429', async () => {
        requestPasswordReset.mockRejectedValue({ isAxiosError: true, response: { status: 429, data: {} } });
        render(<ForgotPasswordForm onBack={vi.fn()} />);

        await submit('milton@correo.com');

        expect(
            await screen.findByText('Hiciste muchos pedidos. Probá de nuevo en unos minutos.'),
        ).toBeInTheDocument();
    });

    it('goes back to the login', async () => {
        const onBack = vi.fn();
        render(<ForgotPasswordForm onBack={onBack} />);

        await userEvent.setup().click(screen.getByRole('button', { name: 'Volver a iniciar sesión' }));

        expect(onBack).toHaveBeenCalled();
    });
});
