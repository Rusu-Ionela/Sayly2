import { Router } from "express";

import { discoveryLimiter, messageSendLimiter, mutationLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

/** Mounted at /matchmaking. Both members also get `flash_quest_updated` over the socket. */
export const matchmakingRouter = Router();

matchmakingRouter.post("/flash-quest", authenticate, mutationLimiter, controller.startQuest);
matchmakingRouter.get("/flash-quest/:id", authenticate, discoveryLimiter, controller.getQuest);
matchmakingRouter.delete("/flash-quest/:id", authenticate, mutationLimiter, controller.leaveQuest);
matchmakingRouter.post("/flash-quest/:id/messages", authenticate, messageSendLimiter, controller.sendMessage);
matchmakingRouter.post("/flash-quest/:id/connect", authenticate, mutationLimiter, controller.chooseToConnect);
