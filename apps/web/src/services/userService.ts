import { createUserService } from "@discordia/services";
import { api } from "./api.web";

export const userService = createUserService(api);
