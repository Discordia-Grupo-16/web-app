import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Hash, Search, Volume2 } from 'lucide-react';
import { MANAGE_MESSAGES, NONE, SEND_MESSAGES, canJoinVoice, hasPermission, useMarkChannelRead } from '@discordia/core';
import { ChatPanel, SearchPanel } from '@/features/chat';
import { useCurrentServer } from '@/features/servers';
import { VoiceChannelPanel } from '@/features/voice';
import { useTabVisible } from '@/shared/hooks/useTabVisible';

// The channel screen: the header, and the chat or the voice panel depending on the channel type.
export const ChannelRoute = () => {
    const { channelId } = useParams();
    const [searchOpen, setSearchOpen] = useState(false);
    // The whole server and not just the channel: `my_permissions` comes with it, and it is what
    // decides whether the composer is usable. It is the one the side panel already loaded, so a
    // change in permissions costs a single request and reaches both at once.
    const { server } = useCurrentServer();

    const channel = server?.channels.find(c => c.id === channelId) ?? null;

    // Reading is what the user does with a text channel in front of them: a voice channel has no
    // messages, and a hidden tab does not read what arrives.
    const tabVisible = useTabVisible();
    useMarkChannelRead(channel?.id ?? '', tabVisible && channel?.type === 'text');

    // Until the new channel loads, don't keep rendering the previous one.
    if (!channel) return null;

    const isVoice = channel.type === 'voice';

    return (
        <div className="flex flex-col h-full w-full">
            <div
                className="flex items-center gap-3 px-4 py-3 shrink-0"
                style={{ borderBottom: '1px solid #202225' }}
            >
                {isVoice
                    ? <Volume2 size={20} style={{ color: '#8e9297', flexShrink: 0 }} />
                    : <Hash size={20} style={{ color: '#8e9297', flexShrink: 0 }} />
                }
                <div className="min-w-0 flex-1">
                    <span className="font-bold text-sm text-white">{channel.name}</span>
                    {channel.topic && (
                        <p className="text-xs truncate mt-0.5" style={{ color: '#99aab5' }}>
                            {channel.topic}
                        </p>
                    )}
                </div>
                {!isVoice && (
                    <button
                        type="button"
                        onClick={() => setSearchOpen(o => !o)}
                        aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar mensajes'}
                        className="shrink-0 flex items-center justify-center w-8 h-8 rounded hover:bg-black/10"
                    >
                        <Search size={18} style={{ color: searchOpen ? '#fff' : '#8e9297' }} />
                    </button>
                )}
            </div>

            {isVoice ? (
                <VoiceChannelPanel
                    key={channel.id}
                    channel={{ id: channel.id, serverId: channel.server_id, name: channel.name }}
                    canJoin={canJoinVoice(server?.my_permissions ?? NONE)}
                />
            ) : searchOpen ? (
                <SearchPanel
                    key={channel.id}
                    serverId={channel.server_id}
                    onClose={() => setSearchOpen(false)}
                />
            ) : (
                <ChatPanel
                    key={channel.id}
                    channelId={channel.id}
                    channelName={channel.name}
                    topic={channel.topic}
                    canSendMessages={hasPermission(server?.my_permissions ?? NONE, SEND_MESSAGES)}
                    canManageMessages={hasPermission(server?.my_permissions ?? NONE, MANAGE_MESSAGES)}
                />
            )}
        </div>
    );
};
