import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminServer } from '@discordia/api';
import { ServersTable } from './ServersTable';

const server = (id: string, overrides: Partial<AdminServer> = {}): AdminServer => ({
    id,
    name: `Server ${id}`,
    memberCount: 10,
    createdAt: '2026-10-01T10:00:00Z',
    ...overrides,
});

describe('ServersTable', () => {
    it('renders the server columns and values', () => {
        const alpha = server('alpha', { memberCount: 42 });
        render(<ServersTable servers={[alpha]} />);

        expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Miembros' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Creado' })).toBeInTheDocument();

        const row = screen.getByText('Server alpha').closest('tr');
        expect(row).not.toBeNull();
        expect(within(row as HTMLElement).getByText('42')).toBeInTheDocument();
        expect(
            within(row as HTMLElement).getByText(new Date(alpha.createdAt).toLocaleDateString('es-AR')),
        ).toBeInTheDocument();
    });

    it('renders each server as its own row', () => {
        render(<ServersTable servers={[server('alpha'), server('beta')]} />);

        expect(screen.getAllByRole('row')).toHaveLength(3);
        expect(screen.getByText('Server alpha')).toBeInTheDocument();
        expect(screen.getByText('Server beta')).toBeInTheDocument();
    });
});
