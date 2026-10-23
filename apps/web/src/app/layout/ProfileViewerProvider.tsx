import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { PublicProfileModal } from '@/features/profile';
import { ProfileViewerContext } from '@/shared/profile/ProfileViewerContext';

// Owns the open public profile, so a click on an author anywhere in the layout shows the same modal.
export const ProfileViewerProvider = ({ children }: { children: ReactNode }) => {
    const [userId, setUserId] = useState<string | null>(null);
    const closeProfile = useCallback(() => setUserId(null), []);
    const viewer = useMemo(() => ({ openProfile: setUserId }), []);

    return (
        <ProfileViewerContext.Provider value={viewer}>
            {children}
            {userId && <PublicProfileModal userId={userId} onClose={closeProfile} />}
        </ProfileViewerContext.Provider>
    );
};
