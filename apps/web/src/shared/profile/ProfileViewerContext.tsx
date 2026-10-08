import { createContext, useContext } from 'react';

// Lets any feature open the public profile of a user without importing the profile feature:
// src/app mounts the modal and provides this.
interface ProfileViewer {
    openProfile: (userId: string) => void;
}

export const ProfileViewerContext = createContext<ProfileViewer | undefined>(undefined);

export const useProfileViewer = (): ProfileViewer => {
    const viewer = useContext(ProfileViewerContext);
    if (!viewer) throw new Error('useProfileViewer must be used inside a ProfileViewerProvider');
    return viewer;
};
