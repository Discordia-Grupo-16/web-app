import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@discordia/api';
import { ProfilePopup } from './ProfilePopup';

const signOut = vi.fn();

vi.mock('@discordia/core', () => ({ useAuth: () => ({ signOut }) }));

const user = { id: 'me', name: 'Bruno', avatarUrl: null, bio: null } as unknown as User;

describe('ProfilePopup', () => {
    it('shows "Cerrar sesión" and signs out when clicked', async () => {
        render(<ProfilePopup user={user} onClose={vi.fn()} onEditProfile={vi.fn()} />);

        await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));

        expect(signOut).toHaveBeenCalledTimes(1);
    });
});
