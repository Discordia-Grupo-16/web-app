import { Link } from 'react-router-dom';
import { PhoneOff, Signal, X } from 'lucide-react';
import { canRejoin, useVoice, VOICE_DISCONNECT_TEXTS, VOICE_TEXTS } from '@discordia/core';

const channelPath = (serverId: string, channelId: string) => `/servers/${serverId}/channels/${channelId}`;

const barStyle = { background: '#292b2f', borderTop: '1px solid #202225' };

// The way back to the call, and out of it, from any screen, including another server.
export const VoiceBar = () => {
    const { call, attempt, join, leave, dismiss } = useVoice();
    if (call.status === 'idle') return null;

    if (call.status === 'disconnected') {
        return (
            <div role="status" className="flex items-start gap-2 px-3 py-2 text-xs" style={{ ...barStyle, color: '#dcddde' }}>
                <div className="flex-1 min-w-0">
                    <p>{VOICE_DISCONNECT_TEXTS[call.reason]}</p>
                    {canRejoin(call.reason) && (
                        <button
                            onClick={() => join(call.channel)}
                            className="mt-1.5 px-2.5 py-1 rounded text-xs font-semibold text-white transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-white"
                            style={{ background: '#3ba55d' }}
                        >
                            {VOICE_TEXTS.rejoin}
                        </button>
                    )}
                </div>
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

    // Leaving does not cancel a join in progress: the button waits until it ends.
    const joining = attempt?.status === 'connecting';

    return (
        <div className="flex items-center gap-2 px-3 py-2" style={barStyle}>
            <div className="flex-1 min-w-0">
                <p
                    role="status"
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: call.reconnecting ? '#faa61a' : '#3ba55d' }}
                >
                    <Signal size={14} aria-hidden />
                    {call.reconnecting ? VOICE_TEXTS.reconnecting : VOICE_TEXTS.connectedTo}
                </p>
                <Link
                    to={channelPath(call.channel.serverId, call.channel.id)}
                    className="block truncate text-xs hover:underline focus-visible:outline-2 focus-visible:outline-white rounded-sm"
                    style={{ color: '#b9bbbe' }}
                >
                    {call.channel.name}
                </Link>
            </div>
            <button
                onClick={leave}
                disabled={joining}
                aria-label={VOICE_TEXTS.leave}
                title={VOICE_TEXTS.leave}
                className="p-1.5 rounded shrink-0 transition-colors hover:bg-[#ed4245]/15 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent"
                style={{ color: '#ed4245' }}
            >
                <PhoneOff size={18} />
            </button>
        </div>
    );
};
