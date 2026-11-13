import { describe, expect, it } from 'vitest';
import { classifyOwnershipError } from './errors';
import type { OwnershipAction, OwnershipFailure } from './types';

// What axios rejects with: a response when the server answered, none when the request never got one.
const httpError = (status: number) => ({ isAxiosError: true, response: { status } });
const noResponse = { isAxiosError: true, response: undefined };

const cases: Array<[OwnershipAction, number | 'no response', OwnershipFailure]> = [
    ['propose', 403, 'not-owner'],
    ['propose', 404, 'server-gone'],
    ['propose', 409, 'conflict'],
    ['propose', 422, 'not-member'],
    ['propose', 'no response', 'network'],
    ['propose', 500, 'service'],
    ['cancel', 403, 'not-owner'],
    ['cancel', 404, 'server-gone'],
    ['cancel', 'no response', 'network'],
    ['cancel', 502, 'service'],
    ['accept', 403, 'unavailable'],
    ['accept', 404, 'gone-or-unavailable'],
    ['accept', 'no response', 'network'],
    ['accept', 503, 'service'],
    ['reject', 403, 'unavailable'],
    ['reject', 404, 'server-gone'],
    ['reject', 'no response', 'network'],
    ['reject', 504, 'service'],
];

describe('classifyOwnershipError', () => {
    it.each(cases)('%s answered with %s is %s', (action, status, expected) => {
        const error = status === 'no response' ? noResponse : httpError(status);

        expect(classifyOwnershipError(error, action)).toBe(expected);
    });

    it('treats an error that is not an HTTP error as a service failure', () => {
        expect(classifyOwnershipError(new Error('boom'), 'propose')).toBe('service');
    });

    it('treats a status the action does not expect as a service failure', () => {
        expect(classifyOwnershipError(httpError(409), 'cancel')).toBe('service');
    });
});
