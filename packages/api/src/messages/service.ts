import type { AxiosInstance } from 'axios';
import type { MessageAttachment, MessageDto } from './types';

export const createMessagesService = (apiClient: AxiosInstance) => ({
    /**
     * Sube un archivo adjunto a través de community y devuelve la URL permanente en Cloudinary.
     */
    uploadAttachment: (file: File): Promise<MessageAttachment> => {
        const form = new FormData();
        form.append('file', file);
        return apiClient
            .post<{ data: MessageAttachment }>('/api/v1/files/upload', form)
            .then(r => r.data.data);
    },

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
});

export type MessagesService = ReturnType<typeof createMessagesService>;
