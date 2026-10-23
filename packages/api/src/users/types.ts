import type { User } from "../auth/types";

export interface userResponse {
    data: User;
}

export interface editProfileRequest {
    name: string,
    bio: string
}

// Public subset of User (identity contract, PublicUser): never email or other private data.
export interface PublicUser {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
}

export interface publicUsersResponse {
    data: PublicUser[];
}

// null means "not available": the account does not exist or is suspended, and the API does not
// say which. The UI shows "Usuario no disponible".
export type PublicProfiles = Map<string, PublicUser | null>;

export type AvatarUpload = File | { uri: string; name: string; type: string };
