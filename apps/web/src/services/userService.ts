import { createUserService } from "@discordia/api";
import { api } from "./api.web";

export const userService = createUserService(api);
