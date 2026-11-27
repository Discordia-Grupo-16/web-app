import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PublicProfilesProvider, type ChatMessage, type PublicProfileSource } from '@discordia/core';
import type { ReactionDto, User } from '@discordia/api';
import { ProfileViewerContext } from '@/shared/profile/ProfileViewerContext';
import { MessageList } from './MessageList';

const me: User = { id: 'me', email: 'me@example.com', name: 'Luis', role: 'user' };

const message = (messageId: string, reactions: ReactionDto[] = []): ChatMessage => ({
    messageId,
    clientMessageId: `c-${messageId}`,
    channelId: 'c1',
    serverId: 's1',
    authorId: 'milton',
    content: `texto ${messageId}`,
    createdAt: '2026-11-21T12:00:00Z',
    reactions,
    reactionsVersion: reactions.length,
});

const source: PublicProfileSource = {
    getPublicProfiles: async (ids: string[]) => new Map(ids.map((id) => [id, null])),
    peekPublicProfile: () => undefined,
};

const tree = (
    messages: ChatMessage[],
    canAddReactions: boolean,
    onReact: (messageId: string, emoji: string, reacted: boolean) => Promise<void>,
) => (
    <PublicProfilesProvider source={source}>
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
                canEditOwn
                maxLength={2000}
                onEdit={vi.fn(async () => {})}
                canManageMessages={false}
                onDelete={vi.fn(async () => {})}
                canAddReactions={canAddReactions}
                onReact={onReact}
            />
        </ProfileViewerContext.Provider>
    </PublicProfilesProvider>
);

const pickerButton = () => screen.queryByRole('button', { name: 'Reaccionar' });

describe('MessageList reactions (SCRUM-49)', () => {
    beforeAll(() => {
        // jsdom does not lay out: the list only reads scrollHeight to stick to the bottom.
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 0 });
    });

    it('shows each emoji with its count and highlights the user\'s own', async () => {
        render(tree([message('m1', [{ emoji: '👍', userIds: ['me', 'milton', 'felipe'] }, { emoji: '🎉', userIds: ['milton'] }])], true, vi.fn()));

        const mine = await screen.findByRole('button', { name: 'Reaccionaste con 👍, 3 personas' });
        expect(mine).toHaveAttribute('aria-pressed', 'true');
        expect(mine).toHaveTextContent('👍3');
        expect(screen.getByRole('button', { name: 'Reaccionar con 🎉, 1 persona' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('a message without reactions shows no chips', async () => {
        render(tree([message('m1')], true, vi.fn()));

        await screen.findByText('texto m1');
        expect(screen.queryByRole('button', { name: /personas?$/ })).not.toBeInTheDocument();
    });

    it('touching someone else\'s chip adds the reaction, and touching the own one takes it back (CA1, CA2)', async () => {
        const user = userEvent.setup();
        const onReact = vi.fn(async () => {});
        render(tree([message('m1', [{ emoji: '👍', userIds: ['me'] }, { emoji: '🎉', userIds: ['milton'] }])], true, onReact));

        await user.click(await screen.findByRole('button', { name: 'Reaccionar con 🎉, 1 persona' }));
        await user.click(screen.getByRole('button', { name: 'Reaccionaste con 👍, 1 persona' }));

        expect(onReact).toHaveBeenNthCalledWith(1, 'm1', '🎉', true);
        expect(onReact).toHaveBeenNthCalledWith(2, 'm1', '👍', false);
    });

    it('picks a reaction from "Reaccionar" and closes the picker', async () => {
        const user = userEvent.setup();
        const onReact = vi.fn(async () => {});
        render(tree([message('m1')], true, onReact));

        await user.click(await screen.findByRole('button', { name: 'Reaccionar' }));
        const picker = screen.getByRole('group', { name: 'Elegir una reacción' });
        await user.click(within(picker).getByRole('button', { name: 'Reaccionar con 🔥' }));

        expect(onReact).toHaveBeenCalledWith('m1', '🔥', true);
        expect(screen.queryByRole('group', { name: 'Elegir una reacción' })).not.toBeInTheDocument();
    });

    it('picking again an emoji the user already reacted with takes it back (CA2)', async () => {
        const user = userEvent.setup();
        const onReact = vi.fn(async () => {});
        render(tree([message('m1', [{ emoji: '👍', userIds: ['me'] }])], true, onReact));

        await user.click(await screen.findByRole('button', { name: 'Reaccionar' }));
        const own = within(screen.getByRole('group', { name: 'Elegir una reacción' })).getByRole('button', { name: 'Quitar tu reacción 👍' });
        expect(own).toHaveAttribute('aria-pressed', 'true');
        await user.click(own);

        expect(onReact).toHaveBeenCalledWith('m1', '👍', false);
    });

    it('closes the picker with Escape, giving the focus back, and with a click outside, without reacting', async () => {
        const user = userEvent.setup();
        const onReact = vi.fn(async () => {});
        render(tree([message('m1')], true, onReact));

        await user.click(await screen.findByRole('button', { name: 'Reaccionar' }));
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('group', { name: 'Elegir una reacción' })).not.toBeInTheDocument();
        expect(pickerButton()).toHaveFocus();

        await user.click(pickerButton()!);
        await user.click(screen.getByText('texto m1'));
        expect(screen.queryByRole('group', { name: 'Elegir una reacción' })).not.toBeInTheDocument();
        expect(onReact).not.toHaveBeenCalled();
    });

    it('without ADD_REACTIONS there is no "Reaccionar" and others\' chips cannot be joined, but the counts show (CA3)', async () => {
        render(tree([message('m1', [{ emoji: '🎉', userIds: ['milton', 'felipe'] }])], false, vi.fn()));

        const theirs = await screen.findByRole('button', { name: 'Reaccionar con 🎉, 2 personas' });
        expect(theirs).toBeDisabled();
        expect(theirs).toHaveTextContent('🎉2');
        expect(pickerButton()).not.toBeInTheDocument();
    });

    it('without ADD_REACTIONS the user can still take back their own reaction: the server only asks for VIEW_CHANNEL', async () => {
        const user = userEvent.setup();
        const onReact = vi.fn(async () => {});
        render(tree([message('m1', [{ emoji: '👍', userIds: ['me'] }])], false, onReact));

        await user.click(await screen.findByRole('button', { name: 'Reaccionaste con 👍, 1 persona' }));

        expect(onReact).toHaveBeenCalledWith('m1', '👍', false);
    });

    // Lesson of the unread bug: the permission is read from the current props, never kept.
    it('shows "Reaccionar" when ADD_REACTIONS is given with the screen open, and removes it when it is taken away', async () => {
        const messages = [message('m1')];
        const onReact = vi.fn(async () => {});
        const { rerender } = render(tree(messages, false, onReact));
        await screen.findByText('texto m1');
        expect(pickerButton()).not.toBeInTheDocument();

        rerender(tree(messages, true, onReact));
        expect(pickerButton()).toBeInTheDocument();

        rerender(tree(messages, false, onReact));
        expect(pickerButton()).not.toBeInTheDocument();
    });

    it.each([
        [403, 'No tenés permiso para reaccionar en este canal.'],
        [409, 'Este mensaje ya tiene 20 emojis distintos.'],
        [500, 'No se pudo reaccionar. Probá de nuevo.'],
    ])('on an HTTP %i says why on that message only', async (status, text) => {
        const user = userEvent.setup();
        const onReact = vi.fn(async () => { throw Object.assign(new Error('x'), { response: { status } }); });
        render(tree([message('m1', [{ emoji: '🎉', userIds: ['milton'] }]), message('m2')], true, onReact));

        await user.click(await screen.findByRole('button', { name: 'Reaccionar con 🎉, 1 persona' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(text);
        expect(screen.getAllByRole('alert')).toHaveLength(1);
    });

    it('the error goes away with the next reaction that works', async () => {
        const user = userEvent.setup();
        const onReact = vi.fn()
            .mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 500 } }))
            .mockResolvedValueOnce(undefined);
        render(tree([message('m1', [{ emoji: '🎉', userIds: ['milton'] }])], true, onReact));
        const chip = await screen.findByRole('button', { name: 'Reaccionar con 🎉, 1 persona' });

        await user.click(chip);
        await screen.findByRole('alert');
        await user.click(chip);

        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });
});
