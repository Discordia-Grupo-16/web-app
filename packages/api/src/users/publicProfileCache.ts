import type { PublicProfiles, PublicUser } from './types';

export const PUBLIC_PROFILE_TTL_MS = 5 * 60 * 1000;
// GET /users?ids= accepts at most 100 ids (identity contract).
export const MAX_PROFILES_PER_REQUEST = 100;

interface PublicProfileCacheOptions {
    fetchBatch: (ids: string[]) => Promise<PublicUser[]>;
    ttlMs?: number;
    maxBatchSize?: number;
    now?: () => number;
}

interface CacheEntry {
    profile: PublicUser | null;
    expiresAt: number;
}

interface QueuedLookup {
    id: string;
    promise: Promise<PublicUser | null>;
    resolve: (profile: PublicUser | null) => void;
    reject: (error: unknown) => void;
}

export const createPublicProfileCache = ({
    fetchBatch,
    ttlMs = PUBLIC_PROFILE_TTL_MS,
    maxBatchSize = MAX_PROFILES_PER_REQUEST,
    now = Date.now,
}: PublicProfileCacheOptions) => {
    const entries = new Map<string, CacheEntry>();
    const inFlight = new Map<string, Promise<PublicUser | null>>();
    let queue: QueuedLookup[] = [];

    const fetchChunk = async (chunk: QueuedLookup[]) => {
        // An invalidated id no longer owns its in-flight slot: its response still reaches whoever
        // was waiting, but it must not repopulate the cache with a stale profile.
        const owns = ({ id, promise }: QueuedLookup) => inFlight.get(id) === promise;
        try {
            const profiles = await fetchBatch(chunk.map(({ id }) => id));
            const byId = new Map(profiles.map((profile) => [profile.id, profile]));
            for (const lookup of chunk) {
                const profile = byId.get(lookup.id) ?? null;
                if (owns(lookup)) {
                    entries.set(lookup.id, { profile, expiresAt: now() + ttlMs });
                    inFlight.delete(lookup.id);
                }
                lookup.resolve(profile);
            }
        } catch (error) {
            for (const lookup of chunk) {
                if (owns(lookup)) inFlight.delete(lookup.id);
                lookup.reject(error);
            }
        }
    };

    // Lookups made in the same tick (a message list asking for every author) go out together.
    const flush = () => {
        const pending = queue;
        queue = [];
        for (let start = 0; start < pending.length; start += maxBatchSize) {
            void fetchChunk(pending.slice(start, start + maxBatchSize));
        }
    };

    const enqueue = (id: string): Promise<PublicUser | null> => {
        let resolve!: QueuedLookup['resolve'];
        let reject!: QueuedLookup['reject'];
        const promise = new Promise<PublicUser | null>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        inFlight.set(id, promise);
        queue.push({ id, promise, resolve, reject });
        if (queue.length === 1) void Promise.resolve().then(flush);
        return promise;
    };

    const invalidate = (id: string) => {
        entries.delete(id);
        inFlight.delete(id);
    };

    const resolveOne = (id: string): Promise<PublicUser | null> => {
        const cached = entries.get(id);
        if (cached && cached.expiresAt > now()) return Promise.resolve(cached.profile);
        return inFlight.get(id) ?? enqueue(id);
    };

    return {
        // fresh: skip what is cached (or in flight) and ask again. The profile view uses it, so
        // opening a profile never shows a bio or avatar that changed within the TTL.
        async get(ids: string[], { fresh = false }: { fresh?: boolean } = {}): Promise<PublicProfiles> {
            const unique = [...new Set(ids)];
            if (fresh) unique.forEach(invalidate);
            const profiles = await Promise.all(unique.map(resolveOne));
            return new Map(unique.map((id, index) => [id, profiles[index]]));
        },

        // Synchronous read for rendering: undefined means "not loaded (or expired)", null means
        // "not available".
        peek(id: string): PublicUser | null | undefined {
            const cached = entries.get(id);
            return cached && cached.expiresAt > now() ? cached.profile : undefined;
        },

        invalidate,

        clear() {
            entries.clear();
            inFlight.clear();
        },
    };
};

export type PublicProfileCache = ReturnType<typeof createPublicProfileCache>;
