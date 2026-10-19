import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { PERMISSION_COPY, authorView, useAuth, usePublicProfiles } from '@discordia/core';
import type { ServerBan } from '@discordia/api';
import { RevokeBanDialog } from './RevokeBanDialog';

interface BansSectionProps {
    serverId: string;
    bans: ServerBan[];
    /** The list could not be loaded: says so instead of "nobody is banned". */
    error?: boolean;
    onBanRevoked: (userId: string) => void;
}

/**
 * The bans of the server, with the action to revoke each one (SCRUM-70).
 *
 * Only rendered for whoever has BAN_MEMBERS: the list is moderation data and
 * the backend refuses it to everyone else.
 */
export const BansSection = ({ serverId, bans, error = false, onBanRevoked }: BansSectionProps) => {
    const { user } = useAuth();
    const [revoking, setRevoking] = useState<string | null>(null);

    // Both the banned users and the moderators who banned them are `identity`'s: one request
    // resolves every name in the section.
    const profiles = usePublicProfiles(bans.flatMap(ban => [ban.user_id, ban.banned_by]));

    const nameOf = (userId: string) => authorView(userId, user, profiles.get(userId)).name;

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between px-2 py-1">
                <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#8e9297' }}
                >
                    {PERMISSION_COPY.bansTitle(bans.length)}
                </span>
            </div>

            {error && (
                <p role="alert" className="text-xs px-3 py-1" style={{ color: '#ed4245' }}>
                    {PERMISSION_COPY.bansError}
                </p>
            )}

            {!error && bans.length === 0 && (
                <p className="text-xs px-3 py-1" style={{ color: '#72767d' }}>
                    {PERMISSION_COPY.noBans}
                </p>
            )}

            {bans.map(({ user_id, banned_by, reason, created_at }) => (
                <div
                    key={user_id}
                    className="group/ban flex items-center gap-2 text-sm px-2 py-1.5 mx-1 rounded"
                    style={{ color: '#8e9297' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#34373c')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <div className="flex-1 min-w-0">
                        <p className="truncate">{nameOf(user_id)}</p>
                        <p className="truncate text-xs" style={{ color: '#72767d' }}>
                            {PERMISSION_COPY.bannedOn(nameOf(banned_by), created_at)}
                        </p>
                        {/* Kept "for the moderators" when banning: this is where they read it,
                            before deciding to revoke. */}
                        {reason && (
                            <p className="truncate text-xs" style={{ color: '#72767d' }} title={reason}>
                                {PERMISSION_COPY.banReason(reason)}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={() => setRevoking(user_id)}
                        className="opacity-0 group-hover/ban:opacity-100 focus-visible:opacity-100 transition-opacity p-1 rounded shrink-0"
                        style={{ color: '#8e9297' }}
                        title={PERMISSION_COPY.revokeBan(nameOf(user_id))}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                    >
                        <Undo2 size={13} />
                    </button>
                </div>
            ))}

            {revoking && (
                <RevokeBanDialog
                    serverId={serverId}
                    userId={revoking}
                    memberName={nameOf(revoking)}
                    onClose={() => setRevoking(null)}
                    onRevoked={onBanRevoked}
                />
            )}
        </div>
    );
};
