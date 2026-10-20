import { isAxiosError } from 'axios';
import { getApiErrorMessage } from '@discordia/api';

const MESSAGES_BY_STATUS: Record<number, string> = {
    401: 'Email o contraseña incorrectos.',
    403: 'Esta cuenta está suspendida.',
    429: 'Demasiados intentos. Probá de nuevo en unos minutos.',
};

export const loginErrorMessage = (err: unknown): string => {
    if (isAxiosError(err)) {
        if (!err.response) return 'No se pudo conectar con el servidor.';
        const message = MESSAGES_BY_STATUS[err.response.status];
        if (message) return message;
    }
    return getApiErrorMessage(err);
};
