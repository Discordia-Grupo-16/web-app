import { describe, expect, it } from 'vitest';
import type { ChannelUnread, MessageCreatedFrame, ReadState } from '@discordia/api';
import {
    channelMentionCount,
    comparePositions,
    hasAnyUnread,
    initialUnreadState,
    isChannelUnread,
    isServerUnread,
    serverMentionCount,
    unreadReducer,
    type UnreadState,
} from './unreadStore';

const ME = 'me';
const OTHER = 'other';

// Dates one minute apart, so the order of the messages is the order of the number.
const at = (n: number) => new Date(Date.UTC(2026, 10, 2, 12, n)).toISOString().replace('.000Z', 'Z');

const item = (overrides: Partial<ChannelUnread> = {}): ChannelUnread => ({
    channelId: 'c1',
    serverId: 's1',
    lastMessageId: 'm2',
    lastMessageAt: at(2),
    lastReadMessageId: null,
    lastReadAt: null,
    unread: true,
    mentionCount: 0,
    ...overrides,
});

const created = (n: number, overrides: Partial<MessageCreatedFrame> = {}): MessageCreatedFrame => ({
    type: 'message.created',
    messageId: `m${n}`,
    channelId: 'c1',
    serverId: 's1',
    authorId: OTHER,
    content: 'hola',
    createdAt: at(n),
    clientMessageId: `cm${n}`,
    ...overrides,
});

const read = (n: number, overrides: Partial<ReadState> = {}): ReadState => ({
    channelId: 'c1',
    serverId: 's1',
    lastReadMessageId: `m${n}`,
    lastReadAt: at(n),
    ...overrides,
});

const loaded = (...items: ChannelUnread[]): UnreadState => unreadReducer(initialUnreadState, { type: 'loaded', items });

const onMessage = (state: UnreadState, frame: MessageCreatedFrame, suppress = false) =>
    unreadReducer(state, { type: 'messageCreated', frame, me: ME, suppress });

const onRead = (state: UnreadState, ...states: ReadState[]) => unreadReducer(state, { type: 'readStateUpdated', states });

describe('comparePositions', () => {
    it('orders by date first and the id only breaks ties', () => {
        expect(comparePositions({ at: at(1), id: 'z' }, { at: at(2), id: 'a' })).toBe(-1);
        expect(comparePositions({ at: at(2), id: 'a' }, { at: at(1), id: 'z' })).toBe(1);
        expect(comparePositions({ at: at(1), id: 'a' }, { at: at(1), id: 'b' })).toBe(-1);
        expect(comparePositions({ at: at(1), id: 'a' }, { at: at(1), id: 'a' })).toBe(0);
    });

    it('compares dates as instants: Go omits the trailing zeros of the decimals', () => {
        // As text, '12:00:00.5Z' < '12:00:00Z' because '.' sorts before 'Z'. As instants it is the opposite.
        const whole = { at: '2026-11-02T12:00:00Z', id: 'a' };
        const half = { at: '2026-11-02T12:00:00.5Z', id: 'a' };
        expect(comparePositions(whole, half)).toBe(-1);
        expect(comparePositions(half, whole)).toBe(1);
    });

    it('treats the same instant written two ways as a tie, so the id decides', () => {
        const a = { at: '2026-11-02T12:00:00Z', id: 'a' };
        const b = { at: '2026-11-02T12:00:00.000Z', id: 'b' };
        expect(comparePositions(a, b)).toBe(-1);
    });
});

describe('loaded', () => {
    it('takes what the server says, including the server of each channel', () => {
        const state = loaded(item(), item({ channelId: 'c2', serverId: 's2', unread: false }));

        expect(isChannelUnread(state, 'c1')).toBe(true);
        expect(isChannelUnread(state, 'c2')).toBe(false);
        expect(state.byChannel.c2.serverId).toBe('s2');
    });

    it('drops a channel the answer no longer lists', () => {
        const before = loaded(item(), item({ channelId: 'c2' }));

        const after = unreadReducer(before, { type: 'loaded', items: [item()] });

        expect(Object.keys(after.byChannel)).toEqual(['c1']);
    });

    it('keeps a message that arrived while the request was in flight', () => {
        const before = onMessage(loaded(item({ lastMessageId: 'm2', lastMessageAt: at(2) })), created(5));

        const after = unreadReducer(before, { type: 'loaded', items: [item({ lastMessageId: 'm2', lastMessageAt: at(2) })] });

        expect(after.byChannel.c1.lastMessageId).toBe('m5');
        expect(after.byChannel.c1.unread).toBe(true);
    });

    it('keeps a read that arrived while the request was in flight', () => {
        const before = onRead(loaded(item({ lastMessageId: 'm2', lastMessageAt: at(2) })), read(2));

        const after = unreadReducer(before, { type: 'loaded', items: [item({ lastMessageId: 'm2', lastMessageAt: at(2) })] });

        expect(after.byChannel.c1.lastReadMessageId).toBe('m2');
        expect(isChannelUnread(after, 'c1')).toBe(false);
    });

    it('takes the later read when the server is ahead of what the client knows', () => {
        const before = loaded(item({ lastReadMessageId: 'm1', lastReadAt: at(1) }));

        const after = unreadReducer(before, {
            type: 'loaded',
            items: [item({ lastReadMessageId: 'm2', lastReadAt: at(2), unread: false })],
        });

        expect(after.byChannel.c1.lastReadMessageId).toBe('m2');
        expect(isChannelUnread(after, 'c1')).toBe(false);
    });
});

describe('messageCreated', () => {
    it('a message from someone else makes the channel unread', () => {
        const state = onMessage(loaded(item({ unread: false, lastReadMessageId: 'm2', lastReadAt: at(2) })), created(3));

        expect(isChannelUnread(state, 'c1')).toBe(true);
        expect(state.byChannel.c1.lastMessageId).toBe('m3');
    });

    it('a message of the user is read, and also clears what was pending before it', () => {
        const state = onMessage(loaded(item()), created(3, { authorId: ME }));

        expect(isChannelUnread(state, 'c1')).toBe(false);
        expect(state.byChannel.c1.lastReadMessageId).toBe('m3');
    });

    it('a message in the channel that is open and visible does not make it unread', () => {
        const state = onMessage(loaded(item({ unread: false })), created(3), true);

        expect(isChannelUnread(state, 'c1')).toBe(false);
        expect(state.byChannel.c1.lastMessageId).toBe('m3');
    });

    it('a channel the client had not seen is created from the message', () => {
        const state = onMessage(initialUnreadState, created(1, { channelId: 'new', serverId: 's9' }));

        expect(state.byChannel.new).toMatchObject({ serverId: 's9', unread: true, lastReadMessageId: null });
    });

    it('a message older than the last one is ignored', () => {
        const before = loaded(item({ lastMessageId: 'm5', lastMessageAt: at(5), unread: false }));

        const after = onMessage(before, created(3));

        expect(after).toBe(before);
    });

    it('the same message twice changes nothing', () => {
        const once = onMessage(loaded(item({ unread: false })), created(3));

        expect(onMessage(once, created(3))).toBe(once);
    });
});

describe('readStateUpdated', () => {
    it('reading up to the last message clears the indicator', () => {
        const state = onRead(loaded(item()), read(2));

        expect(isChannelUnread(state, 'c1')).toBe(false);
    });

    it('reading something before the last message leaves the channel unread', () => {
        const state = onRead(loaded(item({ lastMessageId: 'm5', lastMessageAt: at(5) })), read(3));

        expect(isChannelUnread(state, 'c1')).toBe(true);
        expect(state.byChannel.c1.lastReadMessageId).toBe('m3');
    });

    it('an old frame does not move the read backwards', () => {
        const before = loaded(item({ lastMessageId: 'm5', lastMessageAt: at(5), lastReadMessageId: 'm4', lastReadAt: at(4) }));

        const after = onRead(before, read(2));

        expect(after).toBe(before);
    });

    it('compares fractional and whole dates as instants', () => {
        const before = loaded(item({
            lastMessageId: 'm9',
            lastMessageAt: '2026-11-02T12:00:00.5Z',
            lastReadMessageId: 'm1',
            lastReadAt: '2026-11-02T11:00:00Z',
        }));

        // 12:00:00Z is before 12:00:00.5Z, though as text it sorts after.
        const after = onRead(before, read(0, { lastReadMessageId: 'm8', lastReadAt: '2026-11-02T12:00:00Z' }));

        expect(isChannelUnread(after, 'c1')).toBe(true);
        expect(after.byChannel.c1.lastReadMessageId).toBe('m8');
    });

    it('a channel the client had not loaded keeps the read as a lower bound for later messages', () => {
        const afterRead = onRead(initialUnreadState, read(3));
        expect(isChannelUnread(afterRead, 'c1')).toBe(false);

        // A message before the read does not light it up; one after does.
        expect(isChannelUnread(onMessage(afterRead, created(2)), 'c1')).toBe(false);
        expect(isChannelUnread(onMessage(afterRead, created(4)), 'c1')).toBe(true);
    });

    it('the answer of "mark everything" does not switch off a message that arrived after it was built', () => {
        const unreadAll = loaded(item({ lastMessageId: 'm2', lastMessageAt: at(2) }));
        const withNewer = onMessage(unreadAll, created(4));

        // The server answered with the state up to m2; m4 came in meanwhile.
        const after = onRead(withNewer, read(2));

        expect(isChannelUnread(after, 'c1')).toBe(true);
    });

    it('applies several channels of one frame', () => {
        const before = loaded(item(), item({ channelId: 'c2' }));

        const after = onRead(before, read(2), read(2, { channelId: 'c2' }));

        expect(hasAnyUnread(after)).toBe(false);
    });
});

describe('selectors', () => {
    const state = loaded(
        item({ channelId: 'a', serverId: 's1', unread: false }),
        item({ channelId: 'b', serverId: 's1', unread: true, mentionCount: 2 }),
        item({ channelId: 'c', serverId: 's2', unread: false, mentionCount: 7 }),
    );

    it('a server is unread when any of its channels is', () => {
        expect(isServerUnread(state, 's1')).toBe(true);
        expect(isServerUnread(state, 's2')).toBe(false);
        expect(isServerUnread(state, 'unknown')).toBe(false);
    });

    it('a channel the client does not know is not unread', () => {
        expect(isChannelUnread(state, 'unknown')).toBe(false);
    });

    it('counts mentions only for what is unread', () => {
        expect(channelMentionCount(state, 'b')).toBe(2);
        expect(channelMentionCount(state, 'c')).toBe(0);
        expect(serverMentionCount(state, 's1')).toBe(2);
        expect(serverMentionCount(state, 's2')).toBe(0);
    });

    it('reset forgets everything', () => {
        expect(unreadReducer(state, { type: 'reset' })).toBe(initialUnreadState);
    });
});
