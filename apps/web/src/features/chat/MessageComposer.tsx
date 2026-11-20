import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Paperclip, SendHorizontal, X } from 'lucide-react';
import type { MessageAttachment } from '@discordia/api';
import { PERMISSION_COPY, type RealtimeStatus, type RejectedMessage } from '@discordia/core';

interface MessageComposerProps {
    channelName: string;
    status: RealtimeStatus;
    maxLength: number;
    onSend: (content: string, attachments?: MessageAttachment[]) => void;
    onUpload: (file: File) => Promise<MessageAttachment>;
    rejected: RejectedMessage | null;
    onRejectedHandled: () => void;
    /** SEND_MESSAGES, resolved by `community`. The backend checks it too: this only hides it. */
    canSendMessages: boolean;
}

const MAX_TEXTAREA_HEIGHT_PX = 8 * 24;
const COUNTER_THRESHOLD = 0.8;

export const MessageComposer = ({
    channelName,
    status,
    maxLength,
    onSend,
    onUpload,
    rejected,
    onRejectedHandled,
    canSendMessages,
}: MessageComposerProps) => {
    const [content, setContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // The server limit counts runes (code points), so [...content] instead of content.length: an emoji is 1.
    const length = [...content].length;
    const tooLong = length > maxLength;
    const hasContent = content.trim() !== '' || attachments.length > 0;
    const canSend = canSendMessages && hasContent && !tooLong && !uploading && status === 'open';

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
    }, [content]);

    // The server rejected a message the client should have blocked: show why and give the text back.
    // Done while rendering (not in an effect) so it does not cascade an extra render.
    const [handledRejection, setHandledRejection] = useState<RejectedMessage | null>(null);
    if (rejected && rejected !== handledRejection) {
        setHandledRejection(rejected);
        setError(rejected.message);
        // Keep whatever the user started typing meanwhile instead of overwriting it.
        if (rejected.code === 'MESSAGE_TOO_LONG' && content === '') setContent(rejected.content);
    }

    useEffect(() => {
        if (rejected) onRejectedHandled();
    }, [rejected, onRejectedHandled]);

    const submit = () => {
        if (!canSend) return;
        // Sent as typed: trim() is only used to decide whether the button is enabled.
        onSend(content, attachments.length > 0 ? attachments : undefined);
        setContent('');
        setAttachments([]);
        setError(null);
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
        e.preventDefault();
        submit();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Reset so the same file can be re-picked after removal.
        e.target.value = '';
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const attachment = await onUpload(file);
            setAttachments((prev) => [...prev, attachment]);
            textareaRef.current?.focus();
        } catch (err) {
            const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
            setError(detail ?? 'No se pudo subir el archivo. Intentá de nuevo.');
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="px-4 pb-4 pt-1 shrink-0">
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-2 p-3 rounded-lg border border-white/10" style={{ backgroundColor: '#2f3136' }}>
                    {attachments.map((a, i) => (
                        <div key={i} className="flex flex-col gap-1" style={{ maxWidth: '160px' }}>
                            <div
                                className="relative rounded overflow-hidden border border-white/10"
                                style={{ backgroundColor: '#202225' }}
                            >
                                {a.contentType.startsWith('image/') ? (
                                    <img
                                        src={a.url}
                                        alt={a.filename}
                                        className="object-cover"
                                        style={{ width: '160px', height: '160px' }}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center" style={{ width: '160px', height: '160px' }}>
                                        <span className="text-4xl">📄</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeAttachment(i)}
                                    aria-label={`Quitar ${a.filename}`}
                                    className="absolute top-1 right-1 rounded-full p-1"
                                    style={{ backgroundColor: '#ed4245', color: 'white' }}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                            <span
                                className="text-xs truncate"
                                style={{ color: '#b9bbbe', maxWidth: '160px' }}
                                title={a.filename}
                            >
                                {a.filename}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-end gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: '#40444b' }}>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canSendMessages || uploading}
                    aria-label="Adjuntar archivo"
                    className="p-1 rounded self-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: '#99aab5' }}
                >
                    <Paperclip size={20} />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain"
                    className="hidden"
                    onChange={(e) => { void handleFileChange(e); }}
                />
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={content}
                    onChange={(e) => {
                        setContent(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={!canSendMessages}
                    placeholder={
                        canSendMessages
                            ? PERMISSION_COPY.sendMessage(channelName)
                            : PERMISSION_COPY.cannotSendMessage(channelName)
                    }
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
            {error && (
                <p role="alert" className="text-xs mt-1" style={{ color: '#ed4245' }}>{error}</p>
            )}
        </div>
    );
};
