const host = process.env.EXPO_PUBLIC_API_HOST;
const port = process.env.EXPO_PUBLIC_API_PORT;
const urlFromHostPort = host && port ? `http://${host}:${port}` : undefined;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || urlFromHostPort;
export const API_TIMEOUT_MS = process.env.EXPO_PUBLIC_API_TIMEOUT_MS
  ? Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS)
  : undefined;

export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? '';

// Public base URL of the web app, used to build shareable invite links.
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

// OAuth client ID of type "Android" (package + SHA-1 of the EAS keystore). Public, not a secret.
// Empty: the "Continuar con Google" button is hidden and only the email form is left.
export const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
