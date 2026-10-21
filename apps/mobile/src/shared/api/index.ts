import {
  createApiClient,
  createAuthService,
  createChannelsService,
  createInvitationsService,
  createRolesService,
  createServersService,
  createUserService,
} from '@discordia/api';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/shared/config/env';
import { mobileAuthStorage } from '@/shared/session/authStorage';
import { sessionExpiry } from '@/shared/session/sessionExpiry';

// Every endpoint is bound here, so any feature can reach any resource without importing another feature.
export const api = createApiClient({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  storage: mobileAuthStorage,
  onSessionExpired: sessionExpiry.notify,
});

export const authService = createAuthService(api);
export const userService = createUserService(api);
export const serversService = createServersService(api);
export const channelsService = createChannelsService(api);
export const rolesService = createRolesService(api);
export const invitationsService = createInvitationsService(api);

// The public profile cache belongs to one session: when the server ends it, the cache ends too.
sessionExpiry.subscribe(() => userService.clearPublicProfiles());
