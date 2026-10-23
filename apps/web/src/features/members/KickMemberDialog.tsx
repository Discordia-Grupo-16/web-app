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
    onKicked: (userId: string) => void;
}

/**
 * Confirms kicking a member (SCRUM-68).
 *
 * Unlike the ban dialog there is no reason field: a kick leaves no record to
 * keep it in. The warning says the half a moderator might get wrong — the
 * member can come back with a new invitation.
 */
export const KickMemberDialog = ({ serverId, userId, memberName, onClose, onKicked }: Props) => {
    const [kicking, setKicking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const kick = async () => {
        setKicking(true);
        setError(null);
        try {
            await membersService.kickMember(serverId, userId);
            onKicked(userId);
            onClose();
        } catch (err) {
            // The hierarchy and the permission are the backend's: it knows the roles of both
            // sides and this screen does not. Its detail is shown as it comes, so a refusal
            // says which of the two it was.
            setError(getErrorDetail(err) ?? PERMISSION_COPY.kickMemberError);
            setKicking(false);
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
                    {PERMISSION_COPY.kickMemberTitle}
                </h2>
                <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                    {PERMISSION_COPY.kickMemberWarning(memberName)}
                </p>

                {error && (
                    <p role="alert" className="text-sm mt-4" style={{ color: '#ed4245' }}>
                        {error}
                    </p>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        disabled={kicking}
                        className="text-sm px-4 py-2 rounded"
                        style={{ color: '#b9bbbe' }}
                    >
                        {PERMISSION_COPY.kickCancel}
                    </button>
                    <button
                        onClick={kick}
                        disabled={kicking}
                        className="text-sm font-semibold px-4 py-2 rounded text-white"
                        style={{ background: '#faa61a', opacity: kicking ? 0.6 : 1 }}
                    >
                        {kicking ? PERMISSION_COPY.kicking : PERMISSION_COPY.kickConfirm}
                    </button>
                </div>
            </div>
        </div>
    );
};
