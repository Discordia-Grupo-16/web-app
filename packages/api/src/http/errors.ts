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

// 404: the server was deleted. 403: we are no longer a member.
export const isGoneError = (err: unknown): boolean => {
    const status = (err as { response?: { status?: number } })?.response?.status;
    return status === 404 || status === 403;
};
