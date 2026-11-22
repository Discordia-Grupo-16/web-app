import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider, PublicProfilesProvider } from '@discordia/core';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { router } from '@/app/router';
import { GOOGLE_CLIENT_ID } from '@/shared/config/env';
import { authService, userService } from '@/shared/api';
import { webAuthStorage } from '@/shared/session/authStorage';
import { sessionExpiry } from '@/shared/session/sessionExpiry';
import './index.css';

// The public profile cache is per session: drop it before logging out.
const signOut = async () => {
  userService.clearPublicProfiles();
  await authService.logout();
};

// An expired session also ends the profile cache of that session.
sessionExpiry.subscribe(() => userService.clearPublicProfiles());

const app = (
  <AuthProvider
    storage={webAuthStorage}
    onSignOut={signOut}
    onVerifyMfa={authService.verifyMfa}
    sessionExpiry={sessionExpiry}
  >
    <PublicProfilesProvider source={userService}>
      <RouterProvider router={router} />
    </PublicProfilesProvider>
  </AuthProvider>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Without a client ID there is no Google script and no button: only the email form remains. */}
    {GOOGLE_CLIENT_ID ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{app}</GoogleOAuthProvider> : app}
  </React.StrictMode>
);
