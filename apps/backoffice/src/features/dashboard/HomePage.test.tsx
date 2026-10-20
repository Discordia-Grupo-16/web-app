import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

vi.mock('@discordia/core', () => ({
    useAuth: () => ({ user: { id: '1', name: 'Ana', email: 'ana@discordia.dev', role: 'staff' } }),
}));

describe('HomePage', () => {
    it('greets the staff member and lists the upcoming sections', () => {
        render(<HomePage />);

        expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
        expect(screen.getByText(/SCRUM-85/)).toBeInTheDocument();
        expect(screen.getByText(/SCRUM-83/)).toBeInTheDocument();
    });
});
