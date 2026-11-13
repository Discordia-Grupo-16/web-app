import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GripVertical, Hash, Pencil, Plus, Trash2, Volume2 } from 'lucide-react';
import type { Channel } from '@discordia/api';
import { useChannelUnread } from '@discordia/core';
import { UnreadMarks } from '@/shared/ui/UnreadMarks';

interface ChannelGroupProps {
    label: string;
    channels: Channel[];
    activeId?: string;
    serverId: string;
    canManage: boolean;
    onAdd?: () => void;
    onDelete: (channelId: string, channelName: string) => void;
    onEdit: (channel: Channel) => void;
    /** Called when the user drags a channel to a new position within the group. */
    onReorder?: (fromId: string, toId: string) => void;
    /** Called when a channel is dragged and dropped onto this group's header. */
    onChannelDrop?: (channelId: string) => void;
    /** Extra buttons rendered next to the group label (e.g. rename/delete for categories). */
    headerActions?: ReactNode;
    /** Drawn under the row of each channel, for example who is in a voice call. */
    renderBelowChannel?: (channel: Channel) => ReactNode;
}

// The name and what is unread about it, in its own component because the hook is per channel.
const ChannelName = ({ channel }: { channel: Channel }) => {
    const { unread, mentionCount } = useChannelUnread(channel.id);
    return (
        <>
            <span
                className={`truncate ${unread ? 'font-semibold' : ''}`}
                style={unread ? { color: '#fff' } : undefined}
                data-unread={unread || undefined}
            >
                {channel.name}
            </span>
            {unread && <UnreadMarks mentionCount={mentionCount} what={`el canal ${channel.name}`} />}
        </>
    );
};

export const ChannelGroup = ({ label, channels, activeId, serverId, canManage, onAdd, onDelete, onEdit, onReorder, onChannelDrop, headerActions, renderBelowChannel }: ChannelGroupProps) => {
    const navigate = useNavigate();
    const isText = label.includes('texto');
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [headerDragOver, setHeaderDragOver] = useState(false);

    return (
        <div className="mb-4">
            <div
                className="flex items-center justify-between px-2 py-1 group rounded"
                style={{ background: headerDragOver ? '#40444b' : 'transparent', outline: headerDragOver ? '1.5px dashed #7289da' : 'none' }}
                onDragOver={e => {
                    if (e.dataTransfer.types.includes('channelid') && onChannelDrop) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        setHeaderDragOver(true);
                    }
                }}
                onDragLeave={() => setHeaderDragOver(false)}
                onDrop={e => {
                    const id = e.dataTransfer.getData('channelId');
                    if (id && onChannelDrop) {
                        e.stopPropagation();
                        onChannelDrop(id);
                    }
                    setHeaderDragOver(false);
                }}
            >
                <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: headerDragOver ? '#dcddde' : '#8e9297' }}
                >
                    {label}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    {headerActions}
                    {canManage && onAdd && (
                        <button
                            onClick={onAdd}
                            className="p-0.5 rounded"
                            style={{ color: '#8e9297' }}
                            title={`Crear canal de ${isText ? 'texto' : 'voz'}`}
                        >
                            <Plus size={14} />
                        </button>
                    )}
                </div>
            </div>

            {channels.map(ch => {
                const isActive = ch.id === activeId;
                const isOver = dragOverId === ch.id;
                return (
                    <div
                        key={ch.id}
                        draggable={canManage && !!onReorder}
                        onDragStart={e => { e.dataTransfer.setData('channelId', ch.id); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); }}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragOverId(ch.id); }}
                        onDragLeave={() => setDragOverId(null)}
                        onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const fromId = e.dataTransfer.getData('channelId');
                            if (fromId && fromId !== ch.id) onReorder?.(fromId, ch.id);
                            setDragOverId(null);
                        }}
                        onDragEnd={() => setDragOverId(null)}
                        style={{ borderTop: isOver ? '2px solid #7289da' : '2px solid transparent' }}
                    >
                        <div
                            className="group/ch flex items-center mx-1 rounded"
                            style={{ background: isActive ? '#42464d' : 'transparent' }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#34373c'; }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                        >
                            {canManage && onReorder && (
                                <span
                                    className="opacity-0 group-hover/ch:opacity-100 pl-1 shrink-0 cursor-grab"
                                    style={{ color: '#8e9297' }}
                                    title="Arrastrar para reordenar"
                                >
                                    <GripVertical size={12} />
                                </span>
                            )}
                            <button
                                onClick={() => navigate(`/servers/${serverId}/channels/${ch.id}`)}
                                className="flex items-center gap-2 flex-1 text-sm px-2 py-1.5 min-w-0"
                                style={{ color: isActive ? '#fff' : '#8e9297' }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#dcddde'; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#8e9297'; }}
                            >
                                {ch.type === 'voice'
                                    ? <Volume2 size={16} aria-hidden data-icon="voice" style={{ flexShrink: 0 }} />
                                    : <Hash size={16} aria-hidden data-icon="text" style={{ flexShrink: 0 }} />
                                }
                                <ChannelName channel={ch} />
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
