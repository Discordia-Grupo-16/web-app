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
        onRetryLoadMore?: () => void;
        canEditOwn?: boolean;
        onEdit?: (messageId: string, content: string) => Promise<void>;
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
                    onRetryLoadMore={overrides.onRetryLoadMore ?? vi.fn()}
                    canEditOwn={overrides.canEditOwn ?? true}
                    maxLength={2000}
                    onEdit={overrides.onEdit ?? vi.fn(async () => {})}
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

    it('shows the load-more error banner with a retry button when older messages fail to load', () => {
        const onRetryLoadMore = vi.fn();
        renderList([message('m1', 'me')], {}, undefined, { loadMoreError: true, onRetryLoadMore });
        expect(screen.getByText('No se pudo cargar más mensajes.')).toBeInTheDocument();
        screen.getByRole('button', { name: 'Reintentar' }).click();
        expect(onRetryLoadMore).toHaveBeenCalledOnce();
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
        loadingMore?: boolean;
        loadMoreError?: boolean;
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
                    loadingMore={props.loadingMore ?? false}
                    loadMoreError={props.loadMoreError ?? false}
                    onLoadMore={props.onLoadMore ?? vi.fn()}
                    onRetryLoadMore={vi.fn()}
                    canEditOwn
                    maxLength={2000}
                    onEdit={vi.fn(async () => {})}
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

    it('clears prevScrollHeightRef when loadMore fails so a later socket message does not misadjust scroll', () => {
        const onLoadMore = vi.fn();
        mockScrollHeight = 300;
        const initial = [message('m1', 'me')];
        const { rerender } = render(makeTree({ messages: initial, hasMore: true, onLoadMore }));

        const el = document.querySelector('.py-2') as HTMLDivElement;
        el.scrollTop = 40;
        fireEvent.scroll(el); // saves prevScrollHeight=300, calls onLoadMore

        rerender(makeTree({ messages: initial, hasMore: true, onLoadMore, loadingMore: true }));
        rerender(makeTree({ messages: initial, hasMore: true, onLoadMore, loadMoreError: true }));

        // A new message arrives via socket — scroll should NOT adjust using the stale height
        mockScrollHeight = 340;
        rerender(makeTree({ messages: [...initial, message('m2', 'me')], hasMore: true, onLoadMore }));

        expect(el.scrollTop).toBe(40);
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

describe('MessageList editing', () => {
    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 0 });
    });

    const withEdit = (messageId: string, authorId: string, editedAt: string | null = null): ChatMessage => ({
        ...message(messageId, authorId),
        editedAt,
    });

    // The same tree as renderList, but rerenderable with another permission: the permission is a prop
    // that changes while the screen stays open, which is the case that matters.
    const tree = (messages: ChatMessage[], canEditOwn: boolean, onEdit: (id: string, content: string) => Promise<void>) => (
        <PublicProfilesProvider source={{ getPublicProfiles: vi.fn(async () => new Map()), peekPublicProfile: () => undefined }}>
            <ProfileViewerContext.Provider value={{ openProfile: vi.fn() }}>
                <MessageList
                    channelName="general"
                    topic={null}
                    messages={messages}
                    pending={[]}
                    currentUser={me}
                    canRetry
                    onRetry={vi.fn()}
                    onDiscard={vi.fn()}
                    historyLoaded
                    historyError={false}
                    onRetryHistory={vi.fn()}
                    hasMore={false}
                    loadingMore={false}
                    loadMoreError={false}
                    onLoadMore={vi.fn()}
                    onRetryLoadMore={vi.fn()}
                    canEditOwn={canEditOwn}
                    maxLength={2000}
                    onEdit={onEdit}
                />
            </ProfileViewerContext.Provider>
        </PublicProfilesProvider>
    );

    it('offers "Editar" on the own messages and on no one else\'s', async () => {
        renderList([withEdit('mine', 'me'), withEdit('theirs', 'milton')], { milton });

        await screen.findByText('Milton');
        expect(screen.getAllByRole('button', { name: 'Editar mensaje' })).toHaveLength(1);
    });

    it('never offers "Editar" on a message of another user, whatever the permission', async () => {
        renderList([withEdit('theirs', 'milton')], { milton }, undefined, { canEditOwn: true });

        await screen.findByText('Milton');
        expect(screen.queryByRole('button', { name: 'Editar mensaje' })).not.toBeInTheDocument();
    });

    it('does not offer "Editar" without SEND_MESSAGES', async () => {
        renderList([withEdit('mine', 'me')], {}, undefined, { canEditOwn: false });

        expect(await screen.findByText('texto mine')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Editar mensaje' })).not.toBeInTheDocument();
    });

    it('marks an edited message and shows when it was edited', async () => {
        renderList([withEdit('mine', 'me', '2026-11-09T15:30:00Z'), withEdit('plain', 'me')], {});

        const marks = await screen.findAllByText('(editado)');
        expect(marks).toHaveLength(1);
        expect(marks[0]).toHaveAttribute('title', expect.stringContaining('2026'));
    });

    it('saves with Enter, sends the new text for that message and closes the editor', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn(async () => {});
        renderList([withEdit('mine', 'me')], {}, undefined, { onEdit });

        await user.click(await screen.findByRole('button', { name: 'Editar mensaje' }));
        const box = screen.getByRole('textbox', { name: 'Editar mensaje' });
        await user.clear(box);
        await user.type(box, 'corregido{Enter}');

        await waitFor(() => expect(onEdit).toHaveBeenCalledWith('mine', 'corregido'));
        await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Editar mensaje' })).not.toBeInTheDocument());
    });

    it('Shift+Enter breaks the line instead of saving', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn(async () => {});
        renderList([withEdit('mine', 'me')], {}, undefined, { onEdit });

        await user.click(await screen.findByRole('button', { name: 'Editar mensaje' }));
        await user.type(screen.getByRole('textbox', { name: 'Editar mensaje' }), '{Shift>}{Enter}{/Shift}');

        expect(onEdit).not.toHaveBeenCalled();
        expect(screen.getByRole('textbox', { name: 'Editar mensaje' })).toHaveValue('texto mine\n');
    });

    it('Esc cancels without saving and leaves the text as it was', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn(async () => {});
        renderList([withEdit('mine', 'me')], {}, undefined, { onEdit });

        await user.click(await screen.findByRole('button', { name: 'Editar mensaje' }));
        await user.type(screen.getByRole('textbox', { name: 'Editar mensaje' }), ' cambio{Escape}');

        expect(onEdit).not.toHaveBeenCalled();
        expect(screen.queryByRole('textbox', { name: 'Editar mensaje' })).not.toBeInTheDocument();
        expect(screen.getByText('texto mine')).toBeInTheDocument();
    });

    it('saving without changes closes the editor without calling the server', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn(async () => {});
        renderList([withEdit('mine', 'me')], {}, undefined, { onEdit });

        await user.click(await screen.findByRole('button', { name: 'Editar mensaje' }));
        await user.type(screen.getByRole('textbox', { name: 'Editar mensaje' }), '{Enter}');

        expect(onEdit).not.toHaveBeenCalled();
        expect(screen.queryByRole('textbox', { name: 'Editar mensaje' })).not.toBeInTheDocument();
    });

    it('does not save an empty text', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn(async () => {});
        renderList([withEdit('mine', 'me')], {}, undefined, { onEdit });

        await user.click(await screen.findByRole('button', { name: 'Editar mensaje' }));
        await user.clear(screen.getByRole('textbox', { name: 'Editar mensaje' }));
        await user.keyboard('{Enter}');

        expect(onEdit).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });

    it('keeps the editor open and says why when the server refuses', async () => {
        const user = userEvent.setup();
        const refused = Object.assign(new Error('forbidden'), { response: { status: 403 } });
        const onEdit = vi.fn(async () => { throw refused; });
        renderList([withEdit('mine', 'me')], {}, undefined, { onEdit });

        await user.click(await screen.findByRole('button', { name: 'Editar mensaje' }));
        await user.type(screen.getByRole('textbox', { name: 'Editar mensaje' }), '!{Enter}');

        expect(await screen.findByRole('alert')).toHaveTextContent('No tenés permiso para editar este mensaje.');
        expect(screen.getByRole('textbox', { name: 'Editar mensaje' })).toHaveValue('texto mine!');
    });

    it.each([
        ['an HTTP 500', Object.assign(new Error('boom'), { response: { status: 500 } })],
        ['an HTTP 503', Object.assign(new Error('unavailable'), { response: { status: 503 } })],
        ['no answer at all (network down)', new Error('Network Error')],
    ])('on %s keeps the editor open with the generic error: it must never look as if it saved', async (_case, failure) => {
        const user = userEvent.setup();
        const onEdit = vi.fn(async () => { throw failure; });
        renderList([withEdit('mine', 'me')], {}, undefined, { onEdit });

        await user.click(await screen.findByRole('button', { name: 'Editar mensaje' }));
        await user.type(screen.getByRole('textbox', { name: 'Editar mensaje' }), '!{Enter}');

        expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo editar el mensaje.');
        expect(screen.getByRole('textbox', { name: 'Editar mensaje' })).toHaveValue('texto mine!');
        expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    });

    // Lesson of the unread bug: what depends on the access the user has is read from the current
    // permissions and never kept, and it is tried by changing the access with the screen open.
    it('removes "Editar" and closes an open editor when SEND_MESSAGES is taken away, and it comes back when it is given back', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn(async () => {});
        const messages = [withEdit('mine', 'me')];
        const { rerender } = render(tree(messages, true, onEdit));

        await user.click(await screen.findByRole('button', { name: 'Editar mensaje' }));
        expect(screen.getByRole('textbox', { name: 'Editar mensaje' })).toBeInTheDocument();

        rerender(tree(messages, false, onEdit));

        expect(screen.queryByRole('textbox', { name: 'Editar mensaje' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Editar mensaje' })).not.toBeInTheDocument();
        expect(screen.getByText('texto mine')).toBeInTheDocument();

        rerender(tree(messages, true, onEdit));

        expect(screen.getByRole('button', { name: 'Editar mensaje' })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Editar mensaje' })).not.toBeInTheDocument();
    });
});
