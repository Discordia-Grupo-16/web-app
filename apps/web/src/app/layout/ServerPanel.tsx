import { useParams } from 'react-router-dom';
import {
    BAN_MEMBERS,
    KICK_MEMBERS,
    MANAGE_CHANNELS,
    MANAGE_ROLES,
    NONE,
    PERMISSION_COPY,
    VIEW_CHANNEL,
    hasPermission,
    useAuth,
} from '@discordia/core';
import { ChannelList } from '@/features/channels';
import { BansSection, MembersSection, useBans, useMembers } from '@/features/members';
import { InviteButton } from '@/features/invitations';
import { RolesSection, useRoles } from '@/features/roles';
import { LeaveServerButton, ServerHeader, useServer } from '@/features/servers';

// Second column of the layout: the selected server with its channels and roles.
export const ServerPanel = () => {
    const { serverId, channelId } = useParams();
    const { user } = useAuth();
    const { server, loading: loadingServer, updateChannels } = useServer(serverId, channelId);
    const { roles, loading: loadingRoles, addRole, updateRole } = useRoles(serverId);
    const { members, loading: loadingMembers, setMemberRoles, removeMember } = useMembers(serverId);

    const loading = loadingServer || loadingRoles || loadingMembers;

    // What the caller can do comes resolved from `community` (ADR-0011). Before it loads, nothing:
    // showing a button that then disappears is worse than showing it one render late.
    const permissions = server?.my_permissions ?? NONE;

    // The same bit bans and revokes (ADR-0011). Without it the hook does not even ask: the list of
    // bans is moderation data and the backend answers 403.
    const canBan = hasPermission(permissions, BAN_MEMBERS);
    const { bans, loading: loadingBans, removeBan, reload: reloadBans } = useBans(serverId, canBan);

    // Leaving is not a permission but a condition: the owner cannot leave their own server, they
    // delete it. That is why this is still an ownership check and not a bit.
    const isOwner = !!user && server?.owner_id === user.id;

    return (
        <aside
            className="flex flex-col shrink-0 overflow-hidden"
            style={{ width: 240, background: '#2f3136' }}
        >
            <ServerHeader
                title={serverId ? (server?.name ?? '...') : 'Seleccioná un servidor'}
                actions={serverId && isOwner && <InviteButton serverId={serverId} />}
            />

            <div className="flex-1 overflow-y-auto py-2">
                {loading && (
                    <p className="text-xs px-4 py-2" style={{ color: '#99aab5' }}>Cargando...</p>
                )}
                {serverId && !loading && !hasPermission(permissions, VIEW_CHANNEL) && (
                    // La lista llega vacía porque `community` no manda los
                    // canales sin VIEW_CHANNEL. Sin este texto, la pantalla no
                    // explica nada.
                    <p className="text-xs px-4 py-2" style={{ color: '#99aab5' }}>
                        {PERMISSION_COPY.noViewChannel}
                    </p>
                )}
                {serverId && !loading && (
                    <>
                        {hasPermission(permissions, VIEW_CHANNEL) && (
                            <ChannelList
                                serverId={serverId}
                                channels={server?.channels ?? []}
                                activeChannelId={channelId}
                                canManage={hasPermission(permissions, MANAGE_CHANNELS)}
                                onChannelsChange={updateChannels}
                            />
                        )}
                        <RolesSection
                            serverId={serverId}
                            roles={roles}
                            canManage={hasPermission(permissions, MANAGE_ROLES)}
                            onRoleCreated={addRole}
                            onRoleUpdated={updateRole}
                        />
                        <MembersSection
                            serverId={serverId}
                            members={members}
                            roles={roles}
                            ownerId={server?.owner_id}
                            canManage={hasPermission(permissions, MANAGE_ROLES)}
                            canKick={hasPermission(permissions, KICK_MEMBERS)}
                            canBan={canBan}
                            onRolesChange={setMemberRoles}
                            onMemberKicked={removeMember}
                            onMemberBanned={userId => {
                                removeMember(userId);
                                // Without this the new ban would only show up with the next poll.
                                reloadBans();
                            }}
                        />
                        {/* Not part of the panel's `loading`: the bans only start loading once the
                            server says the caller has the bit, and hiding every section a second
                            time would blink the panel. The section waits on its own instead. */}
                        {canBan && !loadingBans && (
                            <BansSection
                                serverId={serverId}
                                bans={bans}
                                onBanRevoked={removeBan}
                            />
                        )}
                    </>
                )}
            </div>

            {serverId && !isOwner && <LeaveServerButton serverId={serverId} />}
        </aside>
    );
};
