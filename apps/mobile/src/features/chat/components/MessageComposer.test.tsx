import { render, screen, userEvent } from '@testing-library/react-native';
import { MessageComposer } from './MessageComposer';
import type { RealtimeStatus, RejectedMessage } from '@discordia/core';

jest.useFakeTimers();

const renderComposer = async (
  props: Partial<{
    status: RealtimeStatus;
    maxLength: number;
    rejected: RejectedMessage | null;
  }> = {},
) => {
  const onSend = jest.fn();
  const onRejectedHandled = jest.fn();
  const user = userEvent.setup();
  await render(
    <MessageComposer
      channelName="general"
      status="open"
      maxLength={10}
      rejected={null}
      onSend={onSend}
      onRejectedHandled={onRejectedHandled}
      {...props}
    />,
  );
  return { user, onSend, onRejectedHandled };
};

const input = () => screen.getByPlaceholderText('Enviar mensaje a #general');
// TouchableOpacity has no accessibilityRole here, so getByRole('button') cannot find it.
const sendButton = () => screen.getByLabelText('Enviar mensaje');

describe('MessageComposer', () => {
  it('keeps the send button disabled while the input is empty', async () => {
    await renderComposer();

    expect(sendButton()).toBeDisabled();
  });

  it('sends the typed text as is and clears the input', async () => {
    const { user, onSend } = await renderComposer();

    await user.type(input(), ' hola ');
    await user.press(sendButton());

    expect(onSend).toHaveBeenCalledWith(' hola ');
    expect(input()).toHaveDisplayValue('');
  });

  it('does not allow sending when the connection is not open', async () => {
    const { user, onSend } = await renderComposer({ status: 'reconnecting' });

    await user.type(input(), 'hola');
    await user.press(sendButton());

    expect(sendButton()).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows the counter near the limit and blocks sending past it', async () => {
    const { user, onSend } = await renderComposer({ maxLength: 10 });

    await user.type(input(), 'hola mundo!!');

    expect(screen.getByText('12/10')).toBeOnTheScreen();
    expect(sendButton()).toBeDisabled();
    await user.press(sendButton());
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows the server rejection and acknowledges it', async () => {
    const rejected: RejectedMessage = {
      channelId: 'c1',
      content: 'demasiado largo',
      code: 'MESSAGE_TOO_LONG',
      message: 'El mensaje supera el límite',
    };
    const { onRejectedHandled } = await renderComposer({ rejected });

    expect(screen.getByText('El mensaje supera el límite')).toBeOnTheScreen();
    expect(input()).toHaveDisplayValue('demasiado largo');
    expect(onRejectedHandled).toHaveBeenCalled();
  });
});
