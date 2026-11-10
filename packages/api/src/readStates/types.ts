/** Hasta qué mensaje leyó el usuario un canal. Es lo que devuelven los PUT y lo que trae el frame. */
export interface ReadState {
    channelId: string;
    serverId: string;
    lastReadMessageId: string;
    /** `createdAt` del mensaje leído, no la hora en que se marcó. */
    lastReadAt: string;
}

/** Un canal visible con mensajes, tal como lo devuelve `GET /users/me/unread`. */
export interface ChannelUnread {
    channelId: string;
    serverId: string;
    lastMessageId: string;
    lastMessageAt: string;
    lastReadMessageId: string | null;
    lastReadAt: string | null;
    unread: boolean;
    /** Siempre 0 hasta que exista la optativa "Menciones". */
    mentionCount: number;
}
