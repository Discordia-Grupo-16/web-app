import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider, PublicProfilesProvider } from '@discordia/core';
import { router } from '@/app/router';
import { authService, userService } from '@/shared/api';
import { webAuthStorage } from '@/shared/session/authStorage';
import './index.css';

// The public profile cache is per session: drop it before logging out.
const signOut = async () => {
  userService.clearPublicProfiles();
  await authService.logout();
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider storage={webAuthStorage} onSignOut={signOut}>
      <PublicProfilesProvider source={userService}>
        <RouterProvider router={router} />
      </PublicProfilesProvider>
    </AuthProvider>
  </React.StrictMode>
);
