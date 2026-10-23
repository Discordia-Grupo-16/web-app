import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeLoginNotice, setLoginNotice } from './loginNotice';

afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
});

describe('loginNotice', () => {
    it('stores a notice and consumes it once', () => {
        setLoginNotice('hola');

        expect(consumeLoginNotice()).toBe('hola');
        expect(consumeLoginNotice()).toBeNull();
    });

    it('returns null when nothing was stored', () => {
        expect(consumeLoginNotice()).toBeNull();
    });

    it('does not throw when sessionStorage throws on write', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        expect(() => setLoginNotice('hola')).not.toThrow();
    });

    it('does not throw and returns null when sessionStorage throws on read', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        expect(consumeLoginNotice()).toBeNull();
    });

    it('still returns the notice when only the delete throws', () => {
        setLoginNotice('hola');
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        expect(consumeLoginNotice()).toBe('hola');
    });
});
