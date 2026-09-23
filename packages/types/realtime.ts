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

export type ServerFrame = MessageAckFrame | MessageCreatedFrame | ErrorFrame;
