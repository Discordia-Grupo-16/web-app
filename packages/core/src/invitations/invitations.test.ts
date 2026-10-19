import { describe, expect, it } from 'vitest';
import { buildInviteUrl, invitationErrorMessage, parseInviteCode } from './invitations';

describe('buildInviteUrl', () => {
    it('joins the base url and the code', () => {
        expect(buildInviteUrl('http://localhost:5173', 'abc123')).toBe('http://localhost:5173/invite/abc123');
    });

    it('drops the trailing slash of the base url', () => {
        expect(buildInviteUrl('https://discordia.app/', 'abc123')).toBe('https://discordia.app/invite/abc123');
    });
});

describe('parseInviteCode', () => {
    it.each([
        ['a bare code', 'abc123', 'abc123'],
        ['a bare code with surrounding spaces', '  abc123 \n', 'abc123'],
        ['an http link', 'http://localhost:5173/invite/abc123', 'abc123'],
        ['an https link with trailing slash', 'https://discordia.app/invite/abc123/', 'abc123'],
        ['a link with surrounding spaces', '  https://discordia.app/invite/abc123  ', 'abc123'],
        ['a link with a query string', 'https://discordia.app/invite/abc123?ref=x', 'abc123'],
        ['a deep link', 'discordia://invite/abc123', 'abc123'],
    ])('extracts the code from %s', (_label, input, code) => {
        expect(parseInviteCode(input)).toBe(code);
    });

    it.each([
        ['empty text', ''],
        ['only spaces', '   '],
        ['a link without code', 'https://discordia.app/invite/'],
        ['a link to another path', 'https://discordia.app/servers/abc123'],
        ['a deep link without code', 'discordia://invite/'],
        ['text with spaces inside', 'hola que tal'],
    ])('returns null for %s', (_label, input) => {
        expect(parseInviteCode(input)).toBeNull();
    });
});

describe('invitationErrorMessage', () => {
    it.each([
        [404, 'La invitación no existe.'],
        [410, 'Esta invitación ya no es válida (expirada o sin usos disponibles).'],
        [403, 'No podés unirte a este servidor.'],
    ])('maps %i', (status, message) => {
        expect(invitationErrorMessage(status)).toBe(message);
    });

    it('falls back to the generic message', () => {
        expect(invitationErrorMessage(500)).toBe('Ocurrió un error al procesar la invitación.');
        expect(invitationErrorMessage()).toBe('Ocurrió un error al procesar la invitación.');
    });
});
