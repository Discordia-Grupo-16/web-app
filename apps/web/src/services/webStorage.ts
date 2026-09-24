import type { AuthStorageStrategy } from "@discordia/context";

export const TOKEN_KEY = "discordia_token"
const USER_KEY = "discordia_user"

export const webAuthStorage: AuthStorageStrategy = {
    async getToken(): Promise<string | null> {
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch {
            return null;
        }
    },
    async setToken(token: string): Promise<void> {
        localStorage.setItem(TOKEN_KEY, token);
    },
    async removeToken(): Promise<void> {
        localStorage.removeItem(TOKEN_KEY);
    },
    async getUser<T = unknown>(): Promise<T | null> {
        try {
            const data = localStorage.getItem(USER_KEY);
            return data ? (JSON.parse(data) as T) : null;
        } catch {
            return null;
        }
    },
    async setUser(user: unknown): Promise<void> {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    async removeUser(): Promise<void> {
        localStorage.removeItem(USER_KEY);
    },
    async clearSession(): Promise<void> {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },
}   