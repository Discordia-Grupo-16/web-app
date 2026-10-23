// Where each platform keeps the session: localStorage on web, SecureStore on mobile.
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
