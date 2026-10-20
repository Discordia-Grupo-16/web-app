import { describe, expect, it } from 'vitest';
import type { User } from '@discordia/api';
import { isStaff } from './isStaff';

const userWithRole = (role: string): User => ({ id: '1', email: 'a@b.com', name: 'Ana', role });

describe('isStaff', () => {
    it.each([
        ['staff', userWithRole('staff'), true],
        ['user', userWithRole('user'), false],
        ['an empty role', userWithRole(''), false],
        ['a different case', userWithRole('Staff'), false],
        ['no user', null, false],
    ])('with %s returns %s', (_label, user, expected) => {
        expect(isStaff(user)).toBe(expected);
    });
});
