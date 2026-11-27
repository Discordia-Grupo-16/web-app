import type { PresenceStatus } from '@discordia/api';
import { PresenceDot } from '@/shared/ui/PresenceDot';

interface MemberAvatarProps {
    name: string;
    avatarUrl: string | null;
    /** Null while the status is not known: no dot, rather than a "disconnected" that may be false. */
    status: PresenceStatus | null;
}

// The photo is decorative (alt=""): the row already says the name next to it.
export const MemberAvatar = ({ name, avatarUrl, status }: MemberAvatarProps) => (
    <span className="relative shrink-0">
        <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
            style={{ background: avatarUrl ? 'transparent' : '#7289da' }}
        >
            {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
                (name.trim()[0] ?? '?').toUpperCase()
            )}
        </span>
        {status && <PresenceDot status={status} ring="#2f3136" />}
    </span>
);
