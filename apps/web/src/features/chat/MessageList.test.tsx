import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
    overrides: {
        historyLoaded?: boolean;
        historyError?: boolean;
        onRetryHistory?: () => void;
        hasMore?: boolean;
        loadingMore?: boolean;
        loadMoreError?: boolean;
        onLoadMore?: () => void;
    } = {},
) => {
    const openProfile = vi.fn();
    const source: PublicProfileSource = {
        getPublicProfiles:
            getPublicProfiles ??
            vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, profiles[id] ?? null]))),
        peekPublicProfile: () => undefined,
    };
    const result = render(
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
                    historyLoaded={overrides.historyLoaded ?? true}
                    historyError={overrides.historyError ?? false}
                    onRetryHistory={overrides.onRetryHistory ?? vi.fn()}
                    hasMore={overrides.hasMore ?? false}
                    loadingMore={overrides.loadingMore ?? false}
                    loadMoreError={overrides.loadMoreError ?? false}
                    onLoadMore={overrides.onLoadMore ?? vi.fn()}
                />
            </ProfileViewerContext.Provider>
        </PublicProfilesProvider>,
    );
    return { openProfile, source, ...result };
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

describe('MessageList loading and error states', () => {
    it('shows a spinner while history is loading', () => {
        renderList([], {}, undefined, { historyLoaded: false });
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows an error message and a retry button when history fails', () => {
        const onRetryHistory = vi.fn();
        renderList([], {}, undefined, { historyLoaded: false, historyError: true, onRetryHistory });

        expect(screen.getByText('No se pudo cargar el historial.')).toBeInTheDocument();
        screen.getByRole('button', { name: 'Reintentar' }).click();
        expect(onRetryHistory).toHaveBeenCalledOnce();
    });

    it('shows the load-more error banner when older messages fail to load', () => {
        renderList([message('m1', 'me')], {}, undefined, { loadMoreError: true });
        expect(screen.getByText('No se pudo cargar más mensajes.')).toBeInTheDocument();
    });
});

describe('MessageList scroll behavior', () => {
    // Controllable scrollHeight: jsdom returns 0 by default, we need real values for scroll tests.
    let mockScrollHeight = 0;

    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            get() { return mockScrollHeight; },
        });
    });

    beforeEach(() => {
        mockScrollHeight = 0;
    });

    // Full provider tree needed because MessageList uses useProfileViewer and usePublicProfiles.
    const makeTree = (props: {
        messages: ChatMessage[];
        hasMore?: boolean;
        onLoadMore?: () => void;
    }) => (
        <PublicProfilesProvider source={{ getPublicProfiles: vi.fn(async () => new Map()), peekPublicProfile: () => undefined }}>
            <ProfileViewerContext.Provider value={{ openProfile: vi.fn() }}>
                <MessageList
                    channelName="general"
                    topic={null}
                    messages={props.messages}
                    pending={[]}
                    currentUser={me}
                    canRetry
                    onRetry={vi.fn()}
                    onDiscard={vi.fn()}
                    historyLoaded
                    historyError={false}
                    onRetryHistory={vi.fn()}
                    hasMore={props.hasMore ?? false}
                    loadingMore={false}
                    loadMoreError={false}
                    onLoadMore={props.onLoadMore ?? vi.fn()}
                />
            </ProfileViewerContext.Provider>
        </PublicProfilesProvider>
    );

    it('triggers onLoadMore when scrolled near the top and hasMore is true', () => {
        const onLoadMore = vi.fn();
        render(makeTree({ messages: [message('m1', 'me')], hasMore: true, onLoadMore }));

        // scrollTop defaults to 0 in jsdom, which is below the 80px threshold.
        fireEvent.scroll(document.querySelector('.py-2')!);

        expect(onLoadMore).toHaveBeenCalledOnce();
    });

    it('adjusts scrollTop to maintain position after messages are prepended', () => {
        mockScrollHeight = 300;
        const onLoadMore = vi.fn();
        const initial = [message('m2', 'me')];
        const { rerender } = render(makeTree({ messages: initial, hasMore: true, onLoadMore }));

        const el = document.querySelector('.py-2') as HTMLDivElement;
        el.scrollTop = 40;
        fireEvent.scroll(el); // saves prevScrollHeight=300, calls onLoadMore

        mockScrollHeight = 500;
        rerender(makeTree({ messages: [message('m1', 'me'), ...initial], hasMore: true, onLoadMore }));

        // useLayoutEffect: scrollTop += 500 - 300 = 200 → 40 + 200 = 240
        expect(el.scrollTop).toBe(240);
    });
});
