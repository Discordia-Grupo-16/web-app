export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '';
export const API_TIMEOUT_MS: number | undefined = import.meta.env.VITE_API_TIMEOUT_MS
    ? Number(import.meta.env.VITE_API_TIMEOUT_MS)
    : undefined;
