import { useEffect, useRef, useState } from 'react';
import { QUICK_REACTIONS } from '@discordia/core';

interface ReactionPickerProps {
    /** The emojis the user already reacted with: picking one of them again takes it back (CA2). */
    mine: ReadonlySet<string>;
    onPick: (emoji: string, reacted: boolean) => void;
}

/** The "Reaccionar" button of a message and its popover with the quick reactions (SCRUM-49). */
export const ReactionPicker = ({ mine, onPick }: ReactionPickerProps) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLSpanElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setOpen(false);
            buttonRef.current?.focus();
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <span ref={rootRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-label="Reaccionar"
                aria-haspopup="true"
                aria-expanded={open}
                // Stays visible while the popover is open, or it would vanish when the mouse moves to it.
                className={`text-xs font-semibold hover:underline ${open ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                style={{ color: '#99aab5' }}
            >
                Reaccionar
            </button>
            {open && (
                <div
                    role="group"
                    aria-label="Elegir una reacción"
                    className="absolute right-0 top-5 z-10 flex gap-1 rounded-md p-1 shadow-lg"
                    style={{ background: '#2f3136', border: '1px solid #202225' }}
                >
                    {QUICK_REACTIONS.map((emoji) => {
                        const isMine = mine.has(emoji);
                        return (
                            <button
                                key={emoji}
                                type="button"
                                aria-label={`${isMine ? 'Quitar tu reacción' : 'Reaccionar con'} ${emoji}`}
                                aria-pressed={isMine}
                                onClick={() => {
                                    setOpen(false);
                                    onPick(emoji, !isMine);
                                }}
                                className="w-8 h-8 rounded text-lg hover:bg-white/10"
                                style={isMine ? { background: 'rgba(88, 101, 242, 0.3)' } : undefined}
                            >
                                {emoji}
                            </button>
                        );
                    })}
                </div>
            )}
        </span>
    );
};
