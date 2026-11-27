import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { PRESENCE_LABELS, UNAVAILABLE_USER_NAME, useAuth, usePresence, usePublicProfile } from '@discordia/core';
import { presenceService } from '@/shared/api';
import { PresenceDot } from '@/shared/ui/PresenceDot';
import { useCommonServers } from './useCommonServers';

interface PublicProfileModalProps {
    userId: string;
    onClose: () => void;
}

const MUTED = '#99aab5';

const Avatar = ({ name, avatarUrl }: { name: string; avatarUrl: string | null }) => (
    <div
        className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-2xl font-extrabold text-white overflow-hidden"
        style={{ background: avatarUrl ? 'transparent' : '#7289da' }}
    >
        {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
            (name.trim()[0] ?? '?').toUpperCase()
        )}
    </div>
);

const SectionTitle = ({ children }: { children: string }) => (
    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#72767d' }}>
        {children}
    </p>
);

const RetryButton = ({ onRetry }: { onRetry: () => void }) => (
    <button type="button" onClick={onRetry} className="font-semibold underline" style={{ color: '#7289da' }}>
        Reintentar
    </button>
);

const CommonServers = ({ userId }: { userId: string }) => {
    const { state, retry } = useCommonServers(userId);

    return (
        <section aria-label="Servidores en común">
            <SectionTitle>Servidores en común</SectionTitle>
            {state.status === 'loading' && (
                <p className="text-sm" style={{ color: MUTED }}>Cargando...</p>
            )}
            {state.status === 'error' && (
                <p className="text-sm" style={{ color: '#ed4245' }}>
                    No pudimos cargar los servidores en común. <RetryButton onRetry={retry} />
                </p>
            )}
            {state.status === 'ready' && state.servers.length === 0 && (
                <p className="text-sm" style={{ color: MUTED }}>No tienen servidores en común.</p>
            )}
            {state.status === 'ready' && state.servers.length > 0 && (
                <ul className="flex flex-col gap-1">
                    {state.servers.map((server) => (
                        <li key={server.id} className="flex items-center gap-2 text-sm" style={{ color: '#dcddde' }}>
                            <span
                                className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                                style={{ background: server.avatar_url ? 'transparent' : '#5b6eae' }}
                                aria-hidden="true"
                            >
                                {server.avatar_url ? (
                                    <img src={server.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    (server.name.trim()[0] ?? '?').toUpperCase()
                                )}
                            </span>
                            <span className="truncate">{server.name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

// Public profile of another user: only public data (name, photo, bio), the activity status and the
// servers in common.
export const PublicProfileModal = ({ userId, onClose }: PublicProfileModalProps) => {
    const { user } = useAuth();
    const { state, retry } = usePublicProfile(userId);
    const isOwnProfile = user?.id === userId;
    // A profile is opened from a server, and its snapshot is where the status comes from (SCRUM-27).
    // Null while it is not known: nothing is shown rather than a "disconnected" that may be false.
    const { serverId } = useParams();
    const statuses = usePresence(serverId, presenceService.getServerPresence);
    const status = statuses ? (statuses.get(userId) ?? 'offline') : null;

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Perfil de usuario"
                className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
                style={{ background: '#36393f' }}
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="absolute top-4 right-4"
                    style={{ color: MUTED }}
                >
                    <X size={18} />
                </button>

                {state.status === 'loading' && (
                    <p className="text-sm" style={{ color: MUTED }}>Cargando perfil...</p>
                )}

                {state.status === 'error' && (
                    <p className="text-sm" style={{ color: '#ed4245' }}>
                        No pudimos cargar el perfil. <RetryButton onRetry={retry} />
                    </p>
                )}

                {state.status === 'ready' && state.profile === null && (
                    <div className="flex items-center gap-4">
                        <Avatar name="?" avatarUrl={null} />
                        <div>
                            <h2 className="text-lg font-black text-white">{UNAVAILABLE_USER_NAME}</h2>
                            <p className="text-sm" style={{ color: MUTED }}>El perfil no está disponible</p>
                        </div>
                    </div>
                )}

                {state.status === 'ready' && state.profile && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4 pr-6">
                            <span className="relative shrink-0">
                                <Avatar name={state.profile.name} avatarUrl={state.profile.avatarUrl} />
                                {status && <PresenceDot status={status} ring="#36393f" size="lg" />}
                            </span>
                            <div className="min-w-0">
                                <h2 className="text-lg font-black text-white break-words">{state.profile.name}</h2>
                                {status && <p className="text-sm" style={{ color: MUTED }}>{PRESENCE_LABELS[status]}</p>}
                            </div>
                        </div>
                        {state.profile.bio && (
                            <section aria-label="Sobre mí">
                                <SectionTitle>Sobre mí</SectionTitle>
                                <p className="text-sm whitespace-pre-wrap break-words" style={{ color: '#dcddde' }}>
                                    {state.profile.bio}
                                </p>
                            </section>
                        )}
                        {!isOwnProfile && <CommonServers userId={userId} />}
                    </div>
                )}
            </div>
        </div>
    );
};
