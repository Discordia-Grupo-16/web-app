import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCheck, Plus } from 'lucide-react';
import { serversService } from '@/shared/api';
import type { Server } from '@discordia/api';
import { useMarkAllRead, useServerUnread } from '@discordia/core';
import { CreateServerModal } from './CreateServerModal';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';

// What is unread in a server, over its icon. The one open is skipped: the channel list already says it.
const ServerUnreadMarks = ({ server, isCurrent }: { server: Server; isCurrent: boolean }) => {
    const { unread, mentionCount } = useServerUnread(server.id);
    if (!unread) return null;
    return (
        <>
            {!isCurrent && (
                <span
                    role="img"
                    aria-label={`Mensajes sin leer en el servidor ${server.name}`}
                    className="absolute w-1 h-2 rounded-r-full"
                    style={{ background: '#fff', left: -4, top: '50%', transform: 'translateY(-50%)' }}
                />
            )}
            {mentionCount > 0 && (
                <span
                    role="img"
                    aria-label={`${mentionCount} ${mentionCount === 1 ? 'mención sin leer' : 'menciones sin leer'} en el servidor ${server.name}`}
                    className="absolute rounded-full px-1 text-xs font-bold text-white"
                    style={{ background: '#ed4245', right: -4, bottom: -4, minWidth: 18, textAlign: 'center' }}
                >
                    {mentionCount}
                </span>
            )}
        </>
    );
};

export const ServerSidebar = () => {
    const { anyUnread, markAllRead } = useMarkAllRead();
    const [servers, setServers] = useState<Server[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showGoneNotice, setShowGoneNotice] = useState(false);
    const location = useLocation();
    const { serverId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        const state = location.state;
        if (state && typeof state === 'object' && 'serverGone' in state && state.serverGone === true) {
            setShowGoneNotice(true);
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [location.pathname, location.state, navigate]);

    // A response from before a local change (e.g. creating a server) would drop it again.
    const localChangeRef = useRef(0);
    const currentServerIdRef = useRef(serverId);
    const reportedGoneRef = useRef<string | null>(null);
    useEffect(() => {
        currentServerIdRef.current = serverId;
        if (reportedGoneRef.current !== serverId) reportedGoneRef.current = null;
    }, [serverId]);

    const refreshServers = useCallback(() => {
        const startedAt = localChangeRef.current;
        serversService.getServers()
            .then(list => {
                if (localChangeRef.current !== startedAt) return;
                setServers(list);
                if (
                    serverId &&
                    currentServerIdRef.current === serverId &&
                    !list.some(server => server.id === serverId) &&
                    reportedGoneRef.current !== serverId
                ) {
                    reportedGoneRef.current = serverId;
                    setShowGoneNotice(true);
                }
            })
            .catch(console.error);
    }, [serverId]);

    // Reload on every server change too: leaving or losing a server navigates away from it.
    useEffect(() => {
        refreshServers();
    }, [refreshServers, serverId]);

    // Servers deleted, or joined, from another client arrive as a notice of `servers`.
    useLiveRefresh({ resources: ['servers'], refresh: refreshServers });

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
                        <ServerUnreadMarks server={server} isCurrent={server.id === serverId} />
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
                    onClick={() => markAllRead().catch(console.error)}
                    disabled={!anyUnread}
                    title="Marcar todo como leído"
                    aria-label="Marcar todo como leído"
                    className="flex items-center justify-center w-12 h-12 transition-all duration-200 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#36393f', color: '#b9bbbe', borderRadius: '50%' }}
                >
                    <CheckCheck size={22} />
                </button>

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
            {showGoneNotice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="server-gone-title"
                        aria-describedby="server-gone-description"
                        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
                        style={{ background: '#36393f' }}
                    >
                        <h2 id="server-gone-title" className="text-lg font-bold text-white">
                            Servidor no disponible
                        </h2>
                        <p id="server-gone-description" className="mt-2 text-sm" style={{ color: '#b9bbbe' }}>
                            El servidor en el que estabas fue eliminado o suspendido.
                        </p>
                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                autoFocus
                                onClick={() => {
                                    setShowGoneNotice(false);
                                    navigate('/');
                                }}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
                                style={{ background: '#5865f2' }}
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
