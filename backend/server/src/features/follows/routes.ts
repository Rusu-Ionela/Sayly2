import { Router } from "express";

import { mutationLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";
import * as controller from "./controller";

/** Mounted at /follows. */
export const followsRouter = Router();

followsRouter.get("/", authenticate, controller.listFollowing);
followsRouter.put("/:userId", authenticate, mutationLimiter, controller.follow);
followsRouter.delete("/:userId", authenticate, mutationLimiter, controller.unfollow);
