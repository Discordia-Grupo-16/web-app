import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Hash, Volume2 } from 'lucide-react';
import type { Server } from '@discordia/api';
import { NONE, SEND_MESSAGES, hasPermission } from '@discordia/core';
import { ChatPanel } from '@/features/chat';
import { VoiceChannelPanel } from '@/features/voice';
import { serversService } from '@/shared/api';
import { usePolling } from '@/shared/hooks/usePolling';

// The channel screen: the header, and the chat or the voice panel depending on the channel type.
export const ChannelRoute = () => {
    const { serverId, channelId } = useParams();
    // The whole server and not just the channel: `my_permissions` comes with it, and it is what
    // decides whether the composer is usable.
    const [server, setServer] = useState<Server | null>(null);

    useEffect(() => {
        if (!serverId || !channelId) return;
        serversService.getServer(serverId)
            .then(setServer)
            .catch(console.error);
    }, [serverId, channelId]);

    // Los permisos cambian sin que nadie los empuje por el socket, y el poll de
    // `useServer` vive en el panel lateral: sin este, quitarle SEND_MESSAGES a
    // alguien dejaba la caja como estaba hasta que cambiara de canal o
    // recargara. El mobile ya lo refresca en ChannelScreen, así que sin esto
    // las dos plataformas no hacen lo mismo.
    usePolling(() => {
        if (!serverId) return;
        serversService.getServer(serverId)
            .then(srv => setServer(prev => (prev && prev.id === srv.id ? srv : prev)))
            // Un servidor que ya no está lo resuelve quien lo carga en el panel.
            .catch(console.error);
    }, !!serverId);

    const channel = server?.channels.find(c => c.id === channelId) ?? null;

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
                <div className="min-w-0">
                    <span className="font-bold text-sm text-white">{channel.name}</span>
                    {channel.topic && (
                        <p className="text-xs truncate mt-0.5" style={{ color: '#99aab5' }}>
                            {channel.topic}
                        </p>
                    )}
                </div>
            </div>

            {isVoice ? (
                <VoiceChannelPanel
                    key={channel.id}
                    channel={{ id: channel.id, serverId: channel.server_id, name: channel.name }}
                />
            ) : (
                <ChatPanel
                    key={channel.id}
                    channelId={channel.id}
                    channelName={channel.name}
                    topic={channel.topic}
                    canSendMessages={hasPermission(server?.my_permissions ?? NONE, SEND_MESSAGES)}
                />
            )}
        </div>
    );
};
