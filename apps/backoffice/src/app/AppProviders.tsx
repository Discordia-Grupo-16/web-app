import type { ReactNode } from 'react';
import { AuthProvider } from '@discordia/core';
import { authService } from '@/shared/api';
import { backofficeAuthStorage } from '@/shared/session/authStorage';
import { sessionExpiry } from '@/shared/session/sessionExpiry';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider
      storage={backofficeAuthStorage}
      onSignOut={authService.logout}
      sessionExpiry={sessionExpiry}
    >
      {children}
    </AuthProvider>
  );
}
