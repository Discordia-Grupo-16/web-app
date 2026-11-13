import { useState } from 'react';
import {
    OWNERSHIP_TEXTS,
    ownershipErrorText,
    useIncomingOwnershipTransfers,
    useIncomingTransferWatch,
    type IncomingTransferView,
} from '@discordia/core';
import { ownershipSource } from '@/shared/api';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';

interface StripeProps {
    transfer: IncomingTransferView;
    onAccept: () => void;
    onReject: () => void;
    onRetry: () => void;
    onDismiss: () => void;
    onChange: () => void;
}

const buttonStyle = { background: 'rgba(255,255,255,0.15)' };

// One stripe per pending transfer. It watches its own server, so accepting in another session of
// the recipient takes it away without reloading.
const TransferStripe = ({ transfer, onAccept, onReject, onRetry, onDismiss, onChange }: StripeProps) => {
    const [confirming, setConfirming] = useState(false);
    useIncomingTransferWatch({ serverId: transfer.serverId, onChange });

    const busy = transfer.busy !== null;
    const retryable = transfer.error?.kind === 'network' || transfer.error?.kind === 'service';

    return (
        <div
            role="region"
            aria-label={OWNERSHIP_TEXTS.incoming(transfer.fromName, transfer.serverName)}
            className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm text-white"
            style={{ background: '#7289da' }}
        >
            {transfer.stale ? (
                <>
                    <span role="alert" className="flex-1">
                        {transfer.error && ownershipErrorText(transfer.error)}
                    </span>
                    <button onClick={onDismiss} className="px-3 py-1 rounded font-semibold" style={buttonStyle}>
                        {OWNERSHIP_TEXTS.close}
                    </button>
                </>
            ) : (
                <>
                    <span className="flex-1">{OWNERSHIP_TEXTS.incoming(transfer.fromName, transfer.serverName)}</span>
                    {transfer.error && (
                        <span role="alert" className="font-semibold">
                            {ownershipErrorText(transfer.error)}
                        </span>
                    )}
                    {retryable && (
                        <button onClick={onRetry} disabled={busy} className="px-3 py-1 rounded font-semibold" style={buttonStyle}>
                            {OWNERSHIP_TEXTS.retry}
                        </button>
                    )}
                    <button
                        onClick={() => setConfirming(true)}
                        disabled={busy}
                        className="px-3 py-1 rounded font-semibold"
                        style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}
                    >
                        {transfer.busy === 'accepting' ? 'Aceptando…' : OWNERSHIP_TEXTS.accept}
                    </button>
                    <button
                        onClick={onReject}
                        disabled={busy}
                        className="px-3 py-1 rounded font-semibold"
                        style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}
                    >
                        {transfer.busy === 'rejecting' ? 'Rechazando…' : OWNERSHIP_TEXTS.reject}
                    </button>
                </>
            )}
            {confirming && (
                <ConfirmModal
                    title={OWNERSHIP_TEXTS.transfer}
                    message={OWNERSHIP_TEXTS.acceptConfirm(transfer.serverName)}
                    confirmLabel={OWNERSHIP_TEXTS.accept}
                    onConfirm={() => {
                        setConfirming(false);
                        onAccept();
                    }}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </div>
    );
};

/**
 * The transfers of ownership waiting for the user's answer, fixed on top of every screen with a
 * session (SCRUM-35, Transferir propiedad del servidor).
 */
export const IncomingTransferBanner = () => {
    const { transfers, reload, accept, reject, retry, dismiss } = useIncomingOwnershipTransfers({
        source: ownershipSource,
    });
    useLiveRefresh({ resources: ['ownershipTransfers', 'servers'], refresh: reload });

    if (transfers.length === 0) return null;
    return (
        <div>
            {transfers.map((transfer) => (
                <TransferStripe
                    key={transfer.serverId}
                    transfer={transfer}
                    onAccept={() => void accept(transfer.serverId)}
                    onReject={() => void reject(transfer.serverId)}
                    onRetry={() => retry(transfer.serverId)}
                    onDismiss={() => dismiss(transfer.serverId)}
                    onChange={reload}
                />
            ))}
        </div>
    );
};
