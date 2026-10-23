import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

vi.mock('@discordia/core', () => ({
    useAuth: () => ({ user: { id: '1', name: 'Ana', email: 'ana@discordia.dev', role: 'staff' } }),
}));

describe('HomePage', () => {
    it('greets the staff member and links to the users list', () => {
        render(
            <MemoryRouter>
                <HomePage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Usuarios/ })).toHaveAttribute('href', '/users');
        expect(screen.getByText('Buscar y filtrar usuarios de la plataforma.')).toBeInTheDocument();
    });

    it('keeps Servidores as upcoming', () => {
        render(
            <MemoryRouter>
                <HomePage />
            </MemoryRouter>,
        );

        expect(screen.getByText(/SCRUM-83/)).toBeInTheDocument();
        expect(screen.getByText('Próximamente.')).toBeInTheDocument();
    });
});
