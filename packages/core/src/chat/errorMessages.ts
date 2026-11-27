import type { PendingErrorCode } from './chatStore';

// The server's error.message is not shown as is: these are the UI texts.
export const ERROR_TEXTS: Record<PendingErrorCode, string> = {
    INTERNAL_ERROR: 'No se pudo enviar.',
    TIMEOUT: 'No hubo respuesta del servidor.',
    DISCONNECTED: 'Se perdió la conexión.',
    FORBIDDEN: 'No tenés permiso para escribir en este canal.',
    CHANNEL_NOT_FOUND: 'Este canal ya no existe.',
    MUTED: 'Estás silenciado en este servidor.',
    // These two never stay as a failed message (see rejectionMessage), the record just has to be total.
    EMPTY_MESSAGE: 'No se puede enviar un mensaje vacío.',
    MESSAGE_TOO_LONG: 'El mensaje supera el límite de caracteres.',
};

// Text for a message the server rejected and that goes back to the composer instead of staying failed.
export const rejectionMessage = (code: 'EMPTY_MESSAGE' | 'MESSAGE_TOO_LONG', maxLength: number): string =>
    code === 'EMPTY_MESSAGE' ? ERROR_TEXTS.EMPTY_MESSAGE : `El mensaje supera el límite de ${maxLength} caracteres.`;

// Only transient failures can be retried; FORBIDDEN, MUTED and CHANNEL_NOT_FOUND would fail again.
export const isRetryable = (code: PendingErrorCode | undefined): boolean =>
    code === 'INTERNAL_ERROR' || code === 'TIMEOUT' || code === 'DISCONNECTED';

// Why an edit was refused, from the HTTP status of the PATCH. The server's detail is not shown as is.
export const editErrorText = (error: unknown): string => {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    switch (status) {
        case 400:
            return 'El mensaje no es válido.';
        case 403:
            return 'No tenés permiso para editar este mensaje.';
        case 404:
            return 'Este mensaje ya no existe.';
        default:
            return 'No se pudo editar el mensaje.';
    }
};

// Why a delete was refused, from the HTTP status of the DELETE.
export const deleteErrorText = (error: unknown): string => {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    switch (status) {
        case 403:
            return 'No tenés permiso para eliminar este mensaje.';
        case 404:
            return 'Este mensaje ya no existe.';
        default:
            return 'No se pudo eliminar el mensaje.';
    }
};

// Why a reaction was refused, from the HTTP status of the PUT or DELETE (SCRUM-49).
export const reactionErrorText = (error: unknown): string => {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    switch (status) {
        case 400:
            return 'Ese emoji no se puede usar.';
        case 403:
            return 'No tenés permiso para reaccionar en este canal.';
        case 404:
            return 'El mensaje ya no existe.';
        case 409:
            return 'Este mensaje ya tiene 20 emojis distintos.';
        default:
            return 'No se pudo reaccionar. Probá de nuevo.';
    }
};
