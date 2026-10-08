import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import { useProfileViewer } from '@/shared/profile/ProfileViewerContext';
import { ProfileViewerProvider } from './ProfileViewerProvider';

vi.mock('@/shared/api', () => ({ serversService: { getServers: vi.fn(async () => []) } }));
vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: { id: 'me', name: 'Felipe' } }),
}));

const Opener = () => {
    const { openProfile } = useProfileViewer();
    return <button onClick={() => openProfile('milton')}>Abrir</button>;
};

const source: PublicProfileSource = {
    getPublicProfiles: async () => new Map([['milton', { id: 'milton', name: 'Milton', avatarUrl: null, bio: null }]]),
    peekPublicProfile: () => undefined,
};

describe('ProfileViewerProvider', () => {
    it('opens the public profile of the requested user and closes it', async () => {
        render(
            <PublicProfilesProvider source={source}>
                <ProfileViewerProvider>
                    <Opener />
                </ProfileViewerProvider>
            </PublicProfilesProvider>,
        );
        const user = userEvent.setup();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Abrir' }));
        expect(await screen.findByRole('heading', { name: 'Milton' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Cerrar' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('fails with a clear error when a component uses the viewer outside the provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(() => render(<Opener />)).toThrow(/ProfileViewerProvider/);

        spy.mockRestore();
    });
});
