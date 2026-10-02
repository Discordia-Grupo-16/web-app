import { createUserService } from '@discordia/api';
import { api } from '@/services/api';

export const userService = createUserService(api);