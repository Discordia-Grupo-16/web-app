import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Hash, Volume2 } from 'lucide-react';
import { serversService } from '../../services/communityServices';
import type { Channel } from '@discordia/api';
import { ChatPanel } from '../../realtime/components/ChatPanel';

export const ChannelView = () => {
    const { serverId, channelId } = useParams();
    const [channel, setChannel] = useState<Channel | null>(null);

    useEffect(() => {
        if (!serverId || !channelId) return;
        serversService.getServer(serverId)
            .then(srv => {
                const ch = srv.channels.find(c => c.id === channelId) ?? null;
                setChannel(ch);
            })
            .catch(console.error);
    }, [serverId, channelId]);

    // Until the new channel loads, don't keep rendering the previous one.
    if (!channel || channel.id !== channelId) return null;

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
                <ChatPanel key={channel.id} channelId={channel.id} channelName={channel.name} topic={channel.topic} />
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
