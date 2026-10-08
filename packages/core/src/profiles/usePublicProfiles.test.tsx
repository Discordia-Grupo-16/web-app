// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PublicProfiles, PublicUser } from '@discordia/api';
import { PublicProfilesProvider, type PublicProfileSource } from './PublicProfilesProvider';
import { usePublicProfile, usePublicProfiles } from './usePublicProfiles';

const user = (id: string): PublicUser => ({ id, name: `Name ${id}`, avatarUrl: null, bio: null });

const setup = (getPublicProfiles: PublicProfileSource['getPublicProfiles']) => {
    const source: PublicProfileSource = { getPublicProfiles: vi.fn(getPublicProfiles), peekPublicProfile: () => undefined };
    const wrapper = ({ children }: { children: ReactNode }) => (
        <PublicProfilesProvider source={source}>{children}</PublicProfilesProvider>
    );
    return { source, wrapper };
};

const resolving = async (ids: string[]): Promise<PublicProfiles> => new Map(ids.map((id) => [id, user(id)]));

describe('usePublicProfiles', () => {
    it('resolves the profiles of the given ids', async () => {
        const { wrapper } = setup(resolving);

        const { result } = renderHook(() => usePublicProfiles(['a', 'b']), { wrapper });

        await waitFor(() => expect(result.current.get('a')).toEqual(user('a')));
        expect(result.current.get('b')).toEqual(user('b'));
    });

    it('keeps a null entry for accounts that are not available', async () => {
        const { wrapper } = setup(async (ids) => new Map(ids.map((id) => [id, null])));

        const { result } = renderHook(() => usePublicProfiles(['a']), { wrapper });

        await waitFor(() => expect(result.current.has('a')).toBe(true));
        expect(result.current.get('a')).toBeNull();
    });

    it('does not ask again when the same ids arrive in another array or order', async () => {
        const { source, wrapper } = setup(resolving);

        const { result, rerender } = renderHook(({ ids }) => usePublicProfiles(ids), {
            wrapper,
            initialProps: { ids: ['a', 'b'] },
        });
        await waitFor(() => expect(result.current.size).toBe(2));
        rerender({ ids: ['b', 'a', 'a'] });

        expect(source.getPublicProfiles).toHaveBeenCalledTimes(1);
    });

    it('asks again when a new author shows up and keeps the profiles already known', async () => {
        const { source, wrapper } = setup(resolving);

        const { result, rerender } = renderHook(({ ids }) => usePublicProfiles(ids), {
            wrapper,
            initialProps: { ids: ['a'] },
        });
        await waitFor(() => expect(result.current.has('a')).toBe(true));
        rerender({ ids: ['a', 'b'] });

        await waitFor(() => expect(result.current.has('b')).toBe(true));
        expect(source.getPublicProfiles).toHaveBeenLastCalledWith(['a', 'b']);
        expect(result.current.get('a')).toEqual(user('a'));
    });

    it('stays empty, without throwing, when the request fails', async () => {
        const { source, wrapper } = setup(async () => {
            throw new Error('network');
        });

        const { result } = renderHook(() => usePublicProfiles(['a']), { wrapper });

        await waitFor(() => expect(source.getPublicProfiles).toHaveBeenCalled());
        expect(result.current.size).toBe(0);
    });

    it('does not request anything without ids', () => {
        const { source, wrapper } = setup(resolving);

        renderHook(() => usePublicProfiles([]), { wrapper });

        expect(source.getPublicProfiles).not.toHaveBeenCalled();
    });

    it('throws a clear error outside the provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(() => renderHook(() => usePublicProfiles(['a']))).toThrow(/PublicProfilesProvider/);

        spy.mockRestore();
    });
});

describe('usePublicProfile', () => {
    it('goes from loading to ready', async () => {
        const { wrapper } = setup(resolving);

        const { result } = renderHook(() => usePublicProfile('a'), { wrapper });

        expect(result.current.state).toEqual({ status: 'loading' });
        await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', profile: user('a') }));
    });

    it('is ready with a null profile when the account is not available', async () => {
        const { wrapper } = setup(async () => new Map());

        const { result } = renderHook(() => usePublicProfile('a'), { wrapper });

        await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', profile: null }));
    });

    it('reports an error and recovers on retry', async () => {
        let fail = true;
        const { wrapper } = setup(async (ids) => {
            if (fail) throw new Error('network');
            return resolving(ids);
        });

        const { result } = renderHook(() => usePublicProfile('a'), { wrapper });
        await waitFor(() => expect(result.current.state).toEqual({ status: 'error' }));

        fail = false;
        act(() => result.current.retry());

        expect(result.current.state).toEqual({ status: 'loading' });
        await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', profile: user('a') }));
    });

    it('shows loading, not the previous profile, when the user changes', async () => {
        const { wrapper } = setup(resolving);

        const { result, rerender } = renderHook(({ id }) => usePublicProfile(id), { wrapper, initialProps: { id: 'a' } });
        await waitFor(() => expect(result.current.state.status).toBe('ready'));
        rerender({ id: 'b' });

        expect(result.current.state).toEqual({ status: 'loading' });
        await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', profile: user('b') }));
    });
});
