import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@discordia/core';

export const ProtectedRoute = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) return null;

    if (!user) {
        return <Navigate to="/home" replace />;
    }

    return <Outlet />;
};
