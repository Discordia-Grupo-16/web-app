import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GoogleSignIn } from './GoogleSignIn';

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ signIn: vi.fn(), beginMfa: vi.fn() }),
}));
vi.mock('@/shared/api', () => ({ authService: { loginWithGoogle: vi.fn() } }));
vi.mock('@/shared/config/env', () => ({ GOOGLE_CLIENT_ID: '' }));
vi.mock('@react-oauth/google', () => ({ GoogleLogin: () => <button>Continuar con Google</button> }));

describe('GoogleSignIn without a client ID', () => {
    it('renders neither the button nor its divider, so the email form is all there is', () => {
        const { container } = render(
            <MemoryRouter>
                <GoogleSignIn onError={vi.fn()} />
            </MemoryRouter>,
        );

        expect(screen.queryByRole('button', { name: 'Continuar con Google' })).not.toBeInTheDocument();
        expect(container).toBeEmptyDOMElement();
    });
});
