import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { serversService } from '../../services/communityServices';
import type { Server } from '@discordia/api';
import { CreateServerModal } from './CreateServerModal';
import { usePolling } from '../../hooks/usePolling';

export const ServerSidebar = () => {
    const [servers, setServers] = useState<Server[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const { serverId } = useParams();
    const navigate = useNavigate();

    // A response from before a local change (e.g. creating a server) would drop it again.
    const localChangeRef = useRef(0);

    const refreshServers = useCallback(() => {
        const startedAt = localChangeRef.current;
        serversService.getServers()
            .then(list => {
                if (localChangeRef.current === startedAt) setServers(list);
            })
            .catch(console.error);
    }, []);

    // Reload on every server change too: leaving or losing a server navigates away from it.
    useEffect(() => {
        refreshServers();
    }, [refreshServers, serverId]);

    // Servers deleted, or joined, from another client show up on the next poll.
    usePolling(refreshServers);

    const handleCreated = (server: Server) => {
        localChangeRef.current += 1;
        setServers(prev => [...prev, server]);
        setShowCreate(false);
        navigate(`/servers/${server.id}`);
    };

    return (
        <>
            <nav
                className="flex flex-col items-center py-3 gap-2 overflow-y-auto shrink-0"
                style={{ width: 72, background: '#202225' }}
            >
                {servers.map(server => (
                    <button
                        key={server.id}
                        onClick={() => navigate(`/servers/${server.id}`)}
                        title={server.name}
                        className="relative flex items-center justify-center w-12 h-12 font-bold text-lg text-white transition-all duration-200"
                        style={{
                            background: server.id === serverId ? '#7289da' : '#36393f',
                            borderRadius: server.id === serverId ? '30%' : '50%',
                            flexShrink: 0,
                        }}
                        onMouseEnter={e => {
                            if (server.id !== serverId) {
                                e.currentTarget.style.borderRadius = '30%';
                                e.currentTarget.style.background = '#7289da';
                            }
                        }}
                        onMouseLeave={e => {
                            if (server.id !== serverId) {
                                e.currentTarget.style.borderRadius = '50%';
                                e.currentTarget.style.background = '#36393f';
                            }
                        }}
                    >
                        {server.avatar_url
                            ? <img src={server.avatar_url} alt={server.name} className="w-full h-full object-cover rounded-[inherit]" />
                            : server.name[0].toUpperCase()
                        }
                        {server.id === serverId && (
                            <span
                                className="absolute w-1 h-8 rounded-r-full"
                                style={{ background: '#fff', left: -4, top: '50%', transform: 'translateY(-50%)' }}
                            />
                        )}
                    </button>
                ))}

                <div className="w-8 h-px my-1" style={{ background: '#36393f' }} />

                <button
                    onClick={() => setShowCreate(true)}
                    title="Crear servidor"
                    className="flex items-center justify-center w-12 h-12 transition-all duration-200 shrink-0"
                    style={{ background: '#36393f', color: '#43b581', borderRadius: '50%' }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderRadius = '30%';
                        e.currentTarget.style.background = '#43b581';
                        e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderRadius = '50%';
                        e.currentTarget.style.background = '#36393f';
                        e.currentTarget.style.color = '#43b581';
                    }}
                >
                    <Plus size={24} />
                </button>
            </nav>

            {showCreate && (
                <CreateServerModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
            )}
        </>
    );
};
