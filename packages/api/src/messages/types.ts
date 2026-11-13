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
}
