import { useParams } from 'react-router-dom';
import { Hash, Volume2 } from 'lucide-react';
import { NONE, SEND_MESSAGES, canJoinVoice, hasPermission } from '@discordia/core';
import { ChatPanel } from '@/features/chat';
import { useCurrentServer } from '@/features/servers';
import { VoiceChannelPanel } from '@/features/voice';

// The channel screen: the header, and the chat or the voice panel depending on the channel type.
export const ChannelRoute = () => {
    const { channelId } = useParams();
    // The whole server and not just the channel: `my_permissions` comes with it, and it is what
    // decides whether the composer is usable. It is the one the side panel already loaded, so a
    // change in permissions costs a single request and reaches both at once.
    const { server } = useCurrentServer();

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
                    canJoin={canJoinVoice(server?.my_permissions ?? NONE)}
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
