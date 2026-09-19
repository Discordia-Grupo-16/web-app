import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Hash, LogOut, Plus, UserPlus, Volume2 } from 'lucide-react';
import { useAuth } from '@discordia/context';
import { getServer, leaveServer } from '../../services/serversService';
import type { Channel } from '../../types/channel';
import type { Server } from '../../types/server';
import { CreateChannelModal } from './CreateChannelModal';
import { InviteModal } from '../servers/InviteModal';

export const ChannelSidebar = () => {
    const { serverId, channelId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [server, setServer] = useState<Server | null>(null);
    const [loading, setLoading] = useState(false);
    const [createType, setCreateType] = useState<'text' | 'voice' | null>(null);
    const [showInvite, setShowInvite] = useState(false);

    useEffect(() => {
        if (!serverId) { setServer(null); return; }
        setLoading(true);
        getServer(serverId)
            .then(setServer)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [serverId]);

    const handleChannelCreated = (channel: Channel) => {
        setServer(prev => prev ? { ...prev, channels: [...prev.channels, channel] } : prev);
        setCreateType(null);
        navigate(`/servers/${serverId}/channels/${channel.id}`);
    };

    const handleLeave = async () => {
        if (!serverId || !confirm('¿Querés abandonar este servidor?')) return;
        try {
            await leaveServer(serverId);
            navigate('/');
        } catch (err: any) {
            alert(err?.response?.data?.detail || 'Error al abandonar el servidor');
        }
    };

    const isOwner = !!user && server?.owner_id === user.id;
    const textChannels = server?.channels.filter(c => c.type === 'text') ?? [];
    const voiceChannels = server?.channels.filter(c => c.type === 'voice') ?? [];

    return (
        <>
            <aside
                className="flex flex-col shrink-0 overflow-hidden"
                style={{ width: 240, background: '#2f3136' }}
            >
                {/* Header del servidor */}
                <div
                    className="flex items-center justify-between px-4 py-3 shadow-md cursor-pointer select-none"
                    style={{ minHeight: 48, borderBottom: '1px solid #202225' }}
                >
                    <span className="font-bold text-sm text-white truncate">
                        {serverId ? (server?.name ?? '...') : 'Seleccioná un servidor'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                        {serverId && (
                            <button
                                onClick={() => setShowInvite(true)}
                                title="Invitar personas"
                                className="p-1 rounded transition-colors"
                                style={{ color: '#99aab5' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#dcddde'}
                                onMouseLeave={e => e.currentTarget.style.color = '#99aab5'}
                            >
                                <UserPlus size={16} />
                            </button>
                        )}
                        {serverId && <ChevronDown size={16} style={{ color: '#99aab5' }} />}
                    </div>
                </div>

                {/* Lista de canales */}
                <div className="flex-1 overflow-y-auto py-2">
                    {loading && (
                        <p className="text-xs px-4 py-2" style={{ color: '#99aab5' }}>Cargando...</p>
                    )}
                    {serverId && !loading && (
                        <>
                            <ChannelGroup
                                label="Canales de texto"
                                channels={textChannels}
                                activeId={channelId}
                                serverId={serverId}
                                canManage={isOwner}
                                onAdd={() => setCreateType('text')}
                            />
                            <ChannelGroup
                                label="Canales de voz"
                                channels={voiceChannels}
                                activeId={channelId}
                                serverId={serverId}
                                canManage={isOwner}
                                onAdd={() => setCreateType('voice')}
                            />
                        </>
                    )}
                </div>

                {/* Footer */}
                {serverId && !isOwner && (
                    <div
                        className="flex items-center px-3 py-2"
                        style={{ borderTop: '1px solid #202225', background: '#292b2f' }}
                    >
                        <button
                            onClick={handleLeave}
                            className="flex items-center gap-2 text-xs px-2 py-1 rounded w-full transition-colors"
                            style={{ color: '#ed4245' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(237,66,69,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <LogOut size={14} />
                            Abandonar servidor
                        </button>
                    </div>
                )}
            </aside>

            {createType && serverId && (
                <CreateChannelModal
                    serverId={serverId}
                    type={createType}
                    onClose={() => setCreateType(null)}
                    onCreated={handleChannelCreated}
                />
            )}

            {showInvite && serverId && (
                <InviteModal
                    serverId={serverId}
                    onClose={() => setShowInvite(false)}
                />
            )}
        </>
    );
};

interface ChannelGroupProps {
    label: string;
    channels: Channel[];
    activeId?: string;
    serverId: string;
    canManage: boolean;
    onAdd: () => void;
}

const ChannelGroup = ({ label, channels, activeId, serverId, canManage, onAdd }: ChannelGroupProps) => {
    const navigate = useNavigate();
    const isText = label.includes('texto');

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between px-2 py-1 group">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8e9297' }}>
                    {label}
                </span>
                {canManage && (
                    <button
                        onClick={onAdd}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                        style={{ color: '#8e9297' }}
                        title={`Crear canal de ${isText ? 'texto' : 'voz'}`}
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>

            {channels.map(ch => {
                const isActive = ch.id === activeId;
                return (
                    <button
                        key={ch.id}
                        onClick={() => navigate(`/servers/${serverId}/channels/${ch.id}`)}
                        className="flex items-center gap-2 w-full text-sm rounded px-2 py-1.5 mx-1 transition-colors"
                        style={{
                            width: 'calc(100% - 8px)',
                            background: isActive ? '#42464d' : 'transparent',
                            color: isActive ? '#fff' : '#8e9297',
                        }}
                        onMouseEnter={e => {
                            if (!isActive) {
                                e.currentTarget.style.background = '#34373c';
                                e.currentTarget.style.color = '#dcddde';
                            }
                        }}
                        onMouseLeave={e => {
                            if (!isActive) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#8e9297';
                            }
                        }}
                    >
                        {isText ? <Hash size={16} style={{ flexShrink: 0 }} /> : <Volume2 size={16} style={{ flexShrink: 0 }} />}
                        <span className="truncate">{ch.name}</span>
                    </button>
                );
            })}
        </div>
    );
};
