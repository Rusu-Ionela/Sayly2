import { Router } from "express";

import { mutationLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

export const notificationsRouter = Router();

notificationsRouter.post("/push-tokens", authenticate, controller.registerPushToken);
notificationsRouter.delete("/push-tokens/:token", authenticate, controller.unregisterPushToken);

notificationsRouter.get("/", authenticate, controller.listInbox);
notificationsRouter.get("/unread-count", authenticate, controller.unreadCount);
notificationsRouter.patch("/read-all", authenticate, mutationLimiter, controller.markAllRead);
notificationsRouter.patch("/:id/read", authenticate, mutationLimiter, controller.markRead);
