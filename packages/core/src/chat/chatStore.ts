import type { MessageAckFrame, MessageCreatedFrame, ErrorFrame, RealtimeErrorCode } from '@discordia/api';

export interface ChatMessage {
    messageId: string;
    clientMessageId: string;
    channelId: string;
    serverId: string;
    authorId: string;
    content: string;
    createdAt: string;
}

export type PendingStatus = 'sending' | 'acked' | 'failed';

export type PendingErrorCode = RealtimeErrorCode | 'TIMEOUT' | 'DISCONNECTED';

export interface PendingMessage {
    clientMessageId: string;
    channelId: string;
    content: string;
    status: PendingStatus;
    errorCode?: PendingErrorCode;
    errorMessage?: string;
    correlationId?: string;
}

export interface ChannelHistoryMeta {
    loaded: boolean;
    hasMore: boolean;
    loadingMore: boolean;
    error: boolean;
    loadMoreError: boolean;
}

export interface ChatState {
    byChannel: Record<string, ChatMessage[]>;
    historyByChannel: Record<string, ChannelHistoryMeta>;
    seenMessageIds: Record<string, true>;
    pending: Record<string, PendingMessage>;
    pendingOrder: string[];
    awaitingResponse: string[];
}

export type ChatAction =
    | { type: 'sent'; clientMessageId: string; channelId: string; content: string }
    | { type: 'resent'; clientMessageId: string }
    | { type: 'ack'; frame: MessageAckFrame }
    | { type: 'created'; frame: MessageCreatedFrame }
    | { type: 'error'; frame: ErrorFrame }
    | { type: 'timeout'; clientMessageId: string }
    | { type: 'sendFailed'; clientMessageId: string }
    | { type: 'connectionLost' }
    | { type: 'discard'; clientMessageId: string }
    | { type: 'historyLoaded'; channelId: string; messages: ChatMessage[]; hasMore: boolean }
    | { type: 'historyFailed'; channelId: string }
    | { type: 'historyRetry'; channelId: string }
    | { type: 'loadingMoreHistory'; channelId: string }
    | { type: 'moreHistoryLoaded'; channelId: string; messages: ChatMessage[]; hasMore: boolean }
    | { type: 'loadMoreFailed'; channelId: string }
    | { type: 'resyncLoaded'; channelId: string; messages: ChatMessage[] }
    | { type: 'historyReset'; channelId: string };

export const MAX_MESSAGES_PER_CHANNEL = 200;

export const initialChatState: ChatState = {
    byChannel: {},
    historyByChannel: {},
    seenMessageIds: {},
    pending: {},
    pendingOrder: [],
    awaitingResponse: [],
};

const without = (list: string[], id: string): string[] => list.filter((item) => item !== id);

const omit = <T>(record: Record<string, T>, key: string): Record<string, T> => {
    const rest = { ...record };
    delete rest[key];
    return rest;
};

// Moves a still-sending message to failed and takes it out of the response queue.
const failPending = (
    state: ChatState,
    clientMessageId: string,
    errorCode: PendingErrorCode,
    extra: Partial<PendingMessage> = {},
): ChatState => {
    const current = state.pending[clientMessageId];
    const awaitingResponse = without(state.awaitingResponse, clientMessageId);
    if (!current || current.status !== 'sending') return { ...state, awaitingResponse };
    return {
        ...state,
        pending: { ...state.pending, [clientMessageId]: { ...current, status: 'failed', errorCode, ...extra } },
        awaitingResponse,
    };
};

export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
    switch (action.type) {
        case 'sent': {
            const { clientMessageId, channelId, content } = action;
            return {
                ...state,
                pending: { ...state.pending, [clientMessageId]: { clientMessageId, channelId, content, status: 'sending' } },
                pendingOrder: [...state.pendingOrder, clientMessageId],
                awaitingResponse: [...state.awaitingResponse, clientMessageId],
            };
        }

        case 'resent': {
            const current = state.pending[action.clientMessageId];
            if (!current || current.status !== 'failed') return state;
            // Same clientMessageId (idempotent resend), but it goes to the back of the response queue.
            return {
                ...state,
                pending: {
                    ...state.pending,
                    [action.clientMessageId]: {
                        clientMessageId: current.clientMessageId,
                        channelId: current.channelId,
                        content: current.content,
                        status: 'sending',
                    },
                },
                awaitingResponse: [...without(state.awaitingResponse, action.clientMessageId), action.clientMessageId],
            };
        }

        case 'ack': {
            const id = action.frame.clientMessageId;
            const current = state.pending[id];
            const awaitingResponse = without(state.awaitingResponse, id);
            if (!current || current.status !== 'sending') {
                return awaitingResponse.length === state.awaitingResponse.length ? state : { ...state, awaitingResponse };
            }
            return {
                ...state,
                pending: { ...state.pending, [id]: { ...current, status: 'acked' } },
                awaitingResponse,
            };
        }

        case 'created': {
            const { frame } = action;
            if (state.seenMessageIds[frame.messageId]) return state;
            const message: ChatMessage = {
                messageId: frame.messageId,
                clientMessageId: frame.clientMessageId,
                channelId: frame.channelId,
                serverId: frame.serverId,
                authorId: frame.authorId,
                content: frame.content,
                createdAt: frame.createdAt,
            };
            const prev = state.byChannel[frame.channelId] ?? [];
            const appended = [...prev, message];
            const channelMessages = appended.length > MAX_MESSAGES_PER_CHANNEL
                ? appended.slice(-MAX_MESSAGES_PER_CHANNEL)
                : appended;
            const seen: Record<string, true> = { ...state.seenMessageIds, [frame.messageId]: true };
            if (appended.length > MAX_MESSAGES_PER_CHANNEL) {
                delete seen[appended[0].messageId];
            }
            const next: ChatState = {
                ...state,
                byChannel: { ...state.byChannel, [frame.channelId]: channelMessages },
                seenMessageIds: seen,
            };
            if (!state.pending[frame.clientMessageId]) return next;
            return {
                ...next,
                pending: omit(state.pending, frame.clientMessageId),
                pendingOrder: without(state.pendingOrder, frame.clientMessageId),
                awaitingResponse: without(state.awaitingResponse, frame.clientMessageId),
            };
        }

        case 'error': {
            // ErrorFrame carries no clientMessageId. The server answers each message.send with exactly
            // one ack or error, in send order, so an error belongs to the head of the queue.
            const head = state.awaitingResponse[0];
            if (head === undefined) return state;
            const { code, message, correlationId } = action.frame.error;
            return failPending(state, head, code, { errorMessage: message, correlationId });
        }

        case 'timeout':
            return failPending(state, action.clientMessageId, 'TIMEOUT');

        case 'sendFailed':
            return failPending(state, action.clientMessageId, 'DISCONNECTED');

        case 'connectionLost': {
            // Replies from a dead socket never arrive; keeping the queue would shift the FIFO pairing
            // of later sends if a stale reply showed up.
            const pending: Record<string, PendingMessage> = {};
            for (const [id, message] of Object.entries(state.pending)) {
                pending[id] = message.status === 'sending' ? { ...message, status: 'failed', errorCode: 'DISCONNECTED' } : message;
            }
            return { ...state, pending, awaitingResponse: [] };
        }

        case 'discard':
            return {
                ...state,
                pending: omit(state.pending, action.clientMessageId),
                pendingOrder: without(state.pendingOrder, action.clientMessageId),
                awaitingResponse: without(state.awaitingResponse, action.clientMessageId),
            };

        case 'historyLoaded': {
            const { channelId, messages, hasMore } = action;
            const existing = state.byChannel[channelId] ?? [];
            const newMsgs = messages.filter((m) => !state.seenMessageIds[m.messageId]);
            const seen = { ...state.seenMessageIds };
            newMsgs.forEach((m) => { seen[m.messageId] = true; });
            const allMerged = [...newMsgs, ...existing];
            const merged = allMerged.slice(-MAX_MESSAGES_PER_CHANNEL);
            const dropped = allMerged.length - merged.length;
            for (let i = 0; i < dropped; i++) {
                delete seen[allMerged[i].messageId];
            }
            return {
                ...state,
                byChannel: { ...state.byChannel, [channelId]: merged },
                historyByChannel: { ...state.historyByChannel, [channelId]: { loaded: true, hasMore, loadingMore: false, error: false, loadMoreError: false } },
                seenMessageIds: seen,
            };
        }

        case 'historyFailed':
            return {
                ...state,
                historyByChannel: {
                    ...state.historyByChannel,
                    [action.channelId]: { loaded: false, hasMore: false, loadingMore: false, error: true, loadMoreError: false },
                },
            };

        case 'historyRetry': {
            const current = state.historyByChannel[action.channelId];
            if (!current?.error) return state;
            return {
                ...state,
                historyByChannel: {
                    ...state.historyByChannel,
                    [action.channelId]: { ...current, error: false, loaded: false },
                },
            };
        }

        case 'loadingMoreHistory': {
            const current = state.historyByChannel[action.channelId];
            if (!current) return state;
            return {
                ...state,
                historyByChannel: { ...state.historyByChannel, [action.channelId]: { ...current, loadingMore: true, loadMoreError: false } },
            };
        }

        case 'moreHistoryLoaded': {
            const { channelId, messages, hasMore } = action;
            const existing = state.byChannel[channelId] ?? [];
            const newMsgs = messages.filter((m) => !state.seenMessageIds[m.messageId]);
            const seen = { ...state.seenMessageIds };
            newMsgs.forEach((m) => { seen[m.messageId] = true; });
            // Older messages prepended; no slice so newest messages are never discarded from seenMessageIds.
            const merged = [...newMsgs, ...existing];
            return {
                ...state,
                byChannel: { ...state.byChannel, [channelId]: merged },
                historyByChannel: { ...state.historyByChannel, [channelId]: { loaded: true, hasMore, loadingMore: false, error: false, loadMoreError: false } },
                seenMessageIds: seen,
            };
        }

        case 'loadMoreFailed': {
            const current = state.historyByChannel[action.channelId];
            if (!current) return state;
            return {
                ...state,
                historyByChannel: {
                    ...state.historyByChannel,
                    [action.channelId]: { ...current, loadingMore: false, loadMoreError: true },
                },
            };
        }

        case 'resyncLoaded': {
            const { channelId, messages } = action;
            const existing = state.byChannel[channelId] ?? [];
            const newMsgs = messages.filter((m) => !state.seenMessageIds[m.messageId]);
            if (newMsgs.length === 0) return state;
            const seen = { ...state.seenMessageIds };
            newMsgs.forEach((m) => { seen[m.messageId] = true; });
            const sorted = [...existing, ...newMsgs].sort((a, b) => {
                const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
                return diff !== 0 ? diff : a.messageId < b.messageId ? -1 : 1;
            });
            const merged = sorted.slice(-MAX_MESSAGES_PER_CHANNEL);
            const dropped = sorted.length - merged.length;
            for (let i = 0; i < dropped; i++) {
                delete seen[sorted[i].messageId];
            }
            return {
                ...state,
                byChannel: { ...state.byChannel, [channelId]: merged },
                seenMessageIds: seen,
            };
        }

        case 'historyReset': {
            const { channelId } = action;
            const channelMessages = state.byChannel[channelId] ?? [];
            const seen = { ...state.seenMessageIds };
            channelMessages.forEach((m) => { delete seen[m.messageId]; });
            return {
                ...state,
                byChannel: { ...state.byChannel, [channelId]: [] },
                historyByChannel: {
                    ...state.historyByChannel,
                    [channelId]: { loaded: false, hasMore: false, loadingMore: false, error: false, loadMoreError: false },
                },
                seenMessageIds: seen,
            };
        }
    }
};
