import { useState } from 'react';
import { Crown, Pencil } from 'lucide-react';
import { authorView, useAuth, usePublicProfiles } from '@discordia/core';
import type { Role, ServerMember } from '@discordia/api';
import { useProfileViewer } from '@/shared/profile/ProfileViewerContext';
import { MemberRolesModal } from './MemberRolesModal';

interface MembersSectionProps {
    serverId: string;
    members: ServerMember[];
    roles: Role[];
    ownerId: string | undefined;
    canManage: boolean;
    onRolesChange: (userId: string, roles: Role[]) => void;
}

export const MembersSection = ({
    serverId,
    members,
    roles,
    ownerId,
    canManage,
    onRolesChange,
}: MembersSectionProps) => {
    const { user } = useAuth();
    const { openProfile } = useProfileViewer();
    const [editing, setEditing] = useState<string | null>(null);

    // `community` only returns ids: the names are `identity`'s, resolved in one request.
    const profiles = usePublicProfiles(members.map(member => member.user_id));

    const nameOf = (userId: string) => authorView(userId, user, profiles.get(userId)).name;

    const member = members.find(m => m.user_id === editing);

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between px-2 py-1">
                <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#8e9297' }}
                >
                    Miembros — {members.length}
                </span>
            </div>

            {members.map(({ user_id, roles: memberRoles }) => {
                const isOwner = user_id === ownerId;
                // The highest role is the one that names the member in the list: it is the
                // one the backend's hierarchy uses, and the list comes ordered by position.
                const topRole = memberRoles.at(-1);

                return (
                    <div
                        key={user_id}
                        className="group/member flex items-center gap-2 text-sm px-2 py-1.5 mx-1 rounded"
                        style={{ color: '#8e9297' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#34373c')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <button
                            onClick={() => openProfile(user_id)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                            onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}
                        >
                            {isOwner && (
                                <span title="Dueño del servidor" style={{ display: 'flex', flexShrink: 0 }}>
                                    <Crown size={13} style={{ color: '#faa61a' }} />
                                </span>
                            )}
                            <span className="truncate">{nameOf(user_id)}</span>
                            {topRole && (
                                <span className="truncate text-xs" style={{ color: '#72767d' }}>
                                    {topRole.name}
                                </span>
                            )}
                        </button>

                        {/* The owner is never a target: the backend refuses it, because nobody
                            is above them in the hierarchy. */}
                        {canManage && !isOwner && (
                            <button
                                onClick={() => setEditing(user_id)}
                                className="opacity-0 group-hover/member:opacity-100 transition-opacity p-1 rounded shrink-0"
                                style={{ color: '#8e9297' }}
                                title={`Editar roles de ${nameOf(user_id)}`}
                                onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                            >
                                <Pencil size={13} />
                            </button>
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
                />
            )}
        </div>
    );
};
