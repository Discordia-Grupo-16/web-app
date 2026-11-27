import { Alert } from 'react-native';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { PublicProfilesProvider, type ChatMessage } from '@discordia/core';
import type { ReactionDto, User } from '@discordia/api';
import { MessageList } from './MessageList';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

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

const tree = (
  messages: ChatMessage[],
  canAddReactions: boolean,
  onReact: (messageId: string, emoji: string, reacted: boolean) => Promise<void>,
) => (
  <PublicProfilesProvider source={{ getPublicProfiles: jest.fn(async () => new Map()), peekPublicProfile: () => undefined }}>
    <MessageList
      channelName="general"
      messages={messages}
      pending={[]}
      currentUser={me}
      canRetry
      onRetry={jest.fn()}
      onDiscard={jest.fn()}
      historyLoaded
      historyError={false}
      onRetryHistory={jest.fn()}
      hasMore={false}
      loadingMore={false}
      loadMoreError={false}
      onLoadMore={jest.fn()}
      onRetryLoadMore={jest.fn()}
      canEditOwn
      onStartEdit={jest.fn()}
      canManageMessages={false}
      onDelete={jest.fn(async () => {})}
      canAddReactions={canAddReactions}
      onReact={onReact}
    />
  </PublicProfilesProvider>
);

const plus = () => screen.queryByRole('button', { name: 'Reaccionar' });
const picker = () => screen.queryByLabelText('Elegir una reacción');

describe('MessageList reactions (SCRUM-49)', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('shows each emoji with its count and highlights the user\'s own', async () => {
    await render(tree([message('m1', [{ emoji: '👍', userIds: ['me', 'milton', 'felipe'] }, { emoji: '🎉', userIds: ['milton'] }])], true, jest.fn()));

    expect(await screen.findByRole('button', { name: 'Reaccionaste con 👍, 3 personas' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Reaccionar con 🎉, 1 persona' })).not.toBeSelected();
    expect(screen.getByText('3')).toBeOnTheScreen();
  });

  it('touching someone else\'s chip adds the reaction, and touching the own one takes it back (CA1, CA2)', async () => {
    const user = userEvent.setup();
    const onReact = jest.fn(async () => {});
    await render(tree([message('m1', [{ emoji: '👍', userIds: ['me'] }, { emoji: '🎉', userIds: ['milton'] }])], true, onReact));

    await user.press(await screen.findByRole('button', { name: 'Reaccionar con 🎉, 1 persona' }));
    await user.press(screen.getByRole('button', { name: 'Reaccionaste con 👍, 1 persona' }));

    expect(onReact).toHaveBeenNthCalledWith(1, 'm1', '🎉', true);
    expect(onReact).toHaveBeenNthCalledWith(2, 'm1', '👍', false);
  });

  it('picks a reaction from "＋" and closes the picker, without touching the long-press Alert', async () => {
    // Android shows at most three buttons in an Alert: the picker must not live there.
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const onReact = jest.fn(async () => {});
    await render(tree([message('m1')], true, onReact));

    await user.press(await screen.findByRole('button', { name: 'Reaccionar' }));
    await user.press(screen.getByRole('button', { name: 'Reaccionar con 🔥' }));

    expect(onReact).toHaveBeenCalledWith('m1', '🔥', true);
    expect(picker()).not.toBeOnTheScreen();
    expect(alert).not.toHaveBeenCalled();
  });

  it('picking again an emoji the user already reacted with takes it back (CA2)', async () => {
    const user = userEvent.setup();
    const onReact = jest.fn(async () => {});
    await render(tree([message('m1', [{ emoji: '👍', userIds: ['me'] }])], true, onReact));

    await user.press(await screen.findByRole('button', { name: 'Reaccionar' }));
    const own = screen.getByRole('button', { name: 'Quitar tu reacción 👍' });
    expect(own).toBeSelected();
    await user.press(own);

    expect(onReact).toHaveBeenCalledWith('m1', '👍', false);
  });

  it('closes the picker from the backdrop without reacting', async () => {
    const user = userEvent.setup();
    const onReact = jest.fn(async () => {});
    await render(tree([message('m1')], true, onReact));

    await user.press(await screen.findByRole('button', { name: 'Reaccionar' }));
    await user.press(screen.getByLabelText('Cerrar'));

    expect(picker()).not.toBeOnTheScreen();
    expect(onReact).not.toHaveBeenCalled();
  });

  it('without ADD_REACTIONS there is no "＋" and others\' chips cannot be joined, but the counts show (CA3)', async () => {
    await render(tree([message('m1', [{ emoji: '🎉', userIds: ['milton', 'felipe'] }])], false, jest.fn()));

    expect(await screen.findByRole('button', { name: 'Reaccionar con 🎉, 2 personas' })).toBeDisabled();
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(plus()).not.toBeOnTheScreen();
  });

  it('without ADD_REACTIONS the user can still take back their own reaction: the server only asks for VIEW_CHANNEL', async () => {
    const user = userEvent.setup();
    const onReact = jest.fn(async () => {});
    await render(tree([message('m1', [{ emoji: '👍', userIds: ['me'] }])], false, onReact));

    await user.press(await screen.findByRole('button', { name: 'Reaccionaste con 👍, 1 persona' }));

    expect(onReact).toHaveBeenCalledWith('m1', '👍', false);
  });

  // Lesson of the unread bug: the permission is read from the current props, never kept.
  it('shows "＋" when ADD_REACTIONS is given with the screen open, and closes an open picker when it is taken away', async () => {
    const user = userEvent.setup();
    const messages = [message('m1')];
    const onReact = jest.fn(async () => {});
    const { rerender } = await render(tree(messages, false, onReact));
    await screen.findByText('texto m1');
    expect(plus()).not.toBeOnTheScreen();

    await rerender(tree(messages, true, onReact));
    await user.press(screen.getByRole('button', { name: 'Reaccionar' }));
    expect(picker()).toBeOnTheScreen();

    await rerender(tree(messages, false, onReact));
    expect(picker()).not.toBeOnTheScreen();
    expect(plus()).not.toBeOnTheScreen();
  });

  it('closes an open picker when its message is deleted', async () => {
    const user = userEvent.setup();
    const onReact = jest.fn(async () => {});
    const { rerender } = await render(tree([message('m1')], true, onReact));
    await user.press(await screen.findByRole('button', { name: 'Reaccionar' }));
    expect(picker()).toBeOnTheScreen();

    // m1 deleted, m2 arrived: the picker was m1's, so it closes even though there is a message left.
    await rerender(tree([message('m2')], true, onReact));

    expect(picker()).not.toBeOnTheScreen();
  });

  it.each([
    [403, 'No tenés permiso para reaccionar en este canal.'],
    [409, 'Este mensaje ya tiene 20 emojis distintos.'],
    [500, 'No se pudo reaccionar. Probá de nuevo.'],
  ])('on an HTTP %i tells why in an Alert', async (status, text) => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const onReact = jest.fn(async () => { throw Object.assign(new Error('x'), { response: { status } }); });
    await render(tree([message('m1', [{ emoji: '🎉', userIds: ['milton'] }])], true, onReact));

    await user.press(await screen.findByRole('button', { name: 'Reaccionar con 🎉, 1 persona' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('No se pudo reaccionar', text));
  });
});
