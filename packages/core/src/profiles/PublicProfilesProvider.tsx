import { createContext, useContext, type ReactNode } from 'react';
import type { PublicProfiles, PublicUser } from '@discordia/api';

// The slice of the user service the hooks need: the app hands over its single userService, so the
// cache is shared by every screen.
export interface PublicProfileSource {
    getPublicProfiles: (ids: string[], options?: { fresh?: boolean }) => Promise<PublicProfiles>;
    peekPublicProfile: (id: string) => PublicUser | null | undefined;
}

const PublicProfilesContext = createContext<PublicProfileSource | undefined>(undefined);

export const PublicProfilesProvider = ({ source, children }: { source: PublicProfileSource; children: ReactNode }) => (
    <PublicProfilesContext.Provider value={source}>{children}</PublicProfilesContext.Provider>
);

export const usePublicProfileSource = (): PublicProfileSource => {
    const source = useContext(PublicProfilesContext);
    if (!source) throw new Error('usePublicProfiles must be used inside a PublicProfilesProvider');
    return source;
};
