import { describe, expect, it } from 'vitest';
import { getErrorDetail, isGoneError } from './errors';

const httpError = (status: number, detail?: unknown) => ({ response: { status, data: { detail } } });

describe('getErrorDetail', () => {
    it('returns a string detail as is', () => {
        expect(getErrorDetail(httpError(400, 'Nombre inválido'))).toBe('Nombre inválido');
    });

    it('joins the messages of a validation error list', () => {
        const detail = [{ msg: 'name es obligatorio' }, { msg: 'type no es válido' }];
        expect(getErrorDetail(httpError(422, detail))).toBe('name es obligatorio, type no es válido');
    });

    it('returns undefined when there is no usable detail', () => {
        expect(getErrorDetail(httpError(500))).toBeUndefined();
        expect(getErrorDetail(httpError(500, { nested: true }))).toBeUndefined();
        expect(getErrorDetail(new Error('Network Error'))).toBeUndefined();
        expect(getErrorDetail(null)).toBeUndefined();
    });
});

describe('isGoneError', () => {
    it.each([404, 403])('is true for %i', (status) => {
        expect(isGoneError(httpError(status))).toBe(true);
    });

    it('is false for other statuses and for network errors', () => {
        expect(isGoneError(httpError(500))).toBe(false);
        expect(isGoneError(new Error('Network Error'))).toBe(false);
    });
});
