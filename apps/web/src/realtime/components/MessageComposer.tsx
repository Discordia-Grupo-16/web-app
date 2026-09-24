import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SendHorizontal } from 'lucide-react';
import type { RealtimeStatus } from '../realtimeContext';

interface MessageComposerProps {
    channelName: string;
    status: RealtimeStatus;
    maxLength: number;
    onSend: (content: string) => void;
}

const MAX_TEXTAREA_HEIGHT_PX = 8 * 24;
const COUNTER_THRESHOLD = 0.8;

export const MessageComposer = ({ channelName, status, maxLength, onSend }: MessageComposerProps) => {
    const [content, setContent] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // The server limit counts runes (code points), so [...content] instead of content.length: an emoji is 1.
    const length = [...content].length;
    const tooLong = length > maxLength;
    const canSend = content.trim() !== '' && !tooLong && status === 'open';

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
    }, [content]);

    const submit = () => {
        if (!canSend) return;
        // Sent as typed: trim() is only used to decide whether the button is enabled.
        onSend(content);
        setContent('');
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
        e.preventDefault();
        submit();
    };

    return (
        <div className="px-4 pb-4 pt-1 shrink-0">
            <div className="flex items-end gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: '#40444b' }}>
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Enviar mensaje a #${channelName}`}
                    className="flex-1 resize-none bg-transparent outline-none text-sm leading-6"
                    style={{ color: '#dcddde' }}
                />
                {length >= maxLength * COUNTER_THRESHOLD && (
                    <span
                        className="text-xs self-center shrink-0"
                        style={{ color: tooLong ? '#ed4245' : '#99aab5' }}
                    >
                        {length}/{maxLength}
                    </span>
                )}
                <button
                    type="button"
                    onClick={submit}
                    disabled={!canSend}
                    aria-label="Enviar mensaje"
                    className="p-1 rounded self-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: '#7289da' }}
                >
                    <SendHorizontal size={20} />
                </button>
            </div>
        </div>
    );
};
