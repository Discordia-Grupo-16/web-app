import { createAuthService } from '@discordia/services';
import { api } from '@/services/api.mobile';

export const authService = createAuthService(api);
