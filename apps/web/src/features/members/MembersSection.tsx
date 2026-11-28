import { useState, type ReactNode } from 'react';
import { Ban, Crown, MicOff, Pencil, UserMinus } from 'lucide-react';
import { PERMISSION_COPY, authorView, formatMutedUntil, useAuth, useMuteStatus, usePublicProfiles } from '@discordia/core';
import type { Role, ServerMember } from '@discordia/api';
import { useProfileViewer } from '@/shared/profile/ProfileViewerContext';
import { BanMemberDialog } from './BanMemberDialog';
import { KickMemberDialog } from './KickMemberDialog';
import { MemberRolesModal } from './MemberRolesModal';
import { MuteMemberDialog } from './MuteMemberDialog';

interface MembersSectionProps {
    serverId: string;
    members: ServerMember[];
    roles: Role[];
    ownerId: string | undefined;
    canManage: boolean;
    canKick: boolean;
    canBan: boolean;
    /** MODERATE_MEMBERS, resolved by `community`. The backend checks it too: this only shows the button. */
    canModerate: boolean;
    onRolesChange: (userId: string, roles: Role[]) => void;
    onMemberKicked: (userId: string) => void;
    onMemberBanned: (userId: string) => void;
    /** A member was muted or unmuted: the list has to be read again (SCRUM-71). */
    onMuteChanged: () => void;
    /** Extra actions drawn at the end of each row, such as transferring the ownership. */
    renderMemberActions?: (member: ServerMember) => ReactNode;
    /** A 404 when giving or taking a role: the lists are out of date (SCRUM-64). */
    onStale?: () => void;
}

// Both read the clock through useMuteStatus: nothing arrives when a mute ends (SCRUM-71), so the mark
// and the button's meaning have to turn off by themselves instead of waiting for the next read of the list.
const MutedBadge = ({ mutedUntil }: { mutedUntil: string | null }) => {
    const { until } = useMuteStatus(mutedUntil);
    if (!until) return null;
    return (
        <span className="flex items-start gap-1 text-xs break-words" data-testid="muted-badge" style={{ color: '#faa61a' }}>
            <MicOff size={11} aria-hidden className="shrink-0 mt-0.5" />
            {PERMISSION_COPY.mutedBadge(formatMutedUntil(until))}
        </span>
    );
};

const MuteButton = ({
    mutedUntil,
    memberName,
    onClick,
}: {
    mutedUntil: string | null;
    memberName: string;
    onClick: () => void;
}) => {
    const { muted } = useMuteStatus(mutedUntil);
    return (
        <button
            onClick={onClick}
            className="p-1 rounded shrink-0"
            style={{ color: '#8e9297' }}
            title={muted ? PERMISSION_COPY.unmuteMember(memberName) : PERMISSION_COPY.muteMember(memberName)}
            onMouseEnter={e => (e.currentTarget.style.color = '#faa61a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
        >
            <MicOff size={13} />
        </button>
    );
};

export const MembersSection = ({
    serverId,
    members,
    roles,
    ownerId,
    canManage,
    canKick,
    canBan,
    canModerate,
    onRolesChange,
    onMemberKicked,
    onMemberBanned,
    onMuteChanged,
    renderMemberActions,
    onStale,
}: MembersSectionProps) => {
    const { user } = useAuth();
    const { openProfile } = useProfileViewer();
    const [editing, setEditing] = useState<string | null>(null);
    const [kicking, setKicking] = useState<string | null>(null);
    const [banning, setBanning] = useState<string | null>(null);
    const [muting, setMuting] = useState<string | null>(null);

    // `community` only returns ids: the names are `identity`'s, resolved in one request.
    const profiles = usePublicProfiles(members.map(member => member.user_id));

    const nameOf = (userId: string) => authorView(userId, user, profiles.get(userId)).name;

    const member = members.find(m => m.user_id === editing);
    const mutingMember = members.find(m => m.user_id === muting);

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between px-2 py-1">
                <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#8e9297' }}
                >
                    {PERMISSION_COPY.membersTitle(members.length)}
                </span>
            </div>

            {members.map((rowMember) => {
                const { user_id, roles: memberRoles } = rowMember;
                const isOwner = user_id === ownerId;
                // The highest role is the one that names the member in the list: it is the
                // one the backend's hierarchy uses, and the list comes ordered by position.
                const topRole = memberRoles.at(-1);

                // Neither the owner nor oneself is a valid target for kick, ban or mute. A row with
                // no buttons at all does not draw the actions container.
                const isOther = !isOwner && user_id !== user?.id;
                const showRoles = canManage && !isOwner;
                const showKick = canKick && isOther;
                const showBan = canBan && isOther;
                const showMute = canModerate && isOther;
                const extraActions = renderMemberActions?.(rowMember);
                const hasActions = showRoles || showKick || showBan || showMute || Boolean(extraActions);

                return (
                    <div
                        key={user_id}
                        className="group/member relative flex flex-col text-sm px-2 py-1.5 mx-1 rounded"
                        style={{ color: '#8e9297' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#34373c')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <button
                            onClick={() => openProfile(user_id)}
                            className="flex flex-col min-w-0 text-left"
                            onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}
                        >
                            {/* First line: the name gives way (ellipsis) before the role does. */}
                            <span className="flex items-center gap-2 min-w-0">
                                {isOwner && (
                                    <span title={PERMISSION_COPY.ownerMark} style={{ display: 'flex', flexShrink: 0 }}>
                                        <Crown size={13} style={{ color: '#faa61a' }} />
                                    </span>
                                )}
                                <span className="truncate min-w-0">{nameOf(user_id)}</span>
                                {topRole && (
                                    <span className="shrink-0 text-xs" style={{ color: '#72767d' }}>
                                        {topRole.name}
                                    </span>
                                )}
                            </span>
                            {/* Second line: the mute mark, never cut. */}
                            <MutedBadge mutedUntil={rowMember.muted_until} />
                        </button>

                        {/* Out of the row's flow: with hover they float over its right side, so they take no
                            width from the name. Without hover (touch), they sit in a second line. */}
                        {hasActions && (
                            <div
                                data-testid={`member-actions-${user_id}`}
                                className="absolute right-1 top-1.5 flex items-center gap-0.5 rounded px-1 bg-[#34373c] opacity-0 pointer-events-none transition-opacity group-hover/member:opacity-100 group-hover/member:pointer-events-auto group-focus-within/member:opacity-100 group-focus-within/member:pointer-events-auto [@media(hover:none)]:static [@media(hover:none)]:flex-wrap [@media(hover:none)]:mt-1 [@media(hover:none)]:px-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
                            >
                                {/* The owner is never a target: the backend refuses it, because nobody
                                    is above them in the hierarchy. */}
                                {showRoles && (
                                    <button
                                        onClick={() => setEditing(user_id)}
                                        className="p-1 rounded shrink-0"
                                        style={{ color: '#8e9297' }}
                                        title={PERMISSION_COPY.editMemberRoles(nameOf(user_id))}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                    >
                                        <Pencil size={13} />
                                    </button>
                                )}

                                {/* Neither the owner nor oneself is a valid target: the backend
                                    refuses both, because nobody is above them in the hierarchy. */}
                                {showKick && (
                                    <button
                                        onClick={() => setKicking(user_id)}
                                        className="p-1 rounded shrink-0"
                                        style={{ color: '#8e9297' }}
                                        title={PERMISSION_COPY.kickMember(nameOf(user_id))}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#faa61a')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                    >
                                        <UserMinus size={13} />
                                    </button>
                                )}

                                {showBan && (
                                    <button
                                        onClick={() => setBanning(user_id)}
                                        className="p-1 rounded shrink-0"
                                        style={{ color: '#8e9297' }}
                                        title={PERMISSION_COPY.banMember(nameOf(user_id))}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#ed4245')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                    >
                                        <Ban size={13} />
                                    </button>
                                )}

                                {showMute && (
                                    <MuteButton
                                        mutedUntil={rowMember.muted_until}
                                        memberName={nameOf(user_id)}
                                        onClick={() => setMuting(user_id)}
                                    />
                                )}

                                {extraActions}
                            </div>
                        )}
                    </div>
                );
            })}

            {member && (
                <MemberRolesModal
                    serverId={serverId}
                    member={member}
                    memberName={nameOf(member.user_id)}
                    roles={roles}
                    onClose={() => setEditing(null)}
                    onRolesChange={onRolesChange}
                    onStale={onStale}
                />
            )}

            {kicking && (
                <KickMemberDialog
                    serverId={serverId}
                    userId={kicking}
                    memberName={nameOf(kicking)}
                    onClose={() => setKicking(null)}
                    onKicked={onMemberKicked}
                />
            )}

            {mutingMember && (
                <MuteMemberDialog
                    serverId={serverId}
                    userId={mutingMember.user_id}
                    memberName={nameOf(mutingMember.user_id)}
                    mutedUntil={mutingMember.muted_until}
                    onClose={() => setMuting(null)}
                    onChanged={onMuteChanged}
                />
            )}

            {banning && (
                <BanMemberDialog
                    serverId={serverId}
                    userId={banning}
                    memberName={nameOf(banning)}
                    onClose={() => setBanning(null)}
                    onBanned={onMemberBanned}
                />
            )}
        </div>
    );
};
