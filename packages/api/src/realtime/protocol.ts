export interface MessageSendFrame {
    type: 'message.send';
    channelId: string;
    content: string;
    clientMessageId: string;
}

export interface MessageAckFrame {
    type: 'message.ack';
    clientMessageId: string;
    messageId: string;
    createdAt: string;
}

export interface MessageCreatedFrame {
    type: 'message.created';
    messageId: string;
    channelId: string;
    serverId: string;
    authorId: string;
    content: string;
    createdAt: string;
    clientMessageId: string;
}

/**
 * What a client has to fetch again (ADR-0017). The set is open: the server may add values, and a
 * client ignores the ones it does not know, so `resources` is typed as plain strings.
 */
export type InvalidateResource =
    | 'servers'
    | 'server'
    | 'channels'
    | 'permissions'
    | 'members'
    | 'bans'
    | 'profile'
    | 'ownershipTransfers';

/**
 * Something the client has loaded went stale. It carries no data: the client asks again over HTTP,
 * because the source is `community` or `identity`, not `chat`. A repeated or out-of-order notice
 * only costs a refetch.
 */
export interface InvalidateFrame {
    type: 'invalidate';
    /** Absent when the resources are not a server's (`servers`, `profile`). */
    serverId?: string;
    resources: string[];
    /** Whose profile changed. Present only when a profile is the cause. */
    userId?: string;
}

export interface ReadStateEntry {
    channelId: string;
    serverId: string;
    lastReadMessageId: string;
    lastReadAt: string;
}

/**
 * The user read something in another session. Unlike `invalidate` it carries the data: the read
 * state belongs to `chat`, so there is no other service to ask. It also reaches the session that
 * made the request, and applying it twice changes nothing because a read state only moves forward.
 */
export interface ReadStateUpdatedFrame {
    type: 'read-state.updated';
    userId: string;
    states: ReadStateEntry[];
}

export type RealtimeErrorCode =
    | 'CHANNEL_NOT_FOUND'
    | 'FORBIDDEN'
    | 'EMPTY_MESSAGE'
    | 'MESSAGE_TOO_LONG'
    | 'INTERNAL_ERROR';

export interface ErrorFrame {
    type: 'error';
    error: {
        code: RealtimeErrorCode;
        message: string;
        correlationId: string;
        details?: { maxLength?: number };
    };
}

export type ServerFrame = MessageAckFrame | MessageCreatedFrame | InvalidateFrame | ReadStateUpdatedFrame | ErrorFrame;
