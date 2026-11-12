import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AdminServer } from '@discordia/api';
import { ServersTable } from './ServersTable';

const server = (id: string, overrides: Partial<AdminServer> = {}): AdminServer => ({
    id,
    name: `Server ${id}`,
    memberCount: 10,
    createdAt: '2026-10-01T10:00:00Z',
    is_suspended: false,
    ...overrides,
});

describe('ServersTable', () => {
    it('renders the server columns and values', () => {
        const alpha = server('alpha', { memberCount: 42 });
        render(<ServersTable servers={[alpha]} onDelete={vi.fn()} onSuspend={vi.fn()} onReactivate={vi.fn()} />);

        expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Miembros' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Creado' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument();
        expect(screen.getByText('Activo')).toBeInTheDocument();

        const row = screen.getByText('Server alpha').closest('tr');
        expect(row).not.toBeNull();
        expect(within(row as HTMLElement).getByText('42')).toBeInTheDocument();
        expect(
            within(row as HTMLElement).getByText(new Date(alpha.createdAt).toLocaleDateString('es-AR')),
        ).toBeInTheDocument();
    });

    it('renders each server as its own row', () => {
        render(<ServersTable servers={[server('alpha'), server('beta')]} onDelete={vi.fn()} onSuspend={vi.fn()} onReactivate={vi.fn()} />);

        expect(screen.getAllByRole('row')).toHaveLength(3);
        expect(screen.getByText('Server alpha')).toBeInTheDocument();
        expect(screen.getByText('Server beta')).toBeInTheDocument();
    });

    it('calls onDelete with the selected server', () => {
        const alpha = server('alpha');
        const onDelete = vi.fn();
        render(<ServersTable servers={[alpha]} onDelete={onDelete} onSuspend={vi.fn()} onReactivate={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar Server alpha' }));

        expect(onDelete).toHaveBeenCalledWith(alpha);
    });

    it('offers suspension or reactivation according to server status', () => {
        const alpha = server('alpha');
        const beta = server('beta', { is_suspended: true });
        const onSuspend = vi.fn();
        const onReactivate = vi.fn();
        render(
            <ServersTable
                servers={[alpha, beta]}
                onDelete={vi.fn()}
                onSuspend={onSuspend}
                onReactivate={onReactivate}
            />,
        );

        expect(screen.getByText('Suspendido')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Suspender Server alpha' }));
        fireEvent.click(screen.getByRole('button', { name: 'Reactivar Server beta' }));

        expect(onSuspend).toHaveBeenCalledWith(alpha);
        expect(onReactivate).toHaveBeenCalledWith(beta);
    });
});
