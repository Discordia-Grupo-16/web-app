import {
    createApiClient,
    createAuthService,
    createChannelsService,
    createInvitationsService,
    createMfaService,
    createMembersService,
    createMessagesService,
    createReadStatesService,
    createOwnershipService,
    createRolesService,
    createServersService,
    createUserService,
    createVoiceService,
} from '@discordia/api';
import type { OwnershipTransferSource } from '@discordia/core';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/shared/config/env';
import { webAuthStorage } from '@/shared/session/authStorage';
import { sessionExpiry } from '@/shared/session/sessionExpiry';

// Every endpoint is bound here, so any feature can reach any resource without importing another feature.
export const api = createApiClient({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT_MS,
    storage: webAuthStorage,
    onSessionExpired: sessionExpiry.notify,
});

export const authService = createAuthService(api);
export const mfaService = createMfaService(api);
export const userService = createUserService(api);
export const serversService = createServersService(api);
export const channelsService = createChannelsService(api);
export const rolesService = createRolesService(api);
export const membersService = createMembersService(api);
export const invitationsService = createInvitationsService(api);
export const voiceService = createVoiceService(api);
export const readStatesService = createReadStatesService(api);
export const messagesService = createMessagesService(api);
export const ownershipService = createOwnershipService(api);

// What the ownership hooks of core need: the transfer endpoints plus the servers, to tell a deleted
// server apart and to drop the banners of servers the user is no longer in.
export const ownershipSource: OwnershipTransferSource = {
    ...ownershipService,
    getServer: serversService.getServer,
    getServers: () => serversService.getServers(),
};
