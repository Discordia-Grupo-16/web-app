import { Outlet } from 'react-router-dom';
import { UnreadProvider, useIdleDetector } from '@discordia/core';
import { RealtimeProvider } from '@/features/chat';
import { IncomingTransferBanner } from '@/features/ownership';
import { VoiceProvider } from '@/features/voice';
import { readStatesService } from '@/shared/api';
import { PRESENCE_IDLE_MINUTES } from '@/shared/config/env';

// Reports inactivity (SCRUM-27) on every screen with a session. It needs the realtime context, so it
// is a component under the provider.
const IdleDetector = () => {
    useIdleDetector(PRESENCE_IDLE_MINUTES);
    return null;
};

// Mounted right under ProtectedRoute, not in AppLayout: /invite/:code and /admin leave AppLayout and
// would drop the socket and the voice call. The unread state lives here for the same reason: it
// listens to the socket, and it has to keep counting while the user is on another screen. The
// ownership banner too: it has to be on top of every screen with a session.
export const RealtimeOutlet = () => (
    <RealtimeProvider>
        <IdleDetector />
        <UnreadProvider service={readStatesService} logger={console}>
            <VoiceProvider>
                <div className="flex flex-col h-screen">
                    <IncomingTransferBanner />
                    <div className="flex-1 min-h-0 overflow-auto">
                        <Outlet />
                    </div>
                </div>
            </VoiceProvider>
        </UnreadProvider>
    </RealtimeProvider>
);
