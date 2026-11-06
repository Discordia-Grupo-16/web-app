import { X } from 'lucide-react';
import { OWNERSHIP_TEXTS, ownershipErrorText, type OwnershipError } from '@discordia/core';

interface Props {
    toName: string;
    serverName: string;
    busy: boolean;
    error: OwnershipError | null;
    onConfirm: () => void;
    onRetry: () => void;
    onClose: () => void;
}

/**
 * Confirms proposing the server to a member (SCRUM-35). The text says what the owner gives up if
 * the member accepts: nothing changes until then.
 */
export const TransferOwnershipDialog = ({ toName, serverName, busy, error, onConfirm, onRetry, onClose }: Props) => {
    const retryable = error?.kind === 'network' || error?.kind === 'service';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-label={OWNERSHIP_TEXTS.transfer}
                className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
                style={{ background: '#36393f' }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 transition-colors"
                    style={{ color: '#99aab5' }}
                    aria-label={OWNERSHIP_TEXTS.close}
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-black text-white mb-1" style={{ fontFamily: 'Nunito, sans-serif' }}>
                    {OWNERSHIP_TEXTS.transfer}
                </h2>
                <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                    {OWNERSHIP_TEXTS.proposeConfirm(toName, serverName)}
                </p>

                {error && (
                    <p role="alert" className="text-sm mt-4" style={{ color: '#ed4245' }}>
                        {ownershipErrorText(error)}
                    </p>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} disabled={busy} className="text-sm px-4 py-2 rounded" style={{ color: '#b9bbbe' }}>
                        {OWNERSHIP_TEXTS.cancel}
                    </button>
                    <button
                        onClick={retryable ? onRetry : onConfirm}
                        disabled={busy}
                        className="text-sm font-semibold px-4 py-2 rounded text-white"
                        style={{ background: '#7289da', opacity: busy ? 0.6 : 1 }}
                    >
                        {retryable ? OWNERSHIP_TEXTS.retry : OWNERSHIP_TEXTS.transfer}
                    </button>
                </div>
            </div>
        </div>
    );
};
