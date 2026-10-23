import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MessageComposer } from './MessageComposer';

const renderComposer = (canSendMessages: boolean) => {
    const onSend = vi.fn();
    render(
        <MessageComposer
            channelName="general"
            status="open"
            maxLength={2000}
            onSend={onSend}
            rejected={null}
            onRejectedHandled={vi.fn()}
            canSendMessages={canSendMessages}
        />,
    );
    return { onSend, user: userEvent.setup() };
};

const box = () => screen.getByPlaceholderText(/#general/);

describe('MessageComposer without SEND_MESSAGES', () => {
    it('says why instead of inviting to write', () => {
        renderComposer(false);

        expect(screen.getByPlaceholderText('No tenés permiso para escribir en #general')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
    });

    it('sends nothing even if the text gets in another way', async () => {
        // The button and the box are blocked, but Enter has its own path: it must not send
        // either. The backend rejects it anyway; this keeps the two from disagreeing.
        const { onSend, user } = renderComposer(false);

        await user.type(box(), 'hola{Enter}');

        expect(onSend).not.toHaveBeenCalled();
    });
});

describe('MessageComposer with SEND_MESSAGES', () => {
    it('sends what was typed', async () => {
        const { onSend, user } = renderComposer(true);

        await user.type(box(), 'hola{Enter}');

        expect(onSend).toHaveBeenCalledWith('hola');
    });
});
