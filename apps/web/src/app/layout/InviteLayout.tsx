import { Outlet } from 'react-router-dom';
import { VoiceBar } from '@/features/voice';

// /invite/:code leaves AppLayout, but the call goes on: the bar keeps the way back to it.
export const InviteLayout = () => (
    <div className="flex flex-col min-h-screen">
        <div className="sticky top-0 z-10">
            <VoiceBar />
        </div>
        <div className="flex-1">
            <Outlet />
        </div>
    </div>
);
