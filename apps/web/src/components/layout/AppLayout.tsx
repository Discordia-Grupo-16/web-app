import { Outlet } from 'react-router-dom';
import { ServerSidebar } from '../servers/ServerSidebar';
import { ChannelSidebar } from '../channels/ChannelSidebar';

export const AppLayout = () => (
    <div className="flex h-screen overflow-hidden">
        <ServerSidebar />
        <ChannelSidebar />
        <main className="flex-1 flex items-center justify-center overflow-hidden" style={{ background: '#36393f' }}>
            <Outlet />
        </main>
    </div>
);
