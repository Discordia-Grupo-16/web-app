import { createAdminUserService, createApiClient, createAuthService, createAdminServerService } from '@discordia/api';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/shared/config/env';
import { backofficeAuthStorage } from '@/shared/session/authStorage';
import { sessionExpiry } from '@/shared/session/sessionExpiry';

export const api = createApiClient({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT_MS,
    storage: backofficeAuthStorage,
    onSessionExpired: sessionExpiry.notify,
});

export const authService = createAuthService(api);
export const adminUserService = createAdminUserService(api);
export const adminServerService = createAdminServerService(api);
