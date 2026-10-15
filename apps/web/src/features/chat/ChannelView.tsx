import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Hash, Volume2 } from 'lucide-react';
import { NONE, SEND_MESSAGES, hasPermission } from '@discordia/core';
import { serversService } from '@/shared/api';
import type { Server } from '@discordia/api';
import { ChatPanel } from './ChatPanel';

export const ChannelView = () => {
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

    const channel = server?.channels.find(c => c.id === channelId) ?? null;

    // Until the new channel loads, don't keep rendering the previous one.
    if (!channel) return null;

    const isText = channel.type === 'text';

    return (
        <div className="flex flex-col h-full w-full">
            <div
                className="flex items-center gap-3 px-4 py-3 shrink-0"
                style={{ borderBottom: '1px solid #202225' }}
            >
                {isText
                    ? <Hash size={20} style={{ color: '#8e9297', flexShrink: 0 }} />
                    : <Volume2 size={20} style={{ color: '#8e9297', flexShrink: 0 }} />
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

            {isText ? (
                <ChatPanel
                    key={channel.id}
                    channelId={channel.id}
                    channelName={channel.name}
                    topic={channel.topic}
                    canSendMessages={hasPermission(server?.my_permissions ?? NONE, SEND_MESSAGES)}
                />
            ) : (
                <div className="flex-1 flex items-center justify-center" style={{ color: '#99aab5' }}>
                    <div className="text-center select-none">
                        <Volume2 size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-lg font-semibold">Bienvenido a #{channel.name}</p>
                        {channel.topic && (
                            <p className="text-sm mt-1">{channel.topic}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
