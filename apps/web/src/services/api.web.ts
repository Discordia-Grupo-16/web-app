import { createApiClient } from '@discordia/services';
import { webAuthStorage } from './webStorage';

const host = import.meta.env.VITE_API_HOST;
const port = import.meta.env.VITE_API_PORT;
const urlFromHostPort = host && port ? `http://${host}:${port}` : undefined;

export const api = createApiClient({
    baseURL: import.meta.env.VITE_API_URL || urlFromHostPort || '',
    timeout: import.meta.env.VITE_API_TIMEOUT_MS
        ? Number(import.meta.env.VITE_API_TIMEOUT_MS)
        : undefined,
    storage: webAuthStorage,
});