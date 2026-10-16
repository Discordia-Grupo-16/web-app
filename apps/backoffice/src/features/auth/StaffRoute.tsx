import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@discordia/core';
import { isStaff } from './isStaff';

export const StaffRoute = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) return null;
    if (!isStaff(user)) return <Navigate to="/login" replace />;

    return <Outlet />;
};
