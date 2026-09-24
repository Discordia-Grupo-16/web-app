import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { User } from '../types/auth';

export interface AuthStorageStrategy {
    getToken: () => Promise<string | null>;
    setToken: (token: string) => Promise<void>;
    removeToken?: () => Promise<void>;
    getUser: <T>() => Promise<T | null>;
    setUser: <T>(user: T) => Promise<void>;
    removeUser?: () => Promise<void>;
    clearSession: () => Promise<void>;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    signIn: (token: string, user: User) => Promise<void>;
    signOut: () => Promise<void>;
    updateUser: (updatedUser: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: React.ReactNode;
    storage: AuthStorageStrategy;
}

export function AuthProvider({ children, storage }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadStoredSession() {
            try {
                const storedToken = await storage.getToken();
                const storedUser = await storage.getUser<User>();
                if (storedToken) {
                    setToken(storedToken);
                    setUser(storedUser || null);
                }
            } catch {
                // Ignorar error al cargar sesión inicial
            } finally {
                setIsLoading(false);
            }
        }
        loadStoredSession();
    }, [storage]);

    const signIn = async (newToken: string, newUser: User) => {
        await storage.setToken(newToken);
        await storage.setUser(newUser);
        setToken(newToken);
        setUser(newUser);
    };

    const signOut = async () => {
        await storage.clearSession();
        setToken(null);
        setUser(null);
    };

    const updateUser = async (updatedUser: User) => {
        await storage.setUser(updatedUser);
        setUser(updatedUser);
    };

    const value = useMemo(
        () => ({
            user,
            token,
            isLoading,
            signIn,
            signOut,
            updateUser,
        }),
        [user, token, isLoading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
