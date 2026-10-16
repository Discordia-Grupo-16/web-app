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

describe('UsersTable actions', () => {
    const users = [user('ana'), user('boss', { role: 'staff' }), user('bob', { status: 'suspended' })];

    it('has an Acciones column', () => {
        render(<UsersTable users={users} onSuspend={vi.fn()} />);

        expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument();
    });

    it('offers Suspender, named after the user, only for an active non-staff user', async () => {
        const onSuspend = vi.fn();
        render(<UsersTable users={users} onSuspend={onSuspend} />);

        await userEvent.click(screen.getByRole('button', { name: 'Suspender a Name ana' }));

        expect(onSuspend).toHaveBeenCalledWith(users[0]);
        expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('shows "—" and no button for staff (E3)', () => {
        render(<UsersTable users={users} onSuspend={vi.fn()} />);

        const row = rowOf('boss@example.com');
        expect(within(row).queryByRole('button')).not.toBeInTheDocument();
        expect(within(row).getByText('—')).toBeInTheDocument();
    });

    it('shows "—" and no button for a suspended user', () => {
        render(<UsersTable users={users} onSuspend={vi.fn()} />);

        const row = rowOf('bob@example.com');
        expect(within(row).queryByRole('button')).not.toBeInTheDocument();
        expect(within(row).getByText('—')).toBeInTheDocument();
    });
});
