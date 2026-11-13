import type { ChannelUnread, MessageCreatedFrame, ReadState } from '@discordia/api';

export interface ChannelUnreadEntry {
    serverId: string;
    lastMessageId: string;
    lastMessageAt: string;
    lastReadMessageId: string | null;
    lastReadAt: string | null;
    /**
     * What the server said, kept up to date by the events. It is not derived from the two positions
     * because a message of the user's own is the last one and still does not count as unread.
     */
    unread: boolean;
    mentionCount: number;
}

export interface UnreadState {
    byChannel: Record<string, ChannelUnreadEntry>;
}

export type UnreadAction =
    | { type: 'loaded'; items: ChannelUnread[] }
    /**
     * `suppress` is true when the channel is open and visible: the message is seen as it arrives, so
     * it must not light the indicator for the instant before the read is reported.
     */
    | { type: 'messageCreated'; frame: MessageCreatedFrame; me: string; suppress: boolean }
    | { type: 'readStateUpdated'; states: ReadState[] }
    | { type: 'reset' };

export const initialUnreadState: UnreadState = { byChannel: {} };

/**
 * Orders two positions of a channel by (date, id), the same tuple the server uses
 * (`ReadState.Advances`). The dates are compared as instants and never as text: Go leaves out the
 * trailing zeros of the decimals, so `12:00:00Z` and `12:00:00.5Z` do not sort as strings. The id
 * only breaks ties, since UUID v4 carry no order.
 */
export const comparePositions = (a: { at: string; id: string }, b: { at: string; id: string }): number => {
    const byDate = Date.parse(a.at) - Date.parse(b.at);
    if (byDate !== 0 && !Number.isNaN(byDate)) return byDate < 0 ? -1 : 1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
};

const lastOf = (e: ChannelUnreadEntry) => ({ at: e.lastMessageAt, id: e.lastMessageId });

const readOf = (e: { lastReadAt: string | null; lastReadMessageId: string | null }) =>
    e.lastReadAt !== null && e.lastReadMessageId !== null
        ? { at: e.lastReadAt, id: e.lastReadMessageId }
        : null;

/** True when what was read reaches the last message of the channel. */
const caughtUp = (e: ChannelUnreadEntry): boolean => {
    const read = readOf(e);
    return read !== null && comparePositions(read, lastOf(e)) >= 0;
};

/** The later of two read positions. Reads only move forward. */
const laterRead = <T extends { lastReadAt: string | null; lastReadMessageId: string | null }>(a: T, b: T): T => {
    const pa = readOf(a);
    const pb = readOf(b);
    if (pa === null) return b;
    if (pb === null) return a;
    return comparePositions(pb, pa) > 0 ? b : a;
};

const fromServer = (item: ChannelUnread): ChannelUnreadEntry => ({
    serverId: item.serverId,
    lastMessageId: item.lastMessageId,
    lastMessageAt: item.lastMessageAt,
    lastReadMessageId: item.lastReadMessageId,
    lastReadAt: item.lastReadAt,
    unread: item.unread,
    mentionCount: item.mentionCount,
});

const withRead = (entry: ChannelUnreadEntry, read: ChannelUnreadEntry): ChannelUnreadEntry => {
    const merged = { ...entry, lastReadMessageId: read.lastReadMessageId, lastReadAt: read.lastReadAt };
    return caughtUp(merged) ? { ...merged, unread: false } : merged;
};

export const unreadReducer = (state: UnreadState, action: UnreadAction): UnreadState => {
    switch (action.type) {
        case 'loaded': {
            // The answer reflects the moment the server built it. An event that arrived while the
            // request was in flight can be newer, so each side contributes what is later, never
            // the whole snapshot over it. A channel that the answer does not list is dropped: the
            // user no longer sees it.
            const byChannel: Record<string, ChannelUnreadEntry> = {};
            for (const item of action.items) {
                const served = fromServer(item);
                const local = state.byChannel[item.channelId];
                if (!local) {
                    byChannel[item.channelId] = served;
                    continue;
                }
                const localIsNewer = comparePositions(lastOf(local), lastOf(served)) > 0;
                const base = localIsNewer ? local : served;
                byChannel[item.channelId] = withRead(base, laterRead(local, served));
            }
            return { byChannel };
        }

        case 'messageCreated': {
            const { frame, me, suppress } = action;
            const position = { at: frame.createdAt, id: frame.messageId };
            const current = state.byChannel[frame.channelId];
            // Out of order, repeated, or already known (resync after a reconnection): not newer.
            if (current && comparePositions(position, lastOf(current)) <= 0) return state;

            const mine = frame.authorId === me;
            const next: ChannelUnreadEntry = {
                serverId: frame.serverId,
                mentionCount: current?.mentionCount ?? 0,
                lastMessageId: frame.messageId,
                lastMessageAt: frame.createdAt,
                lastReadMessageId: current?.lastReadMessageId ?? null,
                lastReadAt: current?.lastReadAt ?? null,
                unread: current?.unread ?? false,
            };
            if (mine) {
                // What the user writes is read: another device must not show it as news.
                next.lastReadMessageId = frame.messageId;
                next.lastReadAt = frame.createdAt;
                next.unread = false;
            } else if (!suppress) {
                next.unread = true;
            }
            return { byChannel: { ...state.byChannel, [frame.channelId]: next } };
        }

        case 'readStateUpdated': {
            let byChannel = state.byChannel;
            for (const read of action.states) {
                const current = byChannel[read.channelId];
                // A channel the answer did not list: the read is the only position known, which is
                // a lower bound for the last message. A later message will then compare correctly.
                const base: ChannelUnreadEntry = current ?? {
                    serverId: read.serverId,
                    lastMessageId: read.lastReadMessageId,
                    lastMessageAt: read.lastReadAt,
                    lastReadMessageId: null,
                    lastReadAt: null,
                    unread: false,
                    mentionCount: 0,
                };
                const incoming = { ...base, lastReadMessageId: read.lastReadMessageId, lastReadAt: read.lastReadAt };
                const next = withRead(base, laterRead(base, incoming));
                if (next.lastReadMessageId === base.lastReadMessageId && next.unread === base.unread && current) continue;
                byChannel = { ...byChannel, [read.channelId]: next };
            }
            return byChannel === state.byChannel ? state : { byChannel };
        }

        case 'reset':
            return initialUnreadState;
    }
};

export const isChannelUnread = (state: UnreadState, channelId: string): boolean =>
    state.byChannel[channelId]?.unread ?? false;

/** A server is unread when any of its channels is. */
export const isServerUnread = (state: UnreadState, serverId: string): boolean =>
    Object.values(state.byChannel).some((entry) => entry.serverId === serverId && entry.unread);

export const channelMentionCount = (state: UnreadState, channelId: string): number => {
    const entry = state.byChannel[channelId];
    return entry?.unread ? entry.mentionCount : 0;
};

export const serverMentionCount = (state: UnreadState, serverId: string): number =>
    Object.values(state.byChannel).reduce(
        (total, entry) => (entry.serverId === serverId && entry.unread ? total + entry.mentionCount : total),
        0,
    );

/** True while some channel is unread: it is what the "mark everything as read" action looks at. */
export const hasAnyUnread = (state: UnreadState): boolean =>
    Object.values(state.byChannel).some((entry) => entry.unread);
