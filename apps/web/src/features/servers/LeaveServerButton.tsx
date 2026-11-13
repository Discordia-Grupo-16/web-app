import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { OWNERSHIP_TEXTS } from '@discordia/core';
import { serversService } from '@/shared/api';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';

interface LeaveServerButtonProps {
    serverId: string;
    isOwner: boolean;
    /** Name of the recipient when a transfer is pending; null when there is none. */
    pendingTransferTo: string | null;
    /** Takes the owner to the members list, where the ownership is transferred. */
    onTransferRequested: () => void;
    /** Deleting the server (SCRUM-34). Without it, "Eliminar servidor" is not offered. */
    onDeleteRequested?: () => void;
}

const isOwnerConflict = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 409;

/**
 * Leaves the server. The owner cannot leave directly: confirming tells them to transfer the
 * ownership or delete the server first (CA2 of "Abandonar servidor").
 */
export const LeaveServerButton = ({
    serverId,
    isOwner,
    pendingTransferTo,
    onTransferRequested,
    onDeleteRequested,
}: LeaveServerButtonProps) => {
    const navigate = useNavigate();
    const [pendingLeave, setPendingLeave] = useState(false);
    const [ownerNotice, setOwnerNotice] = useState(false);

    const confirmLeave = async () => {
        setPendingLeave(false);
        // The backend would refuse it anyway: the owner gets the way out without the round trip.
        if (isOwner) {
            setOwnerNotice(true);
            return;
        }
        try {
            await serversService.leaveServer(serverId);
            navigate('/');
        } catch (err) {
            // Someone transferred the server to this user while the screen still showed them as a member.
            if (isOwnerConflict(err)) {
                setOwnerNotice(true);
                return;
            }
            const error = err as { response?: { data?: { detail?: string } } };
            const detail = error.response?.data?.detail;

            window.alert(detail || 'Error al abandonar el servidor');
        }
    };

    const ownerMessage = pendingTransferTo
        ? OWNERSHIP_TEXTS.leaveAsOwnerWithPending(pendingTransferTo)
        : OWNERSHIP_TEXTS.leaveAsOwner;

    return (
        <>
            <div
                className="flex items-center px-3 py-2"
                style={{ borderTop: '1px solid #202225', background: '#292b2f' }}
            >
                <button
                    onClick={() => setPendingLeave(true)}
                    className="flex items-center gap-2 text-xs px-2 py-1 rounded w-full transition-colors"
                    style={{ color: '#ed4245' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(237,66,69,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <LogOut size={14} />
                    Abandonar servidor
                </button>
            </div>

            {pendingLeave && (
                <ConfirmModal
                    title="Abandonar servidor"
                    message="¿Seguro que querés salir de este servidor?"
                    confirmLabel="Abandonar"
                    danger
                    onConfirm={confirmLeave}
                    onCancel={() => setPendingLeave(false)}
                />
            )}

            {ownerNotice && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)' }}
                    onClick={() => setOwnerNotice(false)}
                >
                    <div
                        role="dialog"
                        aria-label="Abandonar servidor"
                        className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
                        style={{ background: '#36393f' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setOwnerNotice(false)}
                            className="absolute top-4 right-4 transition-colors"
                            style={{ color: '#99aab5' }}
                            aria-label={OWNERSHIP_TEXTS.close}
                        >
                            <X size={18} />
                        </button>
                        <h2 className="text-lg font-black text-white mb-2">Abandonar servidor</h2>
                        <p className="text-sm mb-6" style={{ color: '#99aab5' }}>{ownerMessage}</p>
                        <div className="flex gap-3 justify-end">
                            {onDeleteRequested && (
                                <button
                                    onClick={() => {
                                        setOwnerNotice(false);
                                        onDeleteRequested();
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-white"
                                    style={{ background: '#ed4245' }}
                                >
                                    Eliminar servidor
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setOwnerNotice(false);
                                    onTransferRequested();
                                }}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-white"
                                style={{ background: '#7289da' }}
                            >
                                {OWNERSHIP_TEXTS.transfer}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
