import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@discordia/core';
import { router } from '@/app/router';
import { authService } from '@/shared/api';
import { backofficeAuthStorage } from '@/shared/session/authStorage';
import { sessionExpiry } from '@/shared/session/sessionExpiry';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider
      storage={backofficeAuthStorage}
      onSignOut={authService.logout}
      sessionExpiry={sessionExpiry}
    >
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
