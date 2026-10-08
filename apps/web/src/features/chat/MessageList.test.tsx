import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PublicProfilesProvider, type ChatMessage, type PublicProfileSource } from '@discordia/core';
import type { PublicUser, User } from '@discordia/api';
import { ProfileViewerContext } from '@/shared/profile/ProfileViewerContext';
import { MessageList } from './MessageList';

const me: User = { id: 'me', email: 'me@example.com', name: 'Felipe', role: 'user' };
const milton: PublicUser = { id: 'milton', name: 'Milton', avatarUrl: 'https://cdn/milton.png', bio: null };

const message = (messageId: string, authorId: string): ChatMessage =>
    ({ messageId, authorId, channelId: 'c1', content: `texto ${messageId}`, createdAt: '2026-10-04T12:00:00Z' }) as ChatMessage;

const renderList = (
    messages: ChatMessage[],
    profiles: Record<string, PublicUser | null>,
    getPublicProfiles?: PublicProfileSource['getPublicProfiles'],
) => {
    const openProfile = vi.fn();
    const source: PublicProfileSource = {
        getPublicProfiles:
            getPublicProfiles ??
            vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, profiles[id] ?? null]))),
        peekPublicProfile: () => undefined,
    };
    render(
        <PublicProfilesProvider source={source}>
            <ProfileViewerContext.Provider value={{ openProfile }}>
                <MessageList
                    channelName="general"
                    topic={null}
                    messages={messages}
                    pending={[]}
                    currentUser={me}
                    canRetry
                    onRetry={vi.fn()}
                    onDiscard={vi.fn()}
                    hasMore={false}
                    loadingMore={false}
                    onLoadMore={vi.fn()}
                />
            </ProfileViewerContext.Provider>
        </PublicProfilesProvider>,
    );
    return { openProfile, source };
};

describe('MessageList authors', () => {
    beforeAll(() => {
        // jsdom does not lay out: the list only reads scrollHeight to stick to the bottom.
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 0 });
    });

    it('shows the name and avatar of each author instead of the id', async () => {
        renderList([message('m1', 'milton')], { milton });

        expect(await screen.findByText('Milton')).toBeInTheDocument();
        expect(screen.queryByText(/^Usuario /)).not.toBeInTheDocument();
        expect(document.querySelector('img[src="https://cdn/milton.png"]')).toBeInTheDocument();
    });

    it('shows the short id until the profile arrives', async () => {
        renderList([message('m1', '7c9e6679-7425-40de-944b-e07fc1f90ae7')], {});

        expect(screen.getByText('Usuario 7c9e6679')).toBeInTheDocument();
        await screen.findByText('Usuario no disponible');
    });

    it('keeps the short id when the profiles cannot be loaded', async () => {
        const getPublicProfiles = vi.fn().mockRejectedValue(new Error('network'));
        renderList([message('m1', '7c9e6679-7425-40de-944b-e07fc1f90ae7')], {}, getPublicProfiles);

        await waitFor(() => expect(getPublicProfiles).toHaveBeenCalled());
        expect(screen.getByText('Usuario 7c9e6679')).toBeInTheDocument();
    });

    it('shows "Usuario no disponible" for suspended authors', async () => {
        renderList([message('m1', 'ghost')], { ghost: null });

        expect(await screen.findByText('Usuario no disponible')).toBeInTheDocument();
    });

    it('asks for each author once, in one request, and never for the own user', async () => {
        const { source } = renderList(
            [message('m1', 'milton'), message('m2', 'me'), message('m3', 'milton'), message('m4', 'ana')],
            { milton },
        );

        expect(await screen.findAllByText('Milton')).toHaveLength(2);
        expect(source.getPublicProfiles).toHaveBeenCalledTimes(1);
        expect(source.getPublicProfiles).toHaveBeenCalledWith(['ana', 'milton']);
    });

    it('uses the session name for the own messages', () => {
        renderList([message('m1', 'me')], {});

        expect(screen.getByText('Felipe')).toBeInTheDocument();
    });

    it('opens the public profile of the author from the name or the avatar', async () => {
        const { openProfile } = renderList([message('m1', 'milton')], { milton });
        const user = userEvent.setup();
        await screen.findByText('Milton');

        await user.click(screen.getByRole('button', { name: 'Milton' }));
        await user.click(screen.getByRole('button', { name: 'Ver perfil de Milton' }));

        expect(openProfile).toHaveBeenCalledTimes(2);
        expect(openProfile).toHaveBeenCalledWith('milton');
    });
});
