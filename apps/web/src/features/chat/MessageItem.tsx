import { MessageEditor } from './MessageEditor';

interface MessageItemProps {
    authorId: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    content: string;
    createdAt?: string;
    /** Last edit, or null/absent if the message was never edited. */
    editedAt?: string | null;
    /** The user may edit this message: it is theirs and they can still write in the channel. */
    canEdit?: boolean;
    editing?: boolean;
    maxLength?: number;
    onStartEdit?: () => void;
    onSaveEdit?: (content: string) => Promise<void>;
    onCancelEdit?: () => void;
    /** The user may delete this message: it is theirs, or they have MANAGE_MESSAGES. */
    canDelete?: boolean;
    onRequestDelete?: () => void;
    /** Why the last delete of this message failed. */
    deleteError?: string | null;
    sending?: boolean;
    failed?: boolean;
    errorText?: string;
    errorTitle?: string;
    onRetry?: () => void;
    retryDisabled?: boolean;
    onDiscard?: () => void;
    onSelectAuthor?: () => void;
}

const AVATAR_COLORS = ['#7289da', '#43b581', '#faa61a', '#f47fff', '#f04747', '#00b0f4', '#747f8d', '#e67e22'];

const avatarColor = (authorId: string): string => {
    let hash = 0;
    for (const char of authorId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const formatTime = (createdAt: string): string =>
    new Date(createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

const formatFullDate = (date: string): string =>
    new Date(date).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });

export const MessageItem = ({
    authorId,
    authorName,
    authorAvatarUrl = null,
    content,
    createdAt,
    editedAt = null,
    canEdit = false,
    editing = false,
    maxLength = 2000,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    canDelete = false,
    onRequestDelete,
    deleteError = null,
    sending = false,
    failed = false,
    errorText,
    errorTitle,
    onRetry,
    retryDisabled = false,
    onDiscard,
    onSelectAuthor,
}: MessageItemProps) => {
    const avatar = (
        <div
            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white font-bold select-none overflow-hidden"
            style={{ backgroundColor: authorAvatarUrl ? 'transparent' : avatarColor(authorId) }}
        >
            {authorAvatarUrl ? (
                <img src={authorAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
                (authorName.trim()[0] ?? '?').toUpperCase()
            )}
        </div>
    );

    return (
        <div
            className="group flex gap-4 px-4 py-1 hover:bg-black/5"
            style={{
                opacity: sending ? 0.5 : 1,
                borderLeft: failed ? '2px solid #ed4245' : '2px solid transparent',
            }}
            title={errorTitle}
        >
            {onSelectAuthor ? (
                <button
                    type="button"
                    onClick={onSelectAuthor}
                    aria-label={`Ver perfil de ${authorName}`}
                    className="shrink-0 self-start rounded-full cursor-pointer"
                >
                    {avatar}
                </button>
            ) : (
                avatar
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    {onSelectAuthor ? (
                        <button
                            type="button"
                            onClick={onSelectAuthor}
                            className="font-bold text-sm text-white hover:underline cursor-pointer"
                        >
                            {authorName}
                        </button>
                    ) : (
                        <span className="font-bold text-sm text-white">{authorName}</span>
                    )}
                    {createdAt && (
                        <span className="text-xs" style={{ color: '#72767d' }}>{formatTime(createdAt)}</span>
                    )}
                    {!editing && ((canEdit && onStartEdit) || (canDelete && onRequestDelete)) && (
                        <span className="ml-auto flex gap-3">
                            {canEdit && onStartEdit && (
                                <button
                                    type="button"
                                    onClick={onStartEdit}
                                    aria-label="Editar mensaje"
                                    className="text-xs font-semibold opacity-0 group-hover:opacity-100 focus:opacity-100 hover:underline"
                                    style={{ color: '#99aab5' }}
                                >
                                    Editar
                                </button>
                            )}
                            {canDelete && onRequestDelete && (
                                <button
                                    type="button"
                                    onClick={onRequestDelete}
                                    aria-label="Eliminar mensaje"
                                    className="text-xs font-semibold opacity-0 group-hover:opacity-100 focus:opacity-100 hover:underline"
                                    style={{ color: '#ed4245' }}
                                >
                                    Eliminar
                                </button>
                            )}
                        </span>
                    )}
                </div>
                {editing && onSaveEdit && onCancelEdit ? (
                    <MessageEditor
                        initialContent={content}
                        maxLength={maxLength}
                        onSave={onSaveEdit}
                        onCancel={onCancelEdit}
                    />
                ) : (
                    /* Content comes from other users: always rendered as text, never as HTML. */
                    <p className="text-sm whitespace-pre-wrap break-words" style={{ color: '#dcddde' }}>
                        {content}
                        {editedAt && (
                            <span className="ml-1 text-xs" style={{ color: '#72767d' }} title={formatFullDate(editedAt)}>
                                (editado)
                            </span>
                        )}
                    </p>
                )}
                {deleteError && (
                    <p role="alert" className="text-xs mt-1" style={{ color: '#ed4245' }}>{deleteError}</p>
                )}
                {failed && (
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: '#ed4245' }}>
                        {errorText && <span>{errorText}</span>}
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                disabled={retryDisabled}
                                className="font-semibold underline disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Reintentar
                            </button>
                        )}
                        {onDiscard && (
                            <button type="button" onClick={onDiscard} className="font-semibold underline">
                                Descartar
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
