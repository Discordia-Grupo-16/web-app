import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DismissedRejectionStore } from '@discordia/core';

// One key per server: only the last closed rejection matters, a later one has another createdAt.
const keyOf = (serverId: string) => `discordia_dismissed_rejection:${serverId}`;

// AsyncStorage, so a closed rejection stays closed after closing and reopening the app.
export const dismissedRejections: DismissedRejectionStore = {
  get: (serverId) => AsyncStorage.getItem(keyOf(serverId)),
  set: (serverId, createdAt) => AsyncStorage.setItem(keyOf(serverId), createdAt),
};
