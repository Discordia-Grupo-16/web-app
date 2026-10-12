import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@discordia/core';
import { buildLoginPath } from './returnTo';

export const ProtectedRoute = () => {
    const { user, isLoading, signedOutByUser } = useAuth();
    const { pathname, search, hash } = useLocation();

    if (isLoading) return null;

    if (!user) {
        // Closing the session on purpose does not leave a pending destination for the next login.
        const pending = signedOutByUser ? '/' : `${pathname}${search}${hash}`;
        return <Navigate to={buildLoginPath(pending)} replace />;
    }

    return <Outlet />;
};
