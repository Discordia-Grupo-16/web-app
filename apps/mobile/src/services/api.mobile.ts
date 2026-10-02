import { createApiClient } from '@discordia/api';
import { mobileAuthStorage } from '@/services/auth-storage';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/constants/config';

export const api = createApiClient({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  storage: mobileAuthStorage,
});