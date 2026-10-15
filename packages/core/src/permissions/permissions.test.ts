import { describe, expect, it } from 'vitest';
import {
    ADMINISTRATOR,
    BAN_MEMBERS,
    MANAGE_ROLES,
    PERMISSION_BY_NAME,
    PERMISSION_HINT,
    PERMISSION_LABEL,
    PERMISSION_ORDER,
    SEND_MESSAGES,
    VIEW_CHANNEL,
    fromPermissionNames,
    hasPermission,
    togglePermission,
    toPermissionNames,
} from './permissions';

describe('the permission table', () => {
    it('repeats no bit', () => {
        const values = Object.values(PERMISSION_BY_NAME);
        expect(new Set(values).size).toBe(values.length);
    });

    it('matches the values the backend uses', () => {
        // If one of them shifts, the front end silently stops understanding
        // what arrives: that is why they are pinned on both sides.
        expect(VIEW_CHANNEL).toBe(1);
        expect(SEND_MESSAGES).toBe(2);
        expect(ADMINISTRATOR).toBe(256);
    });

    it('has a label, a hint and a position for every permission', () => {
        const names = Object.keys(PERMISSION_BY_NAME);
        expect(PERMISSION_ORDER).toHaveLength(names.length);
        for (const name of names) {
            expect(PERMISSION_LABEL).toHaveProperty(name);
            expect(PERMISSION_HINT).toHaveProperty(name);
        }
    });
});

describe('hasPermission', () => {
    it('recognises the granted permission and only that one', () => {
        expect(hasPermission(VIEW_CHANNEL, VIEW_CHANNEL)).toBe(true);
        expect(hasPermission(VIEW_CHANNEL, SEND_MESSAGES)).toBe(false);
    });

    it('requires every bit it is asked for', () => {
        expect(hasPermission(VIEW_CHANNEL, VIEW_CHANNEL | SEND_MESSAGES)).toBe(false);
        expect(hasPermission(VIEW_CHANNEL | SEND_MESSAGES, VIEW_CHANNEL | SEND_MESSAGES)).toBe(true);
    });

    it('grants nothing without permissions', () => {
        expect(hasPermission(0, VIEW_CHANNEL)).toBe(false);
    });

    it('does not infer ADMINISTRATOR: the backend sends it expanded', () => {
        // Checking it here would mean having the same rule in two places. A
        // real administrator arrives with every bit set.
        expect(hasPermission(ADMINISTRATOR, BAN_MEMBERS)).toBe(false);
        expect(hasPermission(511, BAN_MEMBERS)).toBe(true);
    });
});

describe('names', () => {
    it('round-trips without losing anything', () => {
        const mask = VIEW_CHANNEL | MANAGE_ROLES;
        expect(fromPermissionNames(toPermissionNames(mask))).toBe(mask);
    });

    it('returns the names in display order', () => {
        expect(toPermissionNames(MANAGE_ROLES | VIEW_CHANNEL)).toEqual([
            'VIEW_CHANNEL',
            'MANAGE_ROLES',
        ]);
    });

    it('ignores a name it does not know', () => {
        // It comes from the backend: a new permission must not break an old
        // screen, it just does not show up.
        expect(fromPermissionNames(['VIEW_CHANNEL', 'FLY'])).toBe(VIEW_CHANNEL);
    });

    it('returns an empty list without permissions', () => {
        expect(toPermissionNames(0)).toEqual([]);
    });
});

describe('togglePermission', () => {
    it('adds and removes the permission without touching the others', () => {
        const mask = VIEW_CHANNEL | SEND_MESSAGES;

        expect(togglePermission(mask, MANAGE_ROLES, true)).toBe(mask | MANAGE_ROLES);
        expect(togglePermission(mask, SEND_MESSAGES, false)).toBe(VIEW_CHANNEL);
    });

    it('is idempotent', () => {
        expect(togglePermission(VIEW_CHANNEL, VIEW_CHANNEL, true)).toBe(VIEW_CHANNEL);
        expect(togglePermission(VIEW_CHANNEL, SEND_MESSAGES, false)).toBe(VIEW_CHANNEL);
    });
});
