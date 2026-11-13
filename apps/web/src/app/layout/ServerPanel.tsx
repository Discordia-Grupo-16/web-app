import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import type { Channel, ServerMember } from '@discordia/api';
import {
    BAN_MEMBERS,
    KICK_MEMBERS,
    MANAGE_CHANNELS,
    MANAGE_ROLES,
    MANAGE_SERVER,
    NONE,
    OWNERSHIP_TEXTS,
    PERMISSION_COPY,
    VIEW_CHANNEL,
    hasPermission,
    rolesOfMember,
    useAuth,
    useOutgoingOwnershipTransfer,
    usePublicProfiles,
    UNAVAILABLE_USER_NAME,
    useVoice,
    useServerVoiceRoster,
    useVoiceCallParticipants,
    useVoiceRosterViews,
    type RoleDeletionActor,
    type VoiceParticipant,
} from '@discordia/core';
import { voiceService } from '@/shared/api';
import { ChannelList } from '@/features/channels';
import { BansSection, MembersSection, useBans, useMembers } from '@/features/members';
import { InviteButton } from '@/features/invitations';
import { dismissedRejections, OutgoingTransferNotice, TransferOwnershipDialog } from '@/features/ownership';
import { RolesSection, useRoles } from '@/features/roles';
import { EditServerModal, LeaveServerButton, ServerHeader, useCurrentServer } from '@/features/servers';
import { VoiceCallParticipantList, VoiceParticipantList } from '@/features/voice';
import { ownershipSource } from '@/shared/api';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';

const NO_PARTICIPANTS: VoiceParticipant[] = [];

interface ProposeDialogProps {
    toUserId: string;
    serverName: string;
    transfer: ReturnType<typeof useOutgoingOwnershipTransfer>;
    onClose: () => void;
}

// Mounted only while proposing, so the recipient's profile is asked for only then.
const ProposeDialog = ({ toUserId, serverName, transfer, onClose }: ProposeDialogProps) => {
    const profile = usePublicProfiles([toUserId]).get(toUserId);
    const toName =
        profile === undefined ? OWNERSHIP_TEXTS.loadingName : (profile?.name ?? UNAVAILABLE_USER_NAME);

    return (
        <TransferOwnershipDialog
            toName={toName}
            serverName={serverName}
            busy={transfer.busy === 'proposing'}
            error={transfer.error}
            onConfirm={async () => {
                if (await transfer.propose(toUserId)) onClose();
            }}
            onRetry={transfer.retry}
            onClose={() => {
                transfer.dismissError();
                onClose();
            }}
        />
    );
};

// Second column of the layout: the selected server with its channels and roles.
export const ServerPanel = () => {
    const { serverId, channelId } = useParams();
    const { user } = useAuth();
    const { server, loading: loadingServer, updateChannels, updateServer } = useCurrentServer();
      const navigate = useNavigate();
      const [showSettings, setShowSettings] = useState(false);
      const {
          roles,
          loading: loadingRoles,
          addRole,
          updateRole,
          reload: reloadRoles,
          removeRole,
          replaceRoles,
      } = useRoles(serverId);
      const {
          members,
          loading: loadingMembers,
          setMemberRoles,
          removeMember,
          reload: reloadMembers,
      } = useMembers(serverId);

      // What the caller can do comes resolved from `community` (ADR-0011). Before it loads, nothing:
      // showing a button that then disappears is worse than showing it one render late.
      const permissions = server?.my_permissions ?? NONE;

    const { call } = useVoice();
    const callChannelId = call.status === 'connected' ? call.channel.id : null;
    const callParticipants = useVoiceCallParticipants(call.status === 'connected' ? call.participants : NO_PARTICIPANTS);
    // Who is in the other voice channels, without being in the call (SCRUM-54). Without VIEW_CHANNEL
    // the backend answers 403, so the hook gets no server and does not ask.
    const roster = useServerVoiceRoster(
        hasPermission(permissions, VIEW_CHANNEL) ? serverId : undefined,
        voiceService.getServerVoiceParticipants,
    );
    const rosterViews = useVoiceRosterViews(roster);
    // The channel of the call shows LiveKit's list: it is instant and has the mute and who is speaking
    // (W14 and S7). The rest show the roster of `chat`, which does not know who is speaking, only when
    // someone is in it. Another server does not list the call's channel.
    const renderBelowChannel = (channel: Channel) => {
        if (channel.id === callChannelId) return <VoiceCallParticipantList participants={callParticipants} />;
        const connected = rosterViews.get(channel.id);
        return connected?.length ? <VoiceParticipantList participants={connected} /> : null;
    };

    const loading = loadingServer || loadingRoles || loadingMembers;

    // The same bit bans and revokes (ADR-0011). Without it the hook does not even ask: the list of
    // bans is moderation data and the backend answers 403.
    const canBan = hasPermission(permissions, BAN_MEMBERS);
    const {
        bans,
        loading: loadingBans,
        error: bansError,
        removeBan,
        reload: reloadBans,
    } = useBans(serverId, canBan);

    // Leaving is not a permission but a condition: the owner cannot leave their own server, they
    // transfer it or delete it first. That is why this is still an ownership check and not a bit.
    const isOwner = !!user && server?.owner_id === user.id;
    const canManageServer = hasPermission(permissions, MANAGE_SERVER);

    // Only the owner transfers the ownership, whatever its permissions (SCRUM-35).
    const transfer = useOutgoingOwnershipTransfer({
        source: ownershipSource,
        dismissedRejections,
        serverId,
        isOwner,
    });

    // Who deletes a role (SCRUM-64): their own roles come from their row in the member list.
    const roleDeletionActor = useMemo<RoleDeletionActor>(
        () => ({ isOwner, permissions, roles: rolesOfMember(members, user?.id) }),
        [isOwner, permissions, members, user?.id],
    );
    const handleRoleDeleted = (roleId: string) => {
        removeRole(roleId);
        // The role also leaves the roles of every member that had it.
        reloadMembers();
    };
    const handleStale = () => {
        reloadRoles();
        reloadMembers();
    };
    useLiveRefresh({ resources: ['ownershipTransfers'], serverId, refresh: transfer.reload, enabled: isOwner });
    const [proposingTo, setProposingTo] = useState<string | null>(null);
    const membersRef = useRef<HTMLDivElement>(null);

    // The recipient left between opening the list and confirming: the list is out of date.
    const transferError = transfer.error?.kind;
    useEffect(() => {
        if (transferError === 'not-member') reloadMembers();
    }, [transferError, reloadMembers]);

    const pending = transfer.view.kind === 'pending';
    const renderMemberActions = isOwner
        ? (member: ServerMember) =>
              member.user_id === user?.id ? null : (
                  <button
                      onClick={() => setProposingTo(member.user_id)}
                      disabled={pending}
                      className="opacity-0 group-hover/member:opacity-100 transition-opacity p-1 rounded shrink-0"
                      style={{ color: '#8e9297', cursor: pending ? 'not-allowed' : 'pointer' }}
                      title={OWNERSHIP_TEXTS.transfer}
                      aria-label={OWNERSHIP_TEXTS.transfer}
                  >
                      <ArrowRightLeft size={13} />
                  </button>
              )
        : undefined;

    return (
        <aside
            className="flex flex-col shrink-0 overflow-hidden"
            style={{ width: 240, background: '#2f3136' }}
        >
            <ServerHeader
                title={serverId ? (server?.name ?? '...') : 'Seleccioná un servidor'}
                bannerUrl={server?.banner_url}
                iconUrl={server?.avatar_url}
                actions={serverId && (
                    <>
                        {isOwner && <InviteButton serverId={serverId} />}
                        {canManageServer && (
                            <button
                                onClick={() => setShowSettings(true)}
                                title="Configuración del servidor"
                                className="transition-colors"
                                style={{ color: '#99aab5' }}
                            >
                                ⚙
                            </button>
                        )}
                    </>
                )}
            />
            {showSettings && server && (
                <EditServerModal
                    server={server}
                    onClose={() => setShowSettings(false)}
                    onUpdated={updated => { updateServer(updated); setShowSettings(false); }}
                />
            )}

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
                                renderBelowChannel={renderBelowChannel}
                            />
                        )}
                        <RolesSection
                            serverId={serverId}
                            roles={roles}
                            members={members}
                            ownerId={server?.owner_id}
                            canManage={hasPermission(permissions, MANAGE_ROLES)}
                            onRoleCreated={addRole}
                            onRoleUpdated={updateRole}
                            actor={roleDeletionActor}
                            onRoleDeleted={handleRoleDeleted}
                            onRolesReloaded={replaceRoles}
                            onServerGone={() => navigate('/')}
                        />
                        <div ref={membersRef}>
                            <OutgoingTransferNotice
                                view={transfer.view}
                                busy={transfer.busy === 'cancelling'}
                                onCancel={() => void transfer.cancel()}
                                onDismissRejection={transfer.dismissRejection}
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
                                renderMemberActions={renderMemberActions}
                                onStale={handleStale}
                            />
                        </div>
                        {/* Not part of the panel's `loading`: the bans only start loading once the
                            server says the caller has the bit, and hiding every section a second
                            time would blink the panel. The section waits on its own instead. */}
                        {canBan && !loadingBans && (
                            <BansSection
                                serverId={serverId}
                                bans={bans}
                                error={bansError}
                                onBanRevoked={removeBan}
                            />
                        )}
                    </>
                )}
            </div>

            {serverId && (
                <LeaveServerButton
                    serverId={serverId}
                    isOwner={isOwner}
                    pendingTransferTo={transfer.view.kind === 'pending' ? transfer.view.toName : null}
                    onTransferRequested={() => membersRef.current?.scrollIntoView?.({ behavior: 'smooth' })}
                />
            )}

            {serverId && proposingTo && (
                <ProposeDialog
                    toUserId={proposingTo}
                    serverName={server?.name ?? ''}
                    transfer={transfer}
                    onClose={() => setProposingTo(null)}
                />
            )}
        </aside>
    );
};
