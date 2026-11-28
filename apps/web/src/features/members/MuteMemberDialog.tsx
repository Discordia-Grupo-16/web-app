import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { MUTE_DURATIONS, PERMISSION_COPY, formatMutedUntil, isMutedAt } from '@discordia/core';
import { getErrorDetail } from '@discordia/api';
import { membersService } from '@/shared/api';

interface Props {
    serverId: string;
    userId: string;
    memberName: string;
    /** The member's `muted_until`: decides whether the dialog mutes or lifts the mute. */
    mutedUntil: string | null;
    onClose: () => void;
    /** After muting or lifting: the list shows the new state once it is read again. */
    onChanged: () => void;
}

/**
 * Mutes a member for a while, or lifts the mute (SCRUM-71).
 *
 * One dialog for both because the row has one button: what it does depends on whether the member is
 * muted right now. The warning says the half a moderator might get wrong: the member stays, still
 * reads and listens, and the mute ends by itself.
 */
export const MuteMemberDialog = ({ serverId, userId, memberName, mutedUntil, onClose, onChanged }: Props) => {
    const durationId = useId();
    // Read once: the dialog keeps its mode even if the mute ends while it is open.
    const [lifting] = useState(() => isMutedAt(mutedUntil, Date.now()));
    const [seconds, setSeconds] = useState<number>(MUTE_DURATIONS[0].seconds);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            if (lifting) await membersService.unmuteMember(serverId, userId);
            else await membersService.muteMember(serverId, userId, seconds);
            onChanged();
            onClose();
        } catch (err) {
            // The hierarchy and the permission are the backend's: it knows the roles of both
            // sides and this screen does not. Its detail is shown as it comes, so a refusal
            // says which of the two it was.
            setError(getErrorDetail(err) ?? (lifting ? PERMISSION_COPY.unmuteMemberError : PERMISSION_COPY.muteMemberError));
            setBusy(false);
        }
    };

    // Ignores a request to close while the call is in flight, so a refusal is never lost.
    const close = () => {
        if (!busy) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={close}
        >
            <div
                className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
                style={{ background: '#36393f' }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={close}
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
                    {lifting ? PERMISSION_COPY.unmuteMember(memberName) : PERMISSION_COPY.muteMemberTitle}
                </h2>

                {lifting ? (
                    <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                        {PERMISSION_COPY.mutedBadge(formatMutedUntil(mutedUntil ?? ''))}
                    </p>
                ) : (
                    <>
                        <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                            {PERMISSION_COPY.muteMemberWarning(memberName)}
                        </p>
                        <label
                            htmlFor={durationId}
                            className="block text-xs font-semibold uppercase tracking-wider mb-2"
                            style={{ color: '#b9bbbe' }}
                        >
                            {PERMISSION_COPY.muteDurationLabel}
                        </label>
                        <select
                            id={durationId}
                            value={seconds}
                            onChange={e => setSeconds(Number(e.target.value))}
                            disabled={busy}
                            className="w-full text-sm px-3 py-2 rounded outline-none"
                            style={{ background: '#202225', color: '#dcddde' }}
                        >
                            {MUTE_DURATIONS.map(duration => (
                                <option key={duration.seconds} value={duration.seconds}>
                                    {duration.label}
                                </option>
                            ))}
                        </select>
                    </>
                )}

                {error && (
                    <p role="alert" className="text-sm mt-4" style={{ color: '#ed4245' }}>
                        {error}
                    </p>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={close}
                        disabled={busy}
                        className="text-sm px-4 py-2 rounded"
                        style={{ color: '#b9bbbe' }}
                    >
                        {PERMISSION_COPY.muteCancel}
                    </button>
                    <button
                        onClick={submit}
                        disabled={busy}
                        className="text-sm font-semibold px-4 py-2 rounded text-white"
                        style={{ background: '#faa61a', opacity: busy ? 0.6 : 1 }}
                    >
                        {lifting
                            ? PERMISSION_COPY.unmuteConfirm
                            : busy
                              ? PERMISSION_COPY.muting
                              : PERMISSION_COPY.muteConfirm}
                    </button>
                </div>
            </div>
        </div>
    );
};
