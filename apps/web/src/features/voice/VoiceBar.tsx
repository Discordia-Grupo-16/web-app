import { Link } from 'react-router-dom';
import { Signal, X } from 'lucide-react';
import { useVoice, VOICE_DISCONNECT_TEXTS } from '@discordia/core';

const channelPath = (serverId: string, channelId: string) => `/servers/${serverId}/channels/${channelId}`;

// The way back to the call from any screen, including another server.
export const VoiceBar = () => {
    const { call, dismiss } = useVoice();
    if (call.status === 'idle') return null;

    if (call.status === 'disconnected') {
        return (
            <div role="status" className="flex items-start gap-2 px-3 py-2 text-xs" style={{ background: '#292b2f', borderTop: '1px solid #202225', color: '#dcddde' }}>
                <p className="flex-1">{VOICE_DISCONNECT_TEXTS[call.reason]}</p>
                <button
                    onClick={dismiss}
                    aria-label="Cerrar aviso"
                    className="p-0.5 rounded shrink-0 focus-visible:outline-2 focus-visible:outline-white"
                    style={{ color: '#b9bbbe' }}
                >
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="px-3 py-2" style={{ background: '#292b2f', borderTop: '1px solid #202225' }}>
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#3ba55d' }}>
                <Signal size={14} aria-hidden />
                Conectado a
            </p>
            <Link
                to={channelPath(call.channel.serverId, call.channel.id)}
                className="block truncate text-xs hover:underline focus-visible:outline-2 focus-visible:outline-white rounded-sm"
                style={{ color: '#b9bbbe' }}
            >
                {call.channel.name}
            </Link>
        </div>
    );
};
