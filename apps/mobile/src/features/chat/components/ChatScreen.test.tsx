import { Text as MockText, TouchableOpacity as MockTouchable } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { ChatMessage } from '@discordia/core';
import { ChatScreen } from './ChatScreen';

const mockEditMessage = jest.fn();
let mockMessages: ChatMessage[] = [];

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 0 }));
jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
  useAuth: () => ({ user: { id: 'me' } }),
  useChannelMessages: () => ({
    messages: mockMessages,
    pending: [],
    status: 'open',
    maxLength: 2000,
    send: jest.fn(),
    retry: jest.fn(),
    discard: jest.fn(),
    editMessage: mockEditMessage,
    historyLoaded: true,
    historyError: false,
    retryHistory: jest.fn(),
    hasMore: false,
    loadingMore: false,
    loadMoreError: false,
    loadMore: jest.fn(),
    rejected: null,
    clearRejected: jest.fn(),
  }),
}));
// The list has its own tests: here it is only the way to start an edit.
jest.mock('./MessageList', () => ({
  MessageList: ({ onStartEdit }: { onStartEdit: (id: string) => void }) => (
    <MockTouchable accessibilityLabel="empezar edición" onPress={() => onStartEdit('m1')}>
      <MockText>lista</MockText>
    </MockTouchable>
  ),
}));

const own = (messageId: string, authorId = 'me'): ChatMessage =>
  ({ messageId, authorId, channelId: 'c1', content: `texto ${messageId}`, createdAt: '2026-11-09T12:00:00Z' }) as ChatMessage;

const tree = (canSendMessages: boolean) => (
  <ChatScreen channelId="c1" channelName="general" canSendMessages={canSendMessages} />
);

describe('ChatScreen editing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessages = [own('m1')];
    mockEditMessage.mockResolvedValue(undefined);
  });

  it('puts the composer in edit mode with the text of the message, saves it and goes back to composing', async () => {
    const user = userEvent.setup();
    await render(tree(true));

    await user.press(screen.getByLabelText('empezar edición'));
    expect(screen.getByDisplayValue('texto m1')).toBeOnTheScreen();

    await user.type(screen.getByDisplayValue('texto m1'), '!');
    await user.press(screen.getByLabelText('Guardar edición'));

    expect(mockEditMessage).toHaveBeenCalledWith('m1', 'texto m1!');
    expect(await screen.findByLabelText('Enviar mensaje')).toBeOnTheScreen();
    expect(screen.queryByText('Editando mensaje')).not.toBeOnTheScreen();
  });

  it('cancelling goes back to composing without calling the server', async () => {
    const user = userEvent.setup();
    await render(tree(true));

    await user.press(screen.getByLabelText('empezar edición'));
    await user.press(screen.getByLabelText('Cancelar edición'));

    expect(mockEditMessage).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Enviar mensaje')).toBeOnTheScreen();
  });

  // Lesson of the unread bug: what depends on the access the user has is read from the current
  // permissions and never kept, and it is tried by changing the access with the screen open.
  it('closes the editor when SEND_MESSAGES is taken away with it open', async () => {
    const user = userEvent.setup();
    const { rerender } = await render(tree(true));
    await user.press(screen.getByLabelText('empezar edición'));
    expect(screen.getByText('Editando mensaje')).toBeOnTheScreen();

    await rerender(tree(false));

    expect(screen.queryByText('Editando mensaje')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Guardar edición')).not.toBeOnTheScreen();
  });

  it('does not start editing a message of someone else, even if asked to', async () => {
    const user = userEvent.setup();
    mockMessages = [own('m1', 'milton')];
    await render(tree(true));

    await user.press(screen.getByLabelText('empezar edición'));

    expect(screen.queryByText('Editando mensaje')).not.toBeOnTheScreen();
    expect(mockEditMessage).not.toHaveBeenCalled();
  });
});
