import { useState } from 'react';
import { X } from 'lucide-react';
import { PERMISSION_COPY } from '@discordia/core';
import { getErrorDetail } from '@discordia/api';
import { membersService } from '@/shared/api';

interface Props {
    serverId: string;
    userId: string;
    memberName: string;
    onClose: () => void;
    onRevoked: (userId: string) => void;
}

/**
 * Confirms revoking a ban (SCRUM-70).
 *
 * It cannot be undone from the interface either: banning again needs them to
 * be a member, so they would have to come back first. The warning says the
 * half a moderator might get wrong — revoking does not bring them back by
 * itself, they have to accept an invitation.
 */
export const RevokeBanDialog = ({ serverId, userId, memberName, onClose, onRevoked }: Props) => {
    const [revoking, setRevoking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const revoke = async () => {
        setRevoking(true);
        setError(null);
        try {
            await membersService.revokeBan(serverId, userId);
            onRevoked(userId);
            onClose();
        } catch (err) {
            // The permission is the backend's: its detail is shown as it comes.
            setError(getErrorDetail(err) ?? PERMISSION_COPY.revokeBanError);
            setRevoking(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
                style={{ background: '#36393f' }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 transition-colors"
                    style={{ color: '#99aab5' }}
                    aria-label="Cerrar"
                >
                    <X size={20} />
                </button>

                <h2
                    className="text-xl font-black text-white mb-1"
                    style={{ fontFamily: 'Nunito, sans-serif' }}
                >
                    {PERMISSION_COPY.revokeBanTitle}
                </h2>
                <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                    {PERMISSION_COPY.revokeBanWarning(memberName)}
                </p>

                {error && (
                    <p role="alert" className="text-sm mt-4" style={{ color: '#ed4245' }}>
                        {error}
                    </p>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        disabled={revoking}
                        className="text-sm px-4 py-2 rounded"
                        style={{ color: '#b9bbbe' }}
                    >
                        {PERMISSION_COPY.revokeCancel}
                    </button>
                    {/* The brand blue and not red: revoking gives access back, it is not destructive. */}
                    <button
                        onClick={revoke}
                        disabled={revoking}
                        className="text-sm font-semibold px-4 py-2 rounded text-white"
                        style={{ background: revoking ? '#5b6eae' : '#7289da' }}
                    >
                        {revoking ? PERMISSION_COPY.revoking : PERMISSION_COPY.revokeConfirm}
                    </button>
                </div>
            </div>
        </div>
    );
};
