import {
  createChannelsService,
  createInvitationsService,
  createRolesService,
  createServersService,
} from '@discordia/api';
import { api } from '@/services/api';

export const serversService = createServersService(api);
export const channelsService = createChannelsService(api);
export const rolesService = createRolesService(api);
export const invitationsService = createInvitationsService(api);
