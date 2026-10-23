import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { PublicProfilesProvider, type ChatMessage, type PublicProfileSource } from '@discordia/core';
import type { PublicUser, User } from '@discordia/api';
import { MessageList } from './MessageList';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const me: User = { id: 'me', email: 'me@example.com', name: 'Felipe', role: 'user' };
const milton: PublicUser = { id: 'milton', name: 'Milton', avatarUrl: 'https://cdn/milton.png', bio: null };

const message = (messageId: string, authorId: string): ChatMessage =>
  ({
    messageId,
    clientMessageId: messageId,
    authorId,
    channelId: 'c1',
    content: `texto ${messageId}`,
    createdAt: '2026-10-04T12:00:00Z',
  }) as ChatMessage;

const renderList = async (
  messages: ChatMessage[],
  profiles: Record<string, PublicUser | null>,
  getPublicProfiles?: PublicProfileSource['getPublicProfiles'],
) => {
  const source: PublicProfileSource = {
    getPublicProfiles:
      getPublicProfiles ?? jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, profiles[id] ?? null]))),
    peekPublicProfile: () => undefined,
  };
  const user = userEvent.setup();
  await render(
    <PublicProfilesProvider source={source}>
      <MessageList
        channelName="general"
        messages={messages}
        pending={[]}
        currentUser={me}
        canRetry
        onRetry={jest.fn()}
        onDiscard={jest.fn()}
      />
    </PublicProfilesProvider>,
  );
  return { user, source };
};

describe('MessageList authors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the name and avatar of each author instead of the id', async () => {
    await renderList([message('m1', 'milton')], { milton });

    expect(await screen.findByText('Milton')).toBeOnTheScreen();
    expect(screen.queryByText(/^Usuario /)).not.toBeOnTheScreen();
    expect(screen.getByTestId('author-avatar')).toHaveProp('source', { uri: 'https://cdn/milton.png' });
  });

  it('shows the short id until the profile arrives', async () => {
    // render flushes the pending promises, so the request is held open to see the state in between.
    let resolve: (profiles: Map<string, PublicUser | null>) => void = () => undefined;
    const getPublicProfiles = jest.fn(() => new Promise<Map<string, PublicUser | null>>((done) => (resolve = done)));
    await renderList([message('m1', '7c9e6679-7425-40de-944b-e07fc1f90ae7')], {}, getPublicProfiles);

    expect(screen.getByText('Usuario 7c9e6679')).toBeOnTheScreen();

    await act(async () => resolve(new Map([['7c9e6679-7425-40de-944b-e07fc1f90ae7', null]])));
    expect(screen.getByText('Usuario no disponible')).toBeOnTheScreen();
  });

  it('keeps the short id when the profiles cannot be loaded', async () => {
    const getPublicProfiles = jest.fn().mockRejectedValue(new Error('network'));
    await renderList([message('m1', '7c9e6679-7425-40de-944b-e07fc1f90ae7')], {}, getPublicProfiles);

    await waitFor(() => expect(getPublicProfiles).toHaveBeenCalled());
    expect(screen.getByText('Usuario 7c9e6679')).toBeOnTheScreen();
  });

  it('shows "Usuario no disponible" for suspended authors', async () => {
    await renderList([message('m1', 'ghost')], { ghost: null });

    expect(await screen.findByText('Usuario no disponible')).toBeOnTheScreen();
  });

  it('asks for each author once, in one request, and never for the own user', async () => {
    const { source } = await renderList(
      [message('m1', 'milton'), message('m2', 'me'), message('m3', 'milton'), message('m4', 'ana')],
      { milton },
    );

    expect(await screen.findAllByText('Milton')).toHaveLength(2);
    expect(source.getPublicProfiles).toHaveBeenCalledTimes(1);
    expect(source.getPublicProfiles).toHaveBeenCalledWith(['ana', 'milton']);
  });

  it('uses the session name for the own messages', async () => {
    await renderList([message('m1', 'me')], {});

    expect(screen.getByText('Felipe')).toBeOnTheScreen();
  });

  it('opens the public profile of the author from the name or the avatar', async () => {
    const { user } = await renderList([message('m1', 'milton')], { milton });
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText('Milton'));
    await user.press(screen.getByLabelText('Ver perfil de Milton'));

    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/user/[userId]', params: { userId: 'milton' } });
  });
});
