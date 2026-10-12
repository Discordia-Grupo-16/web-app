import { useParams } from 'react-router-dom';
import { useAuth } from '@discordia/core';
import { ChannelList } from '@/features/channels';
import { InviteButton } from '@/features/invitations';
import { RolesSection, useRoles } from '@/features/roles';
import { LeaveServerButton, ServerHeader, useServer } from '@/features/servers';

// Second column of the layout: the selected server with its channels and roles.
export const ServerPanel = () => {
    const { serverId, channelId } = useParams();
    const { user } = useAuth();
    const { server, loading: loadingServer, updateChannels } = useServer(serverId, channelId);
    const { roles, loading: loadingRoles, addRole, updateRole } = useRoles(serverId);

    const loading = loadingServer || loadingRoles;
    const isOwner = !!user && server?.owner_id === user.id;

    return (
        <aside
            className="flex flex-col shrink-0 overflow-hidden"
            style={{ width: 240, background: '#2f3136' }}
        >
            <ServerHeader
                title={serverId ? (server?.name ?? '...') : 'Seleccioná un servidor'}
                actions={serverId && <InviteButton serverId={serverId} />}
            />

            <div className="flex-1 overflow-y-auto py-2">
                {loading && (
                    <p className="text-xs px-4 py-2" style={{ color: '#99aab5' }}>Cargando...</p>
                )}
                {serverId && !loading && (
                    <>
                        <ChannelList
                            serverId={serverId}
                            channels={server?.channels ?? []}
                            activeChannelId={channelId}
                            canManage={isOwner}
                            onChannelsChange={updateChannels}
                        />
                        <RolesSection
                            serverId={serverId}
                            roles={roles}
                            canManage={isOwner}
                            onRoleCreated={addRole}
                            onRoleUpdated={updateRole}
                        />
                    </>
                )}
            </div>

            {serverId && !isOwner && <LeaveServerButton serverId={serverId} />}
        </aside>
    );
};
