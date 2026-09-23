import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';

import App from './App.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { ChannelView } from './components/channels/ChannelView.tsx';
import { ProtectedRoute } from './components/protectedRoute.tsx';
import { AdminHome } from './pages/adminHome.tsx';
import { InvitePage } from './pages/invitePage.tsx';
import { LoginRegister } from './pages/loginRegister.tsx';
import './index.css';
import { webAuthStorage } from './services/webStorage.ts';
import { AuthProvider } from '@discordia/context';

const NoServerSelected = () => (
    <div className="text-center select-none" style={{ color: '#99aab5' }}>
        <p className="text-lg font-semibold">Seleccioná un servidor</p>
        <p className="text-sm mt-1">O creá uno nuevo con el botón +</p>
    </div>
);

const NoChannelSelected = () => (
    <div className="text-center select-none" style={{ color: '#99aab5' }}>
        <p className="text-lg font-semibold">Seleccioná un canal</p>
        <p className="text-sm mt-1">Elegí un canal de la lista para empezar a chatear</p>
    </div>
);

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
                            { index: true, element: <NoServerSelected /> },
                            { path: 'servers/:serverId', element: <NoChannelSelected /> },
                            { path: 'servers/:serverId/channels/:channelId', element: <ChannelView /> },
                        ],
                    },
                    { path: 'admin', element: <AdminHome /> },
                    { path: 'invite/:code', element: <InvitePage /> },
                ],
            },
            { path: '*', element: <Navigate to="/" replace /> },
        ],
    },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider storage={webAuthStorage}>
            <RouterProvider router={router} />
        </AuthProvider>
    </React.StrictMode>
);
