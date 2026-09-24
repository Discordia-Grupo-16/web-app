interface MessageItemProps {
    authorId: string;
    authorName: string;
    content: string;
    createdAt?: string;
    sending?: boolean;
    failed?: boolean;
    errorText?: string;
    errorTitle?: string;
    onRetry?: () => void;
    retryDisabled?: boolean;
    onDiscard?: () => void;
}

const AVATAR_COLORS = ['#7289da', '#43b581', '#faa61a', '#f47fff', '#f04747', '#00b0f4', '#747f8d', '#e67e22'];

const avatarColor = (authorId: string): string => {
    let hash = 0;
    for (const char of authorId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const formatTime = (createdAt: string): string =>
    new Date(createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export const MessageItem = ({
    authorId,
    authorName,
    content,
    createdAt,
    sending = false,
    failed = false,
    errorText,
    errorTitle,
    onRetry,
    retryDisabled = false,
    onDiscard,
}: MessageItemProps) => (
    <div
        className="flex gap-4 px-4 py-1 hover:bg-black/5"
        style={{
            opacity: sending ? 0.5 : 1,
            borderLeft: failed ? '2px solid #ed4245' : '2px solid transparent',
        }}
        title={errorTitle}
    >
        <div
            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white font-bold select-none"
            style={{ backgroundColor: avatarColor(authorId) }}
        >
            {(authorName.trim()[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
                <span className="font-bold text-sm text-white">{authorName}</span>
                {createdAt && (
                    <span className="text-xs" style={{ color: '#72767d' }}>{formatTime(createdAt)}</span>
                )}
            </div>
            {/* Content comes from other users: always rendered as text, never as HTML. */}
            <p className="text-sm whitespace-pre-wrap break-words" style={{ color: '#dcddde' }}>{content}</p>
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
