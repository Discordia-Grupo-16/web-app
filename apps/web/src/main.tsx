// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

import App from './App.tsx';
import { LoginRegister } from './pages/loginRegister.tsx';
import { Home } from './pages/home.tsx';
import { AdminHome } from './pages/adminHome.tsx';
import { ProtectedRoute } from './components/protectedRoute.tsx';
import './index.css';
import { webAuthStorage } from './services/webStorage.ts';
import { AuthProvider } from '@discordia/context';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // /home con login y registro
      {
        path: 'home',
        element: <LoginRegister />,
      },

      // rutas privadas
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '',
            element: <Home />,
          },

          {
            path: 'admin',
            element: <AdminHome />,
          },
        ]
      },

      // Cualquier URL que no exista te manda directo a "/home"
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
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