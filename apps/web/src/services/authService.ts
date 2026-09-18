import { createAuthService } from "@discordia/services";
import { api } from "./api.web.ts";

export const authService = createAuthService(api);
