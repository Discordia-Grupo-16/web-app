import { Outlet } from 'react-router-dom';
import { UnreadProvider } from '@discordia/core';
import { RealtimeProvider } from '@/features/chat';
import { VoiceProvider } from '@/features/voice';
import { readStatesService } from '@/shared/api';

// Mounted right under ProtectedRoute, not in AppLayout: /invite/:code and /admin leave AppLayout and
// would drop the socket and the voice call. The unread state lives here for the same reason: it
// listens to the socket, and it has to keep counting while the user is on another screen.
export const RealtimeOutlet = () => (
    <RealtimeProvider>
        <UnreadProvider service={readStatesService} logger={console}>
            <VoiceProvider>
                <Outlet />
            </VoiceProvider>
        </UnreadProvider>
    </RealtimeProvider>
);
