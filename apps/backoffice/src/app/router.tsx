import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { LoginPage, StaffRoute } from '@/features/auth';
import { HomePage } from '@/features/dashboard';
import { UsersPage } from '@/features/users';
import { ServersPage } from '@/features/servers';
import App from './App';
import { StaffLayout } from './layout/StaffLayout';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { path: 'login', element: <LoginPage /> },
      {
        element: <StaffRoute />,
        children: [
          {
            element: <StaffLayout />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'users', element: <UsersPage /> },
              { path: 'servers', element: <ServersPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
