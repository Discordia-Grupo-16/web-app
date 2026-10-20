import { beforeEach, describe, expect, it } from 'vitest';
import {
    backofficeAuthStorage,
    REFRESH_TOKEN_KEY,
    TOKEN_KEY,
    USER_KEY,
} from './authStorage';

const WEB_KEYS = ['discordia_token', 'discordia_refresh_token', 'discordia_user'];

describe('backofficeAuthStorage', () => {
    beforeEach(() => localStorage.clear());

    it('uses the discordia_backoffice_* keys', () => {
        expect([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]).toEqual([
            'discordia_backoffice_token',
            'discordia_backoffice_refresh_token',
            'discordia_backoffice_user',
        ]);
    });

    it('stores and reads the session under its own keys', async () => {
        await backofficeAuthStorage.setToken('access');
        await backofficeAuthStorage.setRefreshToken!('refresh');
        await backofficeAuthStorage.setUser({ id: 'u1' });

        expect(localStorage.getItem(TOKEN_KEY)).toBe('access');
        expect(await backofficeAuthStorage.getToken()).toBe('access');
        expect(await backofficeAuthStorage.getRefreshToken!()).toBe('refresh');
        expect(await backofficeAuthStorage.getUser()).toEqual({ id: 'u1' });
    });

    it('never touches the keys of the web app', async () => {
        WEB_KEYS.forEach((key) => localStorage.setItem(key, 'web'));

        await backofficeAuthStorage.setToken('access');
        await backofficeAuthStorage.clearSession();

        WEB_KEYS.forEach((key) => expect(localStorage.getItem(key)).toBe('web'));
    });

    it('clearSession removes the three backoffice keys', async () => {
        await backofficeAuthStorage.setToken('access');
        await backofficeAuthStorage.setRefreshToken!('refresh');
        await backofficeAuthStorage.setUser({ id: 'u1' });

        await backofficeAuthStorage.clearSession();

        expect(localStorage.length).toBe(0);
    });
});
