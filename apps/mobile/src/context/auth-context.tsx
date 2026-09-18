import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { authStorage } from '../services/auth-storage';

export interface User {
  id?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredSession() {
      try {
        const storedToken = await authStorage.getToken();
        const storedUser = await authStorage.getUser<User>();
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
  }, []);

  const signIn = async (newToken: string, newUser: User) => {
    await authStorage.setToken(newToken);
    await authStorage.setUser(newUser);
    setToken(newToken);
    setUser(newUser);
  };

  const signOut = async () => {
    await authStorage.clearSession();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      signIn,
      signOut,
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
