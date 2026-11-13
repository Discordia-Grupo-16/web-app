import { OWNERSHIP_TEXTS, type OutgoingTransferView } from '@discordia/core';

interface Props {
    view: OutgoingTransferView;
    busy: boolean;
    onCancel: () => void;
    onDismissRejection: () => void;
}

/** What the owner sees about the transfer of the open server: pending, rejected or nothing. */
export const OutgoingTransferNotice = ({ view, busy, onCancel, onDismissRejection }: Props) => {
    if (view.kind === 'none') return null;
    const pending = view.kind === 'pending';

    return (
        <div
            role="status"
            className="flex items-center gap-2 mx-2 my-2 px-3 py-2 rounded text-xs"
            style={{ background: '#202225', color: '#dcddde' }}
        >
            <span className="flex-1">
                {pending ? OWNERSHIP_TEXTS.pendingTo(view.toName) : OWNERSHIP_TEXTS.rejectedBy(view.toName)}
            </span>
            <button
                onClick={pending ? onCancel : onDismissRejection}
                disabled={busy}
                className="font-semibold px-2 py-1 rounded"
                style={{ color: '#b9bbbe', opacity: busy ? 0.6 : 1 }}
            >
                {pending ? OWNERSHIP_TEXTS.cancel : OWNERSHIP_TEXTS.close}
            </button>
        </div>
    );
};
