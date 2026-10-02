import { describe, expect, it } from 'vitest';
import type { ErrorFrame, MessageAckFrame, MessageCreatedFrame } from '@discordia/api';
import {
    MAX_MESSAGES_PER_CHANNEL,
    chatReducer,
    initialChatState,
    type ChatAction,
    type ChatState,
} from './chatStore';

const run = (actions: ChatAction[], from: ChatState = initialChatState): ChatState =>
    actions.reduce(chatReducer, from);

const sent = (clientMessageId: string, channelId = 'ch1', content = 'hola'): ChatAction => ({
    type: 'sent',
    clientMessageId,
    channelId,
    content,
});

const ack = (clientMessageId: string): ChatAction => ({
    type: 'ack',
    frame: { type: 'message.ack', clientMessageId, messageId: `m-${clientMessageId}`, createdAt: '2026-01-01T00:00:00Z' } satisfies MessageAckFrame,
});

const created = (messageId: string, overrides: Partial<MessageCreatedFrame> = {}): ChatAction => ({
    type: 'created',
    frame: {
        type: 'message.created',
        messageId,
        channelId: 'ch1',
        serverId: 's1',
        authorId: 'u1',
        content: 'hola',
        createdAt: '2026-01-01T00:00:00Z',
        clientMessageId: `c-${messageId}`,
        ...overrides,
    },
});

const error = (code: ErrorFrame['error']['code'] = 'INTERNAL_ERROR'): ChatAction => ({
    type: 'error',
    frame: { type: 'error', error: { code, message: 'server text', correlationId: 'corr-1' } },
});

describe('chatReducer', () => {
    it('sent creates a sending pending and queues it', () => {
        const s = run([sent('A'), sent('B')]);
        expect(s.pending.A).toMatchObject({ status: 'sending', channelId: 'ch1', content: 'hola' });
        expect(s.pendingOrder).toEqual(['A', 'B']);
        expect(s.awaitingResponse).toEqual(['A', 'B']);
    });

    it('ack moves a pending to acked and dequeues it', () => {
        const s = run([sent('A'), ack('A')]);
        expect(s.pending.A.status).toBe('acked');
        expect(s.awaitingResponse).toEqual([]);
    });

    it('created with a pending clientMessageId removes the pending and stores the message', () => {
        const s = run([sent('A'), ack('A'), created('m1', { clientMessageId: 'A' })]);
        expect(s.pending.A).toBeUndefined();
        expect(s.pendingOrder).toEqual([]);
        expect(s.byChannel.ch1).toHaveLength(1);
        expect(s.byChannel.ch1[0].messageId).toBe('m1');
    });

    it('created from another user is added to its channel only', () => {
        const s = run([created('m1', { channelId: 'ch2' }), created('m2', { channelId: 'ch1' })]);
        expect(s.byChannel.ch1.map((m) => m.messageId)).toEqual(['m2']);
        expect(s.byChannel.ch2.map((m) => m.messageId)).toEqual(['m1']);
    });

    it('duplicate created (same messageId) adds nothing', () => {
        const once = run([created('m1')]);
        const twice = chatReducer(once, created('m1'));
        expect(twice.byChannel.ch1).toHaveLength(1);
        expect(twice).toBe(once);
    });

    it('created for a channel that is not being viewed is still stored', () => {
        const s = run([created('m1', { channelId: 'other' })]);
        expect(s.byChannel.other).toHaveLength(1);
    });

    it('keeps only the last MAX_MESSAGES_PER_CHANNEL messages per channel', () => {
        const actions = Array.from({ length: MAX_MESSAGES_PER_CHANNEL + 1 }, (_, i) => created(`m${i}`));
        const list = run(actions).byChannel.ch1;
        expect(list).toHaveLength(MAX_MESSAGES_PER_CHANNEL);
        expect(list[0].messageId).toBe('m1');
        expect(list[list.length - 1].messageId).toBe(`m${MAX_MESSAGES_PER_CHANNEL}`);
    });

    it('FIFO: after ack(A), an error fails B and leaves C sending', () => {
        const s = run([sent('A'), sent('B'), sent('C'), ack('A'), error()]);
        expect(s.pending.A.status).toBe('acked');
        expect(s.pending.B).toMatchObject({ status: 'failed', errorCode: 'INTERNAL_ERROR', correlationId: 'corr-1' });
        expect(s.pending.C.status).toBe('sending');
        expect(s.awaitingResponse).toEqual(['C']);
    });

    it('FIFO with retry: a resent message goes to the back of the queue', () => {
        let s = run([sent('A'), error()]);
        expect(s.pending.A.status).toBe('failed');
        s = run([sent('C'), { type: 'resent', clientMessageId: 'A' }], s);
        expect(s.awaitingResponse).toEqual(['C', 'A']);
        s = chatReducer(s, error());
        expect(s.pending.C.status).toBe('failed');
        expect(s.pending.A.status).toBe('sending');
    });

    it('error with an empty queue changes nothing', () => {
        const s = chatReducer(initialChatState, error());
        expect(s).toBe(initialChatState);
    });

    it('timeout fails a sending message and dequeues it; on an acked one it does nothing', () => {
        const s = run([sent('A'), sent('B'), ack('B'), { type: 'timeout', clientMessageId: 'A' }, { type: 'timeout', clientMessageId: 'B' }]);
        expect(s.pending.A).toMatchObject({ status: 'failed', errorCode: 'TIMEOUT' });
        expect(s.pending.B.status).toBe('acked');
        expect(s.awaitingResponse).toEqual([]);
    });

    it('sendFailed fails a sending message with DISCONNECTED', () => {
        const s = run([sent('A'), { type: 'sendFailed', clientMessageId: 'A' }]);
        expect(s.pending.A).toMatchObject({ status: 'failed', errorCode: 'DISCONNECTED' });
        expect(s.awaitingResponse).toEqual([]);
    });

    it('connectionLost fails every sending message, empties the queue and keeps acked ones', () => {
        const s = run([sent('A'), sent('B'), ack('B'), { type: 'connectionLost' }]);
        expect(s.pending.A).toMatchObject({ status: 'failed', errorCode: 'DISCONNECTED' });
        expect(s.pending.B.status).toBe('acked');
        expect(s.awaitingResponse).toEqual([]);
    });

    it('resent on a message that is not failed does nothing', () => {
        const before = run([sent('A')]);
        expect(chatReducer(before, { type: 'resent', clientMessageId: 'A' })).toBe(before);
        expect(chatReducer(before, { type: 'resent', clientMessageId: 'nope' })).toBe(before);
    });

    it('discard removes the pending from all three structures', () => {
        const s = run([sent('A'), sent('B'), { type: 'discard', clientMessageId: 'A' }]);
        expect(s.pending.A).toBeUndefined();
        expect(s.pendingOrder).toEqual(['B']);
        expect(s.awaitingResponse).toEqual(['B']);
    });

    it('an ack that arrives after the created does not break or resurrect the pending', () => {
        const s = run([sent('A'), created('m1', { clientMessageId: 'A' }), ack('A')]);
        expect(s.pending.A).toBeUndefined();
        expect(s.pendingOrder).toEqual([]);
        expect(s.awaitingResponse).toEqual([]);
        expect(s.byChannel.ch1).toHaveLength(1);
    });

    it('does not mutate the input state', () => {
        const base = run([sent('A'), sent('B'), created('m0')]);
        const snapshot = structuredClone(base);
        const actions: ChatAction[] = [
            sent('C'),
            ack('A'),
            created('m1', { clientMessageId: 'B' }),
            error(),
            { type: 'timeout', clientMessageId: 'C' },
            { type: 'resent', clientMessageId: 'C' },
            { type: 'connectionLost' },
            { type: 'discard', clientMessageId: 'C' },
        ];
        for (const action of actions) chatReducer(base, action);
        expect(base).toEqual(snapshot);
    });
});
