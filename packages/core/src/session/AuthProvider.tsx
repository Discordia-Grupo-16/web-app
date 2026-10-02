import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { AuthStorageStrategy, User } from '@discordia/api';

interface AuthContextType {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    isLoading: boolean;
    signIn: (token: string, user: User, refreshToken?: string) => Promise<void>;
    signOut: () => Promise<void>;
    updateUser: (updatedUser: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: React.ReactNode;
    storage: AuthStorageStrategy;
    onSignOut?: () => Promise<void>;
}

export function AuthProvider({ children, storage, onSignOut }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadStoredSession() {
            try {
                const storedToken = await storage.getToken();
                const storedUser = await storage.getUser<User>();
                const storedRefreshToken = storage.getRefreshToken
                    ? await storage.getRefreshToken()
                    : null;
                if (storedToken) {
                    setToken(storedToken);
                    setUser(storedUser || null);
                    setRefreshToken(storedRefreshToken);
                }
            } catch {
                // Ignorar error al cargar sesión inicial
            } finally {
                setIsLoading(false);
            }
        }
        loadStoredSession();
    }, [storage]);

    const signIn = async (newToken: string, newUser: User, newRefreshToken?: string) => {
        await storage.setToken(newToken);
        await storage.setUser(newUser);
        if (newRefreshToken && storage.setRefreshToken) {
            await storage.setRefreshToken(newRefreshToken);
        }
        setToken(newToken);
        setUser(newUser);
        setRefreshToken(newRefreshToken || null);
    };

    const signOut = async () => {
        try {
            if (onSignOut) {
                await onSignOut();
            }
        } catch {
            // Si la llamada al backend falla o el token ya expiró, garantizamos limpiar la sesión local
        } finally {
            await storage.clearSession();
            setToken(null);
            setRefreshToken(null);
            setUser(null);
        }
    };

    const updateUser = async (updatedUser: User) => {
        await storage.setUser(updatedUser);
        setUser(updatedUser);
    };

    const value = useMemo(
        () => ({
            user,
            token,
            refreshToken,
            isLoading,
            signIn,
            signOut,
            updateUser,
        }),
        [user, token, refreshToken, isLoading]
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
