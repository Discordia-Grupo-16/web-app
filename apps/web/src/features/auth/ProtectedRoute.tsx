import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@discordia/core';
import { buildLoginPath } from './returnTo';

export const ProtectedRoute = () => {
    const { user, isLoading } = useAuth();
    const { pathname, search, hash } = useLocation();

    if (isLoading) return null;

    if (!user) {
        return <Navigate to={buildLoginPath(`${pathname}${search}${hash}`)} replace />;
    }

    return <Outlet />;
};
