import { isAxiosError } from 'axios';

export interface ValidationResult {
    isValid: boolean;
    error: string | null;
}

/**
 * Valida los datos de registro de usuario en el cliente (CA1-CA4).
 */
export function validateRegisterInput(data: {
    name?: string;
    email?: string;
    password?: string;
}): ValidationResult {
    const name = data.name?.trim();
    if (!name) {
        return { isValid: false, error: 'Por favor ingresa tu nombre de usuario.' };
    }

    const email = data.email?.trim();
    if (!email) {
        return { isValid: false, error: 'Por favor ingresa tu correo electrónico.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, error: 'El correo electrónico no tiene un formato válido.' };
    }

    const password = data.password;
    if (!password) {
        return { isValid: false, error: 'Por favor ingresa una contraseña.' };
    }

    if (
        password.length < 8 ||
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/\d/.test(password)
    ) {
        return {
            isValid: false,
            error:
                'La contraseña debe tener al menos 8 caracteres, e incluir al menos una letra mayúscula, una minúscula y un número.',
        };
    }

    return { isValid: true, error: null };
}

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
