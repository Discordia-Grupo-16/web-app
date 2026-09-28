import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@discordia/context';
import { RealtimeProvider } from '../realtime/RealtimeProvider';

export const ProtectedRoute = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) return null;

    if (!user) {
        return <Navigate to="/home" replace />;
    }

    // Mounted here, not in AppLayout: /invite/:code and /admin leave AppLayout and would drop the socket.
    return (
        <RealtimeProvider>
            <Outlet />
        </RealtimeProvider>
    );
};