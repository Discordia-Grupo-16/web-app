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
    onBanned: (userId: string) => void;
}

/**
 * Confirms banning a member (SCRUM-69).
 *
 * The confirmation is not ceremony: unlike taking a role away, this one cannot
 * be undone from the interface — there is no unban endpoint — so the dialog
 * spells out that an invitation will not bring them back.
 */
export const BanMemberDialog = ({ serverId, userId, memberName, onClose, onBanned }: Props) => {
    const [reason, setReason] = useState('');
    const [banning, setBanning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ban = async () => {
        setBanning(true);
        setError(null);
        try {
            await membersService.banMember(serverId, userId, reason);
            onBanned(userId);
            onClose();
        } catch (err) {
            // The hierarchy and the permission are the backend's: it knows the roles of both
            // sides and this screen does not. Its detail is shown as it comes, so a refusal
            // says which of the two it was.
            setError(getErrorDetail(err) ?? PERMISSION_COPY.banMemberError);
            setBanning(false);
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
                    {PERMISSION_COPY.banMemberTitle}
                </h2>
                <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                    {PERMISSION_COPY.banMemberWarning(memberName)}
                </p>

                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#b9bbbe' }}>
                    {PERMISSION_COPY.banReasonLabel}
                </label>
                <input
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    disabled={banning}
                    maxLength={500}
                    placeholder={PERMISSION_COPY.banReasonPlaceholder}
                    aria-label={PERMISSION_COPY.banReasonLabel}
                    className="w-full rounded px-3 py-2 text-sm text-white outline-none"
                    style={{ background: '#202225' }}
                />

                {error && (
                    <p role="alert" className="text-sm mt-4" style={{ color: '#ed4245' }}>
                        {error}
                    </p>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        disabled={banning}
                        className="text-sm px-4 py-2 rounded"
                        style={{ color: '#b9bbbe' }}
                    >
                        {PERMISSION_COPY.banCancel}
                    </button>
                    <button
                        onClick={ban}
                        disabled={banning}
                        className="text-sm font-semibold px-4 py-2 rounded text-white"
                        style={{ background: '#ed4245', opacity: banning ? 0.6 : 1 }}
                    >
                        {banning ? PERMISSION_COPY.banning : PERMISSION_COPY.banConfirm}
                    </button>
                </div>
            </div>
        </div>
    );
};
