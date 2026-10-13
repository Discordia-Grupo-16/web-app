import { describe, expect, it } from 'vitest';
import type { ErrorFrame, MessageAckFrame, MessageCreatedFrame } from '@discordia/api';
import {
    MAX_MESSAGES_PER_CHANNEL,
    chatReducer,
    initialChatState,
    type ChatAction,
    type ChatMessage,
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

const histMsg = (messageId: string, channelId = 'ch1', content = 'msg'): ChatMessage => ({
    messageId,
    clientMessageId: `c-${messageId}`,
    channelId,
    serverId: 's1',
    authorId: 'u1',
    content,
    createdAt: '2026-01-01T00:00:00Z',
});

const historyLoaded = (messages: ChatMessage[], hasMore = false, channelId = 'ch1'): ChatAction => ({
    type: 'historyLoaded',
    channelId,
    messages,
    hasMore,
});

const moreHistoryLoaded = (messages: ChatMessage[], hasMore = false, channelId = 'ch1'): ChatAction => ({
    type: 'moreHistoryLoaded',
    channelId,
    messages,
    hasMore,
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

describe('chatReducer — historial', () => {
    it('historyLoaded stores messages and marks the channel as loaded', () => {
        const s = run([historyLoaded([histMsg('m1'), histMsg('m2')])]);
        expect(s.byChannel.ch1.map((m) => m.messageId)).toEqual(['m1', 'm2']);
        expect(s.historyByChannel.ch1).toMatchObject({ loaded: true, hasMore: false, loadingMore: false });
    });

    it('historyLoaded with hasMore=true forwards that flag', () => {
        const s = run([historyLoaded([histMsg('m1')], true)]);
        expect(s.historyByChannel.ch1.hasMore).toBe(true);
    });

    it('historyLoaded prepends history before live messages already in the channel', () => {
        // A live message arrived via WebSocket before history loaded.
        const withLive = run([created('live')]);
        const s = chatReducer(withLive, historyLoaded([histMsg('old1'), histMsg('old2')]));
        expect(s.byChannel.ch1.map((m) => m.messageId)).toEqual(['old1', 'old2', 'live']);
    });

    it('historyLoaded deduplicates messages already seen via WebSocket', () => {
        const withLive = run([created('m1')]);
        const s = chatReducer(withLive, historyLoaded([histMsg('m1'), histMsg('m2')]));
        expect(s.byChannel.ch1.map((m) => m.messageId)).toEqual(['m2', 'm1']);
        expect(s.byChannel.ch1).toHaveLength(2);
    });

    it('historyLoaded on an empty channel with no messages sets loaded and empty list', () => {
        const s = run([historyLoaded([])]);
        expect(s.byChannel.ch1 ?? []).toHaveLength(0);
        expect(s.historyByChannel.ch1).toMatchObject({ loaded: true, hasMore: false, loadingMore: false });
    });

    it('loadingMoreHistory sets loadingMore to true', () => {
        const s = run([historyLoaded([histMsg('m1')]), { type: 'loadingMoreHistory', channelId: 'ch1' }]);
        expect(s.historyByChannel.ch1.loadingMore).toBe(true);
    });

    it('loadingMoreHistory on an unknown channel does nothing', () => {
        const before = run([historyLoaded([histMsg('m1')])]);
        const after = chatReducer(before, { type: 'loadingMoreHistory', channelId: 'ch2' });
        expect(after).toBe(before);
    });

    it('moreHistoryLoaded prepends older messages before existing ones', () => {
        const s = run([
            historyLoaded([histMsg('m3'), histMsg('m4')], true),
            { type: 'loadingMoreHistory', channelId: 'ch1' },
            moreHistoryLoaded([histMsg('m1'), histMsg('m2')]),
        ]);
        expect(s.byChannel.ch1.map((m) => m.messageId)).toEqual(['m1', 'm2', 'm3', 'm4']);
        expect(s.historyByChannel.ch1).toMatchObject({ loaded: true, hasMore: false, loadingMore: false });
    });

    it('moreHistoryLoaded deduplicates messages already in the channel', () => {
        const s = run([
            historyLoaded([histMsg('m2'), histMsg('m3')], true),
            moreHistoryLoaded([histMsg('m1'), histMsg('m2')]),
        ]);
        expect(s.byChannel.ch1.map((m) => m.messageId)).toEqual(['m1', 'm2', 'm3']);
    });

    it('moreHistoryLoaded preserves all existing messages — no newest are discarded', () => {
        const initial = Array.from({ length: MAX_MESSAGES_PER_CHANNEL }, (_, i) => histMsg(`existing-${i}`));
        const s = run([
            historyLoaded(initial, true),
            moreHistoryLoaded([histMsg('older-1'), histMsg('older-2')]),
        ]);
        expect(s.byChannel.ch1).toHaveLength(MAX_MESSAGES_PER_CHANNEL + 2);
        expect(s.byChannel.ch1[0].messageId).toBe('older-1');
        expect(s.byChannel.ch1[s.byChannel.ch1.length - 1].messageId).toBe(`existing-${MAX_MESSAGES_PER_CHANNEL - 1}`);
    });

    it('resyncLoaded sorts merged messages by (createdAt, messageId) when a live message arrived out of order', () => {
        const m1 = { ...histMsg('m1'), createdAt: '2026-01-01T00:00:00.000Z' };
        const m3 = { ...histMsg('m3'), createdAt: '2026-01-01T00:00:02.000Z' };
        const m2 = { ...histMsg('m2'), createdAt: '2026-01-01T00:00:01.000Z' };
        const m4 = { ...histMsg('m4'), createdAt: '2026-01-01T00:00:03.000Z' };
        const withLive = run([
            historyLoaded([m1]),
            { type: 'created', frame: { type: 'message.created', messageId: 'm3', channelId: 'ch1', serverId: 's1', authorId: 'u1', content: 'x', createdAt: m3.createdAt, clientMessageId: 'c-m3' } },
        ]);
        const s = chatReducer(withLive, { type: 'resyncLoaded', channelId: 'ch1', messages: [m2, m4] });
        expect(s.byChannel.ch1.map((m) => m.messageId)).toEqual(['m1', 'm2', 'm3', 'm4']);
    });

    it('historyFailed marks the channel with error and loaded=false', () => {
        const s = run([{ type: 'historyFailed', channelId: 'ch1' }]);
        expect(s.historyByChannel.ch1).toMatchObject({ loaded: false, error: true });
    });

    it('historyRetry clears the error and sets loaded=false to allow re-fetch', () => {
        const s = run([
            { type: 'historyFailed', channelId: 'ch1' },
            { type: 'historyRetry', channelId: 'ch1' },
        ]);
        expect(s.historyByChannel.ch1).toMatchObject({ error: false, loaded: false });
    });

    it('historyRetry is a no-op when there is no error', () => {
        const before = run([historyLoaded([histMsg('m1')])]);
        const after = chatReducer(before, { type: 'historyRetry', channelId: 'ch1' });
        expect(after).toBe(before);
    });

    it('loadMoreFailed clears loadingMore and sets loadMoreError', () => {
        const s = run([
            historyLoaded([histMsg('m1')], true),
            { type: 'loadingMoreHistory', channelId: 'ch1' },
            { type: 'loadMoreFailed', channelId: 'ch1' },
        ]);
        expect(s.historyByChannel.ch1).toMatchObject({ loadingMore: false, loadMoreError: true, hasMore: true });
    });

    it('resyncLoaded appends missed messages after the last known one', () => {
        const s = run([
            historyLoaded([histMsg('m1'), histMsg('m2')]),
            { type: 'resyncLoaded', channelId: 'ch1', messages: [histMsg('m3'), histMsg('m4')] },
        ]);
        expect(s.byChannel.ch1.map((m) => m.messageId)).toEqual(['m1', 'm2', 'm3', 'm4']);
    });

    it('resyncLoaded deduplicates messages already received via WebSocket', () => {
        const withLive = run([historyLoaded([histMsg('m1')]), created('m2')]);
        const s = chatReducer(withLive, { type: 'resyncLoaded', channelId: 'ch1', messages: [histMsg('m2'), histMsg('m3')] });
        expect(s.byChannel.ch1.map((m) => m.messageId)).toEqual(['m1', 'm2', 'm3']);
    });

    it('resyncLoaded with only duplicates returns the same state reference', () => {
        const before = run([historyLoaded([histMsg('m1')])]);
        const after = chatReducer(before, { type: 'resyncLoaded', channelId: 'ch1', messages: [histMsg('m1')] });
        expect(after).toBe(before);
    });
});
