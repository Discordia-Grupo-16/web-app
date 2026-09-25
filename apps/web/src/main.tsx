import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';

import App from './App.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { ChannelView } from './components/channels/ChannelView.tsx';
import { ProtectedRoute } from './components/protectedRoute.tsx';
import { InvitePage } from './pages/invitePage.tsx';
import { LoginRegister } from './pages/loginRegister.tsx';
import './index.css';
import { webAuthStorage } from './services/webStorage.ts';
import { authService } from './services/authService.ts';
import { AuthProvider } from '@discordia/context';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { path: 'home', element: <LoginRegister /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                index: true, element: (
                  <div className="text-center select-none" style={{ color: '#99aab5' }}>
                    <p className="text-lg font-semibold">Seleccioná un servidor</p>
                    <p className="text-sm mt-1">O creá uno nuevo con el botón +</p>
                  </div>
                )
              },
              {
                path: 'servers/:serverId', element: (
                  <div className="text-center select-none" style={{ color: '#99aab5' }}>
                    <p className="text-lg font-semibold">Seleccioná un canal</p>
                    <p className="text-sm mt-1">Elegí un canal de la lista para empezar a chatear</p>
                  </div>
                )
              },
              { path: 'servers/:serverId/channels/:channelId', element: <ChannelView /> },
            ],
          },
          { path: 'invite/:code', element: <InvitePage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider storage={webAuthStorage} onSignOut={authService.logout}>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
