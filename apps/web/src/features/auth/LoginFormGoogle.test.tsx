import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ signIn: vi.fn(), beginMfa: vi.fn(), pendingMfa: false }),
}));
vi.mock('@/shared/api', () => ({ authService: { login: vi.fn() } }));
// Stands in for the real button: what matters here is what the form does when Google starts.
vi.mock('./GoogleSignIn', () => ({
    GoogleSignIn: ({ onStart }: { onStart: () => void }) => <button onClick={onStart}>Continuar con Google</button>,
}));

describe('LoginForm with Google', () => {
    it('drops the previous notice when a Google login starts', async () => {
        const onSubmitAttempt = vi.fn();
        render(
            <MemoryRouter>
                <LoginForm onSwitch={vi.fn()} onSubmitAttempt={onSubmitAttempt} />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));

        expect(onSubmitAttempt).toHaveBeenCalledOnce();
    });
});
