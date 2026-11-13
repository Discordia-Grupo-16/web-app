import type { Role, ServerMember } from '@discordia/api';
import { describe, expect, it } from 'vitest';
import { ADMINISTRATOR, KICK_MEMBERS, MANAGE_ROLES, NONE } from '../permissions/permissions';
import { canOfferRoleDeletion, roleDeletionBlocker, rolesOfMember } from './deletion';
import type { RoleDeletionActor } from './types';

const role = (id: string, position: number, permissions = NONE, isDefault = false): Role => ({
    id,
    server_id: 'srv',
    name: id,
    is_default: isDefault,
    permissions,
    permission_names: [],
    position,
    created_at: '2026-10-01T00:00:00Z',
});

const mine = role('mine', 5, MANAGE_ROLES);
const below = role('below', 2);
const actor = (overrides: Partial<RoleDeletionActor> = {}): RoleDeletionActor => ({
    isOwner: false,
    permissions: MANAGE_ROLES,
    roles: [mine],
    ...overrides,
});

describe('canOfferRoleDeletion', () => {
    it('is not offered without MANAGE_ROLES', () => {
        expect(canOfferRoleDeletion(below, actor({ permissions: KICK_MEMBERS }))).toBe(false);
    });

    it('is offered with ADMINISTRATOR, which arrives with every bit set', () => {
        expect(canOfferRoleDeletion(below, actor({ permissions: ~0 & 0x1ff }))).toBe(true);
    });

    it('is offered on a role below the highest role of whoever deletes', () => {
        expect(canOfferRoleDeletion(below, actor())).toBe(true);
    });

    it.each([
        ['at the same position', 5],
        ['above', 6],
    ])('is not offered on a role %s', (_, position) => {
        expect(canOfferRoleDeletion(role('x', position), actor())).toBe(false);
    });

    it('is always offered to the owner', () => {
        expect(canOfferRoleDeletion(role('x', 99), actor({ isOwner: true, roles: [] }))).toBe(true);
    });

    it('is not offered while the roles of whoever deletes have not loaded', () => {
        expect(canOfferRoleDeletion(below, actor({ roles: [] }))).toBe(false);
    });

    it('is offered on the default role and on the only source of ADMINISTRATOR, which explain why', () => {
        const admin = role('admin', 3, ADMINISTRATOR);
        const withAdmin = actor({ roles: [mine, admin] });

        expect(canOfferRoleDeletion(role('everyone', 0, NONE, true), withAdmin)).toBe(true);
        expect(canOfferRoleDeletion(admin, withAdmin)).toBe(true);
    });
});

describe('roleDeletionBlocker', () => {
    it('blocks the default role', () => {
        expect(roleDeletionBlocker(role('everyone', 0, NONE, true), actor())).toBe('default-role');
    });

    it('blocks the default role first, even when it is also the only source of ADMINISTRATOR', () => {
        const defaultAdmin = role('everyone', 0, ADMINISTRATOR, true);

        expect(roleDeletionBlocker(defaultAdmin, actor({ roles: [mine, defaultAdmin] }))).toBe('default-role');
    });

    it('blocks the only role that gives ADMINISTRATOR to whoever deletes', () => {
        const admin = role('admin', 3, ADMINISTRATOR);

        expect(roleDeletionBlocker(admin, actor({ roles: [mine, admin] }))).toBe('sole-admin');
    });

    it('does not block it when another role of theirs also gives ADMINISTRATOR', () => {
        const admin = role('admin', 3, ADMINISTRATOR);
        const other = role('other', 4, ADMINISTRATOR);

        expect(roleDeletionBlocker(admin, actor({ roles: [mine, admin, other] }))).toBeNull();
    });

    it('does not block a role with ADMINISTRATOR that whoever deletes does not have', () => {
        expect(roleDeletionBlocker(role('admin', 3, ADMINISTRATOR), actor())).toBeNull();
    });

    it('never blocks the owner because of ADMINISTRATOR', () => {
        const admin = role('admin', 3, ADMINISTRATOR);

        expect(roleDeletionBlocker(admin, actor({ isOwner: true, roles: [admin] }))).toBeNull();
    });

    it('does not block an ordinary role', () => {
        expect(roleDeletionBlocker(below, actor())).toBeNull();
    });
});

describe('rolesOfMember', () => {
    const members: ServerMember[] = [
        { user_id: 'ana', joined_at: '2026-10-01T00:00:00Z', roles: [mine] },
        { user_id: 'beto', joined_at: '2026-10-01T00:00:00Z', roles: [] },
    ];

    it('returns the roles of the member', () => {
        expect(rolesOfMember(members, 'ana')).toEqual([mine]);
    });

    it('is empty when the user is not in the list', () => {
        expect(rolesOfMember(members, 'caro')).toEqual([]);
    });

    it('is empty without a user', () => {
        expect(rolesOfMember(members, undefined)).toEqual([]);
    });
});
