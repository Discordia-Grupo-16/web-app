import { describe, expect, it } from 'vitest';
import {
    ADMINISTRATOR,
    BAN_MEMBERS,
    CONNECT,
    KICK_MEMBERS,
    MANAGE_CHANNELS,
    MANAGE_ROLES,
    MANAGE_SERVER,
    NONE,
    SEND_MESSAGES,
    VIEW_CHANNEL,
} from '../permissions/permissions';
import { VOICE_JOIN_PERMISSIONS, canJoinVoice } from './permissions';

// Así llega un administrador o el owner: community expande todos los bits.
const EVERY_PERMISSION =
    VIEW_CHANNEL |
    SEND_MESSAGES |
    CONNECT |
    MANAGE_CHANNELS |
    MANAGE_ROLES |
    KICK_MEMBERS |
    BAN_MEMBERS |
    MANAGE_SERVER |
    ADMINISTRATOR;

describe('canJoinVoice (CA2 de SCRUM-51, Unirse a canal de voz de servidor)', () => {
    it.each([
        ['VIEW_CHANNEL y CONNECT', VIEW_CHANNEL | CONNECT, true],
        ['solo VIEW_CHANNEL', VIEW_CHANNEL, false],
        ['solo CONNECT', CONNECT, false],
        ['ningún permiso', NONE, false],
        ['bits de más', VIEW_CHANNEL | SEND_MESSAGES | CONNECT, true],
        ['todos los bits', EVERY_PERMISSION, true],
    ])('con %s', (_label, permissions, expected) => {
        expect(canJoinVoice(permissions)).toBe(expected);
    });

    it('pide VIEW_CHANNEL y CONNECT', () => {
        expect(VOICE_JOIN_PERMISSIONS).toBe(VIEW_CHANNEL | CONNECT);
    });
});
