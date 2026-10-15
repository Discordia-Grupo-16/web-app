import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginRegisterPage } from './LoginRegisterPage';
import { setLoginNotice } from '@/shared/session/loginNotice';

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ signIn: vi.fn() }),
}));
vi.mock('@/shared/api', () => ({ authService: { login: vi.fn() } }));

const renderPage = () =>
    render(
        <MemoryRouter>
            <LoginRegisterPage />
        </MemoryRouter>,
    );

afterEach(() => {
    sessionStorage.clear();
});

describe('LoginRegisterPage', () => {
    it('shows a stored login notice once, with role="alert", and not after remounting', () => {
        setLoginNotice('Tu cuenta fue suspendida por el equipo de Discordia.');

        const first = renderPage();
        expect(screen.getByRole('alert')).toHaveTextContent('Tu cuenta fue suspendida por el equipo de Discordia.');
        first.unmount();

        renderPage();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows no alert when there is no notice', () => {
        renderPage();

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
