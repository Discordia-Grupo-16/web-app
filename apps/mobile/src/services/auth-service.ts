import { createAuthService } from '@discordia/api';
import { api } from '@/services/api';

export const authService = createAuthService(api);
