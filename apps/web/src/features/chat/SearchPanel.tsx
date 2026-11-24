import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { authorView, useAuth, usePublicProfiles, useSearchMessages } from '@discordia/core';
import { messagesService } from '@/shared/api';

interface SearchPanelProps {
    serverId: string;
    onClose: () => void;
}

const AVATAR_COLORS = ['#7289da', '#43b581', '#faa61a', '#f47fff', '#f04747', '#00b0f4', '#747f8d', '#e67e22'];

const avatarColor = (id: string): string => {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const SearchPanel = ({ serverId, onClose }: SearchPanelProps) => {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [authorFilter, setAuthorFilter] = useState('');
    const { state, search, loadMore, clear } = useSearchMessages(serverId, messagesService);

    const authorIds = useMemo(
        () => [...new Set(state.results.map(r => r.authorId))].filter(id => id !== user?.id),
        [state.results, user?.id],
    );
    const profiles = usePublicProfiles(authorIds);

    const handleSearch = () => {
        if (!query.trim() && !authorFilter.trim()) return;
        search(query.trim(), authorFilter.trim());
    };

    const handleClose = () => {
        clear();
        onClose();
    };

    const hasSearched = state.activeQuery !== '' || state.activeAuthor !== '';

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #202225' }}>
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: '#72767d' }}
                        />
                        <input
                            autoFocus
                            className="w-full pl-9 pr-3 py-2 rounded text-sm text-white outline-none"
                            style={{ backgroundColor: '#40444b' }}
                            placeholder="Buscar mensajes…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleSearch}
                        className="px-3 py-2 rounded text-sm font-medium text-white"
                        style={{ backgroundColor: '#5865f2' }}
                    >
                        Buscar
                    </button>
                    <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Cerrar búsqueda"
                        className="flex items-center justify-center w-9 rounded hover:bg-black/10"
                    >
                        <X size={18} style={{ color: '#72767d' }} />
                    </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <input
                        className="flex-1 px-3 py-1.5 rounded text-sm text-white outline-none"
                        style={{ backgroundColor: '#40444b' }}
                        placeholder="Filtrar por autor…"
                        value={authorFilter}
                        onChange={e => setAuthorFilter(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                    />
                    <button
                        type="button"
                        onClick={() => setAuthorFilter(user?.name ?? '')}
                        className="shrink-0 px-2 py-1.5 rounded text-xs"
                        style={{ color: '#b9bbbe', backgroundColor: '#2f3136' }}
                        title="Solo mis mensajes"
                    >
                        Solo mis mensajes
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
                {state.loading && (
                    <p className="text-center py-8 text-sm" style={{ color: '#72767d' }}>Buscando…</p>
                )}
                {state.error && (
                    <p className="text-center py-8 text-sm" style={{ color: '#ed4245' }}>
                        Error al buscar. Intentá de nuevo.
                    </p>
                )}
                {!state.loading && !state.error && !hasSearched && (
                    <p className="text-center py-8 text-sm" style={{ color: '#72767d' }}>
                        Ingresá un texto o nombre de autor y presioná Buscar.
                    </p>
                )}
                {!state.loading && !state.error && hasSearched && state.results.length === 0 && (
                    <p className="text-center py-8 text-sm" style={{ color: '#72767d' }}>Sin resultados.</p>
                )}
                {state.results.map(msg => {
                    const { name, avatarUrl } = authorView(msg.authorId, user ?? null, profiles.get(msg.authorId));
                    const color = avatarColor(msg.authorId);
                    const time = new Date(msg.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
                    return (
                        <div key={msg.messageId} className="flex gap-3 px-4 py-2 hover:bg-black/5">
                            <div
                                className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm select-none overflow-hidden"
                                style={{ backgroundColor: avatarUrl ? 'transparent' : color }}
                            >
                                {avatarUrl
                                    ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                    : (name[0] ?? '?').toUpperCase()
                                }
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-white">{name}</span>
                                    <span className="text-xs" style={{ color: '#72767d' }}>{time}</span>
                                    {msg.editedAt && (
                                        <span className="text-xs" style={{ color: '#72767d' }}>(editado)</span>
                                    )}
                                </div>
                                <p className="text-sm whitespace-pre-wrap break-words" style={{ color: '#dcddde' }}>{msg.content}</p>
                            </div>
                        </div>
                    );
                })}
                {state.hasMore && (
                    <div className="flex justify-center py-4">
                        <button
                            type="button"
                            onClick={loadMore}
                            disabled={state.loadingMore}
                            className="text-sm px-4 py-2 rounded text-white disabled:opacity-50"
                            style={{ backgroundColor: '#40444b' }}
                        >
                            {state.loadingMore ? 'Cargando…' : 'Cargar más'}
                        </button>
                    </div>
                )}
                {state.loadMoreError && (
                    <div className="text-center py-2 text-sm" style={{ color: '#ed4245' }}>
                        Error al cargar más.{' '}
                        <button type="button" onClick={loadMore} className="underline">Reintentar</button>
                    </div>
                )}
            </div>
        </div>
    );
};
