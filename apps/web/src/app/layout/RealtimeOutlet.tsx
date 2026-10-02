import { Outlet } from 'react-router-dom';
import { RealtimeProvider } from '@/features/chat';

// Mounted right under ProtectedRoute, not in AppLayout: /invite/:code and /admin leave AppLayout and would drop the socket.
export const RealtimeOutlet = () => (
    <RealtimeProvider>
        <Outlet />
    </RealtimeProvider>
);
