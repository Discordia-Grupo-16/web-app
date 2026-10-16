import { createApiClient, createAuthService } from '@discordia/api';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/shared/config/env';
import { backofficeAuthStorage } from '@/shared/session/authStorage';

export const api = createApiClient({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT_MS,
    storage: backofficeAuthStorage,
});

export const authService = createAuthService(api);
