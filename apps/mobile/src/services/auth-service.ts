import { createAuthService } from '@discordia/api';
import { api } from '@/services/api.mobile';

export const authService = createAuthService(api);
