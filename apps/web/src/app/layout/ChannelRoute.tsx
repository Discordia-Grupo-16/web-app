import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Hash, Volume2 } from 'lucide-react';
import type { Channel } from '@discordia/api';
import { ChatPanel } from '@/features/chat';
import { VoiceChannelPanel } from '@/features/voice';
import { serversService } from '@/shared/api';

// The channel screen: the header, and the chat or the voice panel depending on the channel type.
export const ChannelRoute = () => {
    const { serverId, channelId } = useParams();
    const [channel, setChannel] = useState<Channel | null>(null);

    useEffect(() => {
        if (!serverId || !channelId) return;
        serversService.getServer(serverId)
            .then(srv => setChannel(srv.channels.find(c => c.id === channelId) ?? null))
            .catch(console.error);
    }, [serverId, channelId]);

    // Until the new channel loads, don't keep rendering the previous one.
    if (!channel || channel.id !== channelId) return null;

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
                <ChatPanel key={channel.id} channelId={channel.id} channelName={channel.name} topic={channel.topic} />
            )}
        </div>
    );
};
