import * as Crypto from 'expo-crypto';

// Hermes has no crypto.randomUUID(), so ids come from expo-crypto.
export const newClientMessageId = (): string => Crypto.randomUUID();
