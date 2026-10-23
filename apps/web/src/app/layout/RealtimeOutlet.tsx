import { Outlet } from 'react-router-dom';
import { RealtimeProvider } from '@/features/chat';
import { VoiceProvider } from '@/features/voice';

// Mounted right under ProtectedRoute, not in AppLayout: /invite/:code and /admin leave AppLayout and
// would drop the socket and the voice call.
export const RealtimeOutlet = () => (
    <RealtimeProvider>
        <VoiceProvider>
            <Outlet />
        </VoiceProvider>
    </RealtimeProvider>
);
