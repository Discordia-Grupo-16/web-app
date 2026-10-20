import { describe, expect, it, vi } from 'vitest';
import { createPublicProfileCache, MAX_PROFILES_PER_REQUEST, PUBLIC_PROFILE_TTL_MS } from './publicProfileCache';
import type { PublicUser } from './types';

const profile = (id: string): PublicUser => ({ id, name: `Name ${id}`, avatarUrl: null, bio: null });

const setup = () => {
    let time = 0;
    const fetchBatch = vi.fn(async (ids: string[]) => ids.map(profile));
    const cache = createPublicProfileCache({ fetchBatch, now: () => time });
    return { cache, fetchBatch, advance: (ms: number) => { time += ms; } };
};

describe('createPublicProfileCache', () => {
    it('resolves every requested id with one request', async () => {
        const { cache, fetchBatch } = setup();

        const profiles = await cache.get(['a', 'b', 'c']);

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['a', 'b', 'c']);
        expect(profiles.get('b')).toEqual(profile('b'));
    });

    it('does not repeat an id within the same call', async () => {
        const { cache, fetchBatch } = setup();

        await cache.get(['a', 'a', 'b']);

        expect(fetchBatch).toHaveBeenCalledWith(['a', 'b']);
    });

    it('does not call the API for an empty lookup', async () => {
        const { cache, fetchBatch } = setup();

        const profiles = await cache.get([]);

        expect(profiles.size).toBe(0);
        expect(fetchBatch).not.toHaveBeenCalled();
    });

    it('groups lookups made in the same tick into one request', async () => {
        const { cache, fetchBatch } = setup();

        await Promise.all([cache.get(['a']), cache.get(['b']), cache.get(['c'])]);

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['a', 'b', 'c']);
    });

    it('does not ask again for ids that are already being requested', async () => {
        const { cache, fetchBatch } = setup();

        const first = cache.get(['a', 'b']);
        await Promise.resolve();
        const second = cache.get(['b', 'c']);
        await Promise.all([first, second]);

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenNthCalledWith(1, ['a', 'b']);
        expect(fetchBatch).toHaveBeenNthCalledWith(2, ['c']);
    });

    it('splits a large lookup into requests of at most the batch size', async () => {
        const { cache, fetchBatch } = setup();
        const ids = Array.from({ length: MAX_PROFILES_PER_REQUEST * 2 + 1 }, (_, i) => `id-${i}`);

        const profiles = await cache.get(ids);

        expect(fetchBatch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 1]);
        expect(profiles.size).toBe(ids.length);
    });

    it('serves from the cache until the TTL expires', async () => {
        const { cache, fetchBatch, advance } = setup();
        await cache.get(['a']);

        advance(PUBLIC_PROFILE_TTL_MS - 1);
        await cache.get(['a']);
        expect(fetchBatch).toHaveBeenCalledTimes(1);

        advance(1);
        await cache.get(['a']);
        expect(fetchBatch).toHaveBeenCalledTimes(2);
    });

    it('asks again for a cached id when the lookup is fresh, and keeps the new profile', async () => {
        const { cache, fetchBatch } = setup();
        await cache.get(['a']);
        fetchBatch.mockResolvedValueOnce([{ ...profile('a'), bio: 'new bio' }]);

        const profiles = await cache.get(['a'], { fresh: true });

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(profiles.get('a')?.bio).toBe('new bio');
        expect(cache.peek('a')?.bio).toBe('new bio');
        expect((await cache.get(['a'])).get('a')?.bio).toBe('new bio');
        expect(fetchBatch).toHaveBeenCalledTimes(2);
    });

    it('marks ids missing from the response as not available and caches that too', async () => {
        const { cache, fetchBatch } = setup();
        fetchBatch.mockResolvedValueOnce([profile('a')]);

        const profiles = await cache.get(['a', 'suspended']);
        await cache.get(['suspended']);

        expect(profiles.get('suspended')).toBeNull();
        expect(cache.peek('suspended')).toBeNull();
        expect(fetchBatch).toHaveBeenCalledTimes(1);
    });

    it('rejects the lookup and caches nothing when the request fails', async () => {
        const { cache, fetchBatch } = setup();
        fetchBatch.mockRejectedValueOnce(new Error('Network Error'));

        await expect(cache.get(['a'])).rejects.toThrow('Network Error');
        expect(cache.peek('a')).toBeUndefined();

        const profiles = await cache.get(['a']);
        expect(profiles.get('a')).toEqual(profile('a'));
    });

    it('peek returns undefined for ids that were never loaded', () => {
        expect(setup().cache.peek('a')).toBeUndefined();
    });

    it('invalidate forces the next lookup to ask again', async () => {
        const { cache, fetchBatch } = setup();
        await cache.get(['a']);

        cache.invalidate('a');
        expect(cache.peek('a')).toBeUndefined();
        await cache.get(['a']);

        expect(fetchBatch).toHaveBeenCalledTimes(2);
    });

    it('does not cache a response that arrived after the id was invalidated', async () => {
        const { cache, fetchBatch } = setup();
        let release!: (profiles: PublicUser[]) => void;
        fetchBatch.mockReturnValueOnce(new Promise<PublicUser[]>((resolve) => { release = resolve; }));

        const pending = cache.get(['a']);
        await Promise.resolve();
        await Promise.resolve();
        cache.invalidate('a');
        release([{ ...profile('a'), name: 'Old name' }]);

        expect((await pending).get('a')?.name).toBe('Old name');
        expect(cache.peek('a')).toBeUndefined();
    });

    it('clear drops every entry', async () => {
        const { cache } = setup();
        await cache.get(['a', 'b']);

        cache.clear();

        expect(cache.peek('a')).toBeUndefined();
        expect(cache.peek('b')).toBeUndefined();
    });
});
