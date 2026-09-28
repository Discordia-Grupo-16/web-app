import { createUserService } from '@discordia/services';
import { api } from '@/services/api.mobile';

export const userService = createUserService(api);