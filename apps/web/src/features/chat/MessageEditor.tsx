import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { editErrorText } from '@discordia/core';

interface MessageEditorProps {
    initialContent: string;
    maxLength: number;
    /** Rejects with the HTTP error if the server refuses; the editor stays open and says why. */
    onSave: (content: string) => Promise<void>;
    onCancel: () => void;
}

const COUNTER_THRESHOLD = 0.8;

// Edits a message where it is: Enter saves, Esc cancels and Shift+Enter breaks the line, like the composer.
export const MessageEditor = ({ initialContent, maxLength, onSave, onCancel }: MessageEditorProps) => {
    const [draft, setDraft] = useState(initialContent);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // The server limit counts runes (code points), so [...draft] instead of draft.length: an emoji is 1.
    const length = [...draft].length;
    const tooLong = length > maxLength;
    const canSave = draft.trim() !== '' && !tooLong && !saving;

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, []);

    const save = async () => {
        if (!canSave) return;
        // Nothing changed: there is nothing to tell the server, and it would not mark it as edited.
        if (draft === initialContent) {
            onCancel();
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onSave(draft);
        } catch (err) {
            setError(editErrorText(err));
            setSaving(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
            return;
        }
        if (e.key !== 'Enter' || e.shiftKey) return;
        e.preventDefault();
        void save();
    };

    return (
        <div className="mt-1">
            <textarea
                ref={textareaRef}
                rows={2}
                value={draft}
                disabled={saving}
                aria-label="Editar mensaje"
                onChange={(e) => {
                    setDraft(e.target.value);
                    setError(null);
                }}
                onKeyDown={handleKeyDown}
                className="w-full resize-none rounded px-3 py-2 text-sm leading-6 outline-none"
                style={{ backgroundColor: '#40444b', color: '#dcddde' }}
            />
            <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: '#99aab5' }}>
                <span>Esc para cancelar · Enter para guardar</span>
                {length >= maxLength * COUNTER_THRESHOLD && (
                    <span style={{ color: tooLong ? '#ed4245' : '#99aab5' }}>{length}/{maxLength}</span>
                )}
                <button type="button" onClick={onCancel} disabled={saving} className="font-semibold hover:underline">
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!canSave}
                    className="font-semibold text-blurple hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Guardar
                </button>
            </div>
            {error && (
                <p role="alert" className="text-xs mt-1" style={{ color: '#ed4245' }}>{error}</p>
            )}
        </div>
    );
};
