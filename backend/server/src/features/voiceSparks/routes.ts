import { Router } from "express";

import { messageSendLimiter, mutationLimiter } from "../../infra/limiter/middleware";
import { authenticate } from "../../shared/middleware/authenticate";

import * as controller from "./controller";

/** Mounted at /voicesparks. Audio is uploaded first through POST /media/uploads. */
export const voiceSparksRouter = Router();

voiceSparksRouter.get("/feed", authenticate, controller.getFeed);
voiceSparksRouter.post("/", authenticate, messageSendLimiter, controller.createSpark);
voiceSparksRouter.delete("/:id", authenticate, mutationLimiter, controller.deleteSpark);
