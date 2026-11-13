import { describe, expect, it } from 'vitest';
import { classifyRoleDeletionError } from './errors';
import type { RoleDeletionFailure } from './types';

// What axios rejects with: a response when the server answered, none when the request never got one.
const httpError = (status: number) => ({ isAxiosError: true, response: { status } });
const noResponse = { isAxiosError: true, response: undefined };

describe('classifyRoleDeletionError', () => {
    it.each<[string, unknown, RoleDeletionFailure]>([
        ['403', httpError(403), 'rejected'],
        ['409', httpError(409), 'rejected'],
        ['404', httpError(404), 'gone'],
        ['no response', noResponse, 'network'],
        ['500', httpError(500), 'service'],
        ['503', httpError(503), 'service'],
        ['not an axios error', new Error('boom'), 'service'],
    ])('%s is %s', (_, error, expected) => {
        expect(classifyRoleDeletionError(error)).toBe(expected);
    });
});
