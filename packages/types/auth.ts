export interface User {
    id: string;
    email: string;
    name?: string;
    [key: string]: unknown;
}

export interface LoginCredentials {
    email: string;
    password?: string;
    [key: string]: unknown;
}

export interface AuthResponse {
    token: string;
    user: User;
}
