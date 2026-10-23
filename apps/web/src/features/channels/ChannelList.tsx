import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Channel } from '@discordia/api';
import { channelsService } from '@/shared/api';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { ChannelGroup } from './ChannelGroup';
import { CreateChannelModal } from './CreateChannelModal';
import { EditChannelModal } from './EditChannelModal';

interface ChannelListProps {
    serverId: string;
    channels: Channel[];
    activeChannelId?: string;
    canManage: boolean;
    /** The list does not own the channels: the server does. */
    onChannelsChange: (update: (channels: Channel[]) => Channel[]) => void;
    /** Drawn under the row of each channel; the list does not know what goes there. */
    renderBelowChannel?: (channel: Channel) => ReactNode;
}

export const ChannelList = ({ serverId, channels, activeChannelId, canManage, onChannelsChange, renderBelowChannel }: ChannelListProps) => {
    const navigate = useNavigate();
    const [createType, setCreateType] = useState<'text' | 'voice' | null>(null);
    const [pendingEdit, setPendingEdit] = useState<Channel | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

    const handleChannelCreated = (channel: Channel) => {
        onChannelsChange(prev => [...prev, channel]);
        setCreateType(null);
        navigate(`/servers/${serverId}/channels/${channel.id}`);
    };

    const handleChannelUpdated = (updated: Channel) => {
        onChannelsChange(prev => prev.map(c => c.id === updated.id ? updated : c));
        setPendingEdit(null);
    };

    const confirmChannelDelete = async () => {
        if (!pendingDelete) return;
        const { id } = pendingDelete;
        setPendingDelete(null);
        try {
            await channelsService.deleteChannel(serverId, id);
            onChannelsChange(prev => prev.filter(c => c.id !== id));
            if (id === activeChannelId) navigate(`/servers/${serverId}`);
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            const detail = error.response?.data?.detail;

            window.alert(detail || 'Error al eliminar el canal');
        }
    };

    const groupProps = {
        activeId: activeChannelId,
        serverId,
        canManage,
        onDelete: (id: string, name: string) => setPendingDelete({ id, name }),
        onEdit: setPendingEdit,
        renderBelowChannel,
    };

    return (
        <>
            <ChannelGroup
                label="Canales de texto"
                channels={channels.filter(c => c.type === 'text')}
                onAdd={() => setCreateType('text')}
                {...groupProps}
            />
            <ChannelGroup
                label="Canales de voz"
                channels={channels.filter(c => c.type === 'voice')}
                onAdd={() => setCreateType('voice')}
                {...groupProps}
            />

            {createType && (
                <CreateChannelModal
                    serverId={serverId}
                    type={createType}
                    onClose={() => setCreateType(null)}
                    onCreated={handleChannelCreated}
                />
            )}

            {pendingEdit && (
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
        </>
    );
};
