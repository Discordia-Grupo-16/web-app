// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createSessionExpirySignal, type AuthStorageStrategy, type User } from '@discordia/api';
import { AuthProvider, useAuth } from './AuthProvider';

const felipe = { id: '1', name: 'Felipe' } as User;

const setup = () => {
    let token: string | null = 't';
    let user: unknown = felipe;
    const storage: AuthStorageStrategy = {
        getToken: async () => token,
        setToken: async (value) => { token = value; },
        getUser: async <T,>() => user as T | null,
        setUser: async (value) => { user = value; },
        clearSession: vi.fn(async () => { token = null; user = null; }),
    };
    const onSignOut = vi.fn(async () => undefined);
    const sessionExpiry = createSessionExpirySignal();
    const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider storage={storage} onSignOut={onSignOut} sessionExpiry={sessionExpiry}>
            {children}
        </AuthProvider>
    );
    return { storage, onSignOut, sessionExpiry, wrapper };
};

const loadedSession = async (wrapper: ReturnType<typeof setup>['wrapper']) => {
    const hook = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(hook.result.current.user).toEqual(felipe));
    return hook;
};

describe('AuthProvider session expiry', () => {
    it('drops the local session when the server rejects it, without calling the backend', async () => {
        const { storage, onSignOut, sessionExpiry, wrapper } = setup();
        const { result } = await loadedSession(wrapper);

        act(() => sessionExpiry.notify());

        await waitFor(() => expect(result.current.user).toBeNull());
        expect(result.current.token).toBeNull();
        expect(storage.clearSession).toHaveBeenCalled();
        expect(onSignOut).not.toHaveBeenCalled();
    });

    it('does not mark an expired session as closed by the user', async () => {
        const { sessionExpiry, wrapper } = setup();
        const { result } = await loadedSession(wrapper);

        act(() => sessionExpiry.notify());

        await waitFor(() => expect(result.current.user).toBeNull());
        expect(result.current.signedOutByUser).toBe(false);
    });

    it('marks a deliberate sign out, and clears the mark on the next sign in', async () => {
        const { onSignOut, wrapper } = setup();
        const { result } = await loadedSession(wrapper);

        await act(() => result.current.signOut());

        expect(onSignOut).toHaveBeenCalledTimes(1);
        expect(result.current.user).toBeNull();
        expect(result.current.signedOutByUser).toBe(true);

        await act(() => result.current.signIn('t2', felipe));

        expect(result.current.signedOutByUser).toBe(false);
        expect(result.current.user).toEqual(felipe);
    });

    it('unsubscribes from the expiry signal when it unmounts', async () => {
        const { storage } = setup();
        const unsubscribe = vi.fn();
        const sessionExpiry = { subscribe: vi.fn(() => unsubscribe) };
        const wrapper = ({ children }: { children: ReactNode }) => (
            <AuthProvider storage={storage} sessionExpiry={sessionExpiry}>
                {children}
            </AuthProvider>
        );
        const { unmount } = await loadedSession(wrapper);
        expect(sessionExpiry.subscribe).toHaveBeenCalledTimes(1);

        unmount();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
