export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl?: string | null;
    bio?: string | null;
    createdAt?: string;
    [key: string]: unknown;
}

export interface LoginCredentials {
    email: string;
    password?: string;
    [key: string]: unknown;
}

export interface RegisterUserData {
    email: string;
    name: string;
    password: string;
    avatarUrl?: string | null;
    bio?: string | null;
}

export interface AuthResult {
    user: User;
    accessToken: string;
    refreshToken: string;
    tokenType?: string;
    expiresIn?: number;
}

export interface AuthApiResponse {
    data: AuthResult;
}

export interface AuthResponse {
    token: string;
    user: User;
    refreshToken?: string;
}

export interface RefreshSessionPayload {
    refreshToken: string;
}
