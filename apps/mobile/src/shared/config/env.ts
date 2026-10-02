const host = process.env.EXPO_PUBLIC_API_HOST;
const port = process.env.EXPO_PUBLIC_API_PORT;
const urlFromHostPort = host && port ? `http://${host}:${port}` : undefined;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || urlFromHostPort;
export const API_TIMEOUT_MS = process.env.EXPO_PUBLIC_API_TIMEOUT_MS
  ? Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS)
  : undefined;

export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? '';
