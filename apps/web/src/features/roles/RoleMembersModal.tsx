import { Crown, X } from 'lucide-react';
import { PERMISSION_COPY, authorView, useAuth, usePublicProfiles } from '@discordia/core';
import type { Role, ServerMember } from '@discordia/api';

interface Props {
    role: Role;
    members: ServerMember[];
    ownerId: string | undefined;
    onClose: () => void;
}

/**
 * Lists who holds a role (SCRUM-67).
 *
 * It filters the member list already loaded instead of asking the backend:
 * every member arrives with their roles, so there is nothing to fetch and no
 * second source of truth to keep in step.
 */
export const RoleMembersModal = ({ role, members, ownerId, onClose }: Props) => {
    const { user } = useAuth();
    const withRole = members.filter(member => member.roles.some(r => r.id === role.id));

    // `community` only returns ids: the names are `identity`'s, resolved in one request.
    const profiles = usePublicProfiles(withRole.map(member => member.user_id));

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
                    {PERMISSION_COPY.roleMembersTitle}
                </h2>
                <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                    {role.name} · {PERMISSION_COPY.membersTitle(withRole.length)}
                </p>

                {withRole.length === 0 ? (
                    <p className="text-sm" style={{ color: '#99aab5' }}>
                        {PERMISSION_COPY.noMembersWithRole}
                    </p>
                ) : (
                    <ul className="space-y-1 max-h-80 overflow-y-auto">
                        {withRole.map(({ user_id }) => (
                            <li
                                key={user_id}
                                className="flex items-center gap-2 text-sm py-1.5"
                                style={{ color: '#dcddde' }}
                            >
                                {user_id === ownerId && (
                                    <span
                                        title={PERMISSION_COPY.ownerMark}
                                        style={{ display: 'flex', flexShrink: 0 }}
                                    >
                                        <Crown size={13} style={{ color: '#faa61a' }} />
                                    </span>
                                )}
                                <span className="truncate">
                                    {authorView(user_id, user, profiles.get(user_id)).name}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
