import type { User } from "../auth/types";

export interface userResponse {
    data: User;
}

export interface editProfileRequest {
    name: string,
    bio: string
}