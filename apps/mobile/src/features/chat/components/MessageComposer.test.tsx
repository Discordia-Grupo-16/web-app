import { render, screen, userEvent } from '@testing-library/react-native';
import { MessageComposer } from './MessageComposer';
import type { RealtimeStatus, RejectedMessage } from '@discordia/core';

jest.useFakeTimers();

const renderComposer = async (
  props: Partial<{
    status: RealtimeStatus;
    maxLength: number;
    rejected: RejectedMessage | null;
    canSendMessages: boolean;
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
      canSendMessages
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

describe('MessageComposer without SEND_MESSAGES', () => {
  const box = () => screen.getByPlaceholderText('No tenés permiso para escribir en #general');

  it('says why instead of inviting to write', async () => {
    await renderComposer({ canSendMessages: false });

    expect(box()).toBeOnTheScreen();
    expect(sendButton()).toBeDisabled();
  });

  it('sends nothing even if the text gets in another way', async () => {
    // The box is not editable, but a paste or an autofill can still set it: pressing send
    // must not go through either. The backend rejects it anyway; this keeps the two from
    // disagreeing. There is no Enter path to cover here, unlike the web: on a touch keyboard
    // Enter is a line break and sending is only through the button.
    const { user, onSend } = await renderComposer({ canSendMessages: false });

    await user.type(box(), 'hola');
    await user.press(sendButton());

    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('MessageComposer editing', () => {
  const renderEditing = async (overrides: { onSave?: jest.Mock; status?: RealtimeStatus } = {}) => {
    const onSave = overrides.onSave ?? jest.fn(async () => {});
    const onCancel = jest.fn();
    const user = userEvent.setup();
    await render(
      <MessageComposer
        channelName="general"
        status={overrides.status ?? 'open'}
        maxLength={10}
        rejected={null}
        onSend={jest.fn()}
        onRejectedHandled={jest.fn()}
        canSendMessages
        editing={{ initialContent: 'hola', onSave, onCancel }}
      />,
    );
    return { user, onSave, onCancel };
  };
  const saveButton = () => screen.getByLabelText('Guardar edición');

  it('starts with the text of the message and says it is editing', async () => {
    await renderEditing();

    expect(screen.getByDisplayValue('hola')).toBeOnTheScreen();
    expect(screen.getByText('Editando mensaje')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Enviar mensaje')).not.toBeOnTheScreen();
  });

  it('saves the changed text instead of sending it', async () => {
    const { user, onSave } = await renderEditing();

    await user.type(screen.getByDisplayValue('hola'), '!');
    await user.press(saveButton());

    expect(onSave).toHaveBeenCalledWith('hola!');
  });

  it('closes without calling the server when nothing changed', async () => {
    const { user, onSave, onCancel } = await renderEditing();

    await user.press(saveButton());

    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('has a visible Cancelar that leaves without saving', async () => {
    const { user, onSave, onCancel } = await renderEditing();

    await user.type(screen.getByDisplayValue('hola'), '!');
    await user.press(screen.getByLabelText('Cancelar edición'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not need the socket: editing goes over HTTP', async () => {
    const { user } = await renderEditing({ status: 'closed' });

    await user.type(screen.getByDisplayValue('hola'), '!');

    expect(saveButton()).toBeEnabled();
  });

  it('does not save an empty text or one over the limit', async () => {
    const { user } = await renderEditing();

    await user.clear(screen.getByDisplayValue('hola'));
    expect(saveButton()).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Enviar mensaje a #general'), 'a'.repeat(11));
    expect(saveButton()).toBeDisabled();
  });

  it.each([
    ['an HTTP 500', Object.assign(new Error('boom'), { response: { status: 500 } })],
    ['no answer at all (network down)', new Error('Network Error')],
  ])('on %s stays in edit mode with the generic error: it must never look as if it saved', async (_case, failure) => {
    const { user } = await renderEditing({ onSave: jest.fn(async () => { throw failure; }) });

    await user.type(screen.getByDisplayValue('hola'), '!');
    await user.press(saveButton());

    expect(await screen.findByText('No se pudo editar el mensaje.')).toBeOnTheScreen();
    expect(screen.getByText('Editando mensaje')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('hola!')).toBeOnTheScreen();
    expect(saveButton()).toBeEnabled();
  });

  it('stays open and says why when the server refuses', async () => {
    const refused = Object.assign(new Error('forbidden'), { response: { status: 403 } });
    const { user } = await renderEditing({ onSave: jest.fn(async () => { throw refused; }) });

    await user.type(screen.getByDisplayValue('hola'), '!');
    await user.press(saveButton());

    expect(await screen.findByText('No tenés permiso para editar este mensaje.')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('hola!')).toBeOnTheScreen();
    expect(saveButton()).toBeEnabled();
  });
});
