import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, Pencil, Plus, Trash2, Volume2 } from 'lucide-react';
import type { Channel } from '@discordia/api';

interface ChannelGroupProps {
    label: string;
    channels: Channel[];
    activeId?: string;
    serverId: string;
    canManage: boolean;
    onAdd: () => void;
    onDelete: (channelId: string, channelName: string) => void;
    onEdit: (channel: Channel) => void;
    /** Drawn under the row of each channel, for example who is in a voice call. */
    renderBelowChannel?: (channel: Channel) => ReactNode;
}

export const ChannelGroup = ({ label, channels, activeId, serverId, canManage, onAdd, onDelete, onEdit, renderBelowChannel }: ChannelGroupProps) => {
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
                    <div key={ch.id}>
                        <div
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
                                {ch.type === 'voice'
                                    ? <Volume2 size={16} aria-hidden data-icon="voice" style={{ flexShrink: 0 }} />
                                    : <Hash size={16} aria-hidden data-icon="text" style={{ flexShrink: 0 }} />
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
                        {renderBelowChannel?.(ch)}
                    </div>
                );
            })}
        </div>
    );
};
