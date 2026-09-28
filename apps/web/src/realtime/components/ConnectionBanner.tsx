import type { RealtimeStatus } from '../realtimeContext';

const BANNERS: Record<Exclude<RealtimeStatus, 'open'>, { text: string; color: string }> = {
    idle: { text: 'Conectando…', color: '#faa61a' },
    connecting: { text: 'Conectando…', color: '#faa61a' },
    reconnecting: { text: 'Se perdió la conexión. Reconectando…', color: '#faa61a' },
    closed: { text: 'Desconectado.', color: '#ed4245' },
    disabled: { text: 'Chat en tiempo real no configurado (falta VITE_WS_URL).', color: '#ed4245' },
};

export const ConnectionBanner = ({ status }: { status: RealtimeStatus }) => {
    if (status === 'open') return null;
    const { text, color } = BANNERS[status];

    return (
        <div
            role="status"
            className="px-4 py-1 text-xs font-semibold text-center shrink-0"
            style={{ backgroundColor: color, color: '#ffffff' }}
        >
            {text}
        </div>
    );
};
