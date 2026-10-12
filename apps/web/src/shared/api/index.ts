import {
    createApiClient,
    createAuthService,
    createChannelsService,
    createInvitationsService,
    createMembersService,
    createRolesService,
    createServersService,
    createUserService,
} from '@discordia/api';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/shared/config/env';
import { webAuthStorage } from '@/shared/session/authStorage';

// Every endpoint is bound here, so any feature can reach any resource without importing another feature.
export const api = createApiClient({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT_MS,
    storage: webAuthStorage,
});

export const authService = createAuthService(api);
export const userService = createUserService(api);
export const serversService = createServersService(api);
export const channelsService = createChannelsService(api);
export const rolesService = createRolesService(api);
export const membersService = createMembersService(api);
export const invitationsService = createInvitationsService(api);
