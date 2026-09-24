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

export interface AuthStorageStrategy {
    getToken: () => Promise<string | null>;
    setToken: (token: string) => Promise<void>;
    removeToken?: () => Promise<void>;
    getRefreshToken?: () => Promise<string | null>;
    setRefreshToken?: (token: string) => Promise<void>;
    removeRefreshToken?: () => Promise<void>;
    getUser: <T>() => Promise<T | null>;
    setUser: <T>(user: T) => Promise<void>;
    removeUser?: () => Promise<void>;
    clearSession: () => Promise<void>;
}

