import type { AxiosInstance } from 'axios';
import type { MessageDto, MessageReactionsDto } from './types';

// The emoji goes in the path, so it is percent-encoded: `#` in `#️⃣` would otherwise start a fragment.
const reactionUrl = (channelId: string, messageId: string, emoji: string): string =>
    `/api/v1/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`;

export const createMessagesService = (apiClient: AxiosInstance) => ({
    /**
     * Cambia el contenido de un mensaje propio. Responde el mensaje vigente: si el contenido ya era
     * ese, `editedAt` no cambia. Un 403 es "no es tuyo" o "no podés escribir acá" y un 404, "ya no existe".
     */
    editMessage: (channelId: string, messageId: string, content: string): Promise<MessageDto> =>
        apiClient
            .patch<{ data: MessageDto }>(`/api/v1/channels/${channelId}/messages/${messageId}`, { content })
            .then(r => r.data.data),

    /**
     * Borra un mensaje: propio, o ajeno con `MANAGE_MESSAGES`. Responde 204, también si ya estaba
     * borrado. Un 403 es "no es tuyo y no moderás" y un 404, "no existe en ese canal".
     */
    deleteMessage: (channelId: string, messageId: string): Promise<void> =>
        apiClient.delete(`/api/v1/channels/${channelId}/messages/${messageId}`).then(() => undefined),

    /**
     * Adds the user's reaction with that emoji (SCRUM-49). Idempotent: if it was already there, the
     * answer is the current state with the same `reactionsVersion`. A 400 is an invalid emoji, a 403
     * "no ADD_REACTIONS" or a suspended server, a 404 "the message no longer exists" and a 409 "it
     * already has 20 different emojis".
     */
    addReaction: (channelId: string, messageId: string, emoji: string): Promise<MessageReactionsDto> =>
        apiClient
            .put<{ data: MessageReactionsDto }>(reactionUrl(channelId, messageId, emoji))
            .then(r => r.data.data),

    /**
     * Removes the user's reaction with that emoji (SCRUM-49). Idempotent, and it only needs
     * VIEW_CHANNEL: a user who lost ADD_REACTIONS can still take back their own reaction.
     */
    removeReaction: (channelId: string, messageId: string, emoji: string): Promise<MessageReactionsDto> =>
        apiClient
            .delete<{ data: MessageReactionsDto }>(reactionUrl(channelId, messageId, emoji))
            .then(r => r.data.data),
});

export type MessagesService = ReturnType<typeof createMessagesService>;
