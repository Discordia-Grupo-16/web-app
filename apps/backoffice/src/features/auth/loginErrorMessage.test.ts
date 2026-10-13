import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from './loginErrorMessage';

const withStatus = (status: number, data: unknown = {}) =>
    new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as AxiosResponse);

describe('loginErrorMessage', () => {
    it.each([
        [401, 'Email o contraseña incorrectos.'],
        [403, 'Esta cuenta está suspendida.'],
        [429, 'Demasiados intentos. Probá de nuevo en unos minutos.'],
    ])('maps %s to its message', (status, message) => {
        expect(loginErrorMessage(withStatus(status))).toBe(message);
    });

    it('reports a connection problem when there is no response', () => {
        expect(loginErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(
            'No se pudo conectar con el servidor.',
        );
    });

    it('falls back to the detail of the response for any other status', () => {
        expect(loginErrorMessage(withStatus(500, { detail: 'Boom' }))).toBe('Boom');
    });

    it('falls back to the generic message for anything that is not an Axios error', () => {
        expect(loginErrorMessage(new Error('Algo falló'))).toBe('Algo falló');
        expect(loginErrorMessage('???')).toBe('Ocurrió un error inesperado. Intente nuevamente.');
    });
});
