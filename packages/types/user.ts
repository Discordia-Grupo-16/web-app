import type { User } from "@discordia/types";

export interface userResponse {
    data: User;
}

export interface editProfileRequest {
    name: string,
    bio: string
}