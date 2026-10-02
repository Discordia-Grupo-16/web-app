import { createAuthService } from "@discordia/api";
import { api } from "./api.web.ts";

export const authService = createAuthService(api);
