import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Hash, LogOut, Pencil, Plus, Shield, Trash2, UserPlus, Volume2 } from 'lucide-react';
import { useAuth } from '@discordia/context';
import { getServer, leaveServer } from '../../services/serversService';
import { deleteChannel } from '../../services/channelsService';
import { listRoles } from '../../services/rolesService';
import type { Channel } from '../../types/channel';
import type { Role } from '../../types/role';
import type { Server } from '../../types/server';
import { CreateChannelModal } from './CreateChannelModal';
import { EditChannelModal } from './EditChannelModal';
import { CreateRoleModal } from '../roles/CreateRoleModal';
import { InviteModal } from '../servers/InviteModal';
import { ConfirmModal } from '../ui/ConfirmModal';

export const ChannelSidebar = () => {
    const { serverId, channelId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [server, setServer] = useState<Server | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const [createType, setCreateType] = useState<'text' | 'voice' | null>(null);
    const [showInvite, setShowInvite] = useState(false);
    const [showCreateRole, setShowCreateRole] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
    const [pendingEdit, setPendingEdit] = useState<Channel | null>(null);
    const [pendingLeave, setPendingLeave] = useState(false);

    useEffect(() => {
        if (!serverId) { setServer(null); setRoles([]); return; }
        setLoading(true);
        Promise.all([
            getServer(serverId),
            listRoles(serverId),
        ])
            .then(([srv, roleList]) => { setServer(srv); setRoles(roleList); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [serverId]);

    const handleChannelCreated = (channel: Channel) => {
        setServer(prev => prev ? { ...prev, channels: [...prev.channels, channel] } : prev);
        setCreateType(null);
        navigate(`/servers/${serverId}/channels/${channel.id}`);
    };

    const handleChannelDelete = (targetChannelId: string, channelName: string) => {
        setPendingDelete({ id: targetChannelId, name: channelName });
    };

    const handleChannelUpdated = (updated: Channel) => {
        setServer(prev =>
            prev ? { ...prev, channels: prev.channels.map(c => c.id === updated.id ? updated : c) } : prev
        );
        setPendingEdit(null);
    };

    const confirmChannelDelete = async () => {
        if (!serverId || !pendingDelete) return;
        const { id, name: _ } = pendingDelete;
        setPendingDelete(null);
        try {
            await deleteChannel(serverId, id);
            setServer(prev =>
                prev ? { ...prev, channels: prev.channels.filter(c => c.id !== id) } : prev
            );
            if (id === channelId) navigate(`/servers/${serverId}`);
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            window.alert(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : (detail || 'Error al eliminar el canal'));
        }
    };

    const handleRoleCreated = (role: Role) => {
        setRoles(prev => [...prev, role]);
        setShowCreateRole(false);
    };

    const handleLeave = () => {
        setPendingLeave(true);
    };

    const confirmLeave = async () => {
        if (!serverId) return;
        setPendingLeave(false);
        try {
            await leaveServer(serverId);
            navigate('/');
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            window.alert(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : (detail || 'Error al abandonar el servidor'));
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
                                onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#99aab5')}
                            >
                                <UserPlus size={16} />
                            </button>
                        )}
                        {serverId && <ChevronDown size={16} style={{ color: '#99aab5' }} />}
                    </div>
                </div>

                {/* Lista de canales y roles */}
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
                                onDelete={handleChannelDelete}
                                onEdit={setPendingEdit}
                            />
                            <ChannelGroup
                                label="Canales de voz"
                                channels={voiceChannels}
                                activeId={channelId}
                                serverId={serverId}
                                canManage={isOwner}
                                onAdd={() => setCreateType('voice')}
                                onDelete={handleChannelDelete}
                                onEdit={setPendingEdit}
                            />
                            <RolesGroup
                                roles={roles}
                                canManage={isOwner}
                                onAdd={() => setShowCreateRole(true)}
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
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(237,66,69,0.1)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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

            {showCreateRole && serverId && (
                <CreateRoleModal
                    serverId={serverId}
                    onClose={() => setShowCreateRole(false)}
                    onCreated={handleRoleCreated}
                />
            )}

            {pendingEdit && serverId && (
                <EditChannelModal
                    serverId={serverId}
                    channel={pendingEdit}
                    onClose={() => setPendingEdit(null)}
                    onUpdated={handleChannelUpdated}
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Eliminar canal"
                    message={`¿Eliminar #${pendingDelete.name}? Esta acción no se puede deshacer.`}
                    confirmLabel="Eliminar"
                    danger
                    onConfirm={confirmChannelDelete}
                    onCancel={() => setPendingDelete(null)}
                />
            )}

            {pendingLeave && (
                <ConfirmModal
                    title="Abandonar servidor"
                    message="¿Seguro que querés salir de este servidor?"
                    confirmLabel="Abandonar"
                    danger
                    onConfirm={confirmLeave}
                    onCancel={() => setPendingLeave(false)}
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
    onDelete: (channelId: string, channelName: string) => void;
    onEdit: (channel: Channel) => void;
}

const ChannelGroup = ({ label, channels, activeId, serverId, canManage, onAdd, onDelete, onEdit }: ChannelGroupProps) => {
    const navigate = useNavigate();
    const isText = label.includes('texto');

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between px-2 py-1 group">
                <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#8e9297' }}
                >
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
                    <div
                        key={ch.id}
                        className="group/ch flex items-center mx-1 rounded"
                        style={{ background: isActive ? '#42464d' : 'transparent' }}
                        onMouseEnter={e => {
                            if (!isActive) e.currentTarget.style.background = '#34373c';
                        }}
                        onMouseLeave={e => {
                            if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <button
                            onClick={() => navigate(`/servers/${serverId}/channels/${ch.id}`)}
                            className="flex items-center gap-2 flex-1 text-sm px-2 py-1.5 min-w-0"
                            style={{ color: isActive ? '#fff' : '#8e9297' }}
                            onMouseEnter={e => {
                                if (!isActive) e.currentTarget.style.color = '#dcddde';
                            }}
                            onMouseLeave={e => {
                                if (!isActive) e.currentTarget.style.color = '#8e9297';
                            }}
                        >
                            {isText
                                ? <Hash size={16} style={{ flexShrink: 0 }} />
                                : <Volume2 size={16} style={{ flexShrink: 0 }} />
                            }
                            <span className="truncate">{ch.name}</span>
                        </button>

                        {canManage && (
                            <>
                                <button
                                    onClick={() => onEdit(ch)}
                                    className="opacity-0 group-hover/ch:opacity-100 transition-opacity p-1 rounded shrink-0"
                                    style={{ color: '#8e9297' }}
                                    title="Editar canal"
                                    onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                >
                                    <Pencil size={13} />
                                </button>
                                <button
                                    onClick={() => onDelete(ch.id, ch.name)}
                                    className="opacity-0 group-hover/ch:opacity-100 transition-opacity p-1 mr-1 rounded shrink-0"
                                    style={{ color: '#8e9297' }}
                                    title="Eliminar canal"
                                    onMouseEnter={e => (e.currentTarget.style.color = '#ed4245')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                >
                                    <Trash2 size={13} />
                                </button>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

interface RolesGroupProps {
    roles: Role[];
    canManage: boolean;
    onAdd: () => void;
}

const RolesGroup = ({ roles, canManage, onAdd }: RolesGroupProps) => (
    <div className="mb-4">
        <div className="flex items-center justify-between px-2 py-1 group">
            <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#8e9297' }}
            >
                Roles
            </span>
            {canManage && (
                <button
                    onClick={onAdd}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                    style={{ color: '#8e9297' }}
                    title="Crear rol"
                >
                    <Plus size={14} />
                </button>
            )}
        </div>

        {roles.map(role => (
            <div
                key={role.id}
                className="flex items-center gap-2 text-sm px-2 py-1.5 mx-1 rounded"
                style={{ color: '#8e9297' }}
            >
                <Shield size={14} style={{ flexShrink: 0 }} />
                <span className="truncate">{role.name}</span>
            </div>
        ))}
    </div>
);
