import { describe, expect, it } from 'vitest';
import { deleteErrorText, editErrorText } from './errorMessages';

const httpError = (status: number) => Object.assign(new Error('http'), { response: { status } });

describe('editErrorText', () => {
    it.each([
        [400, 'El mensaje no es válido.'],
        [403, 'No tenés permiso para editar este mensaje.'],
        [404, 'Este mensaje ya no existe.'],
        [500, 'No se pudo editar el mensaje.'],
    ])('explains an HTTP %i', (status, text) => {
        expect(editErrorText(httpError(status))).toBe(text);
    });

    it('falls back to the generic text when there is no HTTP answer (network down) or no error at all', () => {
        expect(editErrorText(new Error('Network Error'))).toBe('No se pudo editar el mensaje.');
        expect(editErrorText(null)).toBe('No se pudo editar el mensaje.');
        expect(editErrorText(undefined)).toBe('No se pudo editar el mensaje.');
    });
});

describe('deleteErrorText', () => {
    it.each([
        [403, 'No tenés permiso para eliminar este mensaje.'],
        [404, 'Este mensaje ya no existe.'],
        [500, 'No se pudo eliminar el mensaje.'],
    ])('explains an HTTP %i', (status, text) => {
        expect(deleteErrorText(httpError(status))).toBe(text);
    });

    it('falls back to the generic text without an HTTP answer', () => {
        expect(deleteErrorText(new Error('Network Error'))).toBe('No se pudo eliminar el mensaje.');
        expect(deleteErrorText(null)).toBe('No se pudo eliminar el mensaje.');
    });
});
