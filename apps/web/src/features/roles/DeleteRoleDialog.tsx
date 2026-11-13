import { X } from 'lucide-react';
import { ROLE_DELETION_TEXTS, roleDeletionErrorText, type RoleDeletionState } from '@discordia/core';

interface DeleteRoleDialogProps {
    state: Exclude<RoleDeletionState, { stage: 'idle' }>;
    onConfirm: () => void;
    onRetry: () => void;
    onClose: () => void;
}

/**
 * Deleting a role (SCRUM-64): the blocking message, or the confirmation with its loading state,
 * error and "Reintentar". It only paints the state of useRoleDeletion, which decides everything.
 */
export const DeleteRoleDialog = ({ state, onConfirm, onRetry, onClose }: DeleteRoleDialogProps) => {
    const deleting = state.stage === 'confirming' && state.deleting;
    const error = state.stage === 'confirming' ? state.error : null;
    const retryable = error?.kind === 'network' || error?.kind === 'service';
    // A 403 or 409 would come back the same if "Eliminar" were pressed again: only closing is left.
    const finished = error?.kind === 'server-gone' || error?.kind === 'rejected';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={deleting ? undefined : onClose}
        >
            <div
                role="dialog"
                aria-label={ROLE_DELETION_TEXTS.title}
                className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
                style={{ background: '#36393f' }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    disabled={deleting}
                    className="absolute top-4 right-4 transition-colors"
                    style={{ color: '#99aab5' }}
                    aria-label={ROLE_DELETION_TEXTS.close}
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-black text-white mb-1" style={{ fontFamily: 'Nunito, sans-serif' }}>
                    {ROLE_DELETION_TEXTS.title}
                </h2>

                {state.stage === 'blocked' ? (
                    <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                        {state.blocker === 'default-role' ? ROLE_DELETION_TEXTS.defaultRole : ROLE_DELETION_TEXTS.soleAdmin}
                    </p>
                ) : (
                    <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                        {ROLE_DELETION_TEXTS.confirm(state.role.name)}
                    </p>
                )}

                {error && (
                    <p role="alert" className="text-sm mt-4" style={{ color: '#ed4245' }}>
                        {roleDeletionErrorText(error)}
                    </p>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    {state.stage === 'blocked' || finished ? (
                        <button onClick={onClose} className="text-sm font-semibold px-4 py-2 rounded text-white" style={{ background: '#4f545c' }}>
                            {ROLE_DELETION_TEXTS.close}
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                disabled={deleting}
                                className="text-sm px-4 py-2 rounded"
                                style={{ color: '#b9bbbe' }}
                            >
                                {ROLE_DELETION_TEXTS.cancel}
                            </button>
                            <button
                                onClick={retryable ? onRetry : onConfirm}
                                disabled={deleting}
                                className="text-sm font-semibold px-4 py-2 rounded text-white"
                                style={{ background: '#ed4245', opacity: deleting ? 0.6 : 1 }}
                            >
                                {deleting
                                    ? ROLE_DELETION_TEXTS.deleting
                                    : retryable
                                      ? ROLE_DELETION_TEXTS.retry
                                      : ROLE_DELETION_TEXTS.confirmButton}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
