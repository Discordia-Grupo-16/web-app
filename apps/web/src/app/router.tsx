import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginRegisterPage, ProtectedRoute } from '@/features/auth';
import { InvitePage } from '@/features/invitations';
import App from './App';
import { AppLayout } from './layout/AppLayout';
import { ChannelRoute } from './layout/ChannelRoute';
import { InviteLayout } from './layout/InviteLayout';
import { RealtimeOutlet } from './layout/RealtimeOutlet';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { path: 'home', element: <LoginRegisterPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <RealtimeOutlet />,
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
                  { path: 'servers/:serverId/channels/:channelId', element: <ChannelRoute /> },
                ],
              },
              {
                element: <InviteLayout />,
                children: [{ path: 'invite/:code', element: <InvitePage /> }],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
