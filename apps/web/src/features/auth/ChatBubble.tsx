export const ChatBubble = ({
    avatar,
    name,
    message,
    time,
    color,
}: {
    avatar: string
    name: string
    message: string
    time: string
    color: string
}) => {
    return (
        <div
            className="flex items-start gap-3 p-4 rounded-xl backdrop-blur-sm"
            style={{ background: 'rgba(44,47,51,0.7)', border: '1px solid rgba(114,137,218,0.1)' }}
        >
            <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
                style={{ background: color }}
            >
                {avatar}
            </div>
            <div className="min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                    <span
                        className="text-sm font-semibold"
                        style={{ fontFamily: 'Open Sans, sans-serif', color: '#ffffff' }}
                    >
                        {name}
                    </span>
                    <span className="text-xs" style={{ color: '#99aab5' }}>
                        {time}
                    </span>
                </div>
                <p className="text-sm leading-snug" style={{ fontFamily: 'Open Sans, sans-serif', color: '#dcddde' }}>
                    {message}
                </p>
            </div>
        </div>
    )
}