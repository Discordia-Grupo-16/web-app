import { useEffect, useId, useRef } from 'react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'default';
    isSubmitting: boolean;
    error: string | null;
    onConfirm: () => void;
    onCancel: () => void;
}

const TONE_CLASS = {
    danger: 'bg-red-500 hover:bg-red-600',
    default: 'bg-blurple hover:bg-blurple-dark',
};

const buttonClass = 'rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed';

// A div and not <dialog>.showModal(): jsdom does not implement it, so it could not be tested.
export const ConfirmDialog = ({
    open,
    title,
    description,
    confirmLabel,
    tone,
    isSubmitting,
    error,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) => {
    const titleId = useId();
    const descriptionId = useId();
    const cancelRef = useRef<HTMLButtonElement>(null);

    // The initial focus goes on Cancelar: the action is destructive, so an Enter pressed by
    // reflex right after opening must not confirm it.
    useEffect(() => {
        if (open) cancelRef.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            // While the request is in flight there is nothing to cancel: closing would hide its outcome.
            if (event.key === 'Escape' && !isSubmitting) onCancel();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, isSubmitting, onCancel]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="w-full max-w-md rounded-2xl bg-discord-card p-6 shadow-2xl"
            >
                <h2 id={titleId} className="text-lg font-black text-white">
                    {title}
                </h2>
                <p id={descriptionId} className="mt-2 text-sm text-discord-muted">
                    {description}
                </p>

                {error && (
                    <p role="alert" className="mt-4 text-sm text-red-400">
                        {error}
                    </p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className={`${buttonClass} bg-white/10 hover:bg-white/20`}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className={`${buttonClass} ${TONE_CLASS[tone]}`}
                    >
                        {isSubmitting ? 'Procesando…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
