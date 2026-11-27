export interface MessageAttachment {
    url: string;
    filename: string;
    contentType: string;
}

/**
 * Un mensaje tal como lo devuelve `chat` por HTTP. Es lo mismo que trae el historial.
 */
export interface MessageDto {
    messageId: string;
    channelId: string;
    serverId: string;
    authorId: string;
    content: string;
    createdAt: string;
    /** Última edición, o `null` si nunca se editó. */
    editedAt: string | null;
    clientMessageId: string;
    attachments?: MessageAttachment[];
    /** One entry per emoji, in the order each emoji was first added (SCRUM-49). Never null. */
    reactions: ReactionDto[];
    /** Goes up by one with every change of `reactions`, and is 0 if it never had any. */
    reactionsVersion: number;
}

/** An emoji and who reacted with it (SCRUM-49). The count is `userIds.length`. */
export interface ReactionDto {
    emoji: string;
    userIds: string[];
}

/**
 * The reactions of a message after adding or removing one (SCRUM-49). It is the same data the
 * `message.reactions` frame carries, so the client that reacted applies it without waiting for it.
 */
export interface MessageReactionsDto {
    messageId: string;
    reactions: ReactionDto[];
    reactionsVersion: number;
}
