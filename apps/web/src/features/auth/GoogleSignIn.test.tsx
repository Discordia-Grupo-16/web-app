import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleSignIn } from './GoogleSignIn';
import { authService } from '@/shared/api';

const signIn = vi.fn();
const beginMfa = vi.fn();
const navigate = vi.fn();

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ signIn, beginMfa }),
}));
vi.mock('@/shared/api', () => ({ authService: { loginWithGoogle: vi.fn() } }));
vi.mock('@/shared/config/env', () => ({ GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com' }));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));
// The real button is an iframe served by Google: stand in for it with two plain buttons.
vi.mock('@react-oauth/google', () => ({
    GoogleLogin: ({ onSuccess, onError }: { onSuccess: (r: { credential?: string }) => void; onError: () => void }) => (
        <>
            <button onClick={() => onSuccess({ credential: 'google-id-token' })}>Continuar con Google</button>
            <button onClick={() => onSuccess({})}>Sin credencial</button>
            <button onClick={onError}>Falla de Google</button>
        </>
    ),
}));

const loginWithGoogle = vi.mocked(authService.loginWithGoogle);
const onError = vi.fn();

const renderButton = () =>
    render(
        <MemoryRouter>
            <GoogleSignIn onError={onError} />
        </MemoryRouter>,
    );

describe('GoogleSignIn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('signs in with the session the backend returns and navigates home', async () => {
        loginWithGoogle.mockResolvedValue({ token: 't', refreshToken: 'r', user: { id: '1', name: 'Ana' } } as never);
        renderButton();

        await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));

        expect(loginWithGoogle).toHaveBeenCalledWith('google-id-token');
        expect(signIn).toHaveBeenCalledWith('t', { id: '1', name: 'Ana' }, 'r');
        expect(navigate).toHaveBeenCalledWith('/', { replace: true });
        expect(onError).not.toHaveBeenCalled();
    });

    it('starts the 2FA second step instead of signing in when the account has 2FA', async () => {
        loginWithGoogle.mockResolvedValue({ mfaRequired: true, mfaToken: 'mfa-1' });
        renderButton();

        await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));

        expect(beginMfa).toHaveBeenCalledWith('mfa-1');
        expect(signIn).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('shows the server message when Google is unavailable (503, CA3) and does not sign in', async () => {
        loginWithGoogle.mockRejectedValue(
            Object.assign(new Error('503'), {
                isAxiosError: true,
                response: { status: 503, data: { detail: 'No pudimos conectar con Google. Ingresá con tu correo y contraseña' } },
            }),
        );
        renderButton();

        await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));

        expect(onError).toHaveBeenCalledWith('No pudimos conectar con Google. Ingresá con tu correo y contraseña');
        expect(signIn).not.toHaveBeenCalled();
    });

    it('falls back to the Google-unavailable text when the request fails without an answer', async () => {
        loginWithGoogle.mockRejectedValue({ isAxiosError: true });
        renderButton();

        await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));

        expect(onError).toHaveBeenCalledWith('No pudimos conectar con Google. Ingresá con tu correo y contraseña.');
    });

    it('reports an error when Google hands back no credential or fails by itself', async () => {
        renderButton();

        await userEvent.click(screen.getByRole('button', { name: 'Sin credencial' }));
        expect(onError).toHaveBeenLastCalledWith('No pudimos validar tu cuenta de Google.');

        await userEvent.click(screen.getByRole('button', { name: 'Falla de Google' }));
        expect(onError).toHaveBeenLastCalledWith('No pudimos conectar con Google. Ingresá con tu correo y contraseña.');
        expect(loginWithGoogle).not.toHaveBeenCalled();
    });
});
