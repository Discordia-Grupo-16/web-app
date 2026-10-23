import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ServerSidebar } from '@/features/servers';
import { ServerPanel } from './ServerPanel';
import { UserProfileSection } from '@/features/profile';
import { VoiceBar } from '@/features/voice';
import { ProfileViewerProvider } from './ProfileViewerProvider';

export const AppLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <ProfileViewerProvider>
            <div className="flex h-screen overflow-hidden">
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-30 md:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                <div className={`
                    fixed inset-y-0 left-0 z-40 flex-col h-full shrink-0 md:relative md:flex
                    ${isSidebarOpen ? 'flex' : 'hidden md:flex'}
                `}>
                    <div className="flex flex-col h-full shrink-0">
                        <div className="flex flex-1 overflow-hidden">
                            <ServerSidebar />
                            <div className="w-60 bg-[#2f3136] flex flex-col h-full overflow-y-auto">
                                <ServerPanel />
                            </div>
                        </div>
                        <div className="w-full bg-[#292b2f] shrink-0">
                            <VoiceBar />
                            <UserProfileSection />
                        </div>
                    </div>
                </div>

                <main className="flex-1 flex flex-col overflow-hidden bg-[#36393f]">
                    <div className="md:hidden p-3 bg-[#2f3136] border-b border-zinc-800">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="text-white bg-[#5865f2] px-3 py-1 rounded"
                        >
                            ☰ Canales
                        </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center overflow-hidden">
                        <Outlet />
                    </div>
                </main>
            </div>
        </ProfileViewerProvider>
    );
};
