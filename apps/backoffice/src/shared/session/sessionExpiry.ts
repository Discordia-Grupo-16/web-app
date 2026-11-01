import { createSessionExpirySignal } from '@discordia/api';

// One signal for the whole app: the HTTP client (shared/api) notifies it and the AuthProvider listens.
export const sessionExpiry = createSessionExpirySignal();
