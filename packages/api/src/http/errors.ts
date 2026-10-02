import { isAxiosError } from 'axios';

/**
 * Extrae el mensaje de error de una respuesta RFC 7807 o error de red de Axios.
 */
export function getApiErrorMessage(
    error: unknown,
    defaultMessage = 'Ocurrió un error inesperado. Intente nuevamente.'
): string {
    if (isAxiosError(error)) {
        return (
            error.response?.data?.detail ||
            error.response?.data?.message ||
            error.response?.data?.title ||
            defaultMessage
        );
    }
    if (error instanceof Error) {
        return error.message;
    }
    return defaultMessage;
}
