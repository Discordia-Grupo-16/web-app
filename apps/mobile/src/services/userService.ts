import { createUserService } from '@discordia/api';
import { api } from '@/services/api.mobile';

export const userService = createUserService(api);