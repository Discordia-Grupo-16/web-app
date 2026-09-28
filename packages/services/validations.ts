import { isAxiosError } from 'axios';

export interface ValidationResult {
    isValid: boolean;
    error: string | null;
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida que el nombre de usuario esté presente y no vacío.
 */
export function validateUsername(name?: string): ValidationResult {
    const trimmed = name?.trim();
    if (!trimmed) {
        return { isValid: false, error: 'Por favor ingresa tu nombre de usuario.' };
    }
    return { isValid: true, error: null };
}

/**
 * Valida formato y presencia de correo electrónico.
 */
export function validateEmail(email?: string): ValidationResult {
    const trimmed = email?.trim();
    if (!trimmed) {
        return { isValid: false, error: 'Por favor ingresa tu correo electrónico.' };
    }
    if (!EMAIL_REGEX.test(trimmed)) {
        return { isValid: false, error: 'El correo electrónico no tiene un formato válido.' };
    }
    return { isValid: true, error: null };
}

/**
 * Valida presencia de una contraseña.
 */
export function validatePasswordRequired(
    password?: string,
    message = 'Por favor ingresa tu contraseña.'
): ValidationResult {
    if (!password) {
        return { isValid: false, error: message };
    }
    return { isValid: true, error: null };
}

/**
 * Valida la complejidad requerida de contraseña para registro (mínimo 8 caracteres, mayúscula, minúscula y número).
 */
export function validatePasswordStrength(password?: string): ValidationResult {
    if (
        !password ||
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
 * Valida los datos de inicio de sesión en el cliente (CA1-CA3).
 */
export function validateLoginInput(data: {
    email?: string;
    password?: string;
}): ValidationResult {
    const emailResult = validateEmail(data.email);
    if (!emailResult.isValid) return emailResult;

    const passwordResult = validatePasswordRequired(data.password, 'Por favor ingresa tu contraseña.');
    if (!passwordResult.isValid) return passwordResult;

    return { isValid: true, error: null };
}

/**
 * Valida los datos de registro de usuario en el cliente (CA1-CA4).
 */
export function validateRegisterInput(data: {
    name?: string;
    email?: string;
    password?: string;
}): ValidationResult {
    const nameResult = validateUsername(data.name);
    if (!nameResult.isValid) return nameResult;

    const emailResult = validateEmail(data.email);
    if (!emailResult.isValid) return emailResult;

    const passwordRequired = validatePasswordRequired(data.password, 'Por favor ingresa una contraseña.');
    if (!passwordRequired.isValid) return passwordRequired;

    const passwordStrength = validatePasswordStrength(data.password);
    if (!passwordStrength.isValid) return passwordStrength;

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
