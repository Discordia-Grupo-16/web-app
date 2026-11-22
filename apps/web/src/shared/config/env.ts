const host = import.meta.env.VITE_API_HOST;
const port = import.meta.env.VITE_API_PORT;
const urlFromHostPort = host && port ? `http://${host}:${port}` : undefined;

export const API_BASE_URL: string = import.meta.env.VITE_API_URL || urlFromHostPort || '';
export const API_TIMEOUT_MS: number | undefined = import.meta.env.VITE_API_TIMEOUT_MS
    ? Number(import.meta.env.VITE_API_TIMEOUT_MS)
    : undefined;

// Public by design (it ships in the bundle). Empty means the Google button is not shown.
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export const WS_URL: string = import.meta.env.VITE_WS_URL ?? '';
