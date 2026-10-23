import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '@discordia/api';
import { UsersTable } from './UsersTable';

const user = (id: string, overrides: Partial<AdminUser> = {}): AdminUser => ({
    id,
    email: `${id}@example.com`,
    name: `Name ${id}`,
    role: 'user',
    status: 'active',
    createdAt: '2026-10-01T10:00:00',
    ...overrides,
});

const rowOf = (email: string) => screen.getByText(email).closest('tr') as HTMLElement;

const renderTable = (users: AdminUser[], handlers = { onSuspend: vi.fn(), onReactivate: vi.fn() }) => {
    render(<UsersTable users={users} {...handlers} />);
    return handlers;
};

describe('UsersTable actions', () => {
    const users = [
        user('ana'),
        user('boss', { role: 'staff' }),
        user('bob', { status: 'suspended' }),
        user('boss2', { role: 'staff', status: 'suspended' }),
    ];

    it('has an Acciones column', () => {
        renderTable(users);

        expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument();
    });

    it('offers Suspender, named after the user, only for an active non-staff user', async () => {
        const { onSuspend, onReactivate } = renderTable(users);

        const row = rowOf('ana@example.com');
        await userEvent.click(within(row).getByRole('button', { name: 'Suspender a Name ana' }));

        expect(onSuspend).toHaveBeenCalledWith(users[0]);
        expect(onReactivate).not.toHaveBeenCalled();
        expect(within(row).queryByRole('button', { name: /Reactivar/ })).not.toBeInTheDocument();
    });

    it('offers Reactivar, named after the user, only for a suspended non-staff user', async () => {
        const { onSuspend, onReactivate } = renderTable(users);

        const row = rowOf('bob@example.com');
        await userEvent.click(within(row).getByRole('button', { name: 'Reactivar a Name bob' }));

        expect(onReactivate).toHaveBeenCalledWith(users[2]);
        expect(onSuspend).not.toHaveBeenCalled();
        expect(within(row).queryByRole('button', { name: /Suspender/ })).not.toBeInTheDocument();
    });

    it.each(['boss@example.com', 'boss2@example.com'])('shows "—" and no button for staff %s (E3)', (email) => {
        renderTable(users);

        const row = rowOf(email);
        expect(within(row).queryByRole('button')).not.toBeInTheDocument();
        expect(within(row).getByText('—')).toBeInTheDocument();
    });
});
