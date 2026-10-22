import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { AuthStorageStrategy, SessionExpirySignal, User } from '@discordia/api';

interface AuthContextType {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    isLoading: boolean;
    /**
     * The user closed the session on purpose. A route guard keeps the pending destination for an
     * expired or missing session, but not after this: the next person to log in must not inherit it.
     */
    signedOutByUser: boolean;
    signIn: (token: string, user: User, refreshToken?: string) => Promise<void>;
    signOut: () => Promise<void>;
    updateUser: (updatedUser: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: React.ReactNode;
    storage: AuthStorageStrategy;
    onSignOut?: () => Promise<void>;
    /** Fires when the server rejects the session for good: the local session is dropped, with no backend call. */
    sessionExpiry?: Pick<SessionExpirySignal, 'subscribe'>;
}

export function AuthProvider({ children, storage, onSignOut, sessionExpiry }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [signedOutByUser, setSignedOutByUser] = useState(false);

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

    useEffect(() => {
        if (!sessionExpiry) return;
        return sessionExpiry.subscribe(() => {
            // The token is already dead, so there is nothing to revoke on the backend.
            storage.clearSession().catch(() => undefined);
            setToken(null);
            setRefreshToken(null);
            setUser(null);
        });
    }, [sessionExpiry, storage]);

    const signIn = async (newToken: string, newUser: User, newRefreshToken?: string) => {
        await storage.setToken(newToken);
        await storage.setUser(newUser);
        if (newRefreshToken && storage.setRefreshToken) {
            await storage.setRefreshToken(newRefreshToken);
        }
        setSignedOutByUser(false);
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
            setSignedOutByUser(true);
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
            signedOutByUser,
            signIn,
            signOut,
            updateUser,
        }),
        [user, token, refreshToken, isLoading, signedOutByUser]
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
